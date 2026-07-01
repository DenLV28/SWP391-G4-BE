import type { Payment } from '../data/mockData';
import { buildApiUrl as buildUrl } from './apiConfig';
const headers = () => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'ngrok-skip-browser-warning': '1',
});

function toPayment(r: any): Payment {
  return {
    id: String(r.id || r.payment_id),
    userId: String(r.userId || r.user_id || ''),
    ticketCode: r.ticketCode || r.ticket_code || '',
    parkingFee: r.parkingFee ?? r.parking_fee ?? 0,
    extraServiceFee: r.extraServiceFee ?? r.extra_service_fee ?? 0,
    lostTicketFee: r.lostTicketFee ?? r.lost_ticket_fee ?? 0,
    overtimeFee: r.overtimeFee ?? r.overtime_fee ?? 0,
    discount: r.discount ?? 0,
    totalAmount: r.totalAmount ?? r.total_amount ?? 0,
    method: r.method || 'Cash',
    status: r.status || 'Unpaid',
    createdAt: r.createdAt || r.created_at || '',
    paidAt: r.paidAt || r.paid_at || '',
  };
}

export async function fetchPaymentsByUser(userId: string): Promise<Payment[]> {
  const res = await fetch(buildUrl(`/api/payments?userId=${encodeURIComponent(userId)}`), {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Payments API ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(toPayment);
}

export async function fetchAllPayments(): Promise<Payment[]> {
  const res = await fetch(buildUrl('/api/payments'), { headers: headers() });
  if (!res.ok) throw new Error(`Payments API ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(toPayment);
}

export async function createPayment(payment: Payment): Promise<Payment> {
  const res = await fetch(buildUrl('/api/payments'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payment),
  });
  if (!res.ok) throw new Error(`Payments API ${res.status}`);
  const data = await res.json();
  return toPayment(data.payment ?? data);
}

export async function updatePayment(id: string, patch: {
  status?: string;
  method?: string;
  paidAt?: string;
  totalAmount?: number;
  parkingFee?: number;
  extraServiceFee?: number;
  lostTicketFee?: number;
  discount?: number;
}): Promise<Payment> {
  const res = await fetch(buildUrl(`/api/payments/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Payments API ${res.status}`);
  const data = await res.json();
  return toPayment(data.payment ?? data);
}
