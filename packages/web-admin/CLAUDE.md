# Admin Portal

Role-based admin portal with Angular 19 frontend and Express API backed by SQLite.

## Repository Structure

- `web-app/` — Angular 19 frontend
- `api/` — Express REST API with SQLite (better-sqlite3)
  - `api/src/db.js` — Database initialization and seeding
  - `api/src/middleware/auth.js` — JWT authentication + role authorization
  - `api/src/routes/auth.js` — Login, profile, change password
  - `api/src/routes/roles.js` — Role CRUD (admin only)
  - `api/src/routes/users.js` — User CRUD (admin only)
  - `api/src/routes/widgets.js` — Widget CRUD + my-widgets endpoint
  - `api/src/routes/status.js` — System status (admin only)
- `db/` — SQLite schema reference (`init.sql`)
- `bicep/` — Azure Bicep templates (legacy, from prior 3-tier deployment)

## Architecture

```
Browser → Angular SPA (login → dashboard) → Express API → SQLite
```

- **Auth**: JWT tokens (jsonwebtoken + bcryptjs). Token stored in localStorage, sent as Bearer header.
- **Database**: SQLite via better-sqlite3. Schema created at startup. DB file at `api/data/admin.db`.
- **Roles**: Admin can create roles. Each role has configurable widgets (tasks/links).
- **Dashboard**: Each user sees widgets assigned to their role.

## Running Locally

```bash
# API (port 3000)
cd api && npm install && node src/index.js

# Frontend (port 4200, proxies /api to localhost:3000)
cd web-app && npm install && ng serve
```

Default login: `admin` / `admin`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | Public | Login, returns JWT |
| GET | /api/auth/me | Bearer | Current user profile |
| POST | /api/auth/change-password | Bearer | Change own password |
| GET | /api/roles | Admin | List roles |
| POST | /api/roles | Admin | Create role |
| PATCH | /api/roles/:id | Admin | Update role |
| DELETE | /api/roles/:id | Admin | Delete role |
| GET | /api/users | Admin | List users |
| POST | /api/users | Admin | Create user |
| PATCH | /api/users/:id | Admin | Update user |
| DELETE | /api/users/:id | Admin | Delete user |
| GET | /api/my-widgets | Bearer | Widgets for current user's role |
| GET | /api/roles/:roleId/widgets | Admin | Widgets for a role |
| POST | /api/roles/:roleId/widgets | Admin | Add widget to role |
| PATCH | /api/widgets/:id | Admin | Update widget |
| DELETE | /api/widgets/:id | Admin | Delete widget |
| GET | /api/status | Admin | System status |

## Frontend Routes

| Path | Guard | Page |
|------|-------|------|
| /login | Public | Login form |
| /dashboard | authGuard | Role-specific widget dashboard |
| /admin/status | adminGuard | System status metrics |
| /admin/roles | adminGuard | Role management |
| /admin/roles/:roleId/widgets | adminGuard | Widget management per role |
| /admin/users | adminGuard | User management |

## Tech Stack

- **Frontend**: Angular 19, standalone components, signals, reactive forms, lazy-loaded routes
- **Backend**: Express 4.21, better-sqlite3, bcryptjs, jsonwebtoken
- **Database**: SQLite (WAL mode, foreign keys enabled)
