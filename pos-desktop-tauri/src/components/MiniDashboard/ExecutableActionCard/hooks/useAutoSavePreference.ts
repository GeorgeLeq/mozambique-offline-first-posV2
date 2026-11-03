/**
 * @file useAutoSavePreference.ts
 * @description Hook for managing "Remember my choice" auto-save preference in localStorage.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { STORAGE_KEY_AUTOSAVE } from '../types';

export function useAutoSavePreference() {
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_AUTOSAVE) === 'true';
    }
    return false;
  });

  const toggleAutoSave = (checked: boolean) => {
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

  return { autoSaveEnabled, toggleAutoSave };
}
