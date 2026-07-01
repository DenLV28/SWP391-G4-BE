/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { calculateParkingDuration, formatDuration } from '../../utils/helpers';

interface TimerProps {
  startTime: string;
  className?: string;
}

export default function Timer({ startTime, className = '' }: TimerProps) {
  const [duration, setDuration] = useState(calculateParkingDuration(startTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(calculateParkingDuration(startTime));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Clock className="h-4 w-4 text-blue-600" />
      <span className="font-mono text-sm font-semibold text-slate-900">
        {formatDuration(duration.hours, duration.minutes)}
      </span>
      <span className="text-xs text-slate-500">parked</span>
    </div>
  );
}
