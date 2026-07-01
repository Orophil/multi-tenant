# Multi-Tenant Feature Flag Management System

A small SaaS-style feature-flag platform with a **single role-based front-end app** and a **single Node.js backend**.

The system lets:

- A **Super Admin** create and view organizations.
- **Organization Admins** sign up, log in, and manage feature flags scoped to their own organization.
- **End Users** check whether a given feature is enabled for their organization.

> UI does not need to be polished — basic usability is enough. The focus is API design, data modeling, role management, and sensible engineering trade-offs.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | Node.js + Express | REST API, single service |
| Database | PostgreSQL (via `pg` / Prisma) | Production-grade relational DB; runs locally via Docker |
| Auth | Custom JWT + bcrypt | **No** third-party auth providers (Auth0/Firebase/Cognito) |
| Frontend | Next.js (App Router, TypeScript) | 1 role-based Next.js app |

> Constraint compliance: authentication is hand-rolled (password hashing + signed tokens). Super Admin uses static config-based credentials.

---

## 2. System Roles

### 2.1 Super Admin
- Static credentials (from config/env, **not** in the DB).
- Can: **log in**, **create organizations**, **view list of organizations**.

### 2.2 Organization Admin
- Belongs to exactly **one** organization.
- Can: **sign up**, **log in**, **create / update / delete feature flags** for their org only.

### 2.3 End User
- Belongs to exactly **one** organization.
- Can: submit a feature key and learn whether it is **enabled / disabled** for their org.

---

## 3. Application (1 Role-Based Frontend)

A single Next.js app on **http://localhost:3000**. One login leads to a
role-aware dashboard that renders the view matching the signed-in user's role.

### One login
- A single login screen with a toggle: **Organization user** (`/auth/login`) vs
  **Super Admin** (`/auth/super-admin/login`).
- Org users can also **sign up** (email, password, organization name, and a role
  selector: Org Admin or End User).
- The token and user are stored under a single session (`ff_token` / `ff_user`).

### Role-based dashboard views
- **Super Admin** → Organizations view: create an organization and list organizations.
- **Org Admin** → Feature Flags view: create flags, list them, enable/disable, delete.
  All flags scoped to the admin's organization.
- **End User** → Feature Check view: enter a feature key and see whether it is
  **enabled** or **disabled** for their org.

---

## 4. Data Model

Persistent storage of **Organizations, Users, Roles, Feature Flags** in PostgreSQL.

```sql
CREATE TABLE organizations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE   -- 'org_admin' | 'end_user'  (super_admin is config-based)
);

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role_id        INTEGER NOT NULL REFERENCES roles(id),
  org_id         INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  id           SERIAL PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key  TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, feature_key)   -- a key is unique per organization
);
```

**Key decisions**
- Feature flags are **unique per `(org_id, feature_key)`** → same key can exist in different orgs independently.
- Super Admin is **not** a DB user — credentials come from config, keeping the "host" identity separate from tenant data.
- Roles are a lookup table so the model can grow (e.g. add `org_viewer`) without schema changes.

---

## 5. API Design

Base URL: `/api`

### Auth
| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/auth/super-admin/login` | — | Super Admin login (static creds) → JWT |
| POST | `/auth/signup` | — | Org Admin / End User signup → JWT |
| POST | `/auth/login` | — | Org Admin / End User login → JWT |

### Organizations
| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/organizations` | Super Admin | Create organization |
| GET | `/organizations` | Super Admin | List organizations |

### Feature Flags
| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/flags` | Org Admin | Create flag for own org |
| GET | `/flags` | Org Admin | List flags for own org |
| PATCH | `/flags/:id` | Org Admin | Enable/disable or update flag |
| DELETE | `/flags/:id` | Org Admin | Delete flag |
| POST | `/flags/check` | End User | `{ feature_key }` → `{ enabled: true/false }` for caller's org |

**Authorization rules**
- JWT carries `userId`, `role`, `orgId`.
- Middleware enforces role per route and **forces `org_id` scoping** from the token — a request body cannot override which org it touches.
- Super Admin token has no `orgId` and is rejected from flag routes.

---

## 6. Auth Flow (Custom)

1. Signup → validate input → `bcrypt.hash(password)` → store user with role + org.
2. Login → look up by email → `bcrypt.compare` → issue **JWT** signed with server secret (`exp` set).
3. Protected routes → `Authorization: Bearer <token>` → verify signature → attach `req.user`.
4. Role middleware (`requireRole('org_admin')`, etc.) gates each endpoint.

---

## 7. Project Structure

```
testapp4/
├── README.md
├── docker-compose.yml          # local PostgreSQL
├── backend/
│   ├── src/
│   │   ├── index.js            # express bootstrap
│   │   ├── db.js               # pg pool + migrations/seed
│   │   ├── config.js           # super-admin creds, JWT secret, DB url (env)
│   │   ├── middleware/auth.js  # verify token + requireRole
│   │   ├── routes/auth.js
│   │   ├── routes/organizations.js
│   │   └── routes/flags.js
│   └── package.json
└── frontend/                    # single role-based Next.js app (port 3000)
    ├── app/
    │   ├── page.tsx             # redirects to /dashboard or /login
    │   ├── login/page.tsx       # one login (org user | super admin toggle)
    │   ├── signup/page.tsx      # org user signup (role selector)
    │   └── dashboard/page.tsx   # protected; renders the role-correct view
    ├── components/              # Nav + SuperAdminView / OrgAdminView / EndUserView
    └── lib/                     # api.ts (fetch wrapper) + auth.ts (session)
```

---

## 8. Build Plan / Checklist

- [ ] Scaffold backend (Express, DB, env config)
- [ ] DB schema + migrations + seed roles
- [ ] Custom auth: signup, login, JWT, bcrypt, role middleware
- [ ] Super Admin: login + create/list organizations
- [ ] Org Admin: CRUD feature flags (org-scoped)
- [ ] End User: feature-check endpoint
- [ ] Frontend 1 — Super Admin (login, create/list orgs)
- [ ] Frontend 2 — Admin (signup, login, flag management)
- [ ] Frontend 3 — User (feature-key check form)
- [ ] Seed/sample data + manual test walkthrough
- [ ] README run instructions

---

## 9. Running Locally

> **Database port note:** This environment runs PostgreSQL via **Podman** on host
> port **5544** (the `docker-compose.yml` maps the same `5544:5432`). Port 5544 is
> used so the DB matches the backend `DATABASE_URL` and does not clash with any
> PostgreSQL already listening on the default `5432`.

### Quick start (one command)

```bash
./start-all.sh
```

`start-all.sh` starts the database (tries `docker compose up -d db`, falls back to
a `podman run` of `postgres:16` named `ff-db` on port 5544), runs the backend
migration, then launches the backend and the single frontend in the background and
prints their URLs.

### Manual steps

```bash
# 1. Database (PostgreSQL 16, host port 5544)
docker compose up -d db
#   ...or, if Docker is unavailable, with Podman:
podman run -d --name ff-db \
  -e POSTGRES_USER=ffuser -e POSTGRES_PASSWORD=ffpass -e POSTGRES_DB=featureflags \
  -p 5544:5432 postgres:16

# 2. Backend
cd backend
npm install
cp .env.example .env        # DATABASE_URL already points at localhost:5544
npm run migrate             # create tables + seed roles (required before first run)
npm run dev                 # http://localhost:4000

# 3. Frontend — one role-based Next.js app.
cd frontend
npm install
npm run dev                 # http://localhost:3000
#    Reads NEXT_PUBLIC_API_URL=http://localhost:4000/api from .env.local
```

### Default super admin credentials

The Super Admin is config-based (not stored in the DB). The defaults shipped in
`backend/.env` are:

```
email:    superadmin@example.com
password: SuperSecret123!
```

Use these to log in via the **Super Admin** tab on the login screen
(`http://localhost:3000/login`). Change
`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `backend/.env` before deploying
anywhere real.

### How signup associates a user with an organization

There is **no public "create organization" step during signup**. A user (Org Admin
or End User) signs up by entering the **name of an existing organization**. The
backend looks that organization up by name and links the new user to it. This means
the **Super Admin must create the organization first** (by signing in as Super Admin
at `:3000`) before anyone can sign up against it — if the named org does not exist, the
signup is rejected.

---

## 10. Trade-offs & Assumptions

- **PostgreSQL** for a production-grade relational store with real constraints (FKs, composite `UNIQUE`, cascading deletes); run locally via Docker for zero manual setup.
- **Next.js (App Router) for a single role-based frontend** — one login and one app whose dashboard renders the view matching the signed-in user's role (super admin / org admin / end user), keeping a shared mental model and one deploy lifecycle. Role-gating in the UI is for UX only; the server is the real guard.
- **Super Admin via config** keeps the platform owner out of tenant data and avoids a bootstrap "who creates the first admin" problem.
- **Org scoping enforced server-side** from the JWT (never trusted from the client) is the core multi-tenancy guard.
- **End-User check is a POST** (`/flags/check`) so the feature key isn't logged in URLs and matches the "submit a form" UX.
