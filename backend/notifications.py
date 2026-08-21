import os
import sys
import time
import threading
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from database import get_db_connection

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Load environment variables
load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+15005550006")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "gate-security@campus.edu")

# Logger setup
logger = logging.getLogger("GateNotificationEngine")
logger.setLevel(logging.INFO)

# Internal client network state flag (thread-safe)
_network_lock = threading.Lock()
_is_online = True

def get_network_status() -> bool:
    with _network_lock:
        return _is_online

def set_network_status(status: bool) -> bool:
    global _is_online
    with _network_lock:
        _is_online = status
    print(f"\n[NETWORK STATUS CHANGE] Gate Station Online State: {'ONLINE' if status else 'OFFLINE SIMULATION'}\n")
    return _is_online

def format_gate_message(student_name: str, timestamp_str: str) -> str:
    """Standardized gate access confirmation message."""
    return f"Hello {student_name}, your gate entry verification was successful at {timestamp_str}. Access Granted."

def send_sms_direct(phone: str, message: str) -> bool:
    """Dispatches SMS via Twilio or gracefully simulates when credentials aren't active."""
    try:
        if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and not TWILIO_ACCOUNT_SID.startswith("your_"):
            try:
                from twilio.rest import Client
                client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                client.messages.create(
                    body=message,
                    from_=TWILIO_PHONE_NUMBER,
                    to=phone
                )
                print(f"[TWILIO SMS LIVE] Sent to {phone}: '{message}'")
                return True
            except Exception as twilio_err:
                print(f"[TWILIO SMS ERROR - Fallback Active] {str(twilio_err)}")
        
        # Simulated dispatch log
        print(f"[SMS DISPATCHED] -> To: {phone} | Body: '{message}'")
        return True
    except Exception as e:
        print(f"[SMS EXCEPTION] Non-blocking dispatch error: {str(e)}")
        return False

def send_email_direct(email: str, student_name: str, message: str) -> bool:
    """Dispatches Email via SendGrid or gracefully simulates when credentials aren't active."""
    try:
        if SENDGRID_API_KEY and not SENDGRID_API_KEY.startswith("your_"):
            try:
                from sendgrid import SendGridAPIClient
                from sendgrid.helpers.mail import Mail
                sg_mail = Mail(
                    from_email=SENDER_EMAIL,
                    to_emails=email,
                    subject="Campus Gate Pass - Access Granted",
                    html_content=f"<h3>Campus Security Verification</h3><p>{message}</p><p><strong>Status:</strong> Access Granted</p>"
                )
                sg = SendGridAPIClient(SENDGRID_API_KEY)
                sg.send(sg_mail)
                print(f"[SENDGRID EMAIL LIVE] Sent to {email}")
                return True
            except Exception as sg_err:
                print(f"[SENDGRID EMAIL ERROR - Fallback Active] {str(sg_err)}")
        
        # Simulated dispatch log
        print(f"[EMAIL DISPATCHED] -> To: {email} | Subject: 'Campus Gate Pass - Access Granted' | Body: '{message}'")
        return True
    except Exception as e:
        print(f"[EMAIL EXCEPTION] Non-blocking dispatch error: {str(e)}")
        return False

def process_live_notification(student_name: str, phone: str, email: str, timestamp_str: str):
    """Executes asynchronous SMS and Email delivery."""
    msg = format_gate_message(student_name, timestamp_str)
    send_sms_direct(phone, msg)
    send_email_direct(email, student_name, msg)

def queue_offline_entry(hall_ticket_number: str, student_name: str, adm_no: str, timestamp_str: str) -> bool:
    """Caches entry verification into pending_sync_logs when station is offline."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        msg = format_gate_message(student_name, timestamp_str)
        cursor.execute("""
        INSERT INTO pending_sync_logs (hall_ticket_number, student_name, adm_no, timestamp, sync_status, message)
        VALUES (?, ?, ?, ?, 'PENDING', ?)
        """, (hall_ticket_number, student_name, adm_no, timestamp_str, msg))
        conn.commit()
        conn.close()
        print(f"[OFFLINE QUEUE] Cached entry for {student_name} (HTN: {hall_ticket_number}, Adm: {adm_no}) in pending_sync_logs.")
        return True
    except Exception as e:
        print(f"[OFFLINE QUEUE ERROR] Failed to cache pending log: {str(e)}")
        return False

def flush_pending_sync_queue() -> int:
    """
    Flushes all PENDING records in pending_sync_logs chronologically,
    dispatching notifications and marking them SYNCED.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT p.id, p.hall_ticket_number, p.student_name, p.adm_no, p.timestamp, p.message,
           u.phone_number, u.email
    FROM pending_sync_logs p
    LEFT JOIN users u ON p.hall_ticket_number = u.hall_ticket_number
    WHERE p.sync_status = 'PENDING'
    ORDER BY p.timestamp ASC
    """)
    pending_items = cursor.fetchall()

    if not pending_items:
        conn.close()
        return 0

    print(f"\n[SYNC WORKER] Network Online! Flushing {len(pending_items)} stacked offline notification(s) chronologically...")

    flushed_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for item in pending_items:
        log_id = item["id"]
        name = item["student_name"] or "Student"
        phone = item["phone_number"] or "+919876543210"
        email = item["email"] or "student@campus.edu"
        msg = item["message"] or format_gate_message(name, item["timestamp"])

        # Dispatch queued notification
        send_sms_direct(phone, f"[SYNCED FROM OFFLINE QUEUE] {msg}")
        send_email_direct(email, name, f"[SYNCED FROM OFFLINE QUEUE] {msg}")

        # Update status
        cursor.execute("""
        UPDATE pending_sync_logs
        SET sync_status = 'SYNCED', dispatched_at = ?
        WHERE id = ?
        """, (now_iso, log_id))
        flushed_count += 1

    conn.commit()
    conn.close()
    print(f"[SYNC WORKER] Successfully flushed and synced {flushed_count} queued gate pass entries.\n")
    return flushed_count

def _sync_worker_daemon():
    """Background listener thread running every 4 seconds to sync queued logs upon reconnection."""
    while True:
        try:
            if get_network_status():
                flush_pending_sync_queue()
        except Exception as e:
            print(f"[SYNC WORKER ERROR] Daemon loop exception: {str(e)}")
        time.sleep(4)

# Start background sync daemon thread
sync_thread = threading.Thread(target=_sync_worker_daemon, daemon=True, name="OfflineSyncWorker")
sync_thread.start()
print("[INIT] OfflineSyncWorker background thread started.")
