/**
 * @file useOperatorCard.ts
 * @description Hook managing operator/cashier creation, update, and deletion in SQLite via ChatAgentBridge.
 */

import { useState, useEffect } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/types';
import { posActionDispatcher as chatAgentBridge } from '../../../../lib/ai/actions';
import toast from 'react-hot-toast';

type OperatorAction = Extract<ExecutableAiAction, { type: 'create_operator' | 'update_operator' | 'delete_operator' }>;

interface UseOperatorCardProps {
  action: OperatorAction;
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export function useOperatorCard({
  action,
  executed = false,
  autoSaveEnabled,
  currentUser,
  onExecuted
}: UseOperatorCardProps) {
  const [isDone, setIsDone] = useState(executed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);

  const [opName, setOpName] = useState(action.data.name || '');
  const [opPin, setOpPin] = useState(
    'pin' in action.data && action.data.pin ? action.data.pin : '1234'
  );
  const [opRole, setOpRole] = useState<'operator' | 'admin' | 'manager'>(
    'role' in action.data && (action.data.role === 'admin' || action.data.role === 'manager')
      ? action.data.role
      : 'operator'
  );
  const [opTerminal, setOpTerminal] = useState(
    'terminal_name' in action.data && action.data.terminal_name ? action.data.terminal_name : 'POS Station 1'
  );
  const [opBlocked, setOpBlocked] = useState(
    'is_blocked' in action.data ? Boolean(action.data.is_blocked) : false
  );

  // Auto-save on mount if enabled (skip for deletions)
  useEffect(() => {
    if (autoSaveEnabled && !executed && !isDone && !isSubmitting && opName && action.type !== 'delete_operator') {
      handleSaveOperator(true);
    }
  }, []);

  const handleSaveOperator = async (isAuto = false) => {
    if (!opName.trim()) {
      if (!isAuto) toast.error('Nome do operador é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      if (action.type === 'create_operator') {
        const res = await chatAgentBridge.createOperator(
          {
            name: opName.trim(),
            pin: opPin.trim() || '1234',
            role: opRole,
            terminal_name: opTerminal.trim()
          },
          currentUser?.id || 'admin'
        );

        if (!res.success) {
          throw new Error(res.error || 'Falha ao cadastrar operador');
        }

        setIsDone(true);
        if (isAuto) {
          setAutoSavedNotice(true);
          toast.success(`⚡ Auto-salvo via Bridge: Operador "${opName}"`, { icon: '🤖' });
        } else {
          toast.success(`Operador "${opName}" cadastrado com sucesso!`);
        }
      } else if (action.type === 'update_operator') {
        const userId = 'user_id' in action.data ? action.data.user_id : undefined;
        const res = await chatAgentBridge.updateOperator(
          {
            userId,
            userName: action.data.name,
            name: opName.trim(),
            pin: opPin.trim(),
            role: opRole,
            is_blocked: opBlocked
          },
          currentUser?.id || 'admin'
        );

        if (!res.success) {
          throw new Error(res.error || 'Falha ao atualizar operador');
        }

        setIsDone(true);
        if (isAuto) {
          setAutoSavedNotice(true);
          toast.success(`⚡ Atualização auto-salva: Operador "${opName}"`, { icon: '🤖' });
        } else {
          toast.success(`Operador "${opName}" atualizado com sucesso!`);
        }
      } else if (action.type === 'delete_operator') {
        const userId = 'user_id' in action.data ? action.data.user_id : undefined;
        const res = await chatAgentBridge.deleteOperator(
          {
            userId,
            userName: action.data.name
          },
          currentUser?.id || 'admin'
        );

        if (!res.success) {
          throw new Error(res.error || 'Falha ao remover operador');
        }

        setIsDone(true);
        toast.success(`Operador "${action.data.name}" arquivado com sucesso!`);
      }

      onExecuted();
    } catch (err: any) {
      console.error('[useOperatorCard] Operator action error:', err);
      if (!isAuto) toast.error(`Erro: ${err.message || 'Falha ao processar operador'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isDone,
    isSubmitting,
    autoSavedNotice,
    opName,
    setOpName,
    opPin,
    setOpPin,
    opRole,
    setOpRole,
    opTerminal,
    setOpTerminal,
    opBlocked,
    setOpBlocked,
    handleSaveOperator
  };
}
