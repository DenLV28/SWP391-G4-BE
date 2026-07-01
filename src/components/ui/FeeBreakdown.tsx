/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receipt } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

interface FeeBreakdownProps {
  baseRate: number;
  additionalHours: number;
  additionalFee: number;
  total: number;
}

export default function FeeBreakdown({ baseRate, additionalHours, additionalFee, total }: FeeBreakdownProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Receipt className="h-4 w-4 text-blue-600" />
        <span>Fee Breakdown</span>
      </div>
      
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Base rate (first hour)</span>
          <span className="font-mono">{formatCurrency(baseRate)}</span>
        </div>
        
        {additionalHours > 0 && (
          <div className="flex justify-between text-slate-600">
            <span>Additional hours ({additionalHours}h)</span>
            <span className="font-mono">{formatCurrency(additionalFee)}</span>
          </div>
        )}
        
        <div className="border-t border-slate-200 pt-2">
          <div className="flex justify-between font-semibold text-slate-900">
            <span>Total estimated</span>
            <span className="font-mono text-blue-600">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        * Final fee may vary based on actual parking duration
      </p>
    </div>
  );
}
