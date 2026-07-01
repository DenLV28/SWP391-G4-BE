/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

interface NotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  visible: boolean;
  onClose: () => void;
}

export default function Notification({ type, message, visible, onClose }: NotificationProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-600" />,
    error: <AlertTriangle className="w-5 h-5 text-rose-600" />,
    info: <Info className="w-5 h-5 text-park-blue-600" />,
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100',
    error: 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100',
    info: 'bg-sky-50 border-blue-200 text-park-blue-900 shadow-park-blue-100',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className={`fixed top-24 right-4 z-50 max-w-sm w-full mx-auto p-4 rounded-xl border flex items-start gap-3 shadow-xl ${bgColors[type]}`}
        >
          <div className="shrink-0 mt-0.5">{icons[type]}</div>
          <div className="flex-1 text-sm font-medium leading-relaxed">{message}</div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
