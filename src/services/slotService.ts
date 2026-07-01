import type { Slot } from '../data/mockData';
import { buildApiUrl } from './apiConfig';

const h = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': '1' });

export type SlotStatusValue = 'Available' | 'Occupied' | 'Reserved' | 'Pending' | 'Maintenance' | 'Locked';

export async function fetchSlotStatuses(): Promise<Slot[]> {
  try {
    const res = await fetch(buildApiUrl('/api/slots'), { headers: h() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function updateSlotStatus(slotCode: string, status: SlotStatusValue): Promise<void> {
  try {
    await fetch(buildApiUrl(`/api/slots/${encodeURIComponent(slotCode)}`), {
      method: 'PATCH',
      headers: h(),
      body: JSON.stringify({ status }),
    });
  } catch {}
}

export function subscribeToSlotEvents(
  onUpdate: (slotCode: string, status: SlotStatusValue) => void,
): () => void {
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout>;

  const connect = async () => {
    if (cancelled) return;
    try {
      const res = await fetch(buildApiUrl('/api/slots/events'), {
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
            const { slotCode, status } = JSON.parse(line.slice(6)) as { slotCode: string; status: SlotStatusValue };
            if (slotCode && status) onUpdate(slotCode, status);
          } catch {}
        }
      }
    } catch { /* fall through to retry */ }

    if (!cancelled) retryTimer = setTimeout(connect, 10000);
  };

  connect();
  return () => { cancelled = true; clearTimeout(retryTimer); };
}
