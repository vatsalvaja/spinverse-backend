# SPINVERSE Backend

NestJS + TypeScript + PostgreSQL (Prisma) API.

> **Status: Phases 1-9** (Phase 7: demo wallet & ledger; Phase 8: game history & results; Phase 9: admin dashboard, management APIs and audit log; all below). Foundation (configuration, Prisma/PostgreSQL, global validation/response/error handling, Swagger, health check), authentication & authorization (Phase 2), user management (Phase 3), the game management & catalog (Phase 4), game package management (Phase 5) and the server-authoritative game engine with algorithms for all six launch games (Phase 6). Everything is free **demo credits**: there are no real-money deposits, bets, withdrawals or cashable rewards.

## Requirements

- Node.js **>= 20.19** and npm
- PostgreSQL **14+** (running locally or remotely)

## 1. Install

```bash
cd spinverse-backend
npm install
```

`npm install` also runs `prisma generate` (via `postinstall`) to build the Prisma client.

## 2. Configure environment

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Then edit **`.env`** (never commit it):

| Variable          | Default                 | Description                                         |
| ----------------- | ----------------------- | --------------------------------------------------- |
| `NODE_ENV`        | `development`           | `development`, `production` or `test`               |
| `PORT`            | `4000`                  | HTTP port                                           |
| `API_PREFIX`      | `api/v1`                | Global route prefix                                 |
| `CORS_ORIGINS`    | `http://localhost:3000` | Comma-separated allowed browser origins             |
| `SWAGGER_ENABLED` | `true`                  | Serve Swagger UI (disable in production if desired) |
| `SWAGGER_PATH`    | `docs`                  | URL path of the Swagger UI                          |
| `DATABASE_URL`    | _(required)_            | PostgreSQL connection string                        |
| `JWT_ACCESS_SECRET`  | _(required)_          | Secret signing access tokens (>= 32 chars)          |
| `JWT_REFRESH_SECRET` | _(required)_          | Secret signing refresh tokens (>= 32 chars, different from the access secret) |
| `JWT_ACCESS_EXPIRES_IN`  | `15m`            | Access-token lifetime (`s`, `m`, `h` or `d` suffix)   |
| `JWT_REFRESH_EXPIRES_IN` | `7d`             | Refresh-token lifetime                              |
| `BCRYPT_SALT_ROUNDS`     | `12`             | bcrypt cost factor (10-15)                          |
| `PACKAGE_STORAGE_DIR`    | `./storage/game-packages` | Where uploaded game packages are stored (outside any public folder) |
| `GAME_LAUNCH_EXPIRES_IN` | `4h`             | How long a game launch link stays valid             |

**JWT secrets:** generate two different random values and put them in `.env` (the app refuses to start with the `CHANGE_ME` placeholders):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The app validates these at startup and refuses to boot with a clear message if one is missing or invalid.

## 3. Database configuration — where to enter your credentials

**The only place to enter database credentials is the `DATABASE_URL` line in `.env`.** Nothing is hard-coded elsewhere, and the database is not created by this project.

1. Create an empty PostgreSQL database yourself, for example:

   ```sql
   CREATE DATABASE spinverse;
   ```

2. Put your credentials in `.env`:

   ```env
   DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=public"
   # e.g. postgresql://postgres:mypassword@localhost:5432/spinverse?schema=public
   ```

   URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, `/` → `%2F`).

The same `.env` file is used by both the NestJS app and the Prisma CLI.

## 4. Migrations

The Prisma schema lives in [`prisma/schema.prisma`](prisma/schema.prisma) and the SQL migrations in [`prisma/migrations/`](prisma/migrations). Migrations (applied in order; never edit one that has been applied):

| Migration                          | Adds                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `20261125120000_add_auth_models`   | `users`, `refresh_tokens`, enum `Role` (Phase 2)                            |
| `20261126090000_add_game_catalog`  | `game_categories`, `games` and the game enums (Phase 4; Phase 3 needs no schema change) |
| `20261127090000_add_packages_and_game_engine` | `game_versions`, `game_package_events` (Phase 5); `demo_wallets`, `game_sessions`, `game_rounds` (Phase 6) |
| `20261129090000_add_game_history_and_audit_logs` | `game_rounds.packageVersion` and history indexes (Phase 8); `audit_logs` and the `UNINSTALLED` package event (Phase 9). Hand-written SQL: the audit log is append-only and a settled round can never be changed or deleted |
| `20261128090000_add_wallet_ledger` | `wallet_transactions` and wallet status/totals (Phase 7). Also hand-written SQL: opening ledger entries for wallets that already exist, `CHECK` constraints, and triggers that make the ledger append-only |

**After creating your empty database and filling `.env`, apply them:**

```bash
npm run prisma:migrate:deploy
```

Optionally load the game categories and the six built-in games (idempotent; it never overwrites existing rows):

```bash
npm run prisma:seed
```

Other commands (use `prisma:migrate:dev` when you change the schema during development):

```bash
# Development: create + apply a migration after editing schema.prisma
npm run prisma:migrate:dev -- --name <migration_name>

# Production / CI: apply existing migrations only
npm run prisma:migrate:deploy

# Check which migrations are applied
npm run prisma:migrate:status

# Regenerate the Prisma client (after schema changes)
npm run prisma:generate

# Browse data in a web UI
npm run prisma:studio
```

## 5. Start the backend

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The app connects to PostgreSQL on startup and exits with an error if it cannot (check `DATABASE_URL` and that PostgreSQL is running).

Once running (default port):

| What        | URL                                    |
| ----------- | -------------------------------------- |
| Health API  | `http://localhost:4000/api/v1/health`  |
| Swagger UI  | `http://localhost:4000/docs`           |

## Scripts

| Script                    | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `npm run start:dev`       | Start with file watching                 |
| `npm run build`           | Compile to `dist/`                       |
| `npm run start:prod`      | Run the compiled build                   |
| `npm run typecheck`       | Type-check without emitting              |
| `npm test`                | Compile and run the unit tests (no database needed) |
| `npm run prisma:*`        | Prisma generate / validate / migrate / studio |

## API response format

Every endpoint is wrapped automatically.

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Service is healthy",
  "data": { "status": "ok", "environment": "development", "uptimeSeconds": 42, "checks": { "database": "up" } },
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/v1/health"
}
```

Error (validation errors list field messages in `errors`; unexpected errors never leak internals):

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["email must be an email"],
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/api/v1/example"
}
```

## Project structure

```
spinverse-backend/
├── prisma/
│   ├── schema.prisma              # Datasource, generator, models and enums
│   ├── migrations/                # SQL migrations (append-only)
│   └── seed.js                    # Optional catalog seed
├── docs/game-algorithms/          # Plain-English algorithm document for every game (+ tools/)
├── storage/                       # Uploaded game packages (created at runtime, git-ignored)
└── src/
    ├── main.ts                    # Bootstrap: prefix, CORS, Swagger, listen
    ├── app.module.ts              # Root module; global pipe, interceptor, filter
    ├── config/                    # Env validation, typed app config, Swagger setup
    ├── database/                  # Global PrismaModule + PrismaService
    ├── common/                    # Shared, feature-agnostic code
    │   ├── constants/  decorators/  dto/  filters/
    │   └── enums/  interceptors/  interfaces/  utils/
    └── modules/
        ├── auth/                  # Register, login, tokens, guards (Phase 2)
        ├── users/                 # Profile + admin user management (Phase 3)
        ├── game-categories/       # Category management + player category list (Phase 4)
        ├── games/                 # Admin game management + player catalog (Phase 4)
        ├── game-packages/         # ZIP upload, validation, install/publish/rollback, launch (Phase 5)
        ├── demo-wallet/           # Demo wallet, credit ledger, player + admin wallet APIs (Phase 7)
        ├── game-history/          # Round history, statistics, report queries (Phase 8)
        ├── audit/                 # Admin audit log: @Audit decorator, interceptor, read-only API (Phase 9)
        ├── admin-dashboard/       # Admin dashboard and reports, composed from the modules above (Phase 9)
        ├── game-engine/           # Sessions, rounds, RNG, audit + engines/ (one folder per game) (Phase 6)
        └── health/                # Feature module template
            ├── constants/  dto/  interfaces/
            ├── health.controller.ts   # HTTP layer
            ├── health.service.ts      # Business logic
            ├── health.repository.ts   # Database access (only layer using Prisma)
            └── health.module.ts
```

### Adding a new module (later phases)

Copy the layout of `modules/health/`: controller → service → repository (the only layer that touches `PrismaService`), with DTOs validated by `class-validator`, plus `constants/`, `interfaces/` and a `*.module.ts` registered in `AppModule`. Use `@ApiSuccessResponse(Dto)` and `@ResponseMessage('...')` to document and label responses.

## Authentication (Phase 2)

All endpoints live under `/api/v1/auth` and are documented in Swagger (`/docs`, use the **Authorize** button with the access token).

| Method | Path             | Auth   | Description                                                  |
| ------ | ---------------- | ------ | ------------------------------------------------------------ |
| POST   | `/auth/register` | public | Create a `USER` account and sign in (201)                    |
| POST   | `/auth/login`    | public | Email + password login (200)                                 |
| POST   | `/auth/refresh`  | public | Rotate a refresh token for a new access/refresh pair (200)   |
| POST   | `/auth/logout`   | public | Revoke the session of a refresh token (200, idempotent)      |
| GET    | `/auth/me`       | Bearer | Current user                                                 |

Request examples:

```http
POST /api/v1/auth/register
{ "name": "Jane Doe", "email": "jane@example.com", "password": "Str0ngPassword" }

POST /api/v1/auth/login
{ "email": "jane@example.com", "password": "Str0ngPassword" }

POST /api/v1/auth/refresh      (also POST /api/v1/auth/logout)
{ "refreshToken": "<refresh token>" }

GET /api/v1/auth/me
Authorization: Bearer <access token>
```

Register and login return `data: { user, tokens: { accessToken, refreshToken, tokenType: "Bearer", expiresIn } }`; refresh returns `data: tokens`; logout returns `data: null`.

### How it works

- **Passwords** are hashed with bcrypt (`BCRYPT_SALT_ROUNDS`); the plain text is never stored or returned. Passwords need 8-72 characters with at least one letter and one number.
- **Access tokens** are short-lived JWTs (`sub`, `email`, `role`). **Refresh tokens** are long-lived JWTs signed with a different secret.
- **Only a SHA-256 hash of each refresh token is stored** (`refresh_tokens.tokenHash`). SHA-256 rather than bcrypt is deliberate: the token is high-entropy random data, and bcrypt only reads the first 72 bytes, which for a JWT is the identical header.
- **Rotation:** every `/auth/refresh` revokes the presented token and issues a new one in the same session (`familyId`). Presenting an already-used token is treated as theft and revokes the whole session.
- **Logout** revokes the whole session of the supplied refresh token. Access tokens simply expire (keep `JWT_ACCESS_EXPIRES_IN` short).
- **Errors** use the standard error envelope: wrong email, wrong password and disabled account all return the same `401 Invalid email or password`; duplicate registration returns `409 Email is already registered`; invalid bodies return `400 Validation failed` with an `errors` list.
- Emails are trimmed and lower-cased before they are stored or compared. Clients cannot choose their own role.

### Protecting routes and roles

`AuthModule` is global, so any controller can use the `@Auth()` decorator (access-token guard + Swagger docs):

```ts
@Auth()                         // any signed-in user
@Get('profile')
getProfile(@CurrentUser() user: SafeUser) { ... }

@Auth(Role.ADMIN)               // admins only (403 for everyone else)
@Delete(':id')
remove(...) { ... }
```

The guard re-loads the user from the database on every request, so deactivating an account or changing a role takes effect immediately.

### Creating the first admin

Registration always creates a `USER`. Promote an account manually once it exists:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

### Tests

`npm test` compiles `src/**/*.test.ts` and runs them with Node's built-in test runner using in-memory fakes, so it needs neither a database nor a `.env`. Covered: authentication, the wallet ledger (balances, idempotency, rollback), the wallet services and admin controls, the game-round / wallet integration, game history (scoping, outcomes, statistics), the audit interceptor, the dashboard and daily report, and package availability / uninstall. Not covered yet: the six game engines and the users, catalog and package upload/validation code (Phases 3 to 6).

## User management (Phase 3)

Every list endpoint is paginated with `?page=1&limit=20` (limit max 100) and returns `data: { items, meta: { page, limit, total, totalPages } }`.

**Own profile** (any signed-in user)

| Method | Path             | Description                                                                                       |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/users/profile` | Current user                                                                                      |
| PATCH  | `/users/profile` | Update own display name (`{ "name": "Jane Doe" }`). Role, email and status cannot be changed here. |

**Administration** (role `ADMIN` only)

| Method | Path                          | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/admin/users`                | List users                           |
| GET    | `/admin/users/:id`            | Get a user                           |
| PATCH  | `/admin/users/:id`            | Update `name`, `email` and/or `role` |
| PATCH  | `/admin/users/:id/activate`   | Activate an account                  |
| PATCH  | `/admin/users/:id/deactivate` | Deactivate an account                |

List query parameters: `search` (name or email, case-insensitive), `role` (`USER` / `ADMIN`), `isActive` (`true` / `false`), `sortBy` (`createdAt` default, `name`, `email`, `role`), `sortOrder` (`asc` / `desc`, default `desc`), `page`, `limit`.

Safeguards:

- Responses never contain password hashes.
- Role changes exist only on the admin endpoint. An admin **cannot change their own role or deactivate themselves**, so at least one admin always remains. A `role` field sent to `/users/profile` is rejected (400).
- A deactivated user can no longer log in, refresh or use existing access tokens (the auth guard re-checks the database on every request).
- Changing a user's email to one already in use returns `409`.

## Game management & catalog (Phase 4)

Games are **data, not code**: `gameId` is a unique, immutable slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3-40 characters, the same rule as the game package manifest). Nothing is hard-coded to the six built-in games; add new ones through the API.

**Models** (`prisma/schema.prisma`)

- `GameCategory`: `name` and `slug` (both unique), `description`, `sortOrder`, `isActive`.
- `Game`:
  - metadata: `gameId`, `name`, `description`, `developer`, `category`, `thumbnail` (a reference), `version`, `status`
  - configuration: `visibility`, `featured`, `displayOrder`, `orientation`, `platforms`, `minClientVersion`, free-form `settings` JSON
  - package/publishing fields for later workflows: `builtIn`, `entryPoint`, `packageStatus`, `installedVersion`, `installedAt`, `publishedVersion`, `publishedAt`. These are **read-only in this phase**; the future install and publish workflows will write them.
- Enums: `GameStatus` (`DRAFT`, `ACTIVE`, `DISABLED`), `GameVisibility` (`PUBLIC` listed, `HIDDEN` reachable by game id only, `PRIVATE` admins only), `GameOrientation`, `GamePlatform`, `PackageStatus`.

**Admin - categories** (role `ADMIN`)

| Method | Path                                    | Description                                                                      |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| POST   | `/admin/game-categories`                | Create (`slug` is derived from `name` when omitted)                              |
| GET    | `/admin/game-categories`                | List (`search`, `isActive`, `sortBy`, `sortOrder`, paging)                       |
| GET    | `/admin/game-categories/:id`            | Get one                                                                          |
| PATCH  | `/admin/game-categories/:id`            | Update name, slug, description, sort order                                       |
| PATCH  | `/admin/game-categories/:id/activate`   | Activate                                                                         |
| PATCH  | `/admin/game-categories/:id/deactivate` | Deactivate (its games leave the player catalog; no new games can be assigned)    |

**Admin - games** (role `ADMIN`; `:id` is the game's UUID)

| Method | Path                       | Description                                                                                   |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------- |
| POST   | `/admin/games`             | Create a game in `DRAFT` status                                                               |
| GET    | `/admin/games`             | List (`search`, `status`, `visibility`, `categoryId`, `featured`, `sortBy`, `sortOrder`, paging) |
| GET    | `/admin/games/:id`         | Get one                                                                                       |
| PATCH  | `/admin/games/:id`         | Update name, description, developer, category, thumbnail, version (not `gameId`)              |
| PATCH  | `/admin/games/:id/enable`  | Set status `ACTIVE` (its category must be active)                                             |
| PATCH  | `/admin/games/:id/disable` | Set status `DISABLED`                                                                         |
| GET    | `/admin/games/:id/config`  | Get the configuration                                                                         |
| PATCH  | `/admin/games/:id/config`  | Update the configuration (only fields sent change; `settings` is replaced as a whole, max 16 KB) |

Create example:

```json
POST /api/v1/admin/games
{ "gameId": "dragon-vault", "name": "Dragon Vault", "categoryId": "<category uuid>",
  "description": "Short catalog description", "thumbnail": "assets/thumbnail.webp", "version": "1.0.0" }
```

**Player catalog** (any signed-in user; read-only)

| Method | Path               | Description                                                                                         |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| GET    | `/games`           | `ACTIVE` + `PUBLIC` games in active categories (`search`, `category` slug, `featured`, `sortBy`, `sortOrder`, paging) |
| GET    | `/games/:gameId`   | One game by game ID (`ACTIVE`, and `PUBLIC` or `HIDDEN`); anything else returns 404                  |
| GET    | `/game-categories` | Active categories (paged)                                                                           |

Players only receive catalog fields (no status, settings or package details).

Notes:

- `PATCH` endpoints need at least one field (otherwise 400). Sending `null` for a field that cannot be null is rejected with 400; `thumbnail`, `description`, `developer` and `minClientVersion` can be cleared with `null`.
- `thumbnail` is a **reference** (relative path, asset key or http(s) URL), not an upload.
- `npm run prisma:seed` creates the eight categories and the six built-in games (`pharaohs-fortune`, `atlantis-cascade`, `neon-overdrive`, `skyfall`, `tiger-clash`, `roulette`) from the frontend package manifests. It only creates missing rows.

## Game package management (Phase 5)

A game is playable only when it is **enabled, published and installed**. Packages are the ZIP files built by the frontend's `npm run package`; the server checks them against the same **package contract** (a copy lives in `src/modules/game-packages/constants/package-contract.constants.ts` and must stay equal to the frontend's `package-contract.json`).

### Lifecycle

```
upload ZIP  ->  install  ->  publish  ->  players can launch (if the game is also ACTIVE)
                    |           |
                    |           +-- unpublish (players lose access, files kept)
                    +-- rollback to an earlier installed version
```

| Step | Endpoint (role `ADMIN`, `:id` is the game's UUID) | What it does |
| --- | --- | --- |
| Upload | `POST /admin/games/:id/versions` (multipart: `file`, optional `releaseNotes`) | Validates the ZIP (ZIP format, size, manifest, game id equals this game, version, entry HTML, assets, structure, secret scan) and stores it as a new **UPLOADED** version with its SHA-256 checksum. Invalid package: `422` with the list of problems, nothing stored. A version number can be uploaded **once** (`409` afterwards). |
| List / view | `GET /admin/games/:id/versions`, `GET /admin/games/:id/versions/:versionId` | Version history with checksum, size, manifest, validation result and flags (`isInstalledVersion`, `isPublishedVersion`). |
| Install | `POST /admin/games/:id/versions/:versionId/install` | Re-checks the stored ZIP's checksum, unpacks it safely and makes it the game's **installed version**. Players are not affected yet. |
| Publish | `POST /admin/games/:id/publish` | Players receive the currently installed version. |
| Unpublish | `POST /admin/games/:id/unpublish` | Players can no longer launch; existing launch links stop working. |
| Rollback | `POST /admin/games/:id/rollback` `{ "versionId": "..." }` | Switches the installed version to an earlier installed one; if the game is published, players move to it immediately. |
| Enable / disable | `PATCH /admin/games/:id/enable` / `disable` (Phase 4) | The game's `ACTIVE` / `DISABLED` status. |
| History | `GET /admin/games/:id/package-events` | Who uploaded, installed, published, unpublished or rolled back, and when. |

Package state is also visible on the game (Phase 4 admin responses): `installedVersion`, `publishedVersion`, `packageStatus`, `entryPoint`.

### Launching and protection against bypassing the checks

- `POST /games/:gameId/launch` (any signed-in user) works only when the game is `ACTIVE`, not `PRIVATE`, in an active category, **published**, and the published version is **installed with its files present**. Anything else is the same `404 This game is not available`.
- It returns a short-lived link (`playUrl`, ending in `/`) to load in an iframe. Files are served at `GET /api/v1/play/<launch-token>/...`. The token is bound to the player and to the published version, and **every file request repeats all the checks** (token valid, player still active, game still available, same version), so a package file cannot be reached after the game is disabled, unpublished or rolled back, even with a link that was valid a minute earlier.
- Packages are stored under `PACKAGE_STORAGE_DIR`, which is **never served directly**. Paths are validated against traversal, dot-files are refused, responses are sent with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- Uploads are kept in memory while being validated (up to 250 MB), so size the server accordingly.

## Demo wallet & credits (Phase 7)

Free **demo credits** with **no cash value**. There are no deposits, withdrawals, payment gateways, purchasable credits or cash-outs anywhere in the system. Every player has exactly one wallet; its balance can only change through the server and every change is written to an immutable ledger.

### The wallet lifecycle in plain language

1. **Creation.** When an account is created it gets a wallet right away with **5,000 initial credits** (the amount the existing games start with). If that step ever fails, the wallet is created the first time it is needed. There is never more than one wallet per player, and the starting credits can only be granted once.
2. **Playing.** When a player starts a round, the server checks the bet against the game's rules and takes the **entry cost** from the wallet. The server's game algorithm then decides the result. If it is a win, the **winnings** are added. The entry, the winnings and the round are saved together: either all of it happens or none of it.
3. **Every change leaves a record.** Each credit or debit adds a line to the ledger: what type it was, the amount, the balance before and after, which game and round it came from, and a unique key that stops it being applied twice.
4. **Administrators.** An administrator can add or remove credits for a player. A written reason is required and is stored with the administrator's id. They cannot change their own wallet.
5. **Players** can see only their own balance and history. Nobody can edit or delete a ledger line, and the balance can never go below zero.

### Player API (any signed-in user, own wallet only)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/wallet` | My wallet: balance, total credited, total debited, status |
| GET | `/wallet/balance` | Just the current balance and status |
| GET | `/wallet/transactions` | My history, newest first. Filters: `type`, `direction` (`CREDIT`/`DEBIT`), `from`, `to`, plus `page` / `limit` |

The wallet is **read-only for players**: there is no endpoint (and no request field) through which a client can set or add to a balance. (The Phase 6 `/demo-wallet` routes were replaced by `/wallet`, and the self-service "reset to 5,000" was removed because players may no longer add credits to themselves.)

### Admin API (role `ADMIN`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/wallets` | List wallets. Filters: `search` (player name or e-mail), `status`; sort by `balance`, `totalCredited`, `totalDebited`, `createdAt`, `updatedAt` |
| GET | `/admin/wallets/:userId` | One player's wallet and balance |
| POST | `/admin/wallets/:userId/credit` | Add credits: `{ "amount": 250, "reason": "...", "idempotencyKey": "...", "type": "ADMIN_CREDIT" \| "BONUS_CREDIT" }` |
| POST | `/admin/wallets/:userId/debit` | Take credits: `{ "amount": 50, "reason": "...", "idempotencyKey": "..." }` (refused with 409 if the balance cannot cover it) |
| GET | `/admin/wallet-transactions` | Ledger history across wallets. Filters: `userId`, `type`, `direction`, `gameId`, `from`, `to` |
| GET | `/admin/wallet-stats` | Wallet counts, credits held, total credited / debited, a consistency check (`discrepancy` is 0 when the books balance) and ledger totals per type, optionally for a date range |

Adjustment rules: amount from 0.01 to 1,000,000 with at most 2 decimals; `reason` 5 to 300 characters (mandatory); `idempotencyKey` is optional but recommended (sending the same key again returns the original result with `replayed: true` instead of adjusting twice).

### Ledger transaction types

| Type | Direction | Used for |
| --- | --- | --- |
| `INITIAL_CREDIT` | credit | The starting credits of a new wallet |
| `ADMIN_CREDIT` | credit | An administrator adds credits |
| `BONUS_CREDIT` | credit | A bonus (admin-chosen type, or future promotions) |
| `GAME_WINNING_CREDIT` | credit | Winnings from a round, paid by the game server |
| `GAME_REFUND` | credit | Gives a round's entry cost back (service operation, see below) |
| `ADMIN_DEBIT` | debit | An administrator removes credits |
| `GAME_ENTRY_DEBIT` | debit | The cost of a round |

Each ledger line stores: unique id, user id, wallet id, type, direction, amount (always positive), balance before, balance after, game id, session id and round id (when it comes from play), description, idempotency key, the acting administrator (admin entries) and the creation time.

### How the game runtime uses the wallet

Game rounds post to the ledger **inside the same database transaction** that stores the round (`GameRoundsRepository`): the entry debit (`round:<id>:entry`), any immediate winnings (`round:<id>:win:0`), the session update and the round row are saved together or not at all. Interactive rounds (SKYFALL) pay each later credit with a key that includes the round's version, so a step can never pay twice. Costs and winnings come only from the server's game engines and their validated rules; nothing in a request can set them. If a game fails before the transaction commits (for example an invalid bet or an engine error), nothing was charged. `DemoWalletService.refundGameEntry` can give a round's entry back (once, and only if the round paid nothing).

### Integrity protections

- **No negative balances:** debits are conditional database updates (`balance >= amount`), and the database itself also has `CHECK (balance >= 0)` constraints.
- **Concurrency:** simultaneous operations on one wallet are serialised by the database row lock; balance-before/after are read while that lock is held.
- **Idempotency:** a unique idempotency key per ledger line. A repeated key returns the original line; reusing a key for a different user, type or amount is refused (409).
- **Immutable history:** database triggers reject any `UPDATE` or `DELETE` on `wallet_transactions`, and no API edits or removes entries.
- **Authorization:** player routes use only the signed-in user's id; admin routes require the `ADMIN` role; admins cannot adjust their own wallet; a suspended wallet accepts no credits or debits.
- **Consistency check:** `balance = totalCredited - totalDebited` for every wallet, reported by `/admin/wallet-stats`.

### Not implemented (planned only)

Changing a wallet's status (`ACTIVE` / `SUSPENDED`) is enforced but there is no endpoint to change it yet; no endpoint triggers `GAME_REFUND` yet; there is no scheduled reconciliation job.

## Game engine (Phase 6)

### Architecture

```
game-engine/
├── engines/                      one independent folder per game, no database or HTTP code inside
│   ├── pharaohs-fortune/  atlantis-cascade/  neon-overdrive/
│   ├── skyfall/  tiger-clash/  roulette/
│   ├── shared/                   secure RNG, money helpers, bet validation helpers
│   └── game-engine-list.ts       the one place engines are registered
├── interfaces/game-engine.interface.ts   the contract every engine implements
├── game-engine.registry.ts       finds the engine by the catalog game's gameId
├── game-sessions.*  game-rounds.*  round-lifecycle.service.ts   sessions, rounds, open-round upkeep
└── game-play.controller.ts  game-engines.controller.ts  admin-game-rounds.controller.ts
```

An engine receives a bet, its own carry-over state and a random number generator, and returns a result. It decides everything: random draws, rules, winners and payouts. The surrounding code only validates ownership and balance, stores the result and moves demo credits, all in **one database transaction** per step (stake, payout, session state and round row are saved together or not at all).

**Adding a game (KENO, HI-LO, PACHINKO, ...):** create `engines/<game>/<game>.engine.ts` implementing `GameEngine` (`prepareBet`, `startRound`, and optionally `resolveRound` / `applyAction` for interactive games), add it to `engines/game-engine-list.ts`, and register a catalog game with the same `gameId`. Nothing else changes. Documentation for the new game goes in `docs/game-algorithms/`.

### Anti-tampering

- The client sends only a **bet** or an **action**. Every random draw, rule and payout happens on the server.
- Every round uses a fresh **256-bit seed from the operating system's secure random source**, expanded with HMAC-SHA256 in counter mode and read without modulo bias. The SHA-256 **commitment** of the seed is shown at the start; the seed is revealed after settlement (for Tiger Clash after the session ends, because one shuffle spans several rounds).
- Stakes are taken with a conditional database update (the balance cannot go below zero), sessions and open rounds use **optimistic locking**, and a round row cannot be written twice.
- SKYFALL results are computed from the **server clock**; the crash point is drawn at round start and hidden until the crash.
- Each round stores the engine version, seed, commitment, number of draws, bet, result, private round state, a hash of the session state before it, and the balance before and after.

### Play API (any signed-in user)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/game-engines` | Engines available, with bet limits and options |
| POST | `/games/:gameId/sessions` | Start (or resume) a play session. Needs the game to be launchable. |
| GET | `/game-sessions/:sessionId` | The session, with free-spin state and balance |
| POST | `/game-sessions/:sessionId/close` | End the session (refused while a round is open) |
| POST | `/game-sessions/:sessionId/rounds` | **Play a round** with `{ "bet": { ... } }` |
| GET | `/game-sessions/:sessionId/rounds` | Round history (paged) |
| GET | `/game-sessions/:sessionId/rounds/:roundId` | One round (an open SKYFALL flight is brought up to date) |
| POST | `/game-sessions/:sessionId/rounds/:roundId/actions` | An action in an open round, e.g. SKYFALL `{ "action": { "type": "CASH_OUT", "panel": 0 } }` |
| GET | `/game-sessions/:sessionId/rounds/:roundId/audit` | Seed, commitment, engine version and how to verify (settled rounds) |

Admin (`ADMIN`): `GET /admin/game-rounds` (filter by `gameId`, `userId`, `status`) and `GET /admin/game-rounds/:id` (full audit data, including the game state before the round).

Bet shapes: slots `{ "bet": 50 }` (the allowed amounts are listed by `GET /game-engines`); Tiger Clash `{ "side": "tiger" | "dragon" | "tie", "stake": 100 }`; Roulette `{ "bets": [{ "id": "straight:17", "amount": 10 }, { "id": "red", "amount": 25 }] }`; SKYFALL `{ "panels": [{ "panel": 0, "stake": 100, "autoCashout": 2.5 }] }`.

### The six algorithms

| Game | Algorithm document | Rules taken from the existing game | Assumed (marked in `*.config.ts`) |
| --- | --- | --- | --- |
| Pharaoh's Fortune | [docs](docs/game-algorithms/pharaohs-fortune.md) | grid, 5 paylines, paytable, wild, scatter, free spins, jackpot | symbol chances |
| Atlantis Cascade | [docs](docs/game-algorithms/atlantis-cascade.md) | cluster rules, paytable, cascades, multipliers, free spins, symbol weights | wild/scatter chance, neighbour "clump" |
| Neon Overdrive | [docs](docs/game-algorithms/neon-overdrive.md) | 12 lines, paytable, wild, Hold & Respin, Overdrive, Grand | symbol chances, core values, respin chance |
| SKYFALL | [docs](docs/game-algorithms/skyfall.md) | growth curve, panels, stakes, cash-out and auto cash-out | crash-point distribution (5% edge, 1000x cap) |
| Tiger Clash | [docs](docs/game-algorithms/tiger-clash.md) | everything | nothing |
| Roulette | [docs](docs/game-algorithms/roulette.md) | everything | nothing |

The documents explain each game in plain English with calculated probabilities and examples. **Read their "assumed" sections:** the frontend games only play scripted demo results, so symbol frequencies and the crash distribution are not defined anywhere, and the returns follow directly from the chosen values. The calculators behind the figures are in [`docs/game-algorithms/tools`](docs/game-algorithms/tools).

## Game history & results (Phase 8)

One central history for all six games, built on the records the game runtime already writes. Nothing is stored twice and nothing is recalculated: history only **reads** the rounds (`game_rounds`) and the wallet ledger.

### What a history entry is

- **One entry per round.** A SKYFALL flight with two bets cashed out at different moments is still ONE round: its `payout` grows as each cash-out is paid, and the round's detail lists every wallet credit separately.
- **Fields:** round id, public game id and name, user id, session id, round number, status, outcome, stake (wagered), payout (won), net, balance before/after, start time, settle time and duration, the game-specific `bet` and `result` exactly as stored, and two versions: `engineVersion` (the algorithm) and `packageVersion` (the game package that was published when the round started; new field, `null` only for rounds stored before it existed).
- **Status:** the runtime has two round statuses, `IN_PROGRESS` and `SETTLED` (completed). **There are no stored "failed" or "cancelled" rounds**: a round that fails before it is saved is rolled back with its stake, so nothing is charged and nothing is stored. A refund (ledger `GAME_REFUND`) is shown in the round's wallet entries and counted in the game report.
- **Outcome** (settled rounds only): `WIN` (paid more than staked), `LOSS` (paid less), `EVEN` (paid exactly the stake, which includes a free spin that won nothing).

### Wallet integration

The round detail returns every ledger entry the round caused, with entry debits, winnings and refunds kept apart (`wallet.transactions` and `wallet.summary`), including the idempotency key for admins.

### Player API (own rounds only)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/game-history` | My rounds, newest first. Filters: `gameId` (public game id), `status`, `outcome`, `from`, `to`; sort by `startedAt`, `settledAt`, `stake`, `payout`; paged |
| GET | `/game-history/stats` | Games played, wins, losses, credits wagered and won, net, win rate, biggest payout, and a per-game breakdown (optional `gameId`, `from`, `to`) |
| GET | `/game-history/games/:gameId` | My history for one game (same filters and sorting) |
| GET | `/game-history/:roundId` | One of my rounds with its result and wallet entries (`404` for anyone else's round) |

### Admin API (role `ADMIN`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/game-history` | All players' rounds. Same filters plus `userId`; entries include the player's name and e-mail |
| GET | `/admin/game-history/stats` | Platform-wide statistics (optionally for one user, game or date range) |
| GET | `/admin/game-history/users/:userId` | One player's history |
| GET | `/admin/game-history/games/:gameId` | One game's history |
| GET | `/admin/game-history/:roundId` | Inspect a round: stored bet and result, versions, wallet entries. (The seed and private round state are in `GET /admin/game-rounds/:id`) |

### Integrity

- Results and credit amounts come only from the server's own records; there is no way to submit one.
- **Completed rounds are immutable:** the runtime never updates a settled round, and a database trigger (see the migration) rejects any update or delete of a settled `game_rounds` row.
- Historical winnings are never recalculated from current game settings: they are the stored amounts.
- Package/version information is kept with each round, so history stays accurate after a game is updated or rolled back.

## Admin dashboard, management & audit (Phase 9)

The admin side is a **composition of the existing modules**, not a second implementation: the dashboard and reports read through the users, catalog, history and wallet services and add no data of their own.

### Admin requirement map

| Need | Where it is |
| --- | --- |
| List / search / filter / sort / paginate users, view one user | `GET /admin/users`, `GET /admin/users/:id` (Phase 3) |
| Suspend and reactivate users | `PATCH /admin/users/:id/deactivate` / `activate` (Phase 3; "suspended" = deactivated: cannot log in or play) |
| One player at a glance (registration, wallet, activity, recent items) | `GET /admin/dashboard/users/:userId` (new) |
| A player's game history / wallet and transactions | `GET /admin/game-history/users/:userId` (Phase 8); `GET /admin/wallets/:userId`, `GET /admin/wallet-transactions?userId=` (Phase 7) |
| List games, game details, enable / disable | `GET /admin/games`, `GET /admin/games/:id`, `PATCH /admin/games/:id/enable` / `disable` (Phase 4) |
| Package versions and history, install, publish, unpublish, rollback | `GET /admin/games/:id/versions`, `.../install`, `POST .../publish`, `.../unpublish`, `.../rollback`, `GET .../package-events` (Phase 5) |
| **Uninstall a package** | `POST /admin/games/:id/versions/:versionId/uninstall` (new) |
| **Game availability and installation status** | `GET /admin/games/:id/availability` (new) |
| Wallets, balances, add / deduct credits (reason required), wallet history and statistics, credit circulation and ledger balance | `/admin/wallets...`, `/admin/wallet-transactions`, `/admin/wallet-stats` (Phase 7); also summarised in the dashboard |
| Recent game results | `GET /admin/game-history` (Phase 8) |

### New admin APIs (all `ADMIN` only)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/dashboard` | Users (total / active / suspended / by role / new in 7 and 30 days), games (registered / installed / published / unpublished / disabled), sessions and completed rounds, credits wagered and won, credits in circulation and whether the ledger balances, per-game activity, and the latest registrations, game activity and wallet transactions |
| GET | `/admin/dashboard/users/:userId` | One player: account and registration, wallet, play activity and statistics, recent rounds and transactions |
| GET | `/admin/reports/games` | Per game: rounds (completed / in progress / refunded), different players, wagered, won, net and observed return. Optional `from` / `to` |
| GET | `/admin/reports/daily` | Per UTC day: rounds, active players, wagered, won, net, new users, wallet credits and debits. Default last 30 days, max 366; optional `gameId` (round columns only) |
| GET | `/admin/reports/user-activity` | Most active players (`sortBy` rounds / wagered / winnings / lastActive, `limit`, optional dates) |
| GET | `/admin/games/:id/availability` | The launch checks (enabled, not private, category active, a version published, installed, files present) and which fail. It uses the same code as the launch endpoint |
| POST | `/admin/games/:id/versions/:versionId/uninstall` | Deletes the unpacked files of an installed version (the ZIP stays). Refused while players receive that version: unpublish first |
| GET | `/admin/audit-logs`, `/admin/audit-logs/:id` | The administrator activity log (filters: `actorId`, `action`, `resourceType`, `resourceId`, `success`, dates) |

### Audit log

Every important admin action is recorded with **who** (admin id), **what** (action), **on what** (resource type and id), **details** (route parameters, the request body with secrets removed, a small result summary), **success or failure** and the **IP address**.

Recorded actions: user update, activation and deactivation; game create, update, enable, disable and configuration; category create, update, activation and deactivation; package upload, install, uninstall, publish, unpublish and rollback; wallet credit and debit.

- Added to a route with one line: `@Audit({ action: AUDIT_ACTIONS.USER_DEACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })`. The `AuditInterceptor` reads the signed-in admin from the request, so no service needed to change.
- Refused or failed attempts (`403`, `409`, server errors) are recorded with `success: false`; plain validation mistakes (`400`, `404`) are not.
- **Protected from tampering:** the repository can only create and read entries, no endpoint edits or deletes them, and a database trigger rejects any `UPDATE` or `DELETE` on `audit_logs`.
- If writing an entry ever fails, the failure is logged but the admin action that already completed is not turned into an error. Wallet adjustments additionally keep their own record (the ledger line holds the reason and the admin id).

### Structure

```
admin-dashboard/   dashboard + reports (composition only: no repository of its own)
audit/             AuditLog model access, @Audit decorator, interceptor, read-only API (global module)
game-history/      round history, statistics, report queries (read-only over game_rounds)
```

## Manual setup for Phases 5 and 6

```bash
npm install                          # also regenerates the Prisma client
npm run prisma:migrate:deploy        # applies all migrations, including 20261127090000 and 20261129090000
npm run prisma:seed                  # optional: categories + the six built-in games (ACTIVE, not yet published)
npm run build && npm test            # build, then the unit tests (no database needed)
npm run start:dev
```

To make a game playable (for example `pharaohs-fortune`) after building packages in the frontend (`npm run package` there):

1. `POST /admin/games/<game uuid>/versions` with the ZIP from the frontend's `packages/` folder.
2. `POST /admin/games/<game uuid>/versions/<version id>/install`.
3. `POST /admin/games/<game uuid>/publish`.
4. Make sure the game is `ACTIVE` (`PATCH /admin/games/<game uuid>/enable`).
5. As a player: `POST /games/pharaohs-fortune/launch` (load `playUrl` in an iframe) and `POST /games/pharaohs-fortune/sessions`, then `POST /game-sessions/<id>/rounds`.

The folder given by `PACKAGE_STORAGE_DIR` is created automatically on the first upload. Make sure the backend may write there and that it is **not** inside a folder your web server exposes.
