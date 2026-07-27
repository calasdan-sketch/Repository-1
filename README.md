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
- **System plan endpoint** — expose a machine-readable three-repository business
  operating plan for future agents and maintainers.

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
| GET    | `/admin/system-plan`             | Inspect the multi-repo operating plan |
| POST   | `/admin/products/import`         | Import + generate content for a product |
| POST   | `/admin/ai-content/:id/approve`  | Approve staged AI content           |

## Three-repository operating model

This repository is part of a larger agent-assisted business system spanning
three repositories in the `calasdan-sketch` account:

| Repository | Intended role |
| ---------- | ------------- |
| `calasdan-sketch/Repository-1` | Private operations control plane for sourcing, merchandising, fulfillment, and human review |
| `calasdan-sketch/repository1` | Public AI gateway/product surface used for external adoption and AI provider access |
| `calasdan-sketch/new-repository-` | Public business-ops hub for shared templates, onboarding, and lightweight runbooks |

The admin endpoint `GET /admin/system-plan` returns this split as JSON so future
agents can discover the intended handoffs programmatically before making
changes.

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
