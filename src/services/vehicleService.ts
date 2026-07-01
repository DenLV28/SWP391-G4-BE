import type { SavedVehicle, VehicleKey } from '../data/mockData';
import { buildApiUrl as buildUrl } from './apiConfig';
const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': '1' });

export interface VehicleRecord {
  id: string | number;
  userId: string | number;
  licensePlate: string;
  vehicleType: string;
  brand: string;
  model: string;
  isDefault: boolean;
}

function toSavedVehicle(r: VehicleRecord): SavedVehicle {
  return {
    id: String(r.id),
    userId: String(r.userId),
    licensePlate: r.licensePlate,
    vehicleType: r.vehicleType as VehicleKey,
    brand: r.brand ?? '',
    model: r.model ?? '',
    isDefault: Boolean(r.isDefault),
  };
}

/** Fetch all vehicles for a specific user from the backend. */
export async function fetchVehiclesByUser(userId: string): Promise<SavedVehicle[]> {
  const res = await fetch(buildUrl(`/api/vehicles?userId=${encodeURIComponent(userId)}`), {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Vehicle API ${res.status}`);
  const data = await res.json();
  const list: VehicleRecord[] = Array.isArray(data)
    ? data
    : Array.isArray(data.vehicles)
      ? data.vehicles
      : [];
  return list.map(toSavedVehicle);
}

/** Create a vehicle in the backend. */
export async function createVehicle(payload: {
  userId: string;
  licensePlate: string;
  vehicleType: string;
  brand: string;
  model: string;
  isDefault: boolean;
}): Promise<SavedVehicle> {
  const res = await fetch(buildUrl('/api/vehicles'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Vehicle API ${res.status}`);
  const data = await res.json();
  const record: VehicleRecord = data.vehicle ?? data;
  return toSavedVehicle(record);
}

/** Mark a vehicle as default (unset others for the same user). */
export async function setDefaultVehicle(vehicleId: string): Promise<void> {
  const res = await fetch(buildUrl(`/api/vehicles/${vehicleId}/default`), {
    method: 'PUT',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Vehicle API ${res.status}`);
}
