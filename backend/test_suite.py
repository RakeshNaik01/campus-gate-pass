import sys
import os
import json
import time
from datetime import datetime, timezone, timedelta

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from fastapi.testclient import TestClient

from main import app, init_db
from notifications import set_network_status, get_network_status, flush_pending_sync_queue
from excel_importer import generate_sample_excel_bytes

init_db(force_reseed=True)
client = TestClient(app)

def run_all_tests():
    passed = 0
    failed = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name} - Details: {details}")
            failed += 1

    print("\n========================================================")
    print("RUNNING DUAL-KEY & OFFLINE-FIRST GATE PASS TEST SUITE")
    print("========================================================\n")

    # 1. API Health & Initial Users
    res = client.get("/")
    assert_test("Gateway Health Check", res.status_code == 200 and res.json()["is_online"] is True)

    res = client.get("/users")
    users = res.json()
    assert_test("Seeded Dual-Key Users (7 profiles)", len(users) == 7, f"Found {len(users)} users")

    # 2. Excel Ingestion Engine (POST /import-student-registry)
    sample_excel = generate_sample_excel_bytes()
    files = {"file": ("new_students.xlsx", sample_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    res = client.post("/import-student-registry", files=files)
    assert_test("Excel Ingestion API Import", res.status_code == 200 and res.json()["imported_count"] == 5)

    res = client.get("/users")
    users_after_import = res.json()
    assert_test("Database Size After Excel Ingestion", len(users_after_import) == 12, f"Total users: {len(users_after_import)}")

    # 3. Permanent QR Verification (Hall Ticket No: 086256001 - Aarav Sharma)
    set_network_status(True)
    res = client.post("/generate-permanent-qr", json={"hall_ticket_number": "086256001"})
    perm_token_1 = res.json()["token"]

    verify_res = client.post("/verify-gate-entry", json={"payload": perm_token_1})
    v_data = verify_res.json()
    assert_test(
        "Tier 1: Permanent QR Verification (086256001)",
        v_data["status"] == "VERIFIED" and v_data["name"] == "Aarav Sharma" and v_data["notification_status"] == "NOTIFICATION DISPATCHED",
        f"Received: {v_data}"
    )

    # 4. Physical ID Card OCR Verification (Adm No: 25-5-117 -> KETAVATH RAKESH NAIK)
    ocr_payload = "STUDENT IDENTITY CARD\nADM NO: 25-5-117\nDEPT: BCA"
    verify_res = client.post("/verify-gate-entry", json={"payload": ocr_payload})
    v_data = verify_res.json()
    assert_test(
        "Tier 2: Physical ID OCR Lookup (25-5-117 -> KETAVATH RAKESH NAIK / 086256008)",
        v_data["status"] == "VERIFIED" and v_data["name"] == "KETAVATH RAKESH NAIK" and v_data["hall_ticket_number"] == "086256008",
        f"Received: {v_data}"
    )

    # 5. Suspended Profile Rejection (086256005 / 25-5-105 -> Vikram Malhotra)
    verify_res = client.post("/verify-gate-entry", json={"payload": "25-5-105"})
    v_data = verify_res.json()
    assert_test(
        "Reject Suspended Student Profile (25-5-105)",
        v_data["status"] == "NOT VERIFIED" and v_data["reason"] == "Profile Suspended",
        f"Received: {v_data}"
    )

    # 6. Unrecognized ID Rejection
    verify_res = client.post("/verify-gate-entry", json={"payload": "99-9-999_UNKNOWN"})
    v_data = verify_res.json()
    assert_test(
        "Reject Unrecognized ID Card",
        v_data["status"] == "NOT VERIFIED" and v_data["reason"] == "ID Number Unrecognized",
        f"Received: {v_data}"
    )

    # 7. Active Time-Bounded Event Pass
    now = datetime.now(timezone.utc)
    res = client.post("/generate-event-qr", json={
        "hall_ticket_number": "086256002",
        "event_id": "EVT-TECH-2026",
        "valid_from": (now - timedelta(hours=1)).isoformat(),
        "valid_till": (now + timedelta(hours=3)).isoformat()
    })
    active_event_token = res.json()["token"]
    verify_res = client.post("/verify-gate-entry", json={"payload": active_event_token})
    v_data = verify_res.json()
    assert_test(
        "Active Event Pass Verification",
        v_data["status"] == "VERIFIED" and "Event Pass Verified" in v_data["reason"],
        f"Received: {v_data}"
    )

    # 8. Expired Temporary Event Pass Rejection
    res = client.post("/generate-event-qr", json={
        "hall_ticket_number": "086256003",
        "event_id": "EVT-HACK-2026",
        "valid_from": (now - timedelta(days=2)).isoformat(),
        "valid_till": (now - timedelta(hours=2)).isoformat()
    })
    expired_event_token = res.json()["token"]
    verify_res = client.post("/verify-gate-entry", json={"payload": expired_event_token})
    v_data = verify_res.json()
    assert_test(
        "Reject Expired Temporary Event Pass",
        v_data["status"] == "NOT VERIFIED" and v_data["reason"] == "Temporary Event Pass Expired",
        f"Received: {v_data}"
    )

    # 9. Offline Simulation & Pending Sync Logs Queueing
    set_network_status(False) # Turn Station OFFLINE
    offline_ocr_payload = "25-5-104" # Ananya Iyer
    verify_res = client.post("/verify-gate-entry", json={"payload": offline_ocr_payload})
    v_data = verify_res.json()
    assert_test(
        "Offline Entry Verification (Access Granted & Queued)",
        v_data["status"] == "VERIFIED" and v_data["notification_status"] == "QUEUED FOR OFFLINE SYNC",
        f"Received: {v_data}"
    )

    # Verify presence in pending_sync_logs
    res = client.get("/sync-queue")
    queue = res.json()
    assert_test(
        "Pending Sync Log Queued in SQLite",
        len(queue) >= 1 and queue[0]["sync_status"] == "PENDING",
        f"Queue items: {len(queue)}"
    )

    # 10. Online Network Recovery & Automatic Background Queue Flush
    set_network_status(True) # Reconnect Online
    time.sleep(1) # Allow sync worker or manual flush
    flushed = flush_pending_sync_queue()
    assert_test("Queue Flush Upon Reconnection", flushed >= 1, f"Flushed: {flushed}")

    res = client.get("/sync-queue")
    queue_after = res.json()
    assert_test(
        "Queue Status Updated to SYNCED",
        all(q["sync_status"] == "SYNCED" for q in queue_after),
        f"Queue statuses: {[q['sync_status'] for q in queue_after]}"
    )

    print("\n--------------------------------------------------------")
    print(f"TEST RESULTS: {passed} PASSED, {failed} FAILED (Total {passed+failed})")
    print("--------------------------------------------------------\n")

    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    if not success:
        sys.exit(1)
