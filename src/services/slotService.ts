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

export type RelocateResult =
  | { ok: true; fromSlotCode: string; toSlotCode: string; floor: string; area: string }
  | { ok: false; error: string };

/** Staff/Manager-only: move a parked vehicle from its current slot to a different Available slot of the SAME vehicle type. */
export async function relocateSlot(fromSlotCode: string, toSlotCode: string, actorId: string): Promise<RelocateResult> {
  try {
    const res = await fetch(buildApiUrl(`/api/slots/${encodeURIComponent(fromSlotCode)}/relocate`), {
      method: 'POST',
      headers: h(),
      body: JSON.stringify({ toSlotCode, actorId }),
    });
    const body: { error?: string; fromSlotCode?: string; toSlotCode?: string; floor?: string; area?: string } =
      await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Không thể chuyển ô đỗ.' };
    return {
      ok: true,
      fromSlotCode: body.fromSlotCode || fromSlotCode,
      toSlotCode: body.toSlotCode || toSlotCode,
      floor: body.floor || '',
      area: body.area || '',
    };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export type ForceClearResult =
  | { ok: true; sessionClosed: boolean; ticketCode: string; licensePlate: string }
  | { ok: false; error: string };

/** Staff/Manager-only: force an Occupied slot back to Available (closes any linked active session). */
export async function forceClearSlot(slotCode: string, userId: string, reason: string): Promise<ForceClearResult> {
  try {
    const res = await fetch(buildApiUrl(`/api/slots/${encodeURIComponent(slotCode)}/force-clear`), {
      method: 'POST',
      headers: h(),
      body: JSON.stringify({ userId, reason }),
    });
    const body: { error?: string; sessionClosed?: boolean; ticketCode?: string; licensePlate?: string } =
      await res.json().catch(() => ({}));
    if (!res.ok) {
      const message: string = body.error || 'Không thể buộc dọn ô đỗ.';
      return { ok: false, error: message };
    }
    return {
      ok: true,
      sessionClosed: !!body.sessionClosed,
      ticketCode: body.ticketCode || '',
      licensePlate: body.licensePlate || '',
    };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export type ForceClearLog = {
  id: string;
  slotCode: string;
  ticketCode: string;
  licensePlate: string;
  performedByName: string;
  performedByRole: string;
  reason: string;
  createdAt: string;
};

/** Recent Force Clear audit trail, for the Staff/Manager activity views. */
export async function fetchForceClearLogs(limit = 20): Promise<ForceClearLog[]> {
  try {
    const res = await fetch(buildApiUrl(`/api/force-clear-logs?limit=${limit}`), { headers: h() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
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
