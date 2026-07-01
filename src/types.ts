/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppMode = 'login' | 'register';

export interface RegisterForm {
  fullName: string;
  email: string;
  phone: string;
  plateNumber: string;
  vehicleType: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

export interface LoginForm {
  identifier: string; // Phone number or Plate number
  password: string;
  rememberMe: boolean;
}

export interface FormErrors {
  general?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  plateNumber?: string;
  vehicleType?: string;
  password?: string;
  confirmPassword?: string;
  agreeTerms?: string;
  identifier?: string;
}

export interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
  visible: boolean;
}

export interface VehicleOption {
  value: string;
  label: string;
  icon: string;
}
