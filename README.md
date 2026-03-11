# Discord Bots Logger

> **Centralized action log aggregator for all Phantom Blade Zero bots.**  
> HTTP API only — no Discord bot. Bots POST logs here; Google Sheets pulls via Apps Script.

---

## Overview

| | |
|---|---|
| **Part of** | Phantom Blade Zero (PBZ) — Discord bot ecosystem |
| **Role** | Log sink: receive events from bots, expose to Google Sheets |
| **Stack** | TypeScript, Express.js, MongoDB |

This service has **no Discord bot** (no token, no slash commands). Other PBZ bots (honorbot-pbz, phantom-melody, pbz-bounty, invite-tracker, Bingo-bot, discord-log-bot) send action logs via `POST /api/logs`. Google Apps Script calls `GET /api/logs` on a schedule and writes rows into a Google Sheet — one tab per bot/category.

---

## Flow

```
honorbot-pbz, phantom-melody, pbz-bounty, … ──► POST /api/logs ──► MongoDB (action_logs)
                                                                        │
Google Apps Script (e.g. every 15 min) ──────► GET /api/logs ◄──────────┘
        │
        ▼
Google Sheet (tabs per bot + category)
```

---

## API

**Auth:** `X-API-Key: <API_KEY>` or `Authorization: Bearer <API_KEY>`.

| Method | Path | Description |
|--------|------|--------------|
| `POST` | `/api/logs` | Receive log entry (botId, category, action, userId, username, details) |
| `GET` | `/api/logs` | Fetch logs (query: botId, category, limit, since) |
| `GET` | `/api/bots` | List botId/category pairs |
| `GET` | `/health` | Health check |

---

## Quick Start

```bash
cp .env.example .env   # MONGO_URI, PORT (3002), API_KEY
npm install && npm run build && npm start
```

**Docker:** Use same network as honor-points-service. Host port **3020** for external access (Google Script).

---

## Google Sheets

1. Create Sheet → Extensions → Apps Script; paste code from `scripts/GoogleAppsScript.gs`.
2. Set `LOGGER_API_URL` = `http://YOUR_VPS_IP:3020`, `LOGGER_API_KEY` = same as `API_KEY`.
3. Logger menu → Create all sheets (first time) → Set auto sync (e.g. every 15 min).

---

## License

ISC
