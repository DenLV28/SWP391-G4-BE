/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface FieldProps {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  helper?: string;
}

export default function Field({ label, children, error, required, helper }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
      {helper && !error && (
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      )}
      {error && (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      )}
    </label>
  );
}
