"""
Pydantic Schemas for Dual-Key Campus Gate Pass System
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal, List

class PermanentPassRequest(BaseModel):
    hall_ticket_number: str

class EventPassRequest(BaseModel):
    hall_ticket_number: str
    event_id: str
    valid_from: str = Field(description="ISO 8601 string, e.g. 2026-08-21T09:00:00Z")
    valid_till: str = Field(description="ISO 8601 string, e.g. 2026-08-21T18:00:00Z")

class PassGenerationResponse(BaseModel):
    status: str
    token: str
    qr_payload: str
    hall_ticket_number: str
    student_name: str
    course: str
    pass_type: str
    details: dict

class VerifyGateEntryRequest(BaseModel):
    payload: str

class GateVerificationResponse(BaseModel):
    status: Literal["VERIFIED", "NOT VERIFIED"]
    name: str
    course: str
    hall_ticket_number: str
    adm_no: str
    reason: str
    notification_status: Optional[str] = "NONE"

class NetworkToggleRequest(BaseModel):
    is_online: bool

class UserRecord(BaseModel):
    hall_ticket_number: str
    adm_no: str
    student_name: str
    course: str
    duration: str
    phone_number: str
    email: str
    status: str

class SyncLogRecord(BaseModel):
    id: int
    hall_ticket_number: str
    student_name: Optional[str]
    adm_no: Optional[str]
    timestamp: str
    sync_status: str
    message: Optional[str]
    dispatched_at: Optional[str]
