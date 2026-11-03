/**
 * @file AutoSavePreferenceBar.tsx
 * @description Preference bar for "Remember my choice (Auto-save without confirmation)".
 */

import React from 'react';
import toast from 'react-hot-toast';
import { STORAGE_KEY_AUTOSAVE } from '../types';

interface AutoSavePreferenceBarProps {
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
}

export const AutoSavePreferenceBar: React.FC<AutoSavePreferenceBarProps> = ({
  autoSaveEnabled,
  setAutoSaveEnabled
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoSaveEnabled(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AUTOSAVE, checked ? 'true' : 'false');
    }
    if (checked) {
      toast.success('Choice remembered: Future AI CRUD actions will auto-save to SQLite', { icon: '⚡' });
    } else {
      toast('Manual confirmation enabled for future AI actions', { icon: 'ℹ️' });
    }
  };

  return (
    <div className="mt-3.5 pt-2.5 border-t border-slate-200/90 dark:border-zinc-800/90 flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white select-none">
        <input
          type="checkbox"
          checked={autoSaveEnabled}
          onChange={handleChange}
          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <span className="font-medium">Remember my choice (Auto-save in the future without confirmation)</span>
      </label>
      {autoSaveEnabled ? (
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
          ⚡ Auto-save ON
        </span>
      ) : (
        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
          Review Mode
        </span>
      )}
    </div>
  );
};
