/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  helper?: string;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({
  title,
  value,
  icon,
  accent,
  helper,
  trend,
  trendUp,
}: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {helper && <p className="mt-1 text-sm text-slate-500">{helper}</p>}
          {trend && (
            <p className={`mt-2 text-xs font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
              {trendUp ? '↗' : '↘'} {trend}
            </p>
          )}
        </div>
        <div className={`rounded-2xl p-3 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}
