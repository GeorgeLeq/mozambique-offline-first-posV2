/**
 * @file CustomerDisplayLauncherModal.tsx
 * @description Dual-Monitor & HDMI Screen Setup Modal for the Customer Display.
 * Provides cashiers with 1-click launch to external HDMI monitors, URL copying, and PiP toggle.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  ExternalLink, 
  Copy, 
  Check, 
  Monitor, 
  Maximize2, 
  X, 
  Layers, 
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { openCustomerDisplayWindow, getCustomerDisplayUrl, isTauriEnvironment } from '../../lib/customerDisplay/windowManager';
import toast from 'react-hot-toast';

interface CustomerDisplayLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTogglePiP: () => void;
  isPiPOpen: boolean;
}

export function CustomerDisplayLauncherModal({
  isOpen,
  onClose,
  onTogglePiP,
  isPiPOpen
}: CustomerDisplayLauncherModalProps) {
  const [copied, setCopied] = useState(false);
  const displayUrl = getCustomerDisplayUrl();
  const isTauri = isTauriEnvironment();

  if (!isOpen) return null;

  const handleLaunchDetached = async () => {
    await openCustomerDisplayWindow({
      onOpened: () => {
        onClose();
      },
      onFallbackToPiP: () => {
        if (!isPiPOpen) onTogglePiP();
        onClose();
      }
    });
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      toast.success('Customer Display URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch (_err) {
      toast.error('Could not copy automatically. Please select and copy manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col select-none"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Tv size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Customer Display & HDMI Setup</h2>
              <p className="text-xs text-indigo-200/80">
                {isTauri ? 'Windows Tauri v2 Dual-Monitor Mode' : 'Standalone Detached Window & Multi-Screen Mode'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Launch Detached Window for HDMI */}
            <div 
              onClick={handleLaunchDetached}
              className="p-4 rounded-2xl border-2 border-indigo-500/40 hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Monitor size={16} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                    Recommended
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Launch Detached Window
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Opens a separate operating system window that you can drag directly onto your 2nd HDMI customer screen.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <span>Launch Now</span>
                <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* 2. Toggle Docked In-App PiP Preview */}
            <div 
              onClick={() => {
                onTogglePiP();
                onClose();
              }}
              className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50 dark:bg-zinc-850/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-700 dark:bg-zinc-700 text-white flex items-center justify-center shadow-sm">
                    <Layers size={16} />
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    isPiPOpen 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                  }`}>
                    {isPiPOpen ? 'Active' : 'Preview'}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  In-App PiP Preview
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Shows a floating miniature preview inside the cashier window for single-monitor cashiers or testing.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-750 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-300">
                <span>{isPiPOpen ? 'Close In-App PiP' : 'Open In-App PiP'}</span>
                <Maximize2 size={14} />
              </div>
            </div>
          </div>

          {/* Direct URL Box */}
          <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Tv size={14} className="text-indigo-500" />
                Customer Screen Direct Web URL
              </span>
              <a
                href={displayUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Open in Tab</span>
                <ExternalLink size={11} />
              </a>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={displayUrl}
                className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-slate-800 dark:text-zinc-200 focus:outline-hidden"
              />
              <button
                onClick={handleCopyUrl}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Quick HDMI Dual-Screen Setup Instructions */}
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 text-xs space-y-2 text-slate-600 dark:text-zinc-400">
            <div className="font-bold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <HelpCircle size={14} />
              How to setup on an HDMI Dual Monitor
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Plug your customer screen into your PC via <span className="font-semibold text-slate-900 dark:text-white">HDMI / VGA</span>.</li>
              <li>Click <span className="font-semibold text-slate-900 dark:text-white">"Launch Detached Window"</span> above.</li>
              <li>Drag the detached window onto your secondary HDMI screen.</li>
              <li>Press <span className="font-semibold text-slate-900 dark:text-white">F11</span> (or click the fullscreen icon) for borderless fullscreen.</li>
              <li>All scanned products, prices, totals, and Customer AI inquiries synchronize in real-time.</li>
            </ol>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
