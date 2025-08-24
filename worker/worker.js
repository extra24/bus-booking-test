const axios = require("axios");
const API_BASE = process.env.API_BASE || "http://localhost:3000";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "4", 10); // 컨테이너당 슬롯

async function processOne(userId) {
  // 처리시간 단축(데모)
  const ms = 100 + Math.floor(Math.random() * 200);
  await new Promise((r) => setTimeout(r, ms));
  const success = Math.random() > 0.2;
  await axios.post(
    `${API_BASE}/_internal/report-result`,
    { userId, success },
    { timeout: 2000 }
  );
}

async function claimAndProcess() {
  try {
    // 남은 슬롯만큼 한 번에 청크로 요청
    const claim = await axios.post(
      `${API_BASE}/_internal/claim-job`,
      { count: CONCURRENCY },
      { timeout: 2000 }
    );
    const jobs = (claim.data && claim.data.jobs) || [];
    if (jobs.length > 0) {
      // 병렬 처리
      await Promise.all(jobs.map((j) => processOne(j.userId)));
    }
  } catch (e) {
    console.error("worker error:", e.message);
  }
}

async function loop() {
  await claimAndProcess();
  setTimeout(loop, 100);
}

console.log("Worker started with CONCURRENCY =", CONCURRENCY);
loop();
