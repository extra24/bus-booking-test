const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

let stats = {
  activeUsers: 0,
  maxUsers: 3,
  queueLength: 0,
  totalRequests: 0,
  success: 0,
  successRate: "0%",
};

const app = express();
app.use(cors());
app.use(express.json());

// HTTP로 현재 통계 조회
app.get("/stats", (req, res) => res.json(stats));

// HTTP로 통계 값을 통째로 덮어쓰기(소스 오브 트루스: API 서버)
app.post("/broadcast", (req, res) => {
  const incoming = req.body?.stats || {};
  stats = { ...stats, ...incoming };
  stats.successRate =
    stats.processed > 0
      ? ((stats.success / stats.processed) * 100).toFixed(2) + "%"
      : "0%";
  broadcast();
  res.json({ ok: true, stats });
});

const server = app.listen(PORT, () =>
  console.log(`WebSocket+HTTP server on http://localhost:${PORT}`)
);

// WebSocket 브로드캐스트
const wss = new WebSocket.Server({ server });

function broadcast() {
  const msg = JSON.stringify({ type: "stats", data: stats });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}
