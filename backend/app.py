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

# Web Push
try:
    from pywebpush import webpush, WebPushException
    PUSH_AVAILABLE = True
except ImportError:
    PUSH_AVAILABLE = False



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

# VAPID keys for Web Push (read from env — private key is never in source code)
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY  = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@example.com")

import urllib.parse as urlparse

if "DATABASE_URL" in os.environ:
    # Render / Aiven provide a URL like mysql://user:pass@host:port/dbname
    url = urlparse.urlparse(os.environ["DATABASE_URL"])
    MYSQL_CONFIG = {
        "host": url.hostname,
        "port": url.port or 3306,
        "user": url.username,
        "password": url.password,
        "database": url.path[1:], # strip leading slash
        "autocommit": False,
        "ssl_disabled": False,   # Aiven MySQL requires SSL
    }
else:
    # Fallback to local XAMPP config
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
# Profile - view & update own info
# ---------------------------------------------------------------------------


@app.get("/api/profile")
@require_auth
def get_profile():
    user = g.current_user
    try:
        cur = get_db().cursor(dictionary=True)
        cur.execute("SELECT id, name, email, phone, role FROM users WHERE id = %s", (user["id"],))
        row = cur.fetchone()
        cur.close()
    except MySQLError as err:
        return db_error(err)
    if not row:
        return jsonify({"error": "User not found"}), 404
    return jsonify(row)


@app.put("/api/profile")
@require_auth
def update_profile():
    user = g.current_user
    data = request.get_json(silent=True) or {}
    errors = {}

    name_raw = (data.get("name") or "").strip()
    phone_raw = (data.get("phone") or "").strip()
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    # Validate name
    if name_raw:
        parts = name_raw.split()
        if len(name_raw) < 2 or len(name_raw) > 80:
            errors["name"] = "Full name must be 2–80 characters"
        elif len(parts) < 2:
            errors["name"] = "Please enter your first and last name"

    # Validate phone
    phone = ""
    if phone_raw:
        phone = _strip_phone(phone_raw)
        if not INDIAN_PHONE_RE.match(phone):
            errors["phone"] = "A valid 10-digit Indian mobile number is required"

    # Validate password change
    if new_password:
        if not current_password:
            errors["current_password"] = "Enter your current password to set a new one"
        if len(new_password) < 8:
            errors["new_password"] = "New password must be at least 8 characters"
        elif len(new_password) > 72:
            errors["new_password"] = "New password must be at most 72 characters"
        elif not STRONG_PW_RE.match(new_password):
            errors["new_password"] = (
                "Password must contain uppercase, lowercase, number, and special character"
            )

    if errors:
        return jsonify({"errors": errors}), 400

    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT name, email, phone, password FROM users WHERE id = %s", (user["id"],))
        row = cur.fetchone()

        # Verify current password if changing password
        if new_password:
            if not check_password(current_password, row["password"]):
                cur.close()
                return jsonify({"errors": {"current_password": "Incorrect current password"}}), 400

        # Build update fields
        updates = []
        values = []
        if name_raw:
            name = " ".join(w.capitalize() for w in name_raw.split())
            updates.append("name = %s")
            values.append(name)
        if phone:
            updates.append("phone = %s")
            values.append(phone)
        if new_password:
            updates.append("password = %s")
            values.append(hash_password(new_password))

        if not updates:
            cur.close()
            return jsonify({"error": "Nothing to update"}), 400

        values.append(user["id"])
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", values)
        db.commit()

        # Return updated user
        cur.execute("SELECT id, name, email, phone, role FROM users WHERE id = %s", (user["id"],))
        updated = cur.fetchone()
        cur.close()
    except MySQLError as err:
        return db_error(err)

    return jsonify({"ok": True, "user": user_payload(updated), "profile": updated})


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

        # Notify all admins about the new booking
        try:
            cur2 = db.cursor(dictionary=True)
            cur2.execute("SELECT id FROM users WHERE role = 'ADMIN'")
            admins = cur2.fetchall()
            cur2.execute("SELECT name FROM services WHERE id = %s", (service_id,))
            svc_row = cur2.fetchone()
            svc_name = svc_row["name"] if svc_row else service_id
            customer_name = g.current_user["name"]
            msg = f"New booking: {customer_name} booked {svc_name} on {date_str} at {time_str}"
            for admin in admins:
                cur2.execute(
                    "INSERT INTO notifications (user_id, type, message, booking_id) VALUES (%s, 'new_booking', %s, %s)",
                    (admin["id"], msg, booking_id),
                )
            db.commit()
            cur2.close()
            # Send push to each admin (additive — never fails the booking)
            for admin in admins:
                _send_push(db, admin["id"], "New Booking", msg, "/admin")
        except Exception:
            pass  # never fail the booking because of a notification error

        cur.close()
        return jsonify({"id": booking_id}), 201
    except MySQLError as err:
        get_db().rollback()
        if err.errno == 1062:
            return jsonify({"error": "That time slot is already booked. Pick another."}), 409
        return db_error(err)


# ---------------------------------------------------------------------------
# Web Push — subscription management & send helper
# ---------------------------------------------------------------------------


def _send_push(db, user_id: int, title: str, body: str, url: str = "/") -> None:
    """
    Send a browser push notification to every stored subscription for user_id.
    Any per-subscription error is caught and logged; stale 410/404 subscriptions
    are removed automatically. Never raises — push is always additive.
    """
    if not PUSH_AVAILABLE or not VAPID_PRIVATE_KEY:
        return
    try:
        cur = db.cursor(dictionary=True)
        cur.execute(
            "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = %s",
            (user_id,),
        )
        subs = cur.fetchall()
        cur.close()
    except Exception as e:
        print(f"[push] DB read error: {e}")
        return

    import json as _json
    payload = _json.dumps({"title": title, "body": body, "url": url})
    stale_ids = []

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIMS_EMAIL},
            )
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):
                # Subscription expired / user unsubscribed from browser side
                stale_ids.append(sub["id"])
            else:
                print(f"[push] send error for sub {sub['id']}: {e}")
        except Exception as e:
            print(f"[push] unexpected error for sub {sub['id']}: {e}")

    if stale_ids:
        try:
            cur2 = db.cursor()
            cur2.executemany(
                "DELETE FROM push_subscriptions WHERE id = %s",
                [(sid,) for sid in stale_ids],
            )
            db.commit()
            cur2.close()
        except Exception:
            pass


# ── VAPID public key endpoint (no auth required — public information) ─────────

@app.get("/api/push/vapid-public-key")
def push_vapid_public_key():
    return jsonify({"public_key": VAPID_PUBLIC_KEY})


# ── Save/update a push subscription ──────────────────────────────────────────

@app.post("/api/push/subscribe")
@require_auth
def push_subscribe():
    user_id = g.current_user["id"]
    data = request.get_json(silent=True) or {}
    endpoint = (data.get("endpoint") or "").strip()
    p256dh   = (data.get("p256dh")   or "").strip()
    auth     = (data.get("auth")     or "").strip()

    if not endpoint or not p256dh or not auth:
        return jsonify({"error": "endpoint, p256dh, and auth are required"}), 400

    try:
        db = get_db()
        cur = db.cursor()
        # INSERT … ON DUPLICATE KEY UPDATE so re-subscribing the same endpoint is idempotent
        cur.execute(
            """INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
               VALUES (%s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE user_id = %s, p256dh = %s, auth = %s""",
            (user_id, endpoint, p256dh, auth, user_id, p256dh, auth),
        )
        db.commit()
        cur.close()
        return jsonify({"ok": True}), 201
    except MySQLError as err:
        return db_error(err)


# ── Remove a push subscription ────────────────────────────────────────────────

@app.delete("/api/push/unsubscribe")
@require_auth
def push_unsubscribe():
    user_id = g.current_user["id"]
    try:
        db = get_db()
        cur = db.cursor()
        # Delete all subscriptions for this user (simple; could target a specific endpoint)
        cur.execute("DELETE FROM push_subscriptions WHERE user_id = %s", (user_id,))
        db.commit()
        cur.close()
        return jsonify({"ok": True})
    except MySQLError as err:
        return db_error(err)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


def _generate_reminders(db, user_id: int):
    """Lazily create 24-hour reminder notifications for upcoming appointments."""
    try:
        now_utc = datetime.now(timezone.utc)
        window_end = now_utc + timedelta(hours=24)
        cur = db.cursor(dictionary=True)
        cur.execute(
            """SELECT a.id, a.date, a.time, s.name AS service_name
               FROM appointments a
               JOIN services s ON s.id = a.service_id
               WHERE a.user_id = %s AND a.status = 'confirmed'
                 AND CONCAT(a.date, ' ', a.time) >= %s
                 AND CONCAT(a.date, ' ', a.time) <= %s""",
            (user_id, now_utc.strftime("%Y-%m-%d %H:%M"), window_end.strftime("%Y-%m-%d %H:%M")),
        )
        upcoming = cur.fetchall()
        for appt in upcoming:
            cur.execute(
                "SELECT id FROM notifications WHERE user_id=%s AND type='appointment_reminder' AND booking_id=%s",
                (user_id, appt["id"]),
            )
            if not cur.fetchone():
                appt_dt_str = f"{appt['date']} {appt['time']}"
                msg = f"Reminder: your {appt['service_name']} appointment is on {appt['date']} at {appt['time']}"
                cur.execute(
                    "INSERT INTO notifications (user_id, type, message, booking_id) VALUES (%s, 'appointment_reminder', %s, %s)",
                    (user_id, msg, appt["id"]),
                )
                # Send push for new reminders only (additive — never crashes)
                try:
                    _send_push(db, user_id, "Appointment Reminder", msg, "/my-bookings")
                except Exception:
                    pass
        db.commit()
        cur.close()
    except Exception:
        pass  # never crash the notifications fetch


@app.get("/api/notifications")
@require_auth
def get_notifications():
    user_id = g.current_user["id"]
    db = get_db()
    # Lazily generate reminders for customers
    if g.current_user.get("role") != "ADMIN":
        _generate_reminders(db, user_id)
    try:
        cur = db.cursor(dictionary=True)
        cur.execute(
            """SELECT id, type, message, is_read, booking_id,
                      created_at
               FROM notifications
               WHERE user_id = %s
               ORDER BY created_at DESC
               LIMIT 30""",
            (user_id,),
        )
        rows = cur.fetchall()
        unread = sum(1 for r in rows if not r["is_read"])
        # Serialize booleans & datetimes
        for r in rows:
            r["is_read"] = bool(r["is_read"])
            if isinstance(r["created_at"], datetime):
                r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
        cur.close()
        return jsonify({"notifications": rows, "unread": unread})
    except MySQLError as err:
        return db_error(err)


@app.put("/api/notifications/read-all")
@require_auth
def mark_all_read():
    user_id = g.current_user["id"]
    try:
        db = get_db()
        cur = db.cursor()
        cur.execute("UPDATE notifications SET is_read = TRUE WHERE user_id = %s", (user_id,))
        db.commit()
        cur.close()
        return jsonify({"ok": True})
    except MySQLError as err:
        return db_error(err)


# ---------------------------------------------------------------------------
# Account deletion
# ---------------------------------------------------------------------------


@app.delete("/api/account")
@require_auth
def delete_account():
    user = g.current_user
    user_id = user["id"]
    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""

    try:
        db = get_db()
        cur = db.cursor(dictionary=True)

        # Fetch current hashed password for verification
        cur.execute("SELECT password, role FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            return jsonify({"error": "User not found"}), 404

        if not check_password(password, row["password"]):
            cur.close()
            return jsonify({"error": "Incorrect password"}), 400

        # Solo-admin guard
        if row["role"] == "ADMIN":
            cur.execute("SELECT COUNT(*) AS cnt FROM users WHERE role = 'ADMIN'", )
            count_row = cur.fetchone()
            if count_row["cnt"] <= 1:
                cur.close()
                return jsonify({
                    "error": "You are the only admin. Promote another user to admin before deleting your account."
                }), 403

        # Cancel upcoming confirmed bookings
        cur.execute(
            "UPDATE appointments SET status = 'cancelled' WHERE user_id = %s AND status = 'confirmed' AND date >= CURDATE()",
            (user_id,),
        )

        # Delete the user (cascades to appointments, notifications, skin_analyses)
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db.commit()
        cur.close()
        return jsonify({"ok": True})
    except MySQLError as err:
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
# Admin - delete user  DELETE /api/admin/users/<id>
# ---------------------------------------------------------------------------

@app.delete("/api/admin/users/<int:user_id>")
@require_admin
def admin_delete_user(user_id: int):
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute("SELECT id, role FROM users WHERE id = %s", (user_id,))
        target = cur.fetchone()
        if not target:
            cur.close()
            return jsonify({"error": "User not found"}), 404
        
        # Guard against self-deletion or solo-admin deletion?
        if target["role"] == "ADMIN":
            cur.execute("SELECT COUNT(*) AS cnt FROM users WHERE role = 'ADMIN'")
            count_row = cur.fetchone()
            if count_row["cnt"] <= 1:
                cur.close()
                return jsonify({"error": "Cannot delete the only admin."}), 403

        # Cancel their upcoming bookings
        cur.execute(
            "UPDATE appointments SET status = 'cancelled' WHERE user_id = %s AND status = 'confirmed' AND date >= CURDATE()",
            (user_id,)
        )
        
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        db.commit()
        cur.close()

        return jsonify({"ok": True, "message": "User deleted successfully"})
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
# Skin Analysis - multi-region LAB heuristic with confidence + lighting check
#
# Pipeline:
#   1. Decode image; compute whole-image brightness for lighting gate.
#   2. Locate the face bounding box using a colour-blob heuristic (no DNN
#      required) so we can place anatomical ROI boxes precisely.
#   3. Derive 5 sample regions from the face box:
#      forehead, left cheek, right cheek, left jaw, right jaw.
#   4. For each region apply a tight dual-condition skin mask:
#      YCrCb Cr/Cb range  AND  HSV saturation floor (rejects grey/white).
#   5. Pool all masked pixels across regions; drop the darkest 10% and
#      brightest 10% (outlier rejection).
#   6. Compute median L, A, B of the filtered pool.
#   7. Compute per-region median L; its std -> confidence score.
#   8. Lighting gate: flag if image is too dark, overexposed, or unevenly lit
#      across regions (soft warning, not a hard rejection).
#   9. L -> depth, A/B -> undertone  (thresholds UNCHANGED from previous code).
#  10. Return hex swatch + palette + confidence + lighting_warning.
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
            {"name": "Peach Nude",      "hex": "#e2a07a"},
            {"name": "Terracotta Lip",  "hex": "#c96b52"},
            {"name": "Warm Coral",      "hex": "#F08770"},
        ],
        "blush": [
            {"name": "Warm Berry",      "hex": "#a24a5f"},
            {"name": "Golden Peach",    "hex": "#fcccb4"},
            {"name": "Bronze Glow",     "hex": "#cd7f32"},
        ],
        "outfits": [
            {"name": "Camel",       "hex": "#c19a6b"},
            {"name": "Olive",       "hex": "#6b7a3a"},
            {"name": "Rust",        "hex": "#b7410e"},
            {"name": "Cream",       "hex": "#f3e5c3"},
            {"name": "Warm Coral",  "hex": "#F08770"},
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
            {"name": "Rose Pink",   "hex": "#d97a95"},
            {"name": "Berry Wine",  "hex": "#7b2a3d"},
            {"name": "Cool Nude",   "hex": "#C89AA0"},
        ],
        "blush": [
            {"name": "Mauve",       "hex": "#a76a8a"},
            {"name": "Soft Pink",   "hex": "#ffb6c1"},
            {"name": "Plum Blush",  "hex": "#5D3A5A"},
        ],
        "outfits": [
            {"name": "Sapphire",      "hex": "#0f52ba"},
            {"name": "Emerald",       "hex": "#046a38"},
            {"name": "Icy Lavender",  "hex": "#c8b6d6"},
            {"name": "Charcoal",      "hex": "#36454f"},
            {"name": "Pure White",    "hex": "#f8f8ff"},
        ],
        "services": ["Herbal / Oxy Bleach", "Diamond Facial", "Whitening Facial"],
    },
    "neutral": {
        "summary": (
            "You have a beautifully balanced neutral undertone - lucky you! Most palettes suit "
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
            {"name": "Rosy Nude",    "hex": "#c98a8a"},
            {"name": "Dusty Rose",   "hex": "#c48b8b"},
            {"name": "Soft Mocha",   "hex": "#a38068"},
        ],
        "blush": [
            {"name": "Soft Plum",    "hex": "#734f5b"},
            {"name": "Peachy Flush", "hex": "#FFAB91"},
            {"name": "Tawny Blush",  "hex": "#cd5c5c"},
        ],
        "outfits": [
            {"name": "Dusty Blue",  "hex": "#6a8caf"},
            {"name": "Blush",       "hex": "#dea5a4"},
            {"name": "Sage",        "hex": "#9caf88"},
            {"name": "Taupe",       "hex": "#8b7d6b"},
            {"name": "Soft Teal",   "hex": "#4a9b9b"},
        ],
        "services": ["Fruit Cleanup", "O3+ Advance Facial", "Fruit Facial"],
    },
}


def _face_bbox_from_skin(img):
    """
    Estimate the face bounding box using a skin-colour blob.
    Works on any close-up selfie without a face-detector model.

    Returns (x, y, w, h) in image coordinates, or None if detection fails.
    """
    import cv2, numpy as np
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    # Standard Cr/Cb range -- reliable across South-Asian skin tones
    mask = cv2.inRange(ycrcb,
                       np.array([0,  133,  77], np.uint8),
                       np.array([255, 175, 127], np.uint8))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask   = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask   = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)

    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < (img.shape[0] * img.shape[1] * 0.02):
        return None
    return cv2.boundingRect(c)


def _anatomical_rois(img, bbox):
    """
    Given a face bounding box (x, y, w, h), return a list of 5 (row_slice,
    col_slice) tuples for: forehead, left cheek, right cheek, left jaw,
    right jaw.  Falls back to a split centre-crop if bbox is None.
    """
    H, W = img.shape[:2]

    if bbox is None:
        t  = int(H * 0.10); b  = int(H * 0.70)
        l  = int(W * 0.20); r  = int(W * 0.80)
        ht = max((b - t) // 3, 1)
        return [
            (slice(t,        t + ht),    slice(l, r)),
            (slice(t + ht,   t + 2*ht), slice(l, int(W*0.50))),
            (slice(t + ht,   t + 2*ht), slice(int(W*0.50), r)),
            (slice(t + 2*ht, b),         slice(l, int(W*0.50))),
            (slice(t + 2*ht, b),         slice(int(W*0.50), r)),
        ]

    x, y, w, h = bbox
    x = max(0, x); y = max(0, y)
    w = min(w, W - x); h = min(h, H - y)

    # Each ROI as (offset_y, height_frac, offset_x, width_frac) of face box
    regions_frac = [
        (0.05, 0.20, 0.30, 0.40),   # forehead
        (0.40, 0.25, 0.10, 0.30),   # left cheek
        (0.40, 0.25, 0.60, 0.30),   # right cheek
        (0.65, 0.20, 0.10, 0.30),   # left jaw
        (0.65, 0.20, 0.60, 0.30),   # right jaw
    ]

    rois = []
    for (oy, fh, ox, fw) in regions_frac:
        ry1 = int(y + oy * h);   ry2 = int(y + (oy + fh) * h)
        rx1 = int(x + ox * w);   rx2 = int(x + (ox + fw) * w)
        ry1 = max(0, min(ry1, H - 1)); ry2 = max(ry1 + 1, min(ry2, H))
        rx1 = max(0, min(rx1, W - 1)); rx2 = max(rx1 + 1, min(rx2, W))
        rois.append((slice(ry1, ry2), slice(rx1, rx2)))
    return rois


def _tight_skin_mask(region):
    """
    Dual-condition skin mask per region.

    Condition 1 - YCrCb: Cr in [133, 175], Cb in [77, 127]
        Narrower than the old broad mask; avoids red clothing/background.
    Condition 2 - HSV saturation floor: S > 15
        Rejects near-grey pixels: eye whites, teeth, jewellery, background.
    Both conditions must be true.
    """
    ycrcb      = cv2.cvtColor(region, cv2.COLOR_BGR2YCrCb)
    mask_ycrcb = cv2.inRange(ycrcb,
                              np.array([0,  133,  77], np.uint8),
                              np.array([255, 175, 127], np.uint8))
    hsv      = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    mask_sat = (hsv[:, :, 1] > 15).astype(np.uint8) * 255
    combined = cv2.bitwise_and(mask_ycrcb, mask_sat)
    kernel   = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    return cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)


def _detect_glare(region, brightness_thresh=215, sat_thresh=50,
                   area_pct=0.015, min_cluster_px=25):
    """
    Detect specular highlights / glare within a BGR image region.

    A pixel is glare if ALL BGR channels >= brightness_thresh (near-white)
    AND HSV saturation < sat_thresh (colourless / blown-out).

    Two independent triggers (either fires the flag):
      A) Area ratio: >= area_pct of the region pixels are glare.
      B) Cluster: at least one connected component of glare pixels
         has >= min_cluster_px pixels (catches small focused hotspots).

    Why the lower thresholds vs. the original (235 / S<30 / 4%):
      - JPEG compression blends bright pixels with neighbours, so real lens
        reflections rarely survive at >= 235; 215 catches them reliably.
      - Glass reflections can carry a slight tint (S up to ~45); S<50 is safe.
      - A real glasses hotspot may cover only ~0.5-1% of a region but be a
        tight cluster — the cluster check catches this without false positives.

    Returns
    -------
    (has_glare: bool, glare_ratio: float)
    """
    if region.size < 27:
        return False, 0.0

    # Near-white mask
    near_white = (
        (region[:, :, 0] >= brightness_thresh) &
        (region[:, :, 1] >= brightness_thresh) &
        (region[:, :, 2] >= brightness_thresh)
    )

    # Low-saturation mask
    hsv      = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    low_sat  = hsv[:, :, 1] < sat_thresh

    glare_mask  = (near_white & low_sat).astype(np.uint8)
    total_px    = region.shape[0] * region.shape[1]
    glare_count = int(np.sum(glare_mask))
    glare_ratio = glare_count / max(total_px, 1)

    # Trigger A: area ratio
    if glare_ratio >= area_pct:
        return True, glare_ratio

    # Trigger B: connected-component cluster (focused hotspot)
    if glare_count >= min_cluster_px:
        n_labels, _, stats, _ = cv2.connectedComponentsWithStats(
            glare_mask, connectivity=8
        )
        # stats[0] is the background label — skip it
        for lbl in range(1, n_labels):
            if stats[lbl, cv2.CC_STAT_AREA] >= min_cluster_px:
                return True, glare_ratio

    return False, glare_ratio


@app.post("/api/analyze-skin")
def analyze_skin():
    """
    Heuristic skin analysis using OpenCV CIE LAB colour space.

    Improvements over the previous version:
    - Landmark-guided multi-region sampling (forehead, cheeks, jawline).
    - Tighter skin mask: YCrCb range + HSV saturation floor.
    - Outlier rejection: drop darkest 10% and brightest 10% of pixels.
    - Lighting quality gate: too dark / overexposed / unevenly lit.
    - Glare / specular highlight detection per region.
    - Eyewear proximity check: glare in forehead/cheek zones -> glasses flag.
    - Per-region median L variance + glare signals -> confidence indicator.
    - Depth and undertone thresholds are unchanged.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    try:
        file       = request.files["image"]
        file_bytes = np.frombuffer(file.read(), np.uint8)
        img        = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Invalid image file. Please upload a PNG or JPG."}), 400

        img_h, img_w = img.shape[:2]

        # -- Step 1: Whole-image brightness for the lighting gate ------------
        cx1, cx2 = int(img_w * 0.15), int(img_w * 0.85)
        cy1, cy2 = int(img_h * 0.10), int(img_h * 0.90)
        centre   = img[cy1:cy2, cx1:cx2]
        if centre.size == 0:
            centre = img
        lab_full = cv2.cvtColor(centre, cv2.COLOR_BGR2LAB)
        L_global = float(np.median(lab_full[:, :, 0].ravel()))

        # -- Step 2: Locate face bounding box via colour blob ----------------
        bbox = _face_bbox_from_skin(img)

        # Bbox quality gate: reject detections that indicate the person is
        # partially outside the frame or the blob is not actually a face.
        poor_framing = False
        if bbox is not None:
            bx, by, bw, bh = bbox
            face_cx_ratio = (bx + bw / 2) / max(img_w, 1)
            at_left_edge  = bx <= 2
            at_right_edge = (bx + bw) >= (img_w - 2)
            too_narrow    = bw < img_w * 0.30

            if (at_left_edge or at_right_edge) and too_narrow:
                poor_framing = True   # edge-cropped
            elif not (0.20 <= face_cx_ratio <= 0.80):
                poor_framing = True   # heavily off-centre

            if poor_framing:
                print(f"[analyze-skin] bbox rejected (quality): {bbox} "
                      f"cx_ratio={face_cx_ratio:.2f} edge=({at_left_edge},{at_right_edge})")
                bbox = None   # fall back to centre-crop bands

        # -- Step 3: Derive 5 anatomical ROI boxes --------------------------
        rois = _anatomical_rois(img, bbox)

        # -- Step 4: Tight skin mask + LAB extraction per region
        #            AND per-region glare detection                 ------------
        region_skin_labs  = []
        region_median_L   = []
        region_glare_flag = []   # True/False per region
        region_glare_rat  = []   # float glare ratio per region

        # Region index semantics (matches _anatomical_rois order):
        #   0 = forehead, 1 = left cheek, 2 = right cheek,
        #   3 = left jaw,  4 = right jaw
        # Indices 0-2 overlap with where glasses lenses/frames sit.
        EYEWEAR_ZONE_INDICES = {0, 1, 2}

        for idx, (rs, cs) in enumerate(rois):
            region = img[rs, cs]
            if region.size < 150:
                region_glare_flag.append(False)
                region_glare_rat.append(0.0)
                continue

            # Glare check for this region
            has_glare, g_ratio = _detect_glare(region)
            region_glare_flag.append(has_glare)
            region_glare_rat.append(g_ratio)

            mask      = _tight_skin_mask(region)
            lab_r     = cv2.cvtColor(region, cv2.COLOR_BGR2LAB) \
                           .reshape(-1, 3).astype(np.float32)
            mask_flat = mask.reshape(-1)
            skin_lab_r = lab_r[mask_flat > 0]
            if len(skin_lab_r) < 30:
                skin_lab_r = lab_r   # fallback: whole region
            region_skin_labs.append(skin_lab_r)
            region_median_L.append(float(np.median(skin_lab_r[:, 0])))

        # Fallback if all regions failed: centre-crop
        if not region_skin_labs:
            top  = int(img_h * 0.08); bottom = int(img_h * 0.65)
            left = int(img_w * 0.20); right  = int(img_w * 0.80)
            roi  = img[top:bottom, left:right]
            if roi.size == 0:
                roi = img
            lab_r = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB) \
                       .reshape(-1, 3).astype(np.float32)
            region_skin_labs = [lab_r]
            region_median_L  = [float(np.median(lab_r[:, 0]))]

        # -- Step 5: Outlier rejection (drop darkest 10% + brightest 10%) ---
        all_skin_lab = np.vstack(region_skin_labs)
        L_low  = float(np.percentile(all_skin_lab[:, 0], 10))
        L_high = float(np.percentile(all_skin_lab[:, 0], 90))
        keep   = (all_skin_lab[:, 0] >= L_low) & (all_skin_lab[:, 0] <= L_high)
        filtered_lab = all_skin_lab[keep]
        if len(filtered_lab) < 20:
            filtered_lab = all_skin_lab

        # -- Step 6: Validate minimum skin-pixel count ----------------------
        if len(all_skin_lab) < 50:
            return jsonify({
                "error": (
                    "Could not detect enough skin in the photo. "
                    "Please upload a clear, close-up, front-facing photo with good lighting."
                )
            }), 400

        # -- Step 7: Median LAB statistics ----------------------------------
        # Use P75 of L for depth (same logic as before: shadows pull median down)
        L_75  = float(np.percentile(filtered_lab[:, 0], 75))
        A_med = float(np.median(filtered_lab[:, 1]))
        B_med = float(np.median(filtered_lab[:, 2]))

        # -- Step 8: Lighting quality gate (soft warning) -------------------
        lighting_warning = None

        L_global_pct = L_global * 100.0 / 255.0
        if L_global_pct < 20:
            lighting_warning = (
                "Your photo looks very dark. "
                "Try a well-lit, front-facing photo in natural daylight for the most accurate result."
            )
        elif L_global_pct > 86:
            lighting_warning = (
                "Your photo looks overexposed. "
                "Avoid direct flash or strong backlighting for a more accurate reading."
            )

        # -- Step 8b: Glare & eyewear analysis ---------------------------------
        # Per-region glare from the 5 anatomical ROIs.
        any_glare       = any(region_glare_flag)
        max_glare_ratio = max(region_glare_rat) if region_glare_rat else 0.0

        # Eyewear proximity: glare in forehead or cheek zones (indices 0-2)
        # strongly suggests glasses reflections.
        eyewear_glare = any(
            region_glare_flag[i]
            for i in range(len(region_glare_flag))
            if i in EYEWEAR_ZONE_INDICES
        )

        # Dedicated eye-band scan (28-52% of face height, 10-90% of face width).
        # This strip sits exactly where glasses lenses are — slightly above the
        # cheek ROI and below the forehead ROI, so it fills the gap.
        eye_band_glare = False
        eye_band_ratio = 0.0
        if bbox is not None:
            bx, by, bw, bh = bbox
            eb_y1 = max(0, int(by + bh * 0.28))
            eb_y2 = min(img_h, int(by + bh * 0.52))
            eb_x1 = max(0, int(bx + bw * 0.10))
            eb_x2 = min(img_w, int(bx + bw * 0.90))
            eye_band = img[eb_y1:eb_y2, eb_x1:eb_x2]
            if eye_band.size >= 27:
                eye_band_glare, eye_band_ratio = _detect_glare(eye_band)

        # Combine all glare signals
        any_glare     = any_glare or eye_band_glare
        eyewear_glare = eyewear_glare or eye_band_glare

        print(
            f"[glare] per_region={[f'{r:.3%}' for r in region_glare_rat]} "
            f"eye_band={eye_band_ratio:.3%} "
            f"any={any_glare} eye={eyewear_glare}"
        )

        # -- Step 9: Confidence score  (combines all signals) ---------------
        #
        # Rules (evaluated in priority order):
        #   LOW    : per-region variance is high  (σ > 38)
        #   LOW    : eyewear glare detected  (glasses reflections)
        #   MEDIUM : moderate variance (σ > 20) OR any non-eyewear glare
        #   HIGH   : regions agree + no significant glare + even lighting
        region_std_conf = float(np.std(region_median_L)) if len(region_median_L) > 1 else 0.0

        confidence_reason = None

        if poor_framing:
            confidence        = "low"
            confidence_reason = "Subject seems to be partially out of frame. Please centre your face."
        elif region_std_conf > 38:
            confidence        = "low"
            confidence_reason = "Lighting looks very uneven — try a well-lit, front-facing photo."
        elif eyewear_glare:
            confidence        = "low"
            confidence_reason = (
                "Reflections detected — try removing glasses or "
                "stepping away from direct light to reduce glare."
            )
        elif region_std_conf > 20 or any_glare:
            confidence        = "medium"
            if any_glare:
                confidence_reason = (
                    "Some glare was detected in the photo — result may be "
                    "slightly less accurate. Try diffused or natural light."
                )
        else:
            confidence = "high"

        # Clamp to medium when we had fewer than 3 regions (fallback path)
        if len(region_median_L) < 3 and confidence == "high":
            confidence = "medium"

        # -- Step 10: Depth from L channel (UNCHANGED thresholds) -----------
        L_norm = L_75 * 100.0 / 255.0
        if   L_norm > 72: depth = "Fair"
        elif L_norm > 62: depth = "Light"
        elif L_norm > 50: depth = "Medium"
        elif L_norm > 38: depth = "Tan"
        else:             depth = "Deep"

        # -- Step 11: Undertone from A and B channels (UNCHANGED) -----------
        A_c = A_med - 128.0   # > 0 -> redder/pinker (cool cue)
        B_c = B_med - 128.0   # > 0 -> yellower/warmer (warm cue)

        if   B_c > 10 and B_c > A_c + 3: undertone = "warm"
        elif A_c > 8  and A_c > B_c - 3: undertone = "cool"
        else:                             undertone = "neutral"

        # -- Step 12: Representative hex for the UI swatch ------------------
        region_bgr_chunks = []
        for (rs, cs) in rois:
            region = img[rs, cs]
            if region.size < 150:
                continue
            mask      = _tight_skin_mask(region)
            mask_flat = mask.reshape(-1)
            bgr_flat  = region.reshape(-1, 3)
            skin_bgr  = bgr_flat[mask_flat > 0]
            if len(skin_bgr) < 10:
                skin_bgr = bgr_flat
            region_bgr_chunks.append(skin_bgr)

        if not region_bgr_chunks:
            region_bgr_chunks = [centre.reshape(-1, 3)]

        all_bgr    = np.vstack(region_bgr_chunks)
        bgr_u8     = np.clip(all_bgr, 0, 255).astype(np.uint8).reshape(-1, 1, 3)
        lab_swatch = cv2.cvtColor(bgr_u8, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
        bright_thresh = float(np.percentile(lab_swatch[:, 0], 60))   # top 40%
        bright_mask   = lab_swatch[:, 0] >= bright_thresh
        bright_bgr    = all_bgr[bright_mask] if bright_mask.any() else all_bgr

        mean_b    = int(np.clip(np.mean(bright_bgr[:, 0]), 0, 255))
        mean_g    = int(np.clip(np.mean(bright_bgr[:, 1]), 0, 255))
        mean_r    = int(np.clip(np.mean(bright_bgr[:, 2]), 0, 255))
        hex_color = f"#{mean_r:02x}{mean_g:02x}{mean_b:02x}"

        palette = _PALETTES_DETAILED[undertone]

        print(
            f"[analyze-skin] bbox={bbox} regions={len(region_median_L)} "
            f"L_75={L_75:.1f} A_c={A_c:.1f} B_c={B_c:.1f} "
            f"depth={depth} undertone={undertone} conf={confidence} "
            f"glare={any_glare}(eye={eyewear_glare},max={max_glare_ratio:.2%}) "
            f"warn={bool(lighting_warning)}"
        )

        return jsonify({
            "skin_tone":         f"{depth} {undertone.capitalize()}",
            "undertone":          undertone,
            "hex":                hex_color,
            "summary":            palette["summary"],
            "hair":               palette["hair"],
            "lips":               palette["lips"],
            "blush":              palette["blush"],
            "outfits":            palette["outfits"],
            "services":           palette["services"],
            "confidence":         confidence,
            "confidence_reason":  confidence_reason,
            "lighting_warning":   lighting_warning,
        })

    except Exception as exc:
        print(f"[analyze-skin error] {exc}")
        import traceback; traceback.print_exc()
        return jsonify({"error": "Analysis failed. Please try a different photo."}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "1") == "1")
