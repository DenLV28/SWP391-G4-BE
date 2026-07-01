import type { Payment, ParkingSession, Reservation, User, Vehicle } from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(emailOrPhone: string, password: string) {
  return req<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrPhone, password }),
  });
}

export async function register(data: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  plateNumber?: string;
  vehicleType?: string;
  brand?: string;
  model?: string;
}) {
  return req<{ user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUsers() {
  return req<User[]>('/api/users');
}

export async function createUser(data: {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status?: string;
  password?: string;
}) {
  return req<{ user: User }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(id: string, data: Partial<User & { password?: string }>) {
  return req<{ user: User }>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: string) {
  return req<{ message: string }>(`/api/users/${id}`, { method: 'DELETE' });
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export async function getVehicles(userId?: string) {
  const qs = userId ? `?userId=${userId}` : '';
  return req<Vehicle[]>(`/api/vehicles${qs}`);
}

export async function createVehicle(data: {
  userId: string;
  licensePlate: string;
  vehicleType: string;
  brand?: string;
  model?: string;
}) {
  return req<{ vehicle: Vehicle }>('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function setDefaultVehicle(id: string, userId: string) {
  return req<{ vehicle: Vehicle }>(`/api/vehicles/${id}/default`, {
    method: 'PUT',
    body: JSON.stringify({ userId }),
  });
}

export async function deleteVehicle(id: string) {
  return req<{ message: string }>(`/api/vehicles/${id}`, { method: 'DELETE' });
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export async function getReservations(params?: { userId?: string }) {
  const qs = new URLSearchParams();
  if (params?.userId) qs.set('userId', params.userId);
  return req<Reservation[]>(`/api/reservations?${qs}`);
}

export async function createReservation(data: {
  userId: string;
  vehicleType: string;
  licensePlate: string;
  date: string;
  startTime: string;
  endTime?: string;
  floor?: string;
  area?: string;
  slotCode?: string;
  note?: string;
  reservationType?: string;
}) {
  return req<{ reservation: Reservation }>('/api/reservations', {
    method: 'POST',
    body: JSON.stringify({ ...data, status: 'Pending', createdAt: new Date().toISOString() }),
  });
}

export async function updateReservation(id: string, data: Partial<Reservation>) {
  return req<{ reservation: Reservation }>(`/api/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteReservation(id: string) {
  return req<{ message: string }>(`/api/reservations/${id}`, { method: 'DELETE' });
}

// ─── Parking Sessions ────────────────────────────────────────────────────────

export async function getSessions(params?: { userId?: string; active?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.active) qs.set('active', 'true');
  return req<ParkingSession[]>(`/api/sessions?${qs}`);
}

export async function createSession(data: Partial<ParkingSession>) {
  return req<{ session: ParkingSession }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSession(id: string, data: Partial<ParkingSession>) {
  return req<{ session: ParkingSession }>(`/api/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function getPayments(userId?: string) {
  const qs = userId ? `?userId=${userId}` : '';
  return req<Payment[]>(`/api/payments${qs}`);
}

export async function createPayment(data: Partial<Payment>) {
  return req<{ payment: Payment }>('/api/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePayment(id: string, data: Partial<Payment>) {
  return req<{ payment: Payment }>(`/api/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Fee calculation ─────────────────────────────────────────────────────────

export function calcFee(checkIn: string, checkOut: string, vehicleType: string): number {
  const msIn = new Date(checkIn).getTime();
  const msOut = new Date(checkOut).getTime();
  if (isNaN(msIn) || isNaN(msOut) || msOut <= msIn) return 0;
  const hours = Math.ceil((msOut - msIn) / 1000 / 3600);
  const ratePerHour = vehicleType === 'Motorcycle' ? 5000 : 10000;
  return Math.max(hours, 1) * ratePerHour;
}

export function formatVND(amount: number) {
  return amount.toLocaleString('vi-VN') + ' đ';
}
