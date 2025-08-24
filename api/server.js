const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors()); // 파일://로 열리는 프론트에서도 호출 가능
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MAX_USERS = parseInt(process.env.MAX_USERS || "3", 10);
const WS_HTTP_URL = process.env.WS_HTTP_URL || "http://localhost:8080";

// 상태/큐
const queue = []; // [userId, ...]
const users = {}; // userId -> { status, route, date, passengers }
const stats = {
  activeUsers: 0,
  maxUsers: MAX_USERS,
  queueLength: 0,
  totalRequests: 0,
  success: 0,
  successRate: "0%",
};

// 웹소켓 서버에 현재 통계 브로드캐스트
async function pushStats() {
  // successRate 계산
  stats.successRate =
    stats.totalRequests > 0
      ? ((stats.success / stats.totalRequests) * 100).toFixed(2) + "%"
      : "0%";
  try {
    await axios.post(`${WS_HTTP_URL}/broadcast`, { stats }, { timeout: 2000 });
  } catch (e) {
    console.error("WS broadcast failed:", e.message);
  }
}

// 1) 예매 요청 → 큐 적재
app.post("/api/book-bus", async (req, res) => {
  const { userId, route, date, passengers } = req.body || {};
  if (!userId)
    return res
      .status(400)
      .json({ status: "error", message: "userId required" });

  users[userId] = { status: "queued", route, date, passengers };
  queue.push(userId);
  stats.totalRequests++;
  stats.queueLength = queue.length;

  await pushStats();
  res.json({ status: "queued", userId });
});

// 2) 유저 상태 조회
app.get("/api/user-status/:userId", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ status: "not_found" });
  res.json(user);
});

// 3) 시스템 현황 조회
app.get("/api/queue-status", (req, res) => {
  res.json(stats);
});

// 내부용: 워커가 잡을 하나 가져감 (동시 처리 제한 고려)
app.post("/_internal/claim-job", async (req, res) => {
  const want = Math.max(1, Math.min(Number(req.body?.count || 1), 50));
  const can = Math.max(0, stats.maxUsers - stats.activeUsers);
  const take = Math.min(want, can, queue.length);
  if (take <= 0) return res.json({ allowed: false, jobs: [] });

  const jobs = [];
  for (let i = 0; i < take; i++) {
    const userId = queue.shift();
    if (!users[userId]) continue;
    users[userId].status = "active";
    stats.activeUsers++;
    jobs.push({ userId });
  }
  stats.queueLength = queue.length;
  await pushStats();
  res.json({ allowed: jobs.length > 0, jobs });
});

// 내부용: 처리 결과 보고 (success/fail)
app.post("/_internal/report-result", async (req, res) => {
  const { userId, success } = req.body || {};
  if (!users[userId])
    return res.status(404).json({ ok: false, message: "user not found" });

  users[userId].status = success ? "completed" : "failed";
  stats.activeUsers = Math.max(0, stats.activeUsers - 1);
  stats.processed = (stats.processed || 0) + 1;
  if (success) stats.success++;

  await pushStats();
  res.json({ ok: true, stats });
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
