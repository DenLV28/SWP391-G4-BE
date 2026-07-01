import { buildApiUrl } from './apiConfig';

export async function createVNPayPayment(
  paymentId: string,
  amount: number,
  orderInfo?: string,
): Promise<string> {
  const res = await fetch(buildApiUrl('/api/vnpay/create-payment'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
    },
    body: JSON.stringify({ paymentId, amount, orderInfo }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Không thể tạo thanh toán VNPay.');
  }

  const data = await res.json() as { paymentUrl: string };
  return data.paymentUrl;
}
