/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Core type definitions for Parking Building Management System
 */

export type PageKey =
  | 'dashboard'
  | 'parking-info'
  | 'current-session'
  | 'reservation'
  | 'payment'
  | 'feedback';

export type SessionStatus = 'Active' | 'Completed' | 'Cancelled';
export type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled';
export type PaymentStatus = 'Paid' | 'Unpaid';
export type FeedbackStatus = 'New' | 'In Progress' | 'Resolved';
export type PriorityLevel = 'Low' | 'Medium' | 'High';
export type VehicleKey = 'car' | 'motorbike' | 'electric vehicle';
export type PaymentMethod = 'Cash' | 'Credit Card' | 'E-Wallet' | 'QR Banking';

export interface VehicleType {
  key: VehicleKey;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export interface PricingRule {
  vehicleType: VehicleKey;
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  overnightSurcharge?: number;
}

export interface Floor {
  id: string;
  floorName: string;
  zone: string;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  maintenanceSlots: number;
}

export interface ParkingSession {
  ticketCode: string;
  licensePlate: string;
  vehicleType: VehicleKey;
  checkInTime: string;
  entryGate: string;
  floorArea: string;
  slotCode: string;
  status: SessionStatus;
  estimatedFee: number;
  baseRate?: number;
  additionalHours?: number;
  additionalFee?: number;
}

export interface ReservationItem {
  id: number;
  reservationCode: string;
  vehicleType: VehicleKey;
  areaFloor: string;
  parkingDate: string;
  startTime: string;
  endTime: string;
  note: string;
  status: ReservationStatus;
  estimatedCost?: number;
}

export interface PaymentItem {
  id: number;
  label: string;
  amount: number;
  status: PaymentStatus;
  description?: string;
}

export interface FeedbackItem {
  id: string;
  type: string;
  ticketCode: string;
  description: string;
  priority: PriorityLevel;
  status: FeedbackStatus;
  createdDate: string;
  imageUrl?: string;
}

export interface CurrentUser {
  name: string;
  role: string;
  memberCode: string;
  vehiclePlate: string;
  email?: string;
  phone?: string;
}

export interface ParkingBuilding {
  name: string;
  address: string;
  operatingHours: string;
  regulations: string[];
  contactPhone?: string;
  emergencyPhone?: string;
}
