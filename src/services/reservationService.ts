import type { Reservation } from '../data/mockData';
import { buildApiUrl as buildUrl } from './apiConfig';

const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': '1' });

function toReservation(r: any): Reservation {
  return {
    id: String(r.id || r.reservation_id),
    userId: String(r.userId || r.user_id || ''),
    reservationCode: r.reservationCode || r.reservation_code || '',
    reservationType: r.reservationType || r.reservation_type || 'Flexible',
    slotAssignmentMode: r.slotAssignmentMode || r.slot_assignment_mode || 'Auto',
    vehicleType: r.vehicleType || r.vehicle_type,
    licensePlate: r.licensePlate || r.license_plate || '',
    date: r.date || '',
    startTime: r.startTime || r.start_time || '',
    endTime: r.endTime || r.end_time || '',
    floor: r.floor || '',
    area: r.area || '',
    slotCode: r.slotCode || r.slot_code || '',
    status: r.status || 'Pending',
    note: r.note || '',
    estimatedCost: r.estimatedCost ?? r.estimated_cost ?? 0,
    parkingLot: r.parkingLot || r.parking_lot || '',
    createdAt: r.createdAt || r.created_at || '',
    confirmedAt: r.confirmedAt || r.confirmed_at || '',
    checkedInAt: r.checkedInAt || r.checked_in_at || '',
    completedAt: r.completedAt || r.completed_at || '',
    cancelledAt: r.cancelledAt || r.cancelled_at || '',
  } as Reservation;
}

export async function fetchReservationsByUser(userId: string): Promise<Reservation[]> {
  const res = await fetch(buildUrl(`/api/reservations?userId=${encodeURIComponent(userId)}`), {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Reservations API ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return list.map(toReservation);
}

export async function fetchAllReservations(): Promise<Reservation[]> {
  const res = await fetch(buildUrl('/api/reservations'), { headers: headers() });
  if (!res.ok) throw new Error(`Reservations API ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(toReservation);
}

export async function createReservation(reservation: Reservation): Promise<Reservation> {
  const res = await fetch(buildUrl('/api/reservations'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(reservation),
  });
  if (!res.ok) throw new Error(`Reservations API ${res.status}`);
  const data = await res.json();
  return toReservation(data.reservation ?? data);
}

export async function updateReservation(
  id: string,
  // cancelledBy/cancelReason ride along on cancellations so the backend can
  // word the driver's bell notification correctly (user vs staff vs overdue).
  // staffId: gửi khi thao tác do STAFF thực hiện (xác nhận/hủy) — backend tự
  // tra bãi được gán của staff và chặn (403) nếu khác bãi của đặt chỗ.
  patch: Partial<Reservation> & { cancelledBy?: 'user' | 'staff'; cancelReason?: 'overdue' | string; staffId?: string },
): Promise<Reservation> {
  const res = await fetch(buildUrl(`/api/reservations/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Reservations API ${res.status}`);
  const data = await res.json();
  return toReservation(data.reservation ?? data);
}

export async function deleteReservation(id: string): Promise<void> {
  const res = await fetch(buildUrl(`/api/reservations/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Reservations API ${res.status}`);
}

export type ReservationEvent =
  | { type: 'upsert'; reservation: Reservation }
  | { type: 'deleted'; id: string };

/**
 * Push-based sync: đặt chỗ mới/được xác nhận/bị hủy đẩy tới mọi tab đang mở
 * ngay lập tức — user đặt chỗ xong staff thấy yêu cầu tức thì, không phải
 * chờ tới chu kỳ poll 10 giây tiếp theo (và ngược lại khi staff xác nhận).
 */
export function subscribeToReservationEvents(onEvent: (e: ReservationEvent) => void): () => void {
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout>;

  const connect = async () => {
    if (cancelled) return;
    try {
      const res = await fetch(buildUrl('/api/reservations/events'), {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'ngrok-skip-browser-warning': '1',
        },
      });
      if (!res.ok || !res.body) throw new Error('SSE failed');

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        if (cancelled) { reader.cancel(); break; }
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const raw = JSON.parse(line.slice(6));
            if (raw?.deleted) onEvent({ type: 'deleted', id: String(raw.id) });
            else onEvent({ type: 'upsert', reservation: toReservation(raw) });
          } catch {}
        }
      }
    } catch { /* fall through to retry */ }

    if (!cancelled) retryTimer = setTimeout(connect, 5000);
  };

  connect();
  return () => { cancelled = true; clearTimeout(retryTimer); };
}
