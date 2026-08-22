"""
Administrative Excel Ingestion Engine (.xlsx / .csv) for Student & Lecturer Registry
"""
import io
import os
import pandas as pd
import hashlib
from database import get_db_connection

REQUIRED_COLUMNS = [
    "hall_ticket_number",
    "adm_no",
    "student_name",
    "course",
    "duration",
    "phone_number",
    "email",
    "status"
]

def generate_salt_for_htn(htn: str) -> str:
    """Generates deterministic cryptographic salt for imported user."""
    h = hashlib.sha256(f"CAMPUS_SALT_{htn}".encode()).hexdigest()[:8]
    return f"salt_{htn}_{h}"

def generate_sample_excel_bytes() -> bytes:
    """Generates an in-memory sample Excel registry template with Role (Student/Lecturer)."""
    sample_data = [
        {
            "hall_ticket_number": "086256010",
            "adm_no": "25-5-120",
            "student_name": "Siddharth Rao",
            "role": "STUDENT",
            "course": "B.Tech Artificial Intelligence",
            "duration": "2023 - 2027",
            "phone_number": "+919876543220",
            "email": "siddharth.rao@campus.edu",
            "status": "ACTIVE"
        },
        {
            "hall_ticket_number": "086256011",
            "adm_no": "25-5-121",
            "student_name": "Divya Krishnan",
            "role": "STUDENT",
            "course": "B.Tech Cyber Security",
            "duration": "2023 - 2027",
            "phone_number": "+919876543221",
            "email": "divya.k@campus.edu",
            "status": "ACTIVE"
        },
        {
            "hall_ticket_number": "086256012",
            "adm_no": "25-5-122",
            "student_name": "Aditya Sengupta",
            "role": "STUDENT",
            "course": "B.Tech Robotics & Automation",
            "duration": "2022 - 2026",
            "phone_number": "+919876543222",
            "email": "aditya.s@campus.edu",
            "status": "ACTIVE"
        },
        {
            "hall_ticket_number": "086256098",
            "adm_no": "FAC-25-02",
            "student_name": "Prof. Rajesh Sharma",
            "role": "LECTURER",
            "course": "Department of Artificial Intelligence",
            "duration": "Permanent Faculty",
            "phone_number": "+919876543298",
            "email": "rajesh.sharma@campus.edu",
            "status": "ACTIVE"
        },
        {
            "hall_ticket_number": "086256014",
            "adm_no": "25-5-124",
            "student_name": "Varun Kapoor",
            "role": "STUDENT",
            "course": "B.Tech Information Technology",
            "duration": "2021 - 2025",
            "phone_number": "+919876543224",
            "email": "varun.k@campus.edu",
            "status": "SUSPENDED"
        }
    ]

    df = pd.DataFrame(sample_data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='CampusRegistry')
    return output.getvalue()

def process_student_excel_upload(file_contents: bytes, filename: str = "upload.xlsx"):
    """
    Ingests an Excel (.xlsx/.xls) or CSV buffer, validates columns,
    and executes a transactional bulk-upsert into the SQLite users table with role support.
    """
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_contents))
        else:
            df = pd.read_excel(io.BytesIO(file_contents), engine="openpyxl")
    except Exception as e:
        return {
            "status": "ERROR",
            "message": f"Failed to parse spreadsheet file: {str(e)}",
            "inserted_count": 0
        }

    # Normalize column names: strip whitespace, lowercase, replace spaces and special chars with underscores
    col_mapping = {}
    for c in df.columns:
        norm = str(c).strip().lower().replace(" ", "_").replace(".", "").replace("-", "_")
        if norm in ["hall_ticket_number", "hall_ticket_no", "ht_no", "htno", "roll_no", "rollno", "reg_no", "regno", "pin_no", "pin", "htn", "id"]:
            col_mapping[c] = "hall_ticket_number"
        elif norm in ["adm_no", "adm_number", "admission_no", "admission_number", "admission", "card_no", "id_no", "adm", "admn_no"]:
            col_mapping[c] = "adm_no"
        elif norm in ["student_name", "student", "name", "full_name", "candidate_name"]:
            col_mapping[c] = "student_name"
        elif norm in ["phone_number", "phone", "mobile", "contact", "mobile_no"]:
            col_mapping[c] = "phone_number"
        elif norm in ["email", "email_id", "mail"]:
            col_mapping[c] = "email"
        elif norm in ["course", "branch", "department", "dept", "class", "stream"]:
            col_mapping[c] = "course"
        elif norm in ["duration", "batch", "year", "academic_year"]:
            col_mapping[c] = "duration"
        elif norm in ["status", "state"]:
            col_mapping[c] = "status"
        elif norm in ["role", "type", "designation", "category"]:
            col_mapping[c] = "role"
        else:
            col_mapping[c] = norm

    df.rename(columns=col_mapping, inplace=True)

    # Ensure required columns exist, fallback if needed
    if "student_name" not in df.columns:
        return {
            "status": "ERROR",
            "message": "Missing 'student_name' or 'name' column in spreadsheet.",
            "inserted_count": 0
        }
    if "hall_ticket_number" not in df.columns and "adm_no" not in df.columns:
        return {
            "status": "ERROR",
            "message": "Spreadsheet must contain at least one ID column: 'hall_ticket_number' or 'adm_no'.",
            "inserted_count": 0
        }

    if "hall_ticket_number" not in df.columns:
        df["hall_ticket_number"] = df["adm_no"]
    if "adm_no" not in df.columns:
        df["adm_no"] = df["hall_ticket_number"]
    if "course" not in df.columns:
        df["course"] = "BCA"
    if "duration" not in df.columns:
        df["duration"] = "2024-2027"
    if "phone_number" not in df.columns:
        df["phone_number"] = "+919876543210"
    if "email" not in df.columns:
        df["email"] = "student@campus.edu"
    if "status" not in df.columns:
        df["status"] = "ACTIVE"
    if "role" not in df.columns:
        df["role"] = "STUDENT"

    conn = get_db_connection()
    cursor = conn.cursor()

    inserted_count = 0
    updated_count = 0
    errors = []

    try:
        cursor.execute("BEGIN TRANSACTION")

        for idx, row in df.iterrows():
            try:
                htn = str(row.get("hall_ticket_number", "")).strip()
                adm_no = str(row.get("adm_no", "")).strip()
                name = str(row.get("student_name", "")).strip()
                role = str(row.get("role", "STUDENT")).strip().upper()
                if role not in ["STUDENT", "LECTURER", "FACULTY"]:
                    role = "STUDENT"
                course = str(row.get("course", "")).strip()
                duration = str(row.get("duration", "")).strip()
                phone = str(row.get("phone_number", "")).strip()
                email = str(row.get("email", "")).strip()
                raw_status = str(row.get("status", "ACTIVE")).strip().upper()
                if "SUSP" in raw_status or "BLOCK" in raw_status:
                    status = "SUSPENDED"
                elif "INACT" in raw_status or "DEACT" in raw_status or "EXPIR" in raw_status:
                    status = "INACTIVE"
                else:
                    status = "ACTIVE"

                if not htn or not adm_no or not name:
                    errors.append(f"Row {idx+1}: Missing critical identifiers (hall_ticket_number, adm_no, or student_name)")
                    continue

                salt = generate_salt_for_htn(htn)

                # Check if user exists by hall_ticket_number OR adm_no
                cursor.execute("""
                SELECT hall_ticket_number FROM users 
                WHERE hall_ticket_number = ? OR UPPER(adm_no) = UPPER(?)
                LIMIT 1
                """, (htn, adm_no))
                existing_row = cursor.fetchone()

                if existing_row:
                    target_htn = existing_row["hall_ticket_number"]
                    cursor.execute("""
                    UPDATE users SET
                        adm_no = ?,
                        student_name = ?,
                        role = ?,
                        course = ?,
                        duration = ?,
                        phone_number = ?,
                        email = ?,
                        status = ?,
                        secure_salt = ?
                    WHERE hall_ticket_number = ?
                    """, (adm_no, name, role, course, duration, phone, email, status, salt, target_htn))
                    updated_count += 1
                else:
                    cursor.execute("""
                    INSERT INTO users (hall_ticket_number, adm_no, student_name, role, course, duration, phone_number, email, status, secure_salt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (htn, adm_no, name, role, course, duration, phone, email, status, salt))
                    inserted_count += 1
            except Exception as row_err:
                errors.append(f"Row {idx+1} Error: {str(row_err)}")

        conn.commit()
        total_count = inserted_count + updated_count
        return {
            "status": "SUCCESS",
            "message": f"Successfully ingested & updated {total_count} student/faculty profile(s) from spreadsheet.",
            "inserted_count": total_count,
            "imported_count": total_count,
            "errors": errors
        }
    except Exception as trans_err:
        conn.rollback()
        return {
            "status": "ERROR",
            "message": f"Database transaction failed: {str(trans_err)}",
            "inserted_count": 0
        }
    finally:
        conn.close()
