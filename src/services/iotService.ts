/**
 * IoT bridge service.
 *
 * The hardware layer (ESP32 + servo + RFID + camera AI) pushes a scan every
 * time a vehicle is detected at a gate. This module is the single place the
 * frontend talks to that layer, so the UI never cares how the bytes arrive.
 *
 * Transport priority:
 *   1. WebSocket   — real-time, preferred. Set VITE_IOT_WS_URL
 *                    (e.g. ws://192.168.1.50:81  or  wss://api.yourhost/iot).
 *   2. HTTP poll   — fallback. Set VITE_IOT_HTTP_URL pointing at an endpoint
 *                    that returns an array of ScanEvent (newest first).
 *   3. Simulator   — when neither is configured, fake scans are generated so
 *                    the dashboard is demo-able without hardware.
 *
 * Outgoing gate commands (open / close / override) are sent back over the same
 * WebSocket, or POSTed to `${VITE_IOT_HTTP_URL}/command` when polling.
 *
 * The device only needs to emit JSON shaped roughly like ScanEvent. Missing
 * fields are filled in by `normalizeScan`, so a minimal ESP32 payload such as
 *   { "gateId": "A1", "plate": "51A-123.45", "rfid": "04A2B1", "dir": "entry" }
 * is enough.
 */

import type { ScanEvent, RecognitionResult, ScanDirection } from '../types/staff';
import type { VehicleKey } from '../data/mockData';

type Env = { VITE_IOT_WS_URL?: string; VITE_IOT_HTTP_URL?: string; VITE_IOT_SIMULATE?: string };
const env: Env =
  // import.meta.env is provided by Vite; guard so the module also imports in tests.
  (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Env }).env) || {};

const WS_URL = env.VITE_IOT_WS_URL?.trim() || '';
const HTTP_URL = env.VITE_IOT_HTTP_URL?.trim() || '';
// Simulator only runs when explicitly enabled via VITE_IOT_SIMULATE=true
const SIMULATE = env.VITE_IOT_SIMULATE?.trim() === 'true';

export type GateCommand = 'open' | 'close' | 'override' | 'open-all' | 'close-all';

export type IotHandlers = {
  onScan: (event: ScanEvent) => void;
  onStatus: (status: 'connecting' | 'online' | 'offline' | 'simulated') => void;
};

let idCounter = 0;
const nextId = () => `SCAN-${Date.now()}-${idCounter++}`;

/** Fill in defaults so a partial device payload becomes a full ScanEvent. */
export function normalizeScan(raw: Record<string, unknown>): ScanEvent {
  const plate = String(raw.licensePlate ?? raw.plate ?? '').toUpperCase();
  const rfid = raw.rfidUid ?? raw.rfid;
  const dir = (raw.direction ?? raw.dir ?? 'entry') as ScanDirection;
  const recognition = (raw.recognition ??
    (plate ? 'casual' : 'unknown')) as RecognitionResult;

  return {
    id: String(raw.id ?? nextId()),
    gateId: String(raw.gateId ?? raw.gate ?? 'A1'),
    direction: dir === 'exit' ? 'exit' : 'entry',
    licensePlate: plate,
    rfidUid: rfid != null ? String(rfid) : undefined,
    vehicleType: raw.vehicleType as VehicleKey | undefined,
    confidence: raw.confidence != null ? Number(raw.confidence) : undefined,
    snapshotUrl: raw.snapshotUrl != null ? String(raw.snapshotUrl) : undefined,
    recognition,
    matchedUserId: raw.matchedUserId != null ? String(raw.matchedUserId) : undefined,
    matchedUserName: raw.matchedUserName != null ? String(raw.matchedUserName) : undefined,
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    handled: false,
  };
}

/**
 * Connect to the IoT layer. Returns an object with `disconnect()` and
 * `sendCommand()`. Call once (e.g. in a useEffect) and clean up on unmount.
 */
export function connectIot(handlers: IotHandlers) {
  let ws: WebSocket | null = null;
  let pollTimer: number | null = null;
  let simTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let closedByUser = false;
  let lastPollTs = 0;

  const startSimulator = () => {
    handlers.onStatus('simulated');
    const plates = ['51A-123.45', '30H-456.78', '29B-999.00', '60C-777.12', '43A-333.33'];
    const rfids = ['04A2B1C3', '04F19D2A', '0419AAB7', '', ''];
    const tick = () => {
      const plate = plates[Math.floor(Math.random() * plates.length)];
      const rfid = rfids[Math.floor(Math.random() * rfids.length)];
      const roll = Math.random();
      const recognition: RecognitionResult =
        roll < 0.55 ? 'subscriber' : roll < 0.85 ? 'casual' : 'unknown';
      handlers.onScan(
        normalizeScan({
          gateId: Math.random() < 0.5 ? 'A1' : 'A2',
          plate: recognition === 'unknown' ? '' : plate,
          rfid: recognition === 'subscriber' ? rfid : '',
          direction: Math.random() < 0.5 ? 'entry' : 'exit',
          recognition,
          confidence: recognition === 'unknown' ? 0.41 : 0.92 + Math.random() * 0.07,
          vehicleType: Math.random() < 0.6 ? 'motorbike' : 'car',
          matchedUserName: recognition === 'subscriber' ? 'Khách tháng' : undefined,
        }),
      );
      simTimer = window.setTimeout(tick, 6000 + Math.random() * 6000);
    };
    simTimer = window.setTimeout(tick, 3500);
  };

  const startPolling = () => {
    handlers.onStatus('online');
    const poll = async () => {
      try {
        const res = await fetch(`${HTTP_URL}?since=${lastPollTs}`);
        if (res.ok) {
          const list = (await res.json()) as Record<string, unknown>[];
          // Expect newest first; emit oldest first so the UI order is natural.
          for (const item of [...list].reverse()) {
            const ev = normalizeScan(item);
            lastPollTs = Math.max(lastPollTs, new Date(ev.timestamp).getTime());
            handlers.onScan(ev);
          }
        } else {
          handlers.onStatus('offline');
        }
      } catch {
        handlers.onStatus('offline');
      }
      pollTimer = window.setTimeout(poll, 3000);
    };
    poll();
  };

  const startWebSocket = () => {
    handlers.onStatus('connecting');
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      handlers.onStatus('offline');
      return;
    }
    ws.onopen = () => handlers.onStatus('online');
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) handlers.onScan(normalizeScan(item));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      handlers.onStatus('offline');
      if (!closedByUser) {
        reconnectTimer = window.setTimeout(startWebSocket, 4000);
      }
    };
    ws.onerror = () => ws?.close();
  };

  if (WS_URL) startWebSocket();
  else if (HTTP_URL) startPolling();
  else if (SIMULATE) startSimulator();
  else handlers.onStatus('offline'); // No hardware configured — stay offline, no fake data

  return {
    sendCommand(gateId: string, command: GateCommand) {
      const payload = JSON.stringify({ type: 'gate-command', gateId, command });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        return true;
      }
      if (HTTP_URL) {
        // Fire and forget; the device confirms via a later scan/status frame.
        fetch(`${HTTP_URL}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(() => undefined);
        return true;
      }
      // Simulator mode: nothing to talk to, the UI updates optimistically.
      return false;
    },
    disconnect() {
      closedByUser = true;
      if (ws) ws.close();
      if (pollTimer) window.clearTimeout(pollTimer);
      if (simTimer) window.clearTimeout(simTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    },
  };
}

/** Which transport is active, for display in the UI. */
export const iotTransport: 'websocket' | 'http' | 'simulator' = WS_URL
  ? 'websocket'
  : HTTP_URL
    ? 'http'
    : SIMULATE
      ? 'simulator'
      : 'http'; // No hardware = offline (reuse 'http' label; status is driven by onStatus)
