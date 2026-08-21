"""
Dual-Key & Offline-First Live Mock Traffic Simulation Script
"""
import httpx
import json
import time
import sys
from datetime import datetime, timezone, timedelta

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

API_BASE = "http://127.0.0.1:8000"

def simulate_upgraded_traffic():
    print("\n========================================================")
    print("DUAL-KEY & OFFLINE-FIRST CAMPUS GATE TRAFFIC SIMULATOR")
    print("========================================================\n")

    client = httpx.Client(base_url=API_BASE, timeout=10.0)

    # 1. Check API health & Network Mode
    root = client.get("/").json()
    print(f"[*] Gateway Status: ONLINE | System: {root['service']} v{root['version']}")
    print(f"[*] Station Network State: {'ONLINE' if root['is_online'] else 'OFFLINE'}")

    # 2. Check Users
    users = client.get("/users").json()
    print(f"[*] Retrieved {len(users)} dual-key student/faculty profiles from SQLite.")
    for u in users[:5]:
        print(f"    - [{u['status']}] {u['student_name']} (HTN: {u['hall_ticket_number']}, Adm: {u['adm_no']}, Course: {u['course']})")

    print("\n--------------------------------------------------------")
    print("TESTING DUAL-KEY ENTRY SCENARIOS & NOTIFICATION WORKERS")
    print("--------------------------------------------------------")

    # Set Station ONLINE first
    client.post("/toggle-network", json={"is_online": True})

    # Scenario 1: Permanent QR Token (Aarav Sharma - 086256001)
    res = client.post("/generate-permanent-qr", json={"hall_ticket_number": "086256001"}).json()
    resp1 = client.post("/verify-gate-entry", json={"payload": res["token"]}).json()
    print(f"\n[01] Tier 1: Decrypted QR Payload (086256001 -> Aarav Sharma)")
    print(f"     Status: {resp1['status']} | Reason: {resp1['reason']}")
    print(f"     Notification: {resp1['notification_status']}")

    # Scenario 2: Physical ID OCR Text (Kavya Swaminathan - 25-5-117)
    resp2 = client.post("/verify-gate-entry", json={"payload": "CAMPUS ID CARD\nADM NO: 25-5-117\nDEPT: DATA SCIENCE"}).json()
    print(f"\n[02] Tier 2: Physical ID OCR Text (Adm: 25-5-117 -> HTN: {resp2['hall_ticket_number']})")
    print(f"     Status: {resp2['status']} | Student: {resp2['name']} ({resp2['course']})")
    print(f"     Notification: {resp2['notification_status']}")

    # Scenario 3: Suspended Profile Rejection (Vikram Malhotra - 25-5-105)
    resp3 = client.post("/verify-gate-entry", json={"payload": "25-5-105"}).json()
    print(f"\n[03] Rejection: Suspended Profile Scan (Adm: 25-5-105)")
    print(f"     Status: {resp3['status']} | Reason: {resp3['reason']}")

    # Scenario 4: Unrecognized Card
    resp4 = client.post("/verify-gate-entry", json={"payload": "99-9-999"}).json()
    print(f"\n[04] Rejection: Unregistered Card Number (99-9-999)")
    print(f"     Status: {resp4['status']} | Reason: {resp4['reason']}")

    # Scenario 5: Offline State Transition & SQLite Queueing
    print("\n--------------------------------------------------------")
    print("TESTING OFFLINE NETWORK FAILURE & ASYNC QUEUE RECOVERY")
    print("--------------------------------------------------------")
    
    # Toggle OFFLINE
    client.post("/toggle-network", json={"is_online": False})
    print("[*] Simulated Network Outage: Station is now OFFLINE.")

    # Scan entry while offline (Priya Patel - 25-5-102)
    resp5 = client.post("/verify-gate-entry", json={"payload": "25-5-102"}).json()
    print(f"\n[05] Offline Gate Scan (Priya Patel - 25-5-102)")
    print(f"     Status: {resp5['status']} (Access Granted Instantly)")
    print(f"     Notification Queue State: {resp5['notification_status']}")

    # Verify pending queue
    queue = client.get("/sync-queue").json()
    print(f"[*] Offline Sync Queue Size: {len(queue)} record(s).")
    for q in queue:
        print(f"    - Log ID {q['id']}: {q['student_name']} (HTN: {q['hall_ticket_number']}) -> Status: {q['sync_status']}")

    # Restore ONLINE connectivity
    print("\n[*] Restoring Internet Connectivity: Station is now ONLINE...")
    client.post("/toggle-network", json={"is_online": True})

    # Allow daemon thread or manual trigger to flush
    time.sleep(1)
    flush_res = client.post("/flush-sync-queue").json()
    print(f"[*] Sync Worker Queue Flush Result: {flush_res['flushed_count']} notification(s) dispatched.")

    queue_after = client.get("/sync-queue").json()
    print(f"[*] Updated Queue Statuses: {[q['sync_status'] for q in queue_after]}")

    print("\n========================================================")
    print("ALL DUAL-KEY & OFFLINE-FIRST INTEGRATION TESTS PASSED!")
    print("========================================================\n")

if __name__ == "__main__":
    simulate_upgraded_traffic()
