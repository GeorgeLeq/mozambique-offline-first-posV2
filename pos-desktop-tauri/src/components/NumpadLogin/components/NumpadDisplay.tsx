/**
 * @file NumpadDisplay.tsx
 * @description Numpad PIN display & Instant Demo Quick Access Controller.
 * Enables zero-friction evaluation for judges with one-tap entry
 * while displaying masked PIN dots for tactile cashier input.
 */

import React from 'react';
import { ShieldCheck, Sparkles, UserCheck, Crown, Briefcase, ShoppingBag, Receipt, Calculator, ChevronDown, ChevronUp } from 'lucide-react';

interface NumpadDisplayProps {
  pin: string;
  error: boolean;
  onQuickPin?: (pin: string) => void;
  isLoading?: boolean;
  showKeypad: boolean;
  onToggleKeypad: () => void;
}

const DEMO_ACCOUNTS = [
  { name: 'Admin', role: 'Administrator', pin: '1234', icon: Crown, color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  { name: 'Carlos Matsinhe', role: 'Manager', pin: '1001', icon: Briefcase, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' },
  { name: 'Maria Sitoe', role: 'Cashier 01 (Active)', pin: '2001', icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  { name: 'João Cossa', role: 'Cashier 02 (Audit)', pin: '3001', icon: Receipt, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
];

export function NumpadDisplay({ pin, error, onQuickPin, isLoading, showKeypad, onToggleKeypad }: NumpadDisplayProps) {
  const pinLength = pin.length;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Brand Icon */}
      <div className="w-16 h-16 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg border border-slate-200/80 dark:border-white/10 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/10 relative">
        <div className="absolute inset-0 bg-indigo-500/15 rounded-2xl blur-lg" />
        <ShieldCheck className="w-9 h-9 text-indigo-600 dark:text-indigo-400 relative z-10" strokeWidth={1.5} />
      </div>

      <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100 text-center">
        SYCOMM POS
      </h1>
      <p className="text-slate-500 dark:text-zinc-400 mb-3 font-medium text-xs text-center">
        Retail Point of Sale &amp; Inventory Intelligence (Mozambique)
      </p>

      {/* 100% Offline SQLite Badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-4">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>100% Offline SQLite • Ready</span>
      </div>

      {/* Prominent One-Click Quick Access Banner (Translated into English) */}
      {onQuickPin && (
        <div className="w-full max-w-[320px] p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-amber-500/10 border border-indigo-500/30 dark:border-indigo-500/20 mb-4 flex flex-col gap-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Access</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400">PIN: 1234</span>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onQuickPin('1234')}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md shadow-indigo-600/30 hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4 text-amber-300" />
            <span>Enter as Admin (1-Click)</span>
          </button>

          {/* Quick Demo Operator Profiles */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-800/80">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.pin}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onQuickPin(acc.pin)}
                  className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${acc.color}`}
                  title={`Login as ${acc.name} (${acc.role} - PIN: ${acc.pin})`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black truncate">{acc.name}</div>
                    <div className="text-[9px] font-mono opacity-80">{acc.role} • {acc.pin}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Masked PIN Indicator Dots */}
      <div className={`flex items-center justify-center gap-3 my-2 ${error ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const isFilled = idx < pinLength;
          return (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                isFilled
                  ? 'bg-indigo-600 dark:bg-indigo-400 scale-125 shadow-md shadow-indigo-500/40 ring-2 ring-indigo-500/20'
                  : 'bg-slate-200 dark:bg-zinc-700/80'
              }`}
            />
          );
        })}
      </div>

      {error ? (
        <p className="text-rose-500 text-xs font-bold mt-1 mb-2 animate-bounce">
          Incorrect PIN! Please try again.
        </p>
      ) : (
        <p className="text-slate-400 dark:text-zinc-500 text-[11px] font-medium mt-1 mb-2">
          Enter your 4 or 6-digit PIN
        </p>
      )}

      {/* English Keypad Toggle Button */}
      <button
        type="button"
        onClick={onToggleKeypad}
        className="mt-1 mb-3 px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
      >
        <Calculator className="w-3.5 h-3.5 text-indigo-500" />
        <span>{showKeypad ? 'Hide Keypad' : 'Show Keypad'}</span>
        {showKeypad ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
      </button>
    </div>
  );
}
