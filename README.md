# Mediashare API Platform

NestJS microservices backing the Mediashare phone app. Nx monorepo (Nx 16, NestJS 10, TypeScript) running on **Node 20**, MongoDB (TypeORM), AWS Cognito.

## Services

| Service   | Port | Purpose                                                        |
| --------- | ---- | -------------------------------------------------------------- |
| media-svc | 3000 | media items, playlists, playlist items, sharing, search, admin |
| user-svc  | 3001 | user profiles, connections, invitations, admin user roster     |
| tags-svc  | 3002 | tags / categorization                                          |

Each service is an independent NestJS app under `apps/<svc>/`. Shared code lives under `libs/` (`@mediashare/core`, `@mediashare/shared`, `@mediashare/api-lib`, `@mediashare/utility`). Each service has its own e2e project at `apps/<svc>-e2e/`.

## Related repos

- [bluecollardev/mediashare-source](https://github.com/bluecollardev/mediashare-source) — shared React Native source library (UI, Redux, generated API clients)
- [bluecollardev/mediashare-app](https://github.com/bluecollardev/mediashare-app) — the phone app wrapper that consumes mediashare-source

## Prerequisites

- **Node 20.x** (use nvm / fnm — `engines.node` is pinned)
- npm 10+
- Docker / Docker Compose
- MongoDB (run via Docker — see _Run locally (Docker)_ below)
- mkcert (`brew install mkcert` + `mkcert -install`) for local SSL certs

## First-time setup

```shell
npm install
npm run gen:certs    # writes ./certs/{key.pem,cert.pem} for localhost / 127.0.0.1 / 0.0.0.0
```

## Run locally (host node)

```shell
npm run serve
# fan-out: npm run user-svc:serve & npm run media-svc:serve & npm run tags-svc:serve
```

Or service-by-service:

```shell
npm run media-svc:serve   # PORT=3000  +  APP_SUBSCRIBER_CONTENT_USER_IDS  +  ADMIN_USER_EMAILS  →  nx serve media-svc
npm run user-svc:serve    # PORT=3001  …
npm run tags-svc:serve    # PORT=3002  …
```

Each service emits its OpenAPI spec on boot (dev only) to `openapi/<svc>.json`.

Production variants (`*-svc:serve:prod`) drop the dev env vars and run `nx serve --env production`.

### Required env

The dev `*-svc:serve` scripts bake in defaults for the two non-secret env vars used by the moderation / subscriber-content features:

- `APP_SUBSCRIBER_CONTENT_USER_IDS=5d8b7b90-83fd-4d04-a59c-589ab6bf71f2` — Cognito sub of the master content user (AFehr) whose public/subscription content is unioned into every subscriber's feed.
- `ADMIN_USER_EMAILS=lucas@bluecollardev.com,Atfehr.pt@gmail.com` — comma-separated whitelist (lowercased on load) used by `AdminGuard` for the admin endpoints.

Secrets (Mongo, Cognito, SES) come from local environment / `.env` and are loaded by `apps/<svc>/src/app/app.configuration.ts`.

### Local URLs

- `https://localhost:3000/api` (media-svc) + Swagger at `/docs`
- `https://localhost:3001/api` (user-svc) + Swagger at `/docs`
- `https://localhost:3002/api` (tags-svc) + Swagger at `/docs`

(macOS Monterey+ — AirPlay Receiver holds `:5000`. Nothing in this project runs there anymore; the old unified service is gone.)

## Run locally (Docker)

```shell
npm run docker:base   # builds the mediashare-base image (rerun whenever Node version changes)
npm run docker        # docker compose up --build (mongo + services)
```

Need just the database?

```shell
npm run docker:db     # spins up mongo + restores ./data/mediashare-backup.tar.gz
```

Per-service docker scripts (used by the compose file):

- `docker:media-svc:development` / `:production`
- `docker:user-svc:development` / `:production`

## Database

```shell
npm run db:backup    # writes data/mediashare-backup.tar.gz and a timestamped copy
npm run db:restore   # restores from data/mediashare-backup.tar.gz (--drop)
```

Schema notes: [`docs/MONGO.md`](docs/MONGO.md), [`docs/ENTITIES.md`](docs/ENTITIES.md).

## OpenAPI client generation

The phone app's TypeScript/RxJS clients are generated from these specs:

1. `apps/<svc>/src/main.ts` writes `openapi/<svc>.json` at startup (`NODE_ENV !== 'production'`).
2. `npm run gen:openapi` runs `openapi-generator-cli generate` per `openapitools.json` → `openapi/clients/<svc>/rxjs-api/`.
3. The generated clients are **manually copied** into `mediashare-source/src/apis/{media-svc,user-svc,tags-svc}/rxjs-api/`. There is no automated sync.

`server.set('etag', false)` is set in every service's `main.ts` so the frontend's RxJS ajax doesn't choke on 304s.

## Seed data

```shell
npm run seed:users   # ts-node scripts/gen-users.script.ts
```

Idempotent. Upserts the AFehr master content user (matching the Cognito sub in `APP_SUBSCRIBER_CONTENT_USER_IDS`) and re-attributes orphaned playlists / media to that sub. Connects via `MONGO_URI` / `MONGO_DB` (defaults `mongodb://localhost:27017` / `mediashare`).

## Tests

```shell
npm test            # nx test (all projects)
npm run test:cov    # with coverage
npm run test:watch
npm run test:debug  # node --inspect-brk -r ts-node/register
```

If you use IntelliJ / WebStorm, run configurations live in `.run/`.

## Lint & format

```shell
npm run lint           # nx workspace-lint + nx lint
npm run format         # nx format:write
npm run format:check
```

`husky install` runs as `prepare`. Pre-commit applies `nx format:write` to staged files.

## Deployment

- **Production**
  - https://user-api.afehrpt.com/api
  - https://media-api.afehrpt.com/api
  - https://tags-api.afehrpt.com/api
- **Dev**
  - https://user-api.dev.afehrpt.com/api
  - https://media-api.dev.afehrpt.com/api
  - https://tags-api.dev.afehrpt.com/api

CI/CD: GitLab pipelines (`.gitlab-ci.yml`), Docker, Kubernetes (DigitalOcean). The legacy Heroku staging/prod URLs are no longer authoritative.

```shell
npm run kube:setup   # doctl auth init + load kubeconfig
```

## Project docs

- [`docs/CHANGES.md`](docs/CHANGES.md) — append-only change log (newest at top)
- [`docs/ENTITIES.md`](docs/ENTITIES.md) — entity / collection reference
- [`docs/MONGO.md`](docs/MONGO.md) — MongoDB notes
- [`docs/NX.md`](docs/NX.md) — Nx workspace notes
