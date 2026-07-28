/**
 * Staff portal domain types.
 *
 * These model the data the Staff role works with: live scan events coming from
 * the IoT layer (ESP32 + RFID + camera AI), the recorded access logs, gate
 * state, shift logs and emergency reports.
 */

import type { VehicleKey } from '../data/mockData';

/** Connection state of the IoT bridge (websocket / polling / simulator). */
export type IotConnectionStatus = 'connecting' | 'online' | 'offline' | 'simulated';

/** How a scanned vehicle was recognised by the system. */
export type RecognitionResult = 'subscriber' | 'casual' | 'unknown';

export type ScanDirection = 'entry' | 'exit';

/**
 * A single scan pushed by the IoT layer. The camera AI does the OCR on the
 * plate, the RFID reader supplies the card UID. Either can be present; for an
 * unknown vehicle the plate may be empty and recognition is "unknown".
 */
export type ScanEvent = {
  id: string;
  gateId: string;
  direction: ScanDirection;
  /** Plate read by the camera AI (OCR). Empty string when OCR failed. */
  licensePlate: string;
  /** UID read from the RFID card, if the vehicle tapped one. */
  rfidUid?: string;
  vehicleType?: VehicleKey;
  /** OCR confidence 0..1, used to flag low-confidence reads for staff review. */
  confidence?: number;
  /** Optional snapshot URL from the gate camera. */
  snapshotUrl?: string;
  recognition: RecognitionResult;
  /** Matched account when recognition is subscriber/casual. */
  matchedUserId?: string;
  matchedUserName?: string;
  timestamp: string;
  /** Set once a staff member (or auto-rule) has handled the scan. */
  handled?: boolean;
};

export type AccessStatus = 'GRANTED' | 'DENIED' | 'OVERRIDE' | 'PENDING';

/** A recorded access event (the "ghi nhận" the staff produces). */
export type AccessLog = {
  id: string;
  gateId: string;
  vehicleId: string; // plate, or RFID UID, or "UNKNOWN"
  action: string; // e.g. Auto-Recognized, Manual Trigger, Staff Badge Sweep
  direction: ScanDirection;
  status: AccessStatus;
  time: string; // display time, e.g. "10:42 AM"
  recognition: RecognitionResult;
  /** Nhãn loại xe thật tại thời điểm quét (vd "Xe máy / Xe máy điện") — không đoán lại ở UI. */
  vehicleType?: string;
  fee?: number;
  handledBy?: string;
  /** Đơn đặt chỗ mới tạo — xe CHƯA vào bãi, staff chưa check-in. Không phải
   *  sự kiện qua cổng thật nên UI hiển thị hành động "CHƯA VÀO" thay vì
   *  đọc theo `direction`. */
  notArrivedYet?: boolean;
};

export type GateState = 'open' | 'closed';

export type Gate = {
  id: string;
  name: string;
  location: string;
  camLabel: string;
  active: boolean;
  state: GateState;
  /** Which flow this gate handles — drives which OCR screen (entry/exit) it's paired with. */
  direction: ScanDirection;
};

export type IncidentType =
  | 'Fire / Smoke'
  | 'Vehicle Collision'
  | 'Security Breach'
  | 'Equipment Failure'
  | 'Medical Emergency'
  | 'Other';

export type EmergencyStatus = 'NEW' | 'LOGGED' | 'RESOLVED' | 'FIXED';

export type EmergencyLog = {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  status: EmergencyStatus;
  createdAt: string; // human label, e.g. "Today at 10:24 AM"
  reportedBy: string;
  slotCode?: string;
  floor?: string;
};

export type ShiftLog = {
  id: string;
  staffName: string;
  gate: string;
  shiftStart: string;
  shiftEnd?: string;
  vehiclesHandled: number;
  alerts: number;
  status: 'On duty' | 'Completed';
  note?: string;
};

// ---------------------------------------------------------------------------
// Seed data (used until live IoT data / a backend replaces it)
// ---------------------------------------------------------------------------

export const initialGates: Gate[] = [
  { id: 'A1', name: 'Cổng A1', location: 'Lối vào phía Bắc', camLabel: 'CAM_R_ENTRANCE', active: true, state: 'closed', direction: 'entry' },
  { id: 'A2', name: 'Cổng A2', location: 'Cổng phía Nam', camLabel: 'CAM_A2_EXIT', active: true, state: 'closed', direction: 'exit' },
];

export const initialAccessLogs: AccessLog[] = [];

export const initialEmergencyLogs: EmergencyLog[] = [];

export const initialShiftLogs: ShiftLog[] = [];

export const incidentTypes: IncidentType[] = [
  'Fire / Smoke',
  'Vehicle Collision',
  'Security Breach',
  'Equipment Failure',
  'Medical Emergency',
  'Other',
];

/** Vehicle classification options for the manual gate dropdown. */
export const manualVehicleOptions: { key: VehicleKey; label: string }[] = [
  { key: 'motorbike', label: 'Xe máy / Xe máy điện' },
  { key: 'car', label: 'Ô tô 4-7 chỗ (Xăng)' },
  { key: 'electric vehicle', label: 'Ô tô 4-7 chỗ (Điện / EV)' },
];
