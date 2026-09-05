# Smart Salon Management System - Build Plan

Frontend built in Lovable (React + Tailwind on TanStack Start). Backend (Flask) and DB (MySQL) delivered as ready-to-paste code files in the repo for you to run locally under XAMPP + Python.

## 1. Design system (from your uploaded flyers)

Palette extracted from the Hemangi Glam Salon flyers:
- Cream background `#F5EBD7`
- Warm sand `#E8D4A8`
- Gold/tan accent `#B8894C`
- Deep maroon (primary) `#6B1E1E`
- Soft brown text `#3D2A1F`
- White cards `#FFFFFF`

Typography: elegant serif for headings (Playfair Display), clean sans (Inter) for body, script accent (Great Vibes) for the "Glamsalon" wordmark - loaded via `<link>` in `__root.tsx`. Tokens defined in `src/styles.css` under `@theme inline` (oklch), mapped to shadcn semantic tokens so no hardcoded colors in components.

## 2. Routes (TanStack Start, file-based)

```
src/routes/
  __root.tsx           # global head, fonts, nav, footer, chatbot mount
  index.tsx            # Hero + featured services + CTA
  services.tsx         # Full service menu from the flyers
  book.tsx             # Booking flow (date/time picker, no double-booking)
  login.tsx            # Client login
  register.tsx         # Client registration
  my-bookings.tsx      # List of user's appointments
```

Each route sets its own `head()` (title, description, og:title/description).

## 3. Components

- `Navbar` - logo, links, login/register buttons
- `Hero` - "Smart, error-free salon bookings" with salon imagery
- `ServiceCard` / `ServicesGrid` - categories: Threading, Waxing, Bleach, Cleanup, D-Tan, Manicure & Pedicure, Hair Spa, Hair Cuts, Hair Treatments, Hair Colour, Massage, Facial (all items + prices from your flyers)
- `BookingForm`:
  - Service dropdown
  - Calendar (shadcn `Calendar`) - past dates disabled
  - Time-slot grid (30-min slots 10:00–19:00) - booked slots visually greyed out and unclickable (fetched from `/api/slots?date=...&service_id=...`)
  - Confirmation dialog
- `AuthForm` - shared login/register with zod validation
- `FloatingChatbot` - bottom-right widget "Ask AI Assistant", opens chat panel, posts to `/api/chatbot`, renders replies with markdown

## 4. Backend integration (frontend side)

- `src/lib/api.ts` - single `API_BASE` from `import.meta.env.VITE_API_BASE` (default `http://localhost:5000`), typed `fetch` helpers, JWT stored in `localStorage`, attached as `Authorization: Bearer`.
- All calls target the Flask endpoints below. No Lovable Cloud, no Supabase - matches your XAMPP + Flask stack.

## 5. Backend + DB reference files (checked into repo for you to run locally)

Created at repo root under `backend/` so faculty can see them alongside frontend:

```
backend/
  schema.sql        # CREATE DATABASE salon_db + 3 tables + seed services
  app.py            # Flask app, CORS, MySQL, bcrypt, JWT, endpoints
  chatbot.py        # NLP keyword extractor (services + date words)
  requirements.txt  # flask, flask-cors, mysql-connector-python, bcrypt, pyjwt
  README.md         # XAMPP + venv + run instructions
```

Endpoints:
- `POST /api/register` - hash password (bcrypt), insert into `users`
- `POST /api/login` - verify, return JWT
- `GET  /api/services` - list services (seeded from your flyers)
- `GET  /api/slots?date=YYYY-MM-DD&service_id=...` - returns taken slots so UI can disable them (prevents double-booking at API + UI level)
- `POST /api/book` - insert appointment with UNIQUE(date,time) guard to reject double-bookings server-side too
- `GET  /api/my-bookings` - JWT-protected
- `POST /api/chatbot` - NLP: detects service keywords ("haircut", "keratin", "facial"…) + date words ("today", "tomorrow", weekday names) via simple regex + a small synonym map; replies with availability using the same slot logic. Structured so you can later swap in an LLM call.

DB tables exactly as requested:
```sql
users(id, name, email UNIQUE, password, phone)
services(id, name, price, description)
appointments(id, user_id FK, service_id FK, date, time, status, UNIQUE(date,time))
```

## 6. Constraints honored

- No payment UI, no card fields, no transaction logic anywhere.
- Code commented in plain language, modular files, small components - easy to explain in a viva.
- Responsive (mobile-first), accessible (labels, focus rings, keyboard nav on time slots).

## 7. Out of scope (confirm if you want added)

- Deploying Flask (kept local per your setup)
- SMS/email notifications
- Admin dashboard for the salon owner

---

Approve to build, or tell me what to change (e.g. add an admin panel, swap chatbot to an LLM via a free API key, etc.).
