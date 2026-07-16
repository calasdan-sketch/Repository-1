# Shopify + AutoDS Dropshipping Automation with Claude AI

An automation layer that connects a **Shopify** store to **AutoDS** (automated
dropshipping) and uses **Claude** (Anthropic API) to generate SEO product
content and score products for viability.

> **Status:** foundational scaffold. Core flows are implemented end-to-end with
> mocked-API tests. AutoDS endpoint paths are placeholders (its public API
> varies by plan) and should be confirmed against your account before going
> live.

## Features

- **Shopify integration** — create/update products, manage inventory, read
  orders, create fulfillments, and verify inbound webhooks via HMAC.
- **AutoDS integration** — source products, forward orders for fulfillment, and
  poll for tracking numbers.
- **Claude AI** — generate SEO titles/descriptions/bullets/tags and score
  candidate products, with prompt-hash caching and token accounting.
- **Orchestration** — end-to-end "source → generate → publish → fulfill → sync"
  flow with a **human-in-the-loop** toggle (`AUTO_PUBLISH` / `AUTO_FULFILL`).
- **Scheduler** — recurring tracking-sync job (cron).
- **Admin API** — inspect mappings/orders/AI content, trigger imports, and
  approve staged content.

## Architecture

```
Shopify  ──webhooks──▶  /webhooks/shopify ──▶  Orchestrator ──▶  AutoDS
   ▲                                              │   │
   │ Admin API / fulfillment                      │   └─▶ Claude (content/scoring)
   └──────────────────────────────────────────────┘
                         SQLite datastore (mappings, orders, sync state, AI content)
```

| Layer            | Location            |
| ---------------- | ------------------- |
| Config (env)     | `src/config`        |
| Services         | `src/services`      |
| HTTP routes      | `src/routes`        |
| Jobs / workflows | `src/jobs`          |
| Datastore        | `src/models`        |
| Shared utilities | `src/lib`           |
| Tests            | `tests`             |

## Requirements

- Node.js >= 20
- npm

## Setup

```bash
npm install
cp .env.example .env   # then fill in credentials
```

### Required credentials

| Variable                 | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `SHOPIFY_SHOP`           | Store domain, e.g. `my-store.myshopify.com`              |
| `SHOPIFY_ACCESS_TOKEN`   | Admin API access token from your custom app              |
| `SHOPIFY_WEBHOOK_SECRET` | Secret used to verify inbound webhook HMAC signatures    |
| `AUTODS_API_TOKEN`       | AutoDS API token (plan-dependent)                        |
| `AUTODS_STORE_ID`        | AutoDS store id                                          |
| `ANTHROPIC_API_KEY`      | Anthropic API key for Claude                             |

Secrets are read from environment variables only and must never be committed.

### Automation behaviour

- `AUTO_PUBLISH=false` — AI content is staged for manual approval (recommended).
- `AUTO_FULFILL=false` — orders are recorded but not auto-forwarded to AutoDS.
- `SYNC_CRON` — cron expression for the recurring tracking-sync job.

## Scripts

```bash
npm run dev          # run in watch mode (tsx)
npm run build        # compile TypeScript to dist/
npm start            # run the compiled server
npm test             # run the test suite (vitest)
npm run lint         # eslint
npm run format       # prettier --write
npm run typecheck    # tsc --noEmit
```

## HTTP endpoints

| Method | Path                             | Purpose                             |
| ------ | -------------------------------- | ----------------------------------- |
| GET    | `/health`                        | Liveness probe                      |
| POST   | `/webhooks/shopify/orders/create`| Shopify order webhook (HMAC-verified) |
| POST   | `/webhooks/shopify/products/update` | Shopify product webhook           |
| POST   | `/webhooks/shopify/app/uninstalled` | App uninstall webhook             |
| GET    | `/admin/store`                   | Display the connected Shopify store |
| GET    | `/admin/products`                | List product mappings               |
| GET    | `/admin/orders`                  | List orders                         |
| GET    | `/admin/ai-content`              | List generated AI content           |
| POST   | `/admin/products/import`         | Import + generate content for a product |
| POST   | `/admin/ai-content/:id/approve`  | Approve staged AI content           |

## Stock sell-price alert (Gmail)

A small, self-contained watcher that emails you through Gmail the moment a
ticker (default `JEPQ`) hits a price you want to sell at (default `$31`). It
runs independently of the Shopify/AutoDS server — start it as its own
process.

### Setup

1. Generate a Gmail **app password** (not your normal password): Google
   Account → Security → 2-Step Verification → App passwords →
   https://myaccount.google.com/apppasswords
2. In `.env`, set:

   ```bash
   STOCK_ALERT_TICKER=JEPQ
   STOCK_ALERT_SELL_PRICE=31
   STOCK_ALERT_CRON=*/15 * * * *   # how often to check during market hours
   GMAIL_USER=you@gmail.com
   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   STOCK_ALERT_RECIPIENT_EMAIL=you@gmail.com   # defaults to GMAIL_USER
   ```

### Run

```bash
npm run stock-alert:once   # single check now — good for verifying setup
npm run stock-alert        # loops on STOCK_ALERT_CRON until stopped (Ctrl+C)
```

### Behaviour

- Checks the price only during regular US market hours
  (9:30am–4:00pm America/New_York, weekdays).
- Fetches the current price from Yahoo Finance's public quote endpoint (no
  API key required).
- Sends **one** email the moment the price first reaches the sell target,
  then stays quiet while the price remains at or above it — no repeat spam.
  If the price dips back below the target and later crosses again, you'll
  get a fresh alert. State is persisted in the same SQLite database
  (`stock_alert_state` table).
- To watch it continuously, run `npm run stock-alert` under a process
  supervisor (pm2, systemd, a Docker container, etc.) or a system cron job
  that calls `npm run stock-alert:once` on the interval you want instead.

## Virtual Office (live agent activity dashboard)

A real-time dashboard at `/virtual-office` that shows Claude Code subagents
as employees at their desks — onboarding, active on a task, completed, or
needing attention.

**Important limitation:** this server has no way to observe subagent
activity automatically. It only shows what gets actively reported to it via
the HTTP API below. In practice that means an outer Claude Code agent (or
any script) has to `curl` a `spawn` event when it starts a subagent, `status`
events as it progresses, and a `complete`/`error` event when it finishes.
If nothing reports in, the office just stays empty — that's expected, not a
bug.

### Setup

```bash
# Generate a token; reporting is disabled (503) until this is set.
VIRTUAL_OFFICE_REPORT_TOKEN=$(openssl rand -hex 32)
```

Add it to `.env`, then open `http://localhost:3000/virtual-office` (or
wherever the server is running) while `npm run dev`/`npm start` is up. The
read endpoints (`/virtual-office/`, `/virtual-office/agents`,
`/virtual-office/events`) are unauthenticated — browsers can't send custom
headers over `EventSource`, so this mirrors the existing `/admin/*` routes'
lack of read auth. Only reporting requires the token.

### Reporter contract

```
POST /virtual-office/report
Authorization: Bearer $VIRTUAL_OFFICE_REPORT_TOKEN
Content-Type: application/json
```

| type | required fields | notes |
| --- | --- | --- |
| `spawn` | `id`, `type`, `name` | `role`, `action` optional |
| `status` | `id`, `type`, `action` | updates the current-task line |
| `complete` | `id`, `type` | `action` defaults to "Task complete" |
| `error` | `id`, `type` | `action` defaults to "Task failed" |

```bash
curl -sS -X POST http://localhost:3000/virtual-office/report \
  -H "Authorization: Bearer $VIRTUAL_OFFICE_REPORT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"sub-1721150000-explore","type":"spawn","name":"Recon-1","role":"explore","action":"Mapping the codebase"}'
```

Use a stable `id` per subagent invocation (e.g. `sub-<timestamp>-<slug>`),
and always send a terminal `complete`/`error` event when it finishes —
agents that never report a terminal event are auto-marked "needs attention"
after `VIRTUAL_OFFICE_STALE_AFTER_MS` (default 45 min) as a safety net, not
a substitute for reporting properly. Finished agents disappear from the
board after `VIRTUAL_OFFICE_RETIRE_AFTER_MS` (default 10 min). All state is
in-memory and resets on restart — this is a live-ops view, not a history log.

## Docker

```bash
docker build -t shopify-autods-claude .
docker run --env-file .env -p 3000:3000 shopify-autods-claude
```

## Notes & next steps

- Confirm AutoDS API endpoints/authentication for your plan and adjust
  `src/services/autods.ts` accordingly.
- Add a UI on top of the admin API if a dashboard is desired.
- Register Shopify webhooks pointing at the `/webhooks/shopify/*` endpoints over
  HTTPS.
