# BrunoPlay admin panel (v4)

Vue 3 + TypeScript + Vite. It talks only to the v4 backend's `/api/admin/*` routes (see `brunoplay-back-v4/docs/API.md`).

## Run

```bash
npm install
npm run dev          # http://localhost:5174, /api is proxied to http://localhost:8080
VITE_BACKEND=http://localhost:8081 npm run dev     # another backend address
npm run build        # type-checks, then writes dist/
```

Production: serve `dist/` from the same domain as the API (for example in the Caddy file: `handle /api/* { reverse_proxy api:8080 }`
and `handle { root * /srv/admin; try_files {path} /index.html; file_server }`), so no CORS setup is needed.
To host it on another domain set `VITE_API_URL=https://api.example.com/api` at build time and add the panel's origin to the API's `CORS_ORIGINS`.

Create the first account on the server: `brunoplay admin-create --email you@example.com --role super` (the password is read from `ADMIN_PASSWORD` or asked for).

## Screens

| Area | Screen | Needs |
|---|---|---|
| Overview | Dashboard: live "needs attention" tiles, players, money, ads, retention | dashboard.read |
| Money | Withdrawals (start paying, complete with hash, reject/return), Top-ups (credit, refund) | withdrawals.*, payments.* |
| Players | List and search, player page (profile, block, holds, note, join bonus, money history, erase data), Risk review, Gift claims (deliver/reject) | players.*, gifts.* |
| Game | Settings (every value, missing view, history), Tasks, Daily combo (patterns and pictures), Tournaments (create, review, disqualify, pay, cancel), Payout guard | settings.*, tasks.*, combo.*, tournaments.* |
| Bot | Broadcasts (draft → test → start/schedule, results), Bot messages (RU/EN templates, delivery stats) | notifications.* |
| System | Ledger check, Audit log, Admins and roles, My account (password) | ledger.read, admins.manage |

The menu shows only what the signed-in role may use (the table is a copy of `internal/admin/rbac.go`; the server enforces it on every request anyway).
Sign-in keeps a short access token and a rotating refresh token in the browser's local storage and renews them silently.

## Verified

`vue-tsc` and `vite build` are clean. All 18 pages were opened in a real browser against the real backend with no console errors or failed requests,
and settings, task, tournament, broadcast-draft and admin creation were exercised through the forms (with the audit log recording them).
Not exercised against real data (the test database was empty): paying a withdrawal, refunding a top-up, delivering a gift, paying a tournament, sending a broadcast.
Those screens use the same request shapes as the backend's own tests, but do one dry run on staging before relying on them.
