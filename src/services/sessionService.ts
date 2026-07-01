import type { ParkingSession } from '../data/mockData';
import { buildApiUrl as buildUrl } from './apiConfig';
const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': '1' });

function toSession(r: any): ParkingSession {
  return {
    id: String(r.id || r.session_id),
    userId: String(r.userId || r.user_id || ''),
    ticketCode: r.ticketCode || r.ticket_code || '',
    licensePlate: r.licensePlate || r.license_plate || '',
    vehicleType: r.vehicleType || r.vehicle_type,
    checkInTime: r.checkInTime || r.check_in_time || '',
    checkOutTime: r.checkOutTime || r.check_out_time || '',
    expectedEndTime: r.expectedEndTime || r.expected_end_time || '',
    entryGate: r.entryGate || r.entry_gate || '',
    floor: r.floor || '',
    area: r.area || '',
    slotCode: r.slotCode || r.slot_code || '',
    estimatedFee: r.estimatedFee ?? r.estimated_fee ?? 0,
    paymentStatus: r.paymentStatus || r.payment_status || 'Unpaid',
    sessionStatus: r.sessionStatus || r.session_status || 'Active',
    barrierStatus: r.barrierStatus || r.barrier_status || 'Closed',
  };
}

export async function fetchSessionsByUser(userId: string): Promise<ParkingSession[]> {
  const res = await fetch(buildUrl(`/api/sessions?userId=${encodeURIComponent(userId)}`), {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Sessions API ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(toSession);
}

export async function fetchActiveSession(userId: string): Promise<ParkingSession | null> {
  const res = await fetch(buildUrl(`/api/sessions?userId=${encodeURIComponent(userId)}&active=true`), {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Sessions API ${res.status}`);
  const data = await res.json();
  const list = (Array.isArray(data) ? data : []).map(toSession);
  return list.find((s) => s.sessionStatus === 'Active') ?? null;
}

export async function createSession(session: ParkingSession): Promise<ParkingSession> {
  const res = await fetch(buildUrl('/api/sessions'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error(`Sessions API ${res.status}`);
  const data = await res.json();
  return toSession(data.session ?? data);
}

export async function updateSession(
  id: string,
  patch: {
    sessionStatus?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    checkOutTime?: string;
    estimatedFee?: number;
    barrierStatus?: string;
  },
): Promise<ParkingSession> {
  const res = await fetch(buildUrl(`/api/sessions/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Sessions API ${res.status}`);
  const data = await res.json();
  return toSession(data.session ?? data);
}
