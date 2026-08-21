# 🎓 Offline-First Dual-Key Campus Gate Entry Pass System

An enterprise-grade Full-Stack Campus Gate Entry Pass Application engineered with **Dual-Key Relational Authentication (Hall Ticket No & Admission No), Excel Student Registry Ingestion, Automated Twilio SMS & SendGrid Email Workers, and an Offline-First SQLite Synchronization Engine**.

---

## 🌟 Key Features

1. **Dual-Key Relational Verification (Two-Tier Model)**:
   - **Tier 1 (Decrypted QR Payload)**: Verifies via hidden system primary key `hall_ticket_number` (e.g., `086256008`).
   - **Tier 2 (Physical ID Card OCR Text)**: Extracts printed `adm_no` (e.g., `25-5-117`) and cross-references to the hidden student profile.
2. **Administrative Excel Ingestion Engine**:
   - `POST /import-student-registry`: Bulk-imports `.xlsx` / `.csv` registries with `pandas` & `openpyxl`.
   - `GET /sample-student-registry`: Generates and downloads a sample spreadsheet template.
3. **Time-Bounded Event Access Passes**:
   - Issue event passes with cryptographic SHA-256 signatures and strict validity windows (`valid_from` to `valid_till`).
4. **Asynchronous Offline-First Notification Engine**:
   - **Online Mode**: Asynchronously dispatches SMS via Twilio and Email via SendGrid without blocking gate entry latency.
   - **Offline Mode**: Automatically caches entries in `pending_sync_logs`.
   - **Automatic Sync Daemon**: Persistent background thread monitors network reconnection and flushes the queue chronologically.
5. **High-Visibility Security UI (React Native / Expo / Web)**:
   - 🟢 **Emerald Green Overlay**: Access Granted + Student Details + 3-second auto-dismiss.
   - 🔴 **Crimson Red Overlay**: Access Denied + Explicit Reason + Manual security officer override.
   - 🔄 **Offline Queue Manager**: Real-time queue monitor with manual flush actions.

---

## 🚀 Quick Start Guide

### 1. Backend (FastAPI + SQLite)

```bash
cd backend
# Install dependencies
python -m pip install -r requirements.txt

# Run database initialization & automated test suite
python test_suite.py

# Launch FastAPI server
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
- API Base URL: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`

### 2. Frontend (React Native / Expo / Web)

```bash
cd frontend
# Install dependencies
npm install --legacy-peer-deps

# Run Web Preview (Vite)
npx vite preview --port 3000

# Or run on Mobile Devices (Expo)
npx expo start
```
- Web Application Console: `http://localhost:3000`

---

## 📋 Database Schema (Local SQLite `gate_pass.db`)

### `users`
| Field | Type | Description |
|---|---|---|
| `hall_ticket_number` | TEXT PRIMARY KEY | Hidden system finder (e.g. `086256008`) |
| `adm_no` | TEXT UNIQUE | Visible card ID (e.g. `25-5-117`) |
| `student_name` | TEXT | Student Full Name |
| `course` | TEXT | Academic Course / Department |
| `duration` | TEXT | Duration (e.g. `2023 - 2027`) |
| `phone_number` | TEXT | Mobile phone for Twilio SMS |
| `email` | TEXT | Email address for SendGrid |
| `status` | TEXT | `ACTIVE` / `INACTIVE` / `SUSPENDED` |
| `secure_salt` | TEXT | Cryptographic user secret salt |

### `event_passes`
| Field | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Auto-increment identifier |
| `event_id` | TEXT | Event ID (e.g. `EVT-TECH-2026`) |
| `hall_ticket_number` | TEXT | FK referencing `users` |
| `valid_from` | DATETIME | Pass start timestamp |
| `valid_till` | DATETIME | Pass expiration timestamp |
| `signature` | TEXT | SHA-256 cryptographic signature |

### `pending_sync_logs` (Offline Cache)
| Field | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Queue item ID |
| `hall_ticket_number` | TEXT | Student Hall Ticket Number |
| `student_name` | TEXT | Student Name |
| `adm_no` | TEXT | Admission Number |
| `timestamp` | DATETIME | Scan timestamp |
| `sync_status` | TEXT | `PENDING` / `SYNCED` / `FAILED` |
| `message` | TEXT | Formatted notification body |
| `dispatched_at` | DATETIME | Cloud sync dispatch timestamp |

---

## 🧪 Testing & Verification

Run the automated integration suite:
```bash
cd backend
python test_suite.py
```

Run the live traffic and network outage simulator:
```bash
python mock_traffic_simulation.py
```
