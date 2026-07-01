/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface MiniMetricProps {
  label: string;
  value: number;
}

export default function MiniMetric({ label, value }: MiniMetricProps) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
