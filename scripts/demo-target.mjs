#!/usr/bin/env node
// Tiny HTTP server for the API Safety Net demo.
//   pnpm demo:target  →  http://localhost:4000
// Ctrl+C to kill it; the vault oracle will see timeouts and route the breach.

import http from "node:http";

const PORT = Number(process.env.PORT ?? 4000);

http
  .createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  })
  .listen(PORT, () => {
    console.log(`demo target up on http://localhost:${PORT}`);
    console.log("Ctrl+C to simulate the outage.");
  });
