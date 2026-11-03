/**
 * @file types.ts
 * @description Common type definitions for ExecutableActionCard sub-components.
 */

import { ExecutableAiAction } from '../../../lib/ai/storeSentinelClient';

export interface ExecutableActionCardProps {
  action: ExecutableAiAction;
  executed?: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const STORAGE_KEY_AUTOSAVE = 'sycomm_ai_auto_save_actions';
