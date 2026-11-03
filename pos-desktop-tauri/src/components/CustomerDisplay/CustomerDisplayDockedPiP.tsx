/**
 * @file CustomerDisplayDockedPiP.tsx
 * @description Docked / Floating Picture-in-Picture (PiP) preview of the Customer Display.
 * 
 * Perfect for single-monitor cashiers or hackathon judges evaluating the system in a browser preview.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, X, Maximize2, ExternalLink, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { CustomerDisplayView } from './CustomerDisplayView';
import { openCustomerDisplayWindow } from '../../lib/customerDisplay/windowManager';
import { useI18n } from '../../i18n';

interface CustomerDisplayDockedPiPProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerDisplayDockedPiP({ isOpen, onClose }: CustomerDisplayDockedPiPProps) {
  const t = useI18n();
  const [isMinimized, setIsMinimized] = useState(false);
  const [scale, setScale] = useState<'normal' | 'expanded'>('normal');

  if (!isOpen) return null;

  const handlePopOut = () => {
    openCustomerDisplayWindow({
      onOpened: () => onClose()
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none">
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.05}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={`bg-white dark:bg-zinc-900 border-2 border-indigo-500 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
          isMinimized
            ? 'w-72 h-14'
            : scale === 'expanded'
            ? 'w-[90vw] max-w-4xl h-[82vh]'
            : 'w-[480px] h-[580px]'
        }`}
      >
        {/* PiP Header - Drag Handle */}
        <div 
          className="px-4 py-3 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="flex items-center gap-2">
            <Tv size={16} className="text-indigo-400" />
            <span className="text-xs font-black uppercase tracking-wider">
              {t.pipPreviewTitle || 'Customer Display (PiP Preview)'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Pop out to real secondary window */}
            <button
              onClick={handlePopOut}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Detach to 2nd Monitor / HDMI (Standalone Window)"
            >
              <ExternalLink size={13} />
            </button>

            {/* Toggle Size */}
            {!isMinimized && (
              <button
                onClick={() => setScale(scale === 'normal' ? 'expanded' : 'normal')}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title={scale === 'normal' ? 'Expand Preview' : 'Normal Size'}
              >
                <Maximize2 size={13} />
              </button>
            )}

            {/* Minimize / Maximize */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isMinimized ? 'Restore' : 'Minimize'}
            >
              {isMinimized ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-white/10 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* PiP Body */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-zinc-950 p-2 transform scale-95 origin-top-left w-[105%] h-[105%]">
            <CustomerDisplayView />
          </div>
        )}
      </motion.div>
    </div>
  );
}
