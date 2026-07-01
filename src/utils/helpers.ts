/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utility helper functions
 */

/**
 * Reverse Windows-1252 / Latin-1 mojibake caused by UTF-8 bytes being
 * misread as single-byte characters (common when MySQL charset is latin1
 * but the stored data is actually UTF-8).
 *
 * Strategy:
 *  1. Walk every character in the string.
 *  2. If every character maps to a single byte (0x00-0xFF in Latin-1, or a
 *     known Windows-1252 codepoint in the 0x80-0x9F range → original byte),
 *     we reassemble the byte sequence and re-decode it as UTF-8.
 *  3. If any character falls outside what a single byte can represent, the
 *     string is already Unicode – return it unchanged.
 *  4. If the byte sequence is not valid UTF-8, return the original string.
 */
const WIN1252_TO_BYTE: Record<number, number> = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201C: 0x93, // "
  0x201D: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F, // Ÿ
};

export const fixMojibake = (str: string): string => {
  if (!str) return str;
  try {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 0xFF) {
        bytes.push(code);
      } else if (WIN1252_TO_BYTE[code] !== undefined) {
        // Windows-1252 special character → map back to original byte
        bytes.push(WIN1252_TO_BYTE[code]);
      } else {
        // True Unicode codepoint (e.g. ă = U+0103 > 0xFF) — string is
        // already correctly encoded, do not touch it.
        return str;
      }
    }
    // Attempt to decode the reassembled byte sequence as UTF-8.
    // `fatal: true` ensures we fall back cleanly for non-UTF-8 sequences.
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return str;
  }
};

import type { VehicleKey, Floor } from '../types/parking';
import { vehicleTypes } from '../data/mockData';

/**
 * Format currency in VND
 */
export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * Get vehicle label by key
 */
export const getVehicleLabel = (key: VehicleKey): string =>
  vehicleTypes.find(vehicle => vehicle.key === key)?.label ?? key;

/**
 * Calculate total stats from floors
 */
export const getTotalStats = (items: Floor[]) =>
  items.reduce(
    (acc, floor) => ({
      totalSlots: acc.totalSlots + floor.totalSlots,
      availableSlots: acc.availableSlots + floor.availableSlots,
      occupiedSlots: acc.occupiedSlots + floor.occupiedSlots,
      reservedSlots: acc.reservedSlots + floor.reservedSlots,
    }),
    { totalSlots: 0, availableSlots: 0, occupiedSlots: 0, reservedSlots: 0 },
  );

/**
 * Calculate duration between two times in hours
 */
export const calculateDuration = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return (endMinutes - startMinutes) / 60;
};

/**
 * Calculate parking duration from check-in time to now
 */
export const calculateParkingDuration = (checkInTime: string): { hours: number; minutes: number } => {
  const checkIn = new Date(checkInTime);
  const now = new Date();
  
  const diffMs = now.getTime() - checkIn.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  return {
    hours: Math.floor(diffMinutes / 60),
    minutes: diffMinutes % 60,
  };
};

/**
 * Format duration for display
 */
export const formatDuration = (hours: number, minutes: number): string => {
  if (hours === 0) {
    return `${minutes} minutes`;
  }
  if (minutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${hours}h ${minutes}m`;
};

/**
 * Generate ticket code
 */
export const generateTicketCode = (): string => {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '').slice(0, 4);
  return `PK-${date}-${time}`;
};

/**
 * Generate reservation code
 */
export const generateReservationCode = (): string => {
  return `RSV-${String(Date.now()).slice(-6)}`;
};

/**
 * Format date for display
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

/**
 * Format datetime for display
 */
export const formatDateTime = (dateTimeString: string): string => {
  const date = new Date(dateTimeString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get current time in HH:MM format
 */
export const getCurrentTime = (): string => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

/**
 * Check if date is in the past
 */
export const isPastDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

/**
 * Check if time is in the past for today
 */
export const isPastTime = (timeString: string, dateString: string): boolean => {
  const today = getTodayDate();
  if (dateString !== today) {
    return false;
  }
  
  const currentTime = getCurrentTime();
  return timeString < currentTime;
};

/**
 * Calculate estimated cost for reservation
 */
export const calculateReservationCost = (
  vehicleType: VehicleKey,
  duration: number,
  pricingRules: Array<{ vehicleType: VehicleKey; hourlyRate: number; dailyRate: number }>
): number => {
  const pricing = pricingRules.find(rule => rule.vehicleType === vehicleType);
  if (!pricing) return 0;
  
  // If duration >= 8 hours, use daily rate
  if (duration >= 8) {
    return pricing.dailyRate;
  }
  
  // Otherwise, use hourly rate
  return Math.ceil(duration) * pricing.hourlyRate;
};
