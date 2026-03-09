import express, { Request, Response } from "express";
import { config } from "dotenv";
import { resolve } from "path";
import auditHandler from "./api/audit";
import discordHandler from "./api/discord";

config({ path: resolve(process.cwd(), ".env") }); // Load .env

const app = express();
app.use(express.json({ limit: "2mb" }));

// CORS for Figma plugin — reflect origin back so "null" origin (sandboxed iframe) is accepted
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  next();
});

// Status page
app.get("/", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html><html><head>
    <title>Design Auditor — Local API</title>
    <style>
      body { font-family: Inter, -apple-system, sans-serif; background: #0f0f0f; color: #eee;
             display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
      .card { background:#1a1a1a; border:1px solid #333; border-radius:12px; padding:40px 48px;
              max-width:480px; text-align:center; }
      h1 { font-size:22px; font-weight:700; margin-bottom:8px; color:#fff; }
      p { color:#999; font-size:14px; margin-bottom:24px; line-height:1.5; }
      .badge { display:inline-flex; align-items:center; gap:8px; background:#0d2b0d;
               color:#4ade80; border:1px solid #166534; border-radius:20px;
               padding:6px 16px; font-size:13px; font-weight:600; margin-bottom:24px; }
      .dot { width:8px; height:8px; background:#4ade80; border-radius:50%;
             animation: pulse 1.5s ease-in-out infinite; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .endpoints { text-align:left; background:#111; border-radius:8px; padding:16px 20px; }
      .ep { font-size:12px; color:#888; margin-bottom:6px; font-family: monospace; }
      .ep span { color:#5B6AF0; }
    </style>
    </head><body>
    <div class="card">
      <h1>Design Auditor API</h1>
      <p>Local development server is running.<br>Point your Figma plugin to this URL.</p>
      <div class="badge"><div class="dot"></div> Running on port 3000</div>
      <div class="endpoints">
        <div class="ep"><span>POST</span> /api/audit</div>
        <div class="ep"><span>POST</span> /api/discord</div>
      </div>
    </div>
    </body></html>
  `);
});

// API routes — delegate to existing Vercel handlers
app.post("/api/audit", (req: Request, res: Response) =>
  auditHandler(req as any, res as any)
);
app.post("/api/discord", (req: Request, res: Response) =>
  discordHandler(req as any, res as any)
);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Design Auditor API running at http://localhost:${PORT}\n`);
  console.log(`   POST http://localhost:${PORT}/api/audit`);
  console.log(`   POST http://localhost:${PORT}/api/discord\n`);
});
