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
    reservationCode: r.reservationCode || r.reservation_code || '',
    licensePlate: r.licensePlate || r.license_plate || '',
    userName: r.userName || r.user_name || '',
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

export async function deletePayment(id: string): Promise<void> {
  await fetch(buildUrl(`/api/payments/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: headers(),
  });
}

export async function updatePayment(id: string, patch: {
  status?: string;
  method?: string;
  paidAt?: string;
  totalAmount?: number;
  parkingFee?: number;
  extraServiceFee?: number;
  overtimeFee?: number;
  lostTicketFee?: number;
  discount?: number;
  ticketCode?: string;
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

/**
 * Push-based payment sync: fires the instant a payment is created or its
 * status changes (e.g. a user finishes VNPay checkout), instead of Staff/
 * Manager dashboards waiting on their next poll cycle to notice it.
 */
export function subscribeToPaymentEvents(onUpdate: (payment: Payment) => void): () => void {
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout>;

  const connect = async () => {
    if (cancelled) return;
    try {
      const res = await fetch(buildUrl('/api/payments/events'), {
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
            onUpdate(toPayment(raw));
          } catch {}
        }
      }
    } catch { /* fall through to retry */ }

    if (!cancelled) retryTimer = setTimeout(connect, 10000);
  };

  connect();
  return () => { cancelled = true; clearTimeout(retryTimer); };
}
