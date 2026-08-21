// Hybrid Online/Offline API and Storage Client
import {
  getLocalUsers,
  saveLocalUsers,
  saveSingleLocalUser,
  updateSingleLocalUserStatus,
  deleteSingleLocalUser,
  getLocalAuditLogs,
  verifyGateEntryOffline,
  parseExcelClientSide,
  downloadSampleExcelClientSide,
} from './offlineEngine';

const API_BASE_URL = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8000';

async function safeJson(response) {
  try {
    return await response.json();
  } catch (e) {
    try {
      const text = await response.text();
      return { status: 'ERROR', detail: text || `HTTP ${response.status}: ${response.statusText}` };
    } catch (e2) {
      return { status: 'ERROR', detail: `HTTP ${response.status}: ${response.statusText}` };
    }
  }
}

export async function createMobileScanSession() {
  try {
    const res = await fetch(`${API_BASE_URL}/mobile-session/create`, { method: 'POST' });
    return await safeJson(res);
  } catch (e) {
    return { session_id: 'SCAN-LOCAL', status: 'ACTIVE' };
  }
}

export async function pollMobileScanSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE_URL}/mobile-session/poll/${sessionId}`);
    return await safeJson(res);
  } catch (e) {
    return { scanned: false };
  }
}

export async function submitMobileScan(sessionId, payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/mobile-session/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, payload }),
    });
    return await safeJson(res);
  } catch (e) {
    // Fallback to offline verification
    return verifyGateEntryOffline(payload);
  }
}

export async function registerManualUser(userData) {
  try {
    const res = await fetch(`${API_BASE_URL}/register-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to register user');
    }
    // Also save to device offline storage
    saveSingleLocalUser(userData);
    return data;
  } catch (e) {
    console.warn('Backend unavailable; saving to local device memory:', e.message);
    const localUser = saveSingleLocalUser(userData);
    return {
      status: 'SUCCESS',
      message: `Registered ${localUser.role.toLowerCase()}: ${localUser.student_name} (Saved to Phone Storage)`,
      user: localUser,
    };
  }
}

export async function verifyGateEntry(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/verify-gate-entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload }),
    });
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return await safeJson(response);
  } catch (error) {
    console.warn('Backend unreachable / laptop offline; running local offline verification engine:', error.message);
    // Instant offline engine execution right on device
    return verifyGateEntryOffline(payload);
  }
}

export async function generatePermanentQR(hall_ticket_number) {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-permanent-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hall_ticket_number }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to generate permanent QR');
    }
    return data;
  } catch (error) {
    return {
      status: 'SUCCESS',
      hall_ticket_number,
      token: JSON.stringify({ hall_ticket_number, type: 'PERMANENT', valid: true }),
    };
  }
}

export async function generateEventQR(hall_ticket_number, eventId, validFrom, validTill) {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-event-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hall_ticket_number,
        event_id: eventId,
        valid_from: validFrom,
        valid_till: validTill,
      }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.detail || 'Failed to generate event QR');
    }
    return data;
  } catch (error) {
    return {
      status: 'SUCCESS',
      token: JSON.stringify({ hall_ticket_number, event_id: eventId, type: 'EVENT', valid_from: validFrom, valid_till: validTill }),
    };
  }
}

export async function importStudentRegistry(fileOrFormData) {
  try {
    let body = fileOrFormData;
    if (!(fileOrFormData instanceof FormData)) {
      body = new FormData();
      body.append('file', fileOrFormData);
    }

    const response = await fetch(`${API_BASE_URL}/import-student-registry`, {
      method: 'POST',
      body: body,
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Failed to import Excel spreadsheet');
    }

    // Refresh local cache if raw file available
    if (fileOrFormData instanceof File) {
      parseExcelClientSide(fileOrFormData).catch(() => {});
    }

    return data;
  } catch (error) {
    console.warn('Backend unavailable; running on-device client Excel ingester:', error.message);
    if (fileOrFormData instanceof File) {
      return await parseExcelClientSide(fileOrFormData);
    } else if (fileOrFormData instanceof FormData) {
      const f = fileOrFormData.get('file');
      if (f && f instanceof File) {
        return await parseExcelClientSide(f);
      }
    }
    throw error;
  }
}

export async function getNetworkStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/network-status`);
    if (!response.ok) throw new Error('Failed to get network status');
    return await safeJson(response);
  } catch (error) {
    return { is_online: false };
  }
}

export async function toggleNetworkStatus(isOnline) {
  try {
    const response = await fetch(`${API_BASE_URL}/toggle-network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_online: isOnline }),
    });
    return await safeJson(response);
  } catch (error) {
    return { status: 'SUCCESS', is_online: isOnline };
  }
}

export async function fetchSyncQueue() {
  try {
    const response = await fetch(`${API_BASE_URL}/sync-queue`);
    if (!response.ok) throw new Error('Failed to fetch sync queue');
    return await safeJson(response);
  } catch (error) {
    return [];
  }
}

export async function flushSyncQueue() {
  try {
    const response = await fetch(`${API_BASE_URL}/flush-sync-queue`, {
      method: 'POST',
    });
    return await safeJson(response);
  } catch (error) {
    return { status: 'SUCCESS', message: 'Local offline queue cleared.' };
  }
}

export async function fetchUsers() {
  try {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    const data = await safeJson(response);
    if (Array.isArray(data) && data.length > 0) {
      saveLocalUsers(data); // Synchronize phone storage
      return data;
    }
    return getLocalUsers();
  } catch (error) {
    console.warn('Backend unavailable; loading from phone storage:', error.message);
    return getLocalUsers();
  }
}

export async function deleteUser(hallTicketNumber) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(hallTicketNumber)}`, {
      method: 'DELETE',
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Failed to delete user');
    }
    deleteSingleLocalUser(hallTicketNumber);
    return data;
  } catch (error) {
    console.warn('Backend unavailable; removing from phone storage:', error.message);
    deleteSingleLocalUser(hallTicketNumber);
    return {
      status: 'SUCCESS',
      message: `Successfully removed student from phone storage.`,
      hall_ticket_number: hallTicketNumber,
    };
  }
}

export async function updateUserStatus(hallTicketNumber, status) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hall_ticket_number: hallTicketNumber, status }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Failed to update status');
    }
    updateSingleLocalUserStatus(hallTicketNumber, status);
    return data;
  } catch (error) {
    console.warn('Backend unavailable; updating in phone storage:', error.message);
    updateSingleLocalUserStatus(hallTicketNumber, status);
    return {
      status: 'SUCCESS',
      message: `Updated status to ${status} (Saved in Phone Storage)`,
      hall_ticket_number: hallTicketNumber,
      new_status: status,
    };
  }
}

export const fetchAllUsers = fetchUsers;

export function getSampleExcelUrl() {
  return `${API_BASE_URL}/sample-student-registry`;
}

export function downloadSampleExcel() {
  if (typeof window !== 'undefined') {
    try {
      downloadSampleExcelClientSide();
    } catch (e) {
      window.open(getSampleExcelUrl(), '_blank');
    }
  }
}

export async function fetchEvents() {
  try {
    const response = await fetch(`${API_BASE_URL}/events`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return await safeJson(response);
  } catch (error) {
    return [];
  }
}

export async function fetchGateLogs() {
  try {
    const response = await fetch(`${API_BASE_URL}/gate-logs`);
    if (!response.ok) throw new Error('Failed to fetch logs');
    const data = await safeJson(response);
    if (Array.isArray(data) && data.length > 0) return data;
    return getLocalAuditLogs();
  } catch (error) {
    return getLocalAuditLogs();
  }
}

export async function resetDatabase() {
  try {
    const response = await fetch(`${API_BASE_URL}/reset-db`, { method: 'POST' });
    return await safeJson(response);
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}
