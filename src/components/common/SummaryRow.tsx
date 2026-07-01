/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatCurrency } from '../../utils/helpers';

interface SummaryRowProps {
  label: string;
  amount: number;
}

export default function SummaryRow({ label, amount }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-slate-600">
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(amount)}</span>
    </div>
  );
}
