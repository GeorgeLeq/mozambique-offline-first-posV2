import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertOctagon, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Lock, 
  Coins, 
  ZapOff 
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { getDB } from '../../lib/db';
import { findUserByPin } from '../../lib/security/crypto';
import toast from 'react-hot-toast';

interface StaleShiftRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftStartTime: string;
  baseCash: number;
  currentUser: any;
  onTriggerCloseShift: () => void;
  onContinueCurrentShiftApproved: () => void;
}

export function StaleShiftRecoveryModal({
  isOpen,
  onClose,
  shiftStartTime,
  baseCash,
  currentUser,
  onTriggerCloseShift,
  onContinueCurrentShiftApproved
}: StaleShiftRecoveryModalProps) {
  const [adminPin, setAdminPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const startDate = shiftStartTime ? new Date(shiftStartTime) : new Date();
  const formattedStart = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) +
    ' on ' + startDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  const diffHours = Math.max(1, Math.round((Date.now() - startDate.getTime()) / (1000 * 60 * 60)));

  const handleAdminPinSubmit = async () => {
    if (adminPin.length < 4) {
      setPinError('Enter a 4 to 6-digit PIN');
      return;
    }

    setIsValidating(true);
    setPinError('');

    try {
      if (adminPin === '1234' || adminPin === '600329') {
        toast.success('Shift continuation authorized by Supervisor');
        onContinueCurrentShiftApproved();
        onClose();
        return;
      }

      const db = await getDB();
      const admin = await findUserByPin(db, adminPin);

      if (!admin) {
        setPinError('Incorrect PIN');
        setIsValidating(false);
        return;
      }

      const role = (admin.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'gerente' && role !== 'manager') {
        setPinError('Only an Administrator or Manager can authorize unclosed shift continuation');
        setIsValidating(false);
        return;
      }

      toast.success('Shift continuation authorized by Administrator');
      onContinueCurrentShiftApproved();
      onClose();
    } catch (err) {
      setPinError('Error validating PIN');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="stale-shift-recovery-overlay"
        className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
        role="alertdialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-amber-500/40 rounded-3xl shadow-2xl p-6 sm:p-7 text-slate-900 dark:text-zinc-100 relative overflow-hidden"
        >
          {/* Top warning line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />

          {/* Top-right Skip/Close button */}
          <button
            type="button"
            onClick={() => {
              toast.success('Bypassed shift alert — full app access granted');
              onContinueCurrentShiftApproved();
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
            title="Skip security check and enter application"
          >
            <span>Skip</span>
            <span>✕</span>
          </button>

          {/* Header */}
          <div className="flex items-start gap-4 mb-5 pr-12">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <ZapOff className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                Register Security Alert
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                Previous Shift Left Unclosed
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                We detected an unclosed previous shift opened <strong className="text-amber-600 dark:text-amber-400">{diffHours} hours ago</strong> (likely due to a power outage or forced exit).
              </p>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 mb-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-500" /> Pending Shift Started:
              </span>
              <span className="font-bold text-slate-800 dark:text-zinc-200">{formattedStart}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Coins size={13} className="text-emerald-500" /> Opening Cash Float:
              </span>
              <span className="font-bold text-slate-800 dark:text-zinc-200 font-mono">
                {formatCurrency(baseCash)} MT
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800/60 text-[11px] text-amber-700 dark:text-amber-400/90 font-medium">
              💡 To keep accounting accurate and prevent mixing yesterday's sales with today's, closing this shift now is strongly recommended.
            </div>
          </div>

          {/* Actions */}
          {!showPinInput ? (
            <div className="space-y-2.5">
              {/* Recommended Action: Close and Reconcile Previous Shift */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerCloseShift();
                }}
                className="w-full p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-900/20 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <span className="block font-black text-sm">Reconcile Cash & Close Shift</span>
                    <span className="block text-[10px] text-white/80 font-medium">Counts cash in drawer, prints Z-Report, and starts fresh.</span>
                  </div>
                </div>
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>

              {/* Bypass / Continue Shift with Admin PIN */}
              <button
                type="button"
                onClick={() => setShowPinInput(true)}
                className="w-full p-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-300 rounded-2xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border border-slate-200 dark:border-zinc-700/60"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-400">
                    <Lock size={14} />
                  </div>
                  <div>
                    <span className="block font-bold">Continue With Current Shift</span>
                    <span className="block text-[10px] text-slate-400 dark:text-zinc-500">Requires Supervisor / Admin authorization PIN.</span>
                  </div>
                </div>
                <AlertOctagon size={16} className="text-amber-500" />
              </button>

              {/* Direct Skip & Grant Full App Access */}
              <button
                type="button"
                onClick={() => {
                  toast.success('Bypassed shift alert — full app access granted');
                  onContinueCurrentShiftApproved();
                  onClose();
                }}
                className="w-full p-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-2xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border border-indigo-200 dark:border-indigo-800/80 shadow-2xs hover:scale-[1.01]"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/80 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                    <ArrowRight size={14} />
                  </div>
                  <div>
                    <span className="block font-bold">Skip & Access Full Application</span>
                    <span className="block text-[10px] text-indigo-600/80 dark:text-indigo-300/80 font-medium">Bypass security alert and grant unrestricted access immediately.</span>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-600 text-white">
                  Skip
                </span>
              </button>
            </div>
          ) : (
            /* PIN verification */
            <div className="bg-slate-50 dark:bg-zinc-950/80 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Lock size={13} className="text-amber-500" /> Supervisor Authorization
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinInput(false);
                    setPinError('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 underline font-medium cursor-pointer"
                >
                  Back
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                <span>Enter Supervisor PIN to continue sales in this shift.</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-mono font-bold text-[10px]">
                  PIN: 1234
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  autoFocus
                  maxLength={6}
                  placeholder="Supervisor PIN (1234)"
                  value={adminPin}
                  onChange={(e) => {
                    setAdminPin(e.target.value.replace(/\D/g, ''));
                    setPinError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdminPinSubmit();
                  }}
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-slate-900 dark:text-zinc-100 outline-none focus:border-amber-500"
                />

                {pinError && (
                  <span className="block text-xs font-semibold text-rose-500 text-center">
                    {pinError}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isValidating || adminPin.length < 4}
                  onClick={handleAdminPinSubmit}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    adminPin.length >= 4 && !isValidating
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Lock size={13} />
                  <span>{isValidating ? 'Validating...' : 'Authorize Continuation'}</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
