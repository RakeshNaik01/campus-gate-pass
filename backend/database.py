"""
Dual-Key Relational Database Architecture (Local-First SQLite)
"""
import sqlite3
import os
from datetime import datetime, timezone, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gate_pass.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_reseed=False):
    """Initializes tables and seeds ONLY KETAVATH RAKESH NAIK as the baseline profile."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if force_reseed:
        cursor.execute("DROP TABLE IF EXISTS gate_audit_logs")
        cursor.execute("DROP TABLE IF EXISTS pending_sync_logs")
        cursor.execute("DROP TABLE IF EXISTS event_passes")
        cursor.execute("DROP TABLE IF EXISTS users")

    # 1. Users Table (Dual-Key: hall_ticket_number PK, adm_no UNIQUE, role)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        hall_ticket_number TEXT PRIMARY KEY,
        adm_no TEXT UNIQUE NOT NULL,
        student_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'STUDENT' CHECK(role IN ('STUDENT', 'LECTURER', 'FACULTY')),
        course TEXT NOT NULL,
        duration TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
        secure_salt TEXT NOT NULL
    );
    """)

    # 2. Event Passes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS event_passes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        hall_ticket_number TEXT NOT NULL,
        valid_from DATETIME NOT NULL,
        valid_till DATETIME NOT NULL,
        signature TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hall_ticket_number) REFERENCES users(hall_ticket_number)
    );
    """)

    # 3. Pending Sync Logs (Offline-First Queue)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pending_sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hall_ticket_number TEXT NOT NULL,
        student_name TEXT,
        adm_no TEXT,
        timestamp DATETIME NOT NULL,
        sync_status TEXT NOT NULL CHECK(sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
        message TEXT,
        dispatched_at DATETIME
    );
    """)

    # 4. Gate Audit Logs Table (SECTION 3: Real-Time Audit Trail)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gate_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME NOT NULL,
        hall_ticket_number TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'STUDENT',
        scan_type TEXT NOT NULL,
        status TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        reason TEXT
    );
    """)

    # 5. Used Single-Use Tokens Table (One-Time Scan Policy Enforcement)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS used_single_use_tokens (
        token_id TEXT PRIMARY KEY,
        hall_ticket_number TEXT,
        participant_name TEXT,
        pass_type TEXT,
        gate_direction TEXT,
        event_name TEXT,
        scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Check and Seed ONLY KETAVATH RAKESH NAIK if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]

    if count == 0:
        seed_users = [
            ("086256008", "25-5-117", "KETAVATH RAKESH NAIK", "STUDENT", "BCA", "2024-2027", "+919876543218", "rakesh.naik@campus.edu", "ACTIVE", "salt_086256008_5a1c9"),
        ]

        cursor.executemany("""
        INSERT INTO users (hall_ticket_number, adm_no, student_name, role, course, duration, phone_number, email, status, secure_salt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, seed_users)
        conn.commit()
        print(f"[DB] Initialized Dual-Key schema. Clean baseline set with ONLY KETAVATH RAKESH NAIK.")
    else:
        print(f"[DB] Database already initialized with {count} users.")

    conn.close()

if __name__ == "__main__":
    init_db(force_reseed=True)
