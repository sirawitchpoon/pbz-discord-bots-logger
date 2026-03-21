<p align="center">
  <strong>Discord Bots Logger</strong>
</p>
<p align="center">
  <em>Centralized action log aggregator for all Phantom Blade Zero bots.</em>
</p>
<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js" alt="Node" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript" /></a>
  <img src="https://img.shields.io/badge/license-ISC-green" alt="License" />
  <img src="https://img.shields.io/badge/Phantom%20Blade%20Zero-PBZ%20Ecosystem-8b0000" alt="PBZ" />
</p>

---

HTTP API only — **no Discord bot**. Other PBZ bots POST logs here; Google Sheets pulls via Apps Script. One sink, one place to analyze.

## 📋 Overview

| | |
|---|---|
| **Part of** | Phantom Blade Zero (PBZ) — Discord bot ecosystem |
| **Role** | Log sink: receive events from bots, expose to Google Sheets |
| **Stack** | TypeScript, Express.js, MongoDB |

---

## 🔄 Flow

```
honorbot-pbz, phantom-melody, pbz-bounty,
wuxia-bobozan (shadow_duel), invite-tracker (invite), …
        ──► POST /api/logs ──► MongoDB (action_logs)
                                        │
Google Apps Script (e.g. every 15 min) ──────► GET /api/logs ◄─────────┘
        │
        ▼
Google Sheet (tabs per bot + category)
```

**Notable `botId` / `category` pairs:** `wuxia-bobozan` + `shadow_duel` (match/settlement analytics); `invite-tracker` + `invite` (`generate_link`, `invite_success` with honor reward fields).

---

## 📡 API

**Auth:** `X-API-Key: <API_KEY>` or `Authorization: Bearer <API_KEY>`.

| Method | Path | Description |
|--------|------|--------------|
| `POST` | `/api/logs` | Receive log entry (botId, category, action, userId, username, details) |
| `GET` | `/api/logs` | Fetch logs (query: botId, category, limit, since) |
| `GET` | `/api/bots` | List botId/category pairs |
| `GET` | `/health` | Health check |

---

## 🚀 Quick Start

```bash
cp .env.example .env   # MONGO_URI, PORT (3002), API_KEY
npm install && npm run build && npm start
```

**Docker:** Use same network as honor-points-service. Host port **3020** for external access (Google Script).

---

## 📊 Google Sheets

1. Create Sheet → **Extensions** → **Apps Script**; paste code from `scripts/GoogleAppsScript.gs`.
2. **Script Properties**: **Project Settings** (gear) → **Script properties** → add `LOGGER_API_URL` = `http://YOUR_VPS_IP:3020`, `LOGGER_API_KEY` = same as logger `API_KEY`. The URL must be reachable from the internet (Google’s servers call it).
3. Logger menu → **Create all sheets** (first time) → **Set auto sync** (e.g. every 15 min).
4. If Sync doesn’t update: run **Test connection (newest log)** to see if the API is reachable and what the newest log time is. Check Index sheet after Sync for “Fetched N logs; newest in API: …” to confirm whether the API returned recent data.

---

## 📄 License

ISC · Part of the **Phantom Blade Zero** community ecosystem.
