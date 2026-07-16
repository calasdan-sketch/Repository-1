# Shopify + AutoDS Dropshipping Automation with Claude AI

An automation layer that connects a **Shopify** store to **AutoDS** (automated
dropshipping) and uses **Claude** (Anthropic API) to generate SEO product
content and score products for viability.

> **Status:** foundational scaffold. Core flows are implemented end-to-end with
> mocked-API tests. AutoDS endpoint paths are placeholders (its public API
> varies by plan) and should be confirmed against your account before going
> live.

## Features

- **Command center (arcade UI)** — a visual "business as a videogame" map: you
  sit at Headquarters in the centre with a branch building for each division
  (Software Development, Error Correction/QA, Social Media, Marketing,
  Operations). Issue orders to divisions, watch their agents, and approve
  purchases / course-altering decisions. Open `http://localhost:3000/` after
  starting the server.
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
| Domain (org map) | `src/domain`        |
| Services         | `src/services`      |
| HTTP routes      | `src/routes`        |
| Jobs / workflows | `src/jobs`          |
| Datastore        | `src/models`        |
| Shared utilities | `src/lib`           |
| Arcade UI        | `public`            |
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

### Command center

Start the server and open `http://localhost:3000/` to see the arcade map. You
(Headquarters) sit in the centre; each surrounding building is a division whose
agents carry out that facet of the business. Click a building to inspect its
agents and issue an order. When an agent proposes a **purchase** or a
**course-altering decision**, it appears under *Pending approvals* and an email
is sent to `OWNER_EMAIL` so you can approve or reject it.

- `OWNER_EMAIL` — address that receives approval requests. When unset, requests
  are still recorded (and visible in the UI) but no email is sent.
- `APPROVALS_FROM_EMAIL` — the from address used on approval notifications.

> The default notifier logs/records messages; wire a real SMTP or email provider
> into `src/services/notifier.ts` to deliver mail in production.

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
| GET    | `/`                              | Arcade command-center UI            |
| GET    | `/api/command-center/organization` | HQ + divisions + agents (org chart) |
| GET    | `/api/command-center/divisions/:id` | A single division and its agents  |
| GET    | `/api/command-center/commands`   | Orders issued from HQ               |
| POST   | `/api/command-center/commands`   | Issue an order to a division        |
| GET    | `/api/command-center/approvals`  | List approvals (optional `?status=`)|
| POST   | `/api/command-center/approvals`  | Escalate a purchase / course change |
| POST   | `/api/command-center/approvals/:id/decision` | Approve or reject an item |
| POST   | `/webhooks/shopify/orders/create`| Shopify order webhook (HMAC-verified) |
| POST   | `/webhooks/shopify/products/update` | Shopify product webhook           |
| POST   | `/webhooks/shopify/app/uninstalled` | App uninstall webhook             |
| GET    | `/admin/store`                   | Display the connected Shopify store |
| GET    | `/admin/products`                | List product mappings               |
| GET    | `/admin/orders`                  | List orders                         |
| GET    | `/admin/ai-content`              | List generated AI content           |
| POST   | `/admin/products/import`         | Import + generate content for a product |
| POST   | `/admin/ai-content/:id/approve`  | Approve staged AI content           |

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
