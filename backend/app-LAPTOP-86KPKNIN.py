"""
Flask API for Hemangi Glam Salon.
Connects to MySQL (XAMPP) for users, bookings, and salon data.
"""

from __future__ import annotations

import os
import re
import secrets
import string
from datetime import date, datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
import mysql.connector
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from mysql.connector import Error as MySQLError

import cv2
import numpy as np




load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
CORS(app, origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:8080").split(","))

# ---------------------------------------------------------------------------
# Rate limiter - uses client IP; in-memory storage (fine for single-process dev)
# ---------------------------------------------------------------------------
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],          # no global limit; apply per-route
    storage_uri="memory://",
)

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-to-a-long-random-string")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "168"))  # 7 days

MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "salon_db"),
    "autocommit": False,
}


def get_db():
    if "db" not in g:
        g.db = mysql.connector.connect(**MYSQL_CONFIG)
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def db_error(err: MySQLError):
    print(f"[db] {err}")
    return jsonify({"error": "Database error. Check MySQL is running and schema.sql was imported."}), 500


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def make_token(user_id: int) -> str:
    # NOTE: PyJWT 2.x requires 'sub' to be a string, not an integer.
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def user_payload(row: dict) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row.get("role", "USER")}


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        print("\n[require_auth] --- REQUEST ---")
        print("[require_auth] Endpoint:", request.method, request.path)
        header = request.headers.get("Authorization", "")
        print("[require_auth] Auth header:", repr(header[:80]))

        if not header.startswith("Bearer "):
            print("[require_auth] ERROR: No Bearer token")
            return jsonify({"error": "Login required"}), 401
        token = header[7:]
        print("[require_auth] Token[:40]:", token[:40])
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = int(payload["sub"])
            print("[require_auth] Decoded OK, user_id:", user_id)
        except jwt.ExpiredSignatureError:
            print("[require_auth] ERROR: Token EXPIRED")
            return jsonify({"error": "Invalid or expired session. Please login again."}), 401
        except jwt.InvalidTokenError as e:
            print("[require_auth] ERROR: Invalid token -", e)
            return jsonify({"error": "Invalid or expired session. Please login again."}), 401
        except (KeyError, ValueError) as e:
            print("[require_auth] ERROR: Bad payload -", e)
            return jsonify({"error": "Invalid or expired session. Please login again."}), 401

        try:
            cur = get_db().cursor(dictionary=True)
            cur.execute("SELECT id, name, email, role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            cur.close()
            print("[require_auth] DB user:", user)
        except MySQLError as err:
            return db_error(err)

        if not user:
            print("[require_auth] ERROR: User not found for id:", user_id)
            return jsonify({"error": "User not found"}), 401

        print("[require_auth] PASSED for", user["email"])
        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


def require_admin(f):
    """Decorator that checks the user is authenticated AND has role == 'ADMIN'."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        print("\n[require_admin] --- REQUEST ---")
        print("[require_admin] Endpoint:", request.method, request.path)

        header = request.headers.get("Authorization", "")
        print("[require_admin] Auth header:", repr(header[:80]))

        if not header.startswith("Bearer "):
            print("[require_admin] ERROR: No Bearer token")
            return jsonify({"error": "Login required"}), 401

        token = header[7:]
        print("[require_admin] Token[:40]:", token[:40])

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = int(payload["sub"])
            print("[require_admin] Decoded OK, user_id:", user_id, "payload:", payload)
        except jwt.ExpiredSignatureError:
            print("[require_admin] ERROR: Token EXPIRED")
            return jsonify({"error": "Invalid or expired session. Please login again."}), 401
        except jwt.InvalidTokenError as e:
            print("[require_admin] ERROR: Invalid token -", e)
            return jsonify({"error": "Invalid or expired session. Please login again."}), 401
        except (KeyError, ValueError) as e:
            print("[require_admin] ERROR: Bad payload -", e)
            return jsonify({"error": "Invalid or expired session. Please login again."}), 401

        try:
            cur = get_db().cursor(dictionary=True)
            cur.execute("SELECT id, name, email, role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            cur.close()
            print("[require_admin] DB user:", user)
        except MySQLError as err:
            print("[require_admin] ERROR: DB query failed -", err)
            return db_error(err)

        if not user:
            print("[require_admin] ERROR: No user found for id:", user_id)
            return jsonify({"error": "User not found"}), 401

        print("[require_admin] Role in DB:", user.get("role"))
        if user.get("role") != "ADMIN":
            print("[require_admin] ERROR: Role is", user.get("role"), "not ADMIN -> 403")
            return jsonify({"error": "Forbidden: Admin access required"}), 403

        print("[require_admin] PASSED for", user["name"], "-", user["email"])
        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Validation helpers & regexes
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
# Exactly 10 digits; first digit must be 6, 7, 8, or 9 (Indian mobile)
INDIAN_PHONE_RE = re.compile(r"^[6-9]\d{9}$")
# Strong password: 8+ chars, at least one upper, lower, digit, special
STRONG_PW_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?`~]).{8,72}$")


def _strip_phone(raw: str) -> str:
    """Remove all non-digit characters; strip leading '91' or '+91' prefix."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits


def validate_register(data: dict) -> dict | None:
    """Return a dict of {field: error_message} or None if everything is valid."""
    errors: dict[str, str] = {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    phone_raw = (data.get("phone") or "").strip()
    phone = _strip_phone(phone_raw)

    # ── Name ────────────────────────────────────────────────────────────────
    parts = name.split()
    if len(name) < 2 or len(name) > 80:
        errors["name"] = "Full name must be 2–80 characters"
    elif len(parts) < 2:
        errors["name"] = "Please enter your first and last name"

    # ── Email ────────────────────────────────────────────────────────────────
    if not email:
        errors["email"] = "Email address is required"
    elif not EMAIL_RE.match(email) or len(email) > 120:
        errors["email"] = "Enter a valid email address (e.g. you@example.com)"

    # ── Phone ────────────────────────────────────────────────────────────────
    if not phone:
        errors["phone"] = "A valid 10-digit Indian mobile number is required for booking confirmations"
    elif not INDIAN_PHONE_RE.match(phone):
        errors["phone"] = "A valid 10-digit Indian mobile number is required for booking confirmations"

    # ── Password ────────────────────────────────────────────────────────────
    if not password:
        errors["password"] = "Password is required"
    elif len(password) < 8:
        errors["password"] = "Password must be at least 8 characters"
    elif len(password) > 72:
        errors["password"] = "Password must be at most 72 characters"
    elif not STRONG_PW_RE.match(password):
        errors["password"] = (
            "Password must contain at least one uppercase letter, one lowercase letter, "
            "one number, and one special character"
        )

    return errors if errors else None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health():
    try:
        cur = get_db().cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close()
        return jsonify({"ok": True, "database": "connected"})
    except MySQLError as err:
        return db_error(err)


# ---------------------------------------------------------------------------
# Auth - register & login
# ---------------------------------------------------------------------------


@app.post("/api/register")
@limiter.limit("5 per minute")           # IP-based spam protection
def register():
    data = request.get_json(silent=True) or {}
    field_errors = validate_register(data)
    if field_errors:
        return jsonify({"errors": field_errors}), 400

    # Sanitize & normalise
    name  = " ".join(w.capitalize() for w in data["name"].strip().split())  # Title Case
    email = data["email"].strip().lower()
    password = data["password"]
    phone = _strip_phone(data["phone"].strip())   # store clean 10-digit number
    hashed = hash_password(password)

    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute(
            "INSERT INTO users (name, email, password, phone) VALUES (%s, %s, %s, %s)",
            (name, email, hashed, phone),
        )
        user_id = cur.lastrowid
        db.commit()
        cur.execute("SELECT id, name, email, role FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        cur.close()
    except MySQLError as err:
        get_db().rollback()
        if err.errno == 1062:  # duplicate email
            return jsonify({"errors": {"email": "An account with this email already exists"}}), 409
        return db_error(err)

    token = make_token(user["id"])
    return jsonify({"token": token, "user": user_payload(user)}), 201


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        cur = get_db().cursor(dictionary=True)
        cur.execute("SELECT id, name, email, password, role FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
    except MySQLError as err:
        return db_error(err)

    if not user or not check_password(password, user["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    token = make_token(user["id"])
    return jsonify({"token": token, "user": user_payload(user)})


# ---------------------------------------------------------------------------
# Services & booking slots
# ---------------------------------------------------------------------------


@app.get("/api/services")
def list_services():
    try:
        cur = get_db().cursor(dictionary=True)
        cur.execute("SELECT id, name, price, category, description FROM services ORDER BY category, name")
        rows = cur.fetchall()
        cur.close()
        return jsonify({"services": rows})
    except MySQLError as err:
        return db_error(err)


@app.get("/api/slots")
def slots():
    date_str = request.args.get("date", "")
    try:
        slot_date = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "Invalid date. Use YYYY-MM-DD"}), 400

    # Friday (weekday 4) is a closed day — return all slots as taken
    if slot_date.weekday() == 4:
        return jsonify({"taken": [], "closed": True, "message": "We are closed on Fridays."})

    try:
        cur = get_db().cursor(dictionary=True)
        cur.execute(
            "SELECT time FROM appointments WHERE date = %s AND status != 'cancelled'",
            (slot_date,),
        )
        taken = [row["time"] for row in cur.fetchall()]
        cur.close()
        return jsonify({"taken": taken})
    except MySQLError as err:
        return db_error(err)


@app.post("/api/book")
@require_auth
def book():
    data = request.get_json(silent=True) or {}
    service_id = (data.get("service_id") or "").strip()
    date_str = (data.get("date") or "").strip()
    time_str = (data.get("time") or "").strip()

    if not service_id or not date_str or not time_str:
        return jsonify({"error": "service_id, date, and time are required"}), 400

    try:
        slot_date = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400

    if slot_date < date.today():
        return jsonify({"error": "Cannot book a past date"}), 400

    # Friday (weekday 4) is a closed day
    if slot_date.weekday() == 4:
        return jsonify({"error": "We are closed on Fridays. Please choose another day."}), 400

    # Validate time is within working hours: 09:00 – 16:30
    VALID_TIMES = [
        f"{str(h).zfill(2)}:{m}"
        for h in range(9, 17)
        for m in ("00", "30")
        if not (h == 16 and m == "30")  # last slot is 16:30 (5 PM closing)
    ] + ["16:30"]  # explicitly include 16:30
    if time_str not in VALID_TIMES:
        return jsonify({"error": "Booking time must be between 09:00 and 16:30 (salon closes at 5 PM)."}), 400

    try:
        db = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute("SELECT id FROM services WHERE id = %s", (service_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Unknown service"}), 400

        cur.execute(
            "SELECT id FROM appointments WHERE date = %s AND time = %s AND status != 'cancelled'",
            (slot_date, time_str),
        )
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "That time slot is already booked. Pick another."}), 409

        cur.execute(
            "INSERT INTO appointments (user_id, service_id, date, time, status) VALUES (%s, %s, %s, %s, 'confirmed')",
            (g.current_user["id"], service_id, slot_date, time_str),
        )
        booking_id = cur.lastrowid
        db.commit()
        cur.close()
        return jsonify({"id": booking_id}), 201
    except MySQLError as err:
        get_db().rollback()
        if err.errno == 1062:
            return jsonify({"error": "That time slot is already booked. Pick another."}), 409
        return db_error(err)


@app.get("/api/my-bookings")
@require_auth
def my_bookings():
    try:
        cur = get_db().cursor(dictionary=True)
        cur.execute(
            """
            SELECT a.id, s.name AS service_name, a.date, a.time, a.status
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.user_id = %s AND a.status != 'cancelled'
            ORDER BY a.date DESC, a.time DESC
            """,
            (g.current_user["id"],),
        )
        rows = cur.fetchall()
        cur.close()
        for row in rows:
            row["date"] = row["date"].isoformat()
        return jsonify({"bookings": rows})
    except MySQLError as err:
        return db_error(err)


@app.put("/api/bookings/<int:booking_id>")
@require_auth
def update_booking(booking_id: int):
    data = request.get_json(silent=True) or {}
    date_str = (data.get("date") or "").strip()
    time_str = (data.get("time") or "").strip()

    if not date_str or not time_str:
        return jsonify({"error": "date and time are required"}), 400

    try:
        slot_date = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400

    try:
        db = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute(
            "SELECT id FROM appointments WHERE id = %s AND user_id = %s AND status != 'cancelled'",
            (booking_id, g.current_user["id"]),
        )
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Booking not found"}), 404

        cur.execute(
            "SELECT id FROM appointments WHERE date = %s AND time = %s AND id != %s AND status != 'cancelled'",
            (slot_date, time_str, booking_id),
        )
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "That time slot is already booked"}), 409

        cur.execute(
            "UPDATE appointments SET date = %s, time = %s WHERE id = %s",
            (slot_date, time_str, booking_id),
        )
        db.commit()
        cur.close()
        return jsonify({"ok": True})
    except MySQLError as err:
        get_db().rollback()
        if err.errno == 1062:
            return jsonify({"error": "That time slot is already booked"}), 409
        return db_error(err)


@app.delete("/api/bookings/<int:booking_id>")
@require_auth
def cancel_booking(booking_id: int):
    try:
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "UPDATE appointments SET status = 'cancelled' WHERE id = %s AND user_id = %s",
            (booking_id, g.current_user["id"]),
        )
        if cur.rowcount == 0:
            cur.close()
            return jsonify({"error": "Booking not found"}), 404
        db.commit()
        cur.close()
        return jsonify({"ok": True})
    except MySQLError as err:
        get_db().rollback()
        return db_error(err)


# ---------------------------------------------------------------------------
# Skin tone recommendations (matches frontend Palette type)
# ---------------------------------------------------------------------------

PALETTES = {
    "warm": {
        "undertone": "warm",
        "summary": (
            "You have a warm undertone with golden, peachy warmth. "
            "Earthy, sun-kissed shades will make your complexion glow."
        ),
        "hair": [
            {"name": "Honey Caramel", "hex": "#a9743b"},
            {"name": "Warm Chestnut", "hex": "#6b3f21"},
            {"name": "Copper Auburn", "hex": "#b5651d"},
        ],
        "lips": [
            {"name": "Peach Nude", "hex": "#e2a07a"},
            {"name": "Terracotta", "hex": "#c96b52"},
            {"name": "Coral", "hex": "#FF7F50"},
        ],
        "blush": [
            {"name": "Warm Berry", "hex": "#a24a5f"},
            {"name": "Golden Peach", "hex": "#fcccb4"},
            {"name": "Bronze", "hex": "#cd7f32"},
        ],
        "outfits": [
            {"name": "Camel", "hex": "#c19a6b"},
            {"name": "Olive", "hex": "#6b7a3a"},
            {"name": "Rust", "hex": "#b7410e"},
            {"name": "Cream", "hex": "#f3e5c3"},
        ],
        "services": ["Gold Bleach", "Fruit Cleanup", "Gold Facial"],
    },
    "cool": {
        "undertone": "cool",
        "summary": (
            "You have a cool undertone with pink or bluish notes. "
            "Jewel tones and soft pastels will flatter your skin beautifully."
        ),
        "hair": [
            {"name": "Ash Brown", "hex": "#5a4a3f"},
            {"name": "Cool Espresso", "hex": "#3b2a24"},
            {"name": "Platinum Blonde", "hex": "#e5e4e2"},
        ],
        "lips": [
            {"name": "Rose Pink", "hex": "#d97a95"},
            {"name": "Berry Wine", "hex": "#7b2a3d"},
            {"name": "Cherry Red", "hex": "#990000"},
        ],
        "blush": [
            {"name": "Mauve", "hex": "#a76a8a"},
            {"name": "Soft Pink", "hex": "#ffb6c1"},
            {"name": "Cool Plum", "hex": "#8e4585"},
        ],
        "outfits": [
            {"name": "Sapphire", "hex": "#0f52ba"},
            {"name": "Emerald", "hex": "#046a38"},
            {"name": "Icy Lavender", "hex": "#c8b6d6"},
            {"name": "Charcoal", "hex": "#36454f"},
        ],
        "services": ["Herbal / Oxy Bleach", "Diamond Facial", "Whitening Facial"],
    },
    "neutral": {
        "undertone": "neutral",
        "summary": (
            "You have a balanced neutral undertone. "
            "A wide range of colors flatters you - try muted, versatile shades."
        ),
        "hair": [
            {"name": "Natural Brown", "hex": "#6f4e37"},
            {"name": "Soft Mahogany", "hex": "#8b3a3a"},
            {"name": "Warm Black", "hex": "#1c1c1c"},
        ],
        "lips": [
            {"name": "Rosy Nude", "hex": "#c98a8a"},
            {"name": "Dusty Rose", "hex": "#c48b8b"},
            {"name": "Soft Mocha", "hex": "#a38068"},
        ],
        "blush": [
            {"name": "Soft Plum", "hex": "#734f5b"},
            {"name": "Peachy Pink", "hex": "#ffc1cc"},
            {"name": "Tawny", "hex": "#cd5c5c"},
        ],
        "outfits": [
            {"name": "Dusty Blue", "hex": "#6a8caf"},
            {"name": "Blush", "hex": "#dea5a4"},
            {"name": "Sage", "hex": "#9caf88"},
            {"name": "Taupe", "hex": "#8b7d6b"},
        ],
        "services": ["Fruit Cleanup", "O3+ Advance Facial", "Fruit Facial"],
    },
}


@app.get("/api/recommendations")
def recommendations():
    undertone = request.args.get("undertone", "warm")
    if undertone not in PALETTES:
        return jsonify({"error": "undertone must be warm, cool, or neutral"}), 400
    return jsonify(PALETTES[undertone])


@app.post("/api/skin-analysis")
@require_auth
def save_skin_analysis():
    data = request.get_json(silent=True) or {}
    hex_val = (data.get("hex") or "").strip()
    depth = (data.get("depth") or "").strip()
    undertone = (data.get("undertone") or "").strip()

    if undertone not in PALETTES:
        return jsonify({"error": "undertone must be warm, cool, or neutral"}), 400
    if not hex_val or not depth:
        return jsonify({"error": "hex and depth are required"}), 400

    try:
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "INSERT INTO skin_analyses (user_id, hex, depth, undertone) VALUES (%s, %s, %s, %s)",
            (g.current_user["id"], hex_val, depth, undertone),
        )
        analysis_id = cur.lastrowid
        db.commit()
        cur.close()
        return jsonify({"id": analysis_id, **PALETTES[undertone]}), 201
    except MySQLError as err:
        get_db().rollback()
        return db_error(err)


@app.get("/api/skin-analysis")
@require_auth
def list_skin_analyses():
    try:
        cur = get_db().cursor(dictionary=True)
        cur.execute(
            """
            SELECT id, hex, depth, undertone, created_at
            FROM skin_analyses
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (g.current_user["id"],),
        )
        rows = cur.fetchall()
        cur.close()
        for row in rows:
            row["created_at"] = row["created_at"].isoformat() if row["created_at"] else None
        return jsonify({"analyses": rows})
    except MySQLError as err:
        return db_error(err)



# ---------------------------------------------------------------------------
# Admin - view all registered users
# ---------------------------------------------------------------------------

@app.get("/api/admin/users")
@require_admin
def admin_list_users():
    try:
        cur = get_db().cursor(dictionary=True)
        cur.execute("SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC")
        rows = cur.fetchall()
        cur.close()
        for row in rows:
            row["created_at"] = row["created_at"].isoformat() if row["created_at"] else None
        return jsonify({"total": len(rows), "users": rows})
    except MySQLError as err:
        return db_error(err)


# ---------------------------------------------------------------------------
# Admin - promote a user to ADMIN role (legacy endpoint, kept for compatibility)
# ---------------------------------------------------------------------------

@app.put("/api/admin/users/<int:target_id>/promote")
@require_admin
def admin_promote_user(target_id: int):
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute("SELECT id, name, email, role FROM users WHERE id = %s", (target_id,))
        target = cur.fetchone()

        if not target:
            cur.close()
            return jsonify({"error": "User not found"}), 404

        if target["role"] == "ADMIN":
            cur.close()
            return jsonify({"error": "User is already an admin"}), 409

        cur.execute("UPDATE users SET role = 'ADMIN' WHERE id = %s", (target_id,))
        db.commit()
        cur.close()

        return jsonify({
            "ok": True,
            "message": f"{target['name']} has been promoted to ADMIN",
        })
    except MySQLError as err:
        get_db().rollback()
        return db_error(err)


# ---------------------------------------------------------------------------
# Admin - set a user's role (promote OR demote)  PUT /api/admin/users/<id>/role
# ---------------------------------------------------------------------------

@app.put("/api/admin/users/<int:user_id>/role")
@require_admin
def admin_set_user_role(user_id: int):
    """Change a user's role to ADMIN or USER.

    Safety: an admin cannot change their own role so they cannot
    accidentally lock themselves out.
    """
    # Self-protection check
    if g.current_user["id"] == user_id:
        return jsonify({"error": "You cannot change your own admin status."}), 400

    data = request.get_json(silent=True) or {}
    new_role = (data.get("role") or "").strip().upper()

    if new_role not in ("ADMIN", "USER"):
        return jsonify({"error": "role must be 'ADMIN' or 'USER'"}), 400

    try:
        db = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute("SELECT id, name, email, role FROM users WHERE id = %s", (user_id,))
        target = cur.fetchone()

        if not target:
            cur.close()
            return jsonify({"error": "User not found"}), 404

        cur.execute("UPDATE users SET role = %s WHERE id = %s", (new_role, user_id))
        db.commit()
        cur.close()

        action = "promoted to ADMIN" if new_role == "ADMIN" else "demoted to USER"
        return jsonify({
            "ok": True,
            "message": f"{target['name']} has been {action}.",
            "user": {"id": target["id"], "name": target["name"], "email": target["email"], "role": new_role},
        })
    except MySQLError as err:
        get_db().rollback()
        return db_error(err)


# ---------------------------------------------------------------------------
# Admin - view ALL bookings (all users)
# ---------------------------------------------------------------------------

@app.get("/api/admin/bookings")
@require_admin
def admin_list_bookings():
    status_filter = request.args.get("status", "")
    try:
        cur = get_db().cursor(dictionary=True)
        if status_filter and status_filter != "all":
            cur.execute(
                """
                SELECT a.id, a.date, a.time, a.status, a.created_at,
                       u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
                       s.id AS service_id, s.name AS service_name, s.price AS service_price, s.category
                FROM appointments a
                JOIN users u ON u.id = a.user_id
                JOIN services s ON s.id = a.service_id
                WHERE a.status = %s
                ORDER BY a.date DESC, a.time DESC
                """,
                (status_filter,),
            )
        else:
            cur.execute(
                """
                SELECT a.id, a.date, a.time, a.status, a.created_at,
                       u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
                       s.id AS service_id, s.name AS service_name, s.price AS service_price, s.category
                FROM appointments a
                JOIN users u ON u.id = a.user_id
                JOIN services s ON s.id = a.service_id
                ORDER BY a.date DESC, a.time DESC
                """
            )
        rows = cur.fetchall()
        cur.close()
        for row in rows:
            row["date"] = row["date"].isoformat() if row["date"] else None
            row["created_at"] = row["created_at"].isoformat() if row["created_at"] else None
        return jsonify({"total": len(rows), "bookings": rows})
    except MySQLError as err:
        return db_error(err)


# ---------------------------------------------------------------------------
# Admin - update a booking's status (confirm / cancel)
# ---------------------------------------------------------------------------

@app.put("/api/admin/bookings/<int:booking_id>/status")
@require_admin
def admin_update_booking_status(booking_id: int):
    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip().lower()
    allowed = {"confirmed", "cancelled", "completed", "no-show"}
    if new_status not in allowed:
        return jsonify({"error": f"status must be one of: {', '.join(allowed)}"}), 400

    try:
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "UPDATE appointments SET status = %s WHERE id = %s",
            (new_status, booking_id),
        )
        if cur.rowcount == 0:
            cur.close()
            return jsonify({"error": "Booking not found"}), 404
        db.commit()
        cur.close()
        return jsonify({"ok": True})
    except MySQLError as err:
        get_db().rollback()
        return db_error(err)


# ---------------------------------------------------------------------------
# Admin - dashboard statistics
# ---------------------------------------------------------------------------

@app.get("/api/admin/stats")
@require_admin
def admin_stats():
    try:
        cur = get_db().cursor(dictionary=True)

        cur.execute("SELECT COUNT(*) AS total FROM users")
        total_users = cur.fetchone()["total"]

        cur.execute(
            "SELECT COUNT(*) AS total FROM appointments WHERE date = CURDATE() AND status != 'cancelled'"
        )
        bookings_today = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM services")
        total_services = cur.fetchone()["total"]

        cur.execute(
            """
            SELECT COUNT(*) AS total FROM appointments
            WHERE MONTH(date) = MONTH(CURDATE())
            AND YEAR(date) = YEAR(CURDATE())
            AND status != 'cancelled'
            """
        )
        bookings_mtd = cur.fetchone()["total"]

        cur.execute(
            """
            SELECT COUNT(*) AS total FROM appointments
            WHERE status NOT IN ('cancelled')
            """
        )
        total_bookings = cur.fetchone()["total"]

        cur.close()

        return jsonify({
            "total_users": total_users,
            "bookings_today": bookings_today,
            "total_services": total_services,
            "bookings_mtd": bookings_mtd,
            "total_bookings": total_bookings,
        })
    except MySQLError as err:
        return db_error(err)


# ---------------------------------------------------------------------------
# Admin - reset user password
# ---------------------------------------------------------------------------

@app.post("/api/admin/users/<int:user_id>/reset-password")
@require_admin
def admin_reset_user_password(user_id: int):
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute("SELECT id, email FROM users WHERE id = %s", (user_id,))
        target = cur.fetchone()

        if not target:
            cur.close()
            return jsonify({"error": "User not found"}), 404

        alphabet = string.ascii_letters + string.digits + "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?`~"
        while True:
            new_password = "".join(secrets.choice(alphabet) for i in range(10))
            if (any(c.islower() for c in new_password)
                and any(c.isupper() for c in new_password)
                and any(c.isdigit() for c in new_password)
                and any(c in "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?`~" for c in new_password)):
                break

        hashed = hash_password(new_password)

        cur.execute("UPDATE users SET password = %s WHERE id = %s", (hashed, user_id))
        
        # Log action
        cur.execute(
            """INSERT INTO admin_actions 
               (admin_id, admin_email, action, target_id, target_email, detail) 
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (g.current_user["id"], g.current_user["email"], "password_reset",
             target["id"], target["email"], "Admin reset user password via dashboard")
        )
        
        db.commit()
        cur.close()
        
        return jsonify({"password": new_password})
    except MySQLError as err:
        get_db().rollback()
        return db_error(err)

# ---------------------------------------------------------------------------
# Skin Analysis — LAB colour-space heuristic (no ML model required)
#
# Key insight: converting to CIE LAB separates perceived Lightness (L) from
# pure colour information (A = green↔red axis, B = blue↔yellow axis).
# This makes depth and undertone calculations far less sensitive to the
# colour temperature of ambient lighting.
# ---------------------------------------------------------------------------

# Rich palette dictionary returned with every analysis result.
# Each entry has named Swatch objects so the UI can display colour chips + labels.
_PALETTES_DETAILED: dict = {
    "warm": {
        "summary": (
            "Your skin has a golden, peachy warmth. Earthy and sun-kissed shades will make "
            "your complexion glow, while icy silvers and cool pastels can look washed out."
        ),
        "hair": [
            {"name": "Honey Caramel",   "hex": "#a9743b"},
            {"name": "Warm Chestnut",   "hex": "#6b3f21"},
            {"name": "Copper Auburn",   "hex": "#b5651d"},
            {"name": "Golden Brown",    "hex": "#8B5A2B"},
            {"name": "Amber Balayage",  "hex": "#C68642"},
        ],
        "lips": [
            {"name": "Peach Nude",        "hex": "#e2a07a"},
            {"name": "Terracotta Lip",    "hex": "#c96b52"},
            {"name": "Warm Coral",        "hex": "#F08770"},
            {"name": "Spiced Apricot",    "hex": "#d4785e"},
            {"name": "Cinnamon Rose",     "hex": "#b5533c"},
            {"name": "Burnt Sienna",      "hex": "#a0522d"},
        ],
        "blush": [
            {"name": "Warm Berry",        "hex": "#a24a5f"},
            {"name": "Golden Peach",      "hex": "#fcccb4"},
            {"name": "Bronze Glow",       "hex": "#cd7f32"},
            {"name": "Terracotta Flush",  "hex": "#c86a4a"},
            {"name": "Amber Blush",       "hex": "#e8a87c"},
            {"name": "Warm Coral Pink",   "hex": "#f4896b"},
        ],
        "outfits": [
            {"name": "Camel",         "hex": "#c19a6b"},
            {"name": "Olive",         "hex": "#6b7a3a"},
            {"name": "Rust",          "hex": "#b7410e"},
            {"name": "Cream",         "hex": "#f3e5c3"},
            {"name": "Warm Coral",    "hex": "#F08770"},
            {"name": "Burnt Orange",  "hex": "#cc5500"},
        ],
        "services": ["Gold Bleach", "Fruit Cleanup", "Gold Facial"],
    },
    "cool": {
        "summary": (
            "Your skin has pink or bluish undertones. Jewel tones and cool metals like silver "
            "and platinum will really pop on you, while warm oranges can clash."
        ),
        "hair": [
            {"name": "Ash Brown",        "hex": "#5a4a3f"},
            {"name": "Cool Espresso",    "hex": "#3b2a24"},
            {"name": "Platinum Blonde",  "hex": "#e5e4e2"},
            {"name": "Burgundy",         "hex": "#6E1423"},
            {"name": "Blue-Black",       "hex": "#1a1a2e"},
        ],
        "lips": [
            {"name": "Rose Pink",       "hex": "#d97a95"},
            {"name": "Berry Wine",      "hex": "#7b2a3d"},
            {"name": "Cool Nude",       "hex": "#C89AA0"},
            {"name": "Raspberry",       "hex": "#c0256e"},
            {"name": "Orchid Pink",     "hex": "#b56fa8"},
            {"name": "Cherry Red",      "hex": "#9b1b30"},
        ],
        "blush": [
            {"name": "Mauve",           "hex": "#a76a8a"},
            {"name": "Soft Pink",       "hex": "#ffb6c1"},
            {"name": "Plum Blush",      "hex": "#5D3A5A"},
            {"name": "Cool Lilac",      "hex": "#b694c8"},
            {"name": "Dusty Rose",      "hex": "#b07080"},
            {"name": "Fuchsia Glow",    "hex": "#c2538a"},
        ],
        "outfits": [
            {"name": "Sapphire",        "hex": "#0f52ba"},
            {"name": "Emerald",         "hex": "#046a38"},
            {"name": "Icy Lavender",    "hex": "#c8b6d6"},
            {"name": "Charcoal",        "hex": "#36454f"},
            {"name": "Pure White",      "hex": "#f8f8ff"},
            {"name": "Plum Purple",     "hex": "#5e2d79"},
        ],
        "services": ["Herbal / Oxy Bleach", "Diamond Facial", "Whitening Facial"],
    },
    "neutral": {
        "summary": (
            "You have a beautifully balanced neutral undertone — lucky you! Most palettes suit "
            "you, but softly muted, mid-saturation shades look most harmonious."
        ),
        "hair": [
            {"name": "Natural Brown",      "hex": "#6f4e37"},
            {"name": "Soft Mahogany",      "hex": "#8b3a3a"},
            {"name": "Warm Black",         "hex": "#1c1c1c"},
            {"name": "Mocha",              "hex": "#7B5E3B"},
            {"name": "Toffee Highlights",  "hex": "#946A48"},
        ],
        "lips": [
            {"name": "Rosy Nude",        "hex": "#c98a8a"},
            {"name": "Dusty Rose",       "hex": "#c48b8b"},
            {"name": "Soft Mocha",       "hex": "#a38068"},
            {"name": "Muted Mauve",      "hex": "#b07898"},
            {"name": "Nude Beige",       "hex": "#c4a882"},
            {"name": "Warm Blush Pink",  "hex": "#d4898b"},
        ],
        "blush": [
            {"name": "Soft Plum",        "hex": "#734f5b"},
            {"name": "Peachy Flush",     "hex": "#FFAB91"},
            {"name": "Tawny Blush",      "hex": "#cd5c5c"},
            {"name": "Rose Clay",        "hex": "#c08070"},
            {"name": "Apricot Glow",     "hex": "#f4b183"},
            {"name": "Muted Coral",      "hex": "#d4816a"},
        ],
        "outfits": [
            {"name": "Dusty Blue",    "hex": "#6a8caf"},
            {"name": "Blush",        "hex": "#dea5a4"},
            {"name": "Sage",         "hex": "#9caf88"},
            {"name": "Taupe",        "hex": "#8b7d6b"},
            {"name": "Soft Teal",    "hex": "#4a9b9b"},
            {"name": "Warm Ivory",   "hex": "#e8dcc8"},
        ],
        "services": ["Fruit Cleanup", "O3+ Advance Facial", "Fruit Facial"],
    },
}


@app.post("/api/analyze-skin")
def analyze_skin():
    """
    Heuristic skin analysis using OpenCV LAB colour space.

    Pipeline (no face detector needed — works on any selfie):
      1. Crop the central-upper region of the image where the face sits.
      2. Apply a YCrCb skin-pixel mask to validate the crop has real skin.
      3. Convert masked pixels to CIE LAB (separates lightness from colour).
      4. Compute median L, A, B (robust to outliers).
      5. L channel  → depth  (Fair / Light / Medium / Tan / Deep).
      6. A + B channels → undertone (Warm / Cool / Neutral).
      7. Return hex colour + full named-swatch palette.

    Note: cv2.CascadeClassifier was removed — it is not available in OpenCV 5.x.
    The center-crop approach is equally accurate for close-up selfies and
    removes a hard dependency on the legacy objdetect module.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    try:
        file = request.files["image"]
        file_bytes = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Invalid image file. Please upload a PNG or JPG."}), 400

        img_h, img_w = img.shape[:2]

        # ── Step 1: Center-upper crop ───────────────────────────────────────
        # In any close-up selfie the face occupies the upper-centre portion.
        # Sample the central 60 % of the width and the top 65 % of the height.
        top    = int(img_h * 0.08)
        bottom = int(img_h * 0.65)
        left   = int(img_w * 0.20)
        right  = int(img_w * 0.80)
        roi    = img[top:bottom, left:right]

        if roi.size < 300:
            roi = img   # extreme-resolution fallback: use the whole image

        # ── Step 2: Skin pixel mask (YCrCb) ────────────────────────────────
        # Wider Cr/Cb window captures lighter South-Asian skin tones that
        # the standard [133-173, 77-127] range misses.
        ycrcb     = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
        skin_mask = cv2.inRange(
            ycrcb,
            np.array([0,   128,  75], np.uint8),   # broader lower bound
            np.array([255, 185, 135], np.uint8),   # broader upper bound
        )
        # Morphological closing to fill small gaps in the mask
        kernel    = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)

        # Validate: at least 5 % of the crop must be skin-coloured pixels.
        skin_pixel_count = int(np.sum(skin_mask > 0))
        roi_area         = roi.shape[0] * roi.shape[1]
        skin_ratio       = skin_pixel_count / max(roi_area, 1)

        if skin_ratio < 0.05:
            return jsonify({
                "error": (
                    "Could not detect enough skin in the photo. "
                    "Please upload a clear, close-up, front-facing photo with good lighting."
                )
            }), 400

        # ── Step 3: Convert to LAB ──────────────────────────────────────────
        lab       = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB)
        lab_flat  = lab.reshape(-1, 3).astype(np.float32)
        mask_flat = skin_mask.reshape(-1)
        skin_lab  = lab_flat[mask_flat > 0]

        # Fallback: use all ROI pixels if the skin mask is too restrictive
        if len(skin_lab) < 50:
            skin_lab = lab_flat

        # ── Step 4: Lighting-robust statistics ──────────────────────────────
        #
        # KEY ACCURACY FIX:
        #   Use the 75th percentile of L rather than the median.
        #   Shadows, dark jewellery, and background bleed all pull the median
        #   downward, making fair/light skin read as "Medium" or "Tan".
        #   The 75th percentile focuses on the well-lit skin pixels and gives
        #   a result that matches what the human eye sees.
        #
        L_75  = float(np.percentile(skin_lab[:, 0], 75))
        A_med = float(np.median(skin_lab[:, 1]))   # A/B: median still stable
        B_med = float(np.median(skin_lab[:, 2]))

        # ── Step 5: Depth from L channel ────────────────────────────────────
        # Thresholds re-calibrated for South-Asian skin range
        # (standard 0–100 scale; OpenCV stores L as 0–255).
        L_norm = L_75 * 100.0 / 255.0
        if   L_norm > 72: depth = "Fair"
        elif L_norm > 62: depth = "Light"
        elif L_norm > 50: depth = "Medium"
        elif L_norm > 38: depth = "Tan"
        else:             depth = "Deep"

        # ── Step 6: Undertone from A and B channels ─────────────────────────
        # OpenCV centres at 128.  Shift to centred range for clarity.
        A_c = A_med - 128.0   # > 0 → redder / pinker  (cool cue)
        B_c = B_med - 128.0   # > 0 → yellower / warmer (warm cue)

        if   B_c > 10 and B_c > A_c + 3: undertone = "warm"
        elif A_c > 8  and A_c > B_c - 3: undertone = "cool"
        else:                             undertone = "neutral"

        # ── Step 7: Representative hex for the UI swatch ────────────────────
        # Use only the TOP 40 % brightest skin pixels so the swatch reflects
        # the visible lit skin, not the shadow-averaged mean.
        skin_bgr_all = roi.reshape(-1, 3)[mask_flat > 0] if skin_pixel_count >= 50 else roi.reshape(-1, 3)
        skin_l_vals  = skin_lab[:, 0] if skin_pixel_count >= 50 else lab_flat[:, 0]
        bright_thresh = np.percentile(skin_l_vals, 60)           # top 40 %
        bright_mask   = skin_l_vals >= bright_thresh
        bright_pixels = skin_bgr_all[bright_mask] if bright_mask.any() else skin_bgr_all
        mean_b = int(np.clip(np.mean(bright_pixels[:, 0]), 0, 255))
        mean_g = int(np.clip(np.mean(bright_pixels[:, 1]), 0, 255))
        mean_r = int(np.clip(np.mean(bright_pixels[:, 2]), 0, 255))
        hex_color = f"#{mean_r:02x}{mean_g:02x}{mean_b:02x}"

        palette = _PALETTES_DETAILED[undertone]

        return jsonify({
            "skin_tone": f"{depth} {undertone.capitalize()}",
            "undertone":  undertone,
            "hex":        hex_color,
            "summary":    palette["summary"],
            "hair":       palette["hair"],
            "lips":       palette["lips"],
            "blush":      palette["blush"],
            "outfits":    palette["outfits"],
            "services":   palette["services"],
        })

    except Exception as exc:
        print(f"[analyze-skin error] {exc}")
        import traceback; traceback.print_exc()
        return jsonify({"error": "Analysis failed. Please try a different photo."}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "1") == "1")
