# Hemangi Glam Salon - Flask + MySQL Backend

Python/Flask API that stores users in **MySQL** and powers login, register, and bookings for the React frontend.

## Prerequisites

1. **XAMPP** (or any MySQL server) - start **MySQL** from the XAMPP Control Panel
2. **Python 3.10+** - [python.org](https://www.python.org/downloads/)

## 1. Create the database

Open **phpMyAdmin** (`http://localhost/phpmyadmin`) → **Import** → choose `schema.sql` → **Go**.

Or from a terminal:

```bash
mysql -u root < schema.sql
```

This creates `salon_db` with tables:

| Table | Purpose |
|-------|---------|
| `users` | name, email, hashed password, phone |
| `services` | salon menu (pre-seeded) |
| `appointments` | bookings with double-booking protection |
| `skin_analyses` | saved skin-tone results |

## 2. Configure environment

```bash
cd backend
copy .env.example .env
```

Edit `.env` if your MySQL password is not empty:

```
MYSQL_PASSWORD=your_xampp_password
```

## 3. Install Python dependencies

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

## 4. Run the API server

```bash
python app.py
```

Server runs at **http://localhost:5000**.

Test it:

```bash
curl http://localhost:5000/api/health
```

Expected: `{"ok": true, "database": "connected"}`

## 5. Connect the frontend

The React app already points to `http://localhost:5000` by default.

Start the frontend (from the project root):

```bash
npm run dev
```

Then open the app and use **Register** / **Login** - data is saved in MySQL.

Optional: set a custom API URL in `.env` at the project root:

```
VITE_API_BASE_URL=http://localhost:5000
```

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | DB connectivity check |
| POST | `/api/register` | No | Create account → JWT |
| POST | `/api/login` | No | Login → JWT |
| GET | `/api/slots?date=YYYY-MM-DD` | No | Taken time slots |
| POST | `/api/book` | JWT | Book appointment |
| GET | `/api/my-bookings` | JWT | User's bookings |
| PUT | `/api/bookings/:id` | JWT | Reschedule |
| DELETE | `/api/bookings/:id` | JWT | Cancel booking |
| POST | `/api/chatbot` | No | AI assistant replies |

### Register example

```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Riya\",\"email\":\"riya@example.com\",\"password\":\"secret123\",\"phone\":\"9876543210\"}"
```

### Login example

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"riya@example.com\",\"password\":\"secret123\"}"
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Database error` on startup | Start MySQL in XAMPP; run `schema.sql` |
| `Access denied for user 'root'` | Set `MYSQL_PASSWORD` in `.env` |
| Frontend still uses mock data | Ensure Flask is running on port 5000; check browser console for CORS errors |
| Port 5000 in use | Change `PORT=5001` in `.env` and set `VITE_API_BASE_URL=http://localhost:5001` |

## Security notes (for production)

- Change `JWT_SECRET` to a long random string
- Use a dedicated MySQL user (not `root`)
- Set `FLASK_DEBUG=0`
- Put Flask behind a reverse proxy (nginx) with HTTPS
