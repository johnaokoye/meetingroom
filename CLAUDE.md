# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start everything (first run builds images)
docker compose up --build

# Subsequent runs
docker compose up

# Tear down (keeps the database volume)
docker compose down

# Wipe database and start fresh
docker compose down -v && docker compose up --build
```

Use `docker compose` (no dash) — the old `docker-compose` v1 is broken with the current Docker Engine.

App runs at http://localhost:3004 (frontend) and http://localhost:3002/api (backend).

Hot reload is active for both services — edit files under `backend/src/` or `frontend/src/` and changes apply without rebuilding.

## Architecture

Three Docker services defined in `docker-compose.yml`:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:16-alpine | — | PostgreSQL, data in `pgdata` volume |
| `backend` | node:20-alpine | 3001 | Express REST API |
| `frontend` | node:20-alpine | 3000 | React dev server (proxies `/api/*` → backend) |

### Backend (`backend/src/`)

Express app bootstrapped in `index.js`. On startup it runs `db.js:migrate()`, which creates tables and seeds 4 rooms if they don't exist.

Routes:
- `POST /api/auth/register` / `POST /api/auth/login` — JWT auth (7-day tokens)
- `GET /api/rooms` / `GET /api/rooms/:id` — room listing
- `POST /api/rooms` / `PUT /api/rooms/:id` / `DELETE /api/rooms/:id` — CRUD (admin only)
- `PUT /api/rooms/:id/settings` — update `photo_url`, `theme_color`, `tagline` (admin only)
- `GET /api/bookings?roomId=&start=&end=` — all bookings with optional filters
- `GET /api/bookings/mine` — current user's upcoming bookings (auth required)
- `POST /api/bookings` — create booking; checks for time conflicts before insert
- `POST /api/bookings/:id/checkin` — mark checked-in (only valid while booking is active)
- `DELETE /api/bookings/:id` — cancel own booking
- `GET /api/admin/users` / `PATCH /api/admin/users/:id` / `DELETE /api/admin/users/:id` — user management
- `GET /api/admin/bookings` / `DELETE /api/admin/bookings/:id` — admin booking management

Auth middleware (`middleware/auth.js`) validates the JWT and populates `req.user` with `{ id, email, name, is_admin }`.

Email notifications are sent via nodemailer in `services/email.js`. If `SMTP_HOST` is empty, email is silently skipped — this is intentional so the app works without SMTP configured.

### Frontend (`frontend/src/`)

React 18 app using:
- **react-router-dom v6** — four routes: `/login`, `/register`, `/` (dashboard), `/admin`
- **AuthContext** in `App.jsx` — holds user state and `login`/`logout` helpers; token stored in localStorage
- **axios** in `api.js` — `baseURL: '/api'`, attaches JWT header automatically, redirects to `/login` on 401
- **react-big-calendar** — weekly calendar in `components/RoomCalendar.jsx`; blue events = current user's bookings, grey = others'

Key interaction flow in `pages/Dashboard.jsx`:
1. Select a room from the sidebar → fetches that room's bookings
2. Click empty calendar slot → opens `BookingModal` to create a booking
3. Click your own booking on the calendar → opens `BookingModal` to cancel
4. Sidebar "My Upcoming Bookings" → "View / Cancel" also opens the modal
5. `components/RoomHero.jsx` — hero banner showing the room's photo, theme color, and tagline

Admin panel (`pages/AdminPanel.jsx`) — only accessible to `is_admin` users; three tabs:
- **Rooms** — add/edit/delete rooms (uses `RoomModal` inline component)
- **Bookings** — view all bookings with status badges, cancel any non-past booking
- **Users** — toggle admin status or delete users (cannot modify your own account)

`components/AdminSettings.jsx` — modal accessible from the dashboard (admin only) to set `photo_url`, `theme_color`, and `tagline` for the first room; fires a `room-settings-updated` custom DOM event on save so the hero refreshes.

### Database schema

```sql
users    (id, name, email, password_hash, is_admin, created_at)
rooms    (id, name UNIQUE, capacity, description, photo_url, theme_color, tagline, created_at)
bookings (id, room_id→rooms, user_id→users, title, start_time, end_time, checked_in, checked_in_at, created_at)
```

Overlap prevention is enforced in the application layer (bookings route queries for conflicts before insert).

`db.js:migrate()` runs on every startup. It uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so it is safe to re-run. It also resets room data to a single "Conference Room" on every startup (`DELETE FROM rooms WHERE name != 'Conference Room'`) — **adding rooms in the admin panel is lost on container restart unless this seed logic is changed.** The first registered user is automatically promoted to admin if no admin exists yet.

## Environment variables

Copy `.env.example` to `.env` and edit for production. For development the values are hard-coded in `docker-compose.yml`. Email sending requires setting `SMTP_HOST`; leaving it empty disables email silently.

## Production deployment

The current Dockerfiles use dev servers (nodemon + CRA dev server). For production:
- Backend: change `CMD` to `["node", "src/index.js"]` and remove the nodemon devDependency
- Frontend: use a multi-stage build — `npm run build` in stage 1, then serve the `build/` folder with nginx; add an nginx `location /api/` block that proxies to the backend
