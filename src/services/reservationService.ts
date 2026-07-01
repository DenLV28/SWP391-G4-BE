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
    createdAt: r.createdAt || r.created_at || '',
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

export async function updateReservation(id: string, patch: Partial<Reservation>): Promise<Reservation> {
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
