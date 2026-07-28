import { buildApiUrl, buildDirectApiUrl, defaultHeaders } from './apiConfig';

export type RfidScanStatus = 'Scanned' | 'Captured' | 'Linked';

export type RfidScan = {
  id: string;
  rfidUid: string;
  gateId: string;
  direction: 'entry' | 'exit';
  status: RfidScanStatus;
  imageData: string;
  licensePlate: string;
  licensePlateHash: string;
  vehicleId: string;
  scannedById: string;
  scannedByName: string;
  createdAt: string;
};

/** Step 1 — Initial Save: called the instant the card is tapped, before OCR runs. */
export async function createRfidScan(payload: {
  rfidUid: string;
  gateId: string;
  direction: 'entry' | 'exit';
  scannedById: string;
  scannedByName: string;
}): Promise<RfidScan | null> {
  try {
    const res = await fetch(buildApiUrl('/api/rfid-scans'), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as RfidScan;
  } catch {
    return null;
  }
}

/** Step 4 — Final Data Link: attaches the captured photo + OCR'd plate (and, once matched, the vehicle) to the scan row. */
export async function updateRfidScan(
  id: string,
  patch: { imageData?: string; licensePlate?: string; vehicleId?: string },
): Promise<RfidScan | null> {
  try {
    const res = await fetch(buildApiUrl(`/api/rfid-scans/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return (await res.json()) as RfidScan;
  } catch {
    return null;
  }
}

// ─── IoT bridge: card taps pushed by the Arduino/ESP32 reader ────────────────

export type RfidTapEvent = {
  rfidUid: string;
  gateId: string;
  direction: 'entry' | 'exit';
  ts: number;
};

/** Push an open/close command to the backend queue; ESP32 polls and consumes it.
 * Dùng buildDirectApiUrl: lệnh mở rào phải tới nơi trong ~1s, không được xếp
 * hàng sau các luồng SSE đang chiếm pool kết nối của origin dev server. */
export async function sendGateCommand(gateId: string, command: 'open' | 'close'): Promise<void> {
  try {
    await fetch(buildDirectApiUrl('/api/iot/gate-command'), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ gateId, command }),
    });
  } catch {
    // Best-effort — ESP32 may not be online
  }
}

/**
 * Live stream of RFID taps relayed by the backend (POST /api/iot/rfid-tap →
 * SSE /api/iot/rfid-events). The Gate Control screen subscribes and runs the
 * auto capture → PaddleOCR → save pipeline for each tap, hands-free.
 */
export function subscribeToRfidTaps(onTap: (e: RfidTapEvent) => void): () => void {
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout>;

  const connect = async () => {
    if (cancelled) return;
    try {
      const res = await fetch(buildApiUrl('/api/iot/rfid-events'), {
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
            if (raw && typeof raw.rfidUid === 'string' && raw.rfidUid) {
              onTap({
                rfidUid: raw.rfidUid,
                gateId: String(raw.gateId ?? ''),
                direction: raw.direction === 'exit' ? 'exit' : 'entry',
                ts: Number(raw.ts) || Date.now(),
              });
            }
          } catch {}
        }
      }
    } catch { /* fall through to retry */ }

    if (!cancelled) retryTimer = setTimeout(connect, 5000);
  };

  connect();
  return () => { cancelled = true; clearTimeout(retryTimer); };
}

/** Staff từ chối lượt quét → xóa hẳn bản ghi (kèm ảnh) khỏi DB. */
export async function deleteRfidScan(id: string | number): Promise<boolean> {
  try {
    const res = await fetch(buildApiUrl(`/api/rfid-scans/${encodeURIComponent(String(id))}`), {
      method: 'DELETE',
      headers: defaultHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchRfidScans(limit = 20, rfidUid?: string): Promise<RfidScan[]> {
  try {
    const query = `limit=${limit}${rfidUid ? `&rfidUid=${encodeURIComponent(rfidUid)}` : ''}`;
    const res = await fetch(buildApiUrl(`/api/rfid-scans?${query}`), { headers: defaultHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
