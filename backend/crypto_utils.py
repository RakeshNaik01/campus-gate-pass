"""
Cryptographic Utilities for Dual-Key Campus Gate Pass System
"""
import hashlib
import json
from datetime import datetime, timezone

def compute_sha256(data_str: str) -> str:
    """Computes SHA-256 hex digest for a string."""
    return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

def create_permanent_signature(hall_ticket_number: str, status: str, secure_salt: str) -> str:
    """
    Combines hall_ticket_number + status + secure_salt and generates SHA-256 signature.
    """
    raw_payload = f"{hall_ticket_number}:{status}:{secure_salt}"
    return compute_sha256(raw_payload)

def create_event_signature(hall_ticket_number: str, event_id: str, valid_from: str, valid_till: str, secure_salt: str) -> str:
    """
    Combines hall_ticket_number + event_id + valid_from + valid_till + secure_salt and generates SHA-256 signature.
    """
    raw_payload = f"{hall_ticket_number}:{event_id}:{valid_from}:{valid_till}:{secure_salt}"
    return compute_sha256(raw_payload)

def build_permanent_token_string(hall_ticket_number: str, status: str, secure_salt: str, student_name: str = "", course: str = "") -> str:
    """
    Builds the structural verifiable token JSON string for a permanent pass.
    """
    sig = create_permanent_signature(hall_ticket_number, status, secure_salt)
    token_data = {
        "type": "PERMANENT",
        "hall_ticket_number": hall_ticket_number,
        "name": student_name,
        "course": course,
        "status": status,
        "signature": sig
    }
    return json.dumps(token_data, separators=(',', ':'))

def build_event_token_string(hall_ticket_number: str, event_id: str, valid_from: str, valid_till: str, secure_salt: str, student_name: str = "", course: str = "") -> str:
    """
    Builds the structural verifiable token JSON string for an event pass.
    """
    sig = create_event_signature(hall_ticket_number, event_id, valid_from, valid_till, secure_salt)
    token_data = {
        "type": "EVENT",
        "hall_ticket_number": hall_ticket_number,
        "name": student_name,
        "course": course,
        "event_id": event_id,
        "valid_from": valid_from,
        "valid_till": valid_till,
        "signature": sig
    }
    return json.dumps(token_data, separators=(',', ':'))

def parse_iso_datetime(dt_str: str) -> datetime:
    """
    Parses ISO formatted datetime strings, normalizing timezone info.
    """
    cleaned = dt_str.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(cleaned)
    except ValueError:
        dt = datetime.strptime(cleaned[:19], "%Y-%m-%dT%H:%M:%S")
    
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
