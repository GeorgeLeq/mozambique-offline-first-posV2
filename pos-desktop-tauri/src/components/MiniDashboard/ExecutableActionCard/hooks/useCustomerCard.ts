/**
 * @file useCustomerCard.ts
 * @description Hook managing customer CRUD operations and fiado debt in local SQLite via ChatAgentBridge.
 */

import { useState, useEffect } from 'react';
import { ExecutableAiAction } from '../../../../lib/ai/types';
import { posActionDispatcher as chatAgentBridge } from '../../../../lib/ai/actions';
import toast from 'react-hot-toast';

type CustomerAction = Extract<ExecutableAiAction, { type: 'create_customer' | 'update_customer' | 'delete_customer' }>;

interface UseCustomerCardProps {
  action: CustomerAction;
  executed?: boolean;
  autoSaveEnabled: boolean;
  currentUser?: { id?: string; name?: string; role?: string } | null;
  onExecuted: () => void;
}

export function useCustomerCard({
  action,
  executed = false,
  autoSaveEnabled,
  currentUser,
  onExecuted
}: UseCustomerCardProps) {
  const [isDone, setIsDone] = useState(executed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);

  const [custName, setCustName] = useState(action.data.customer_name || '');
  const [custPhone, setCustPhone] = useState(
    'phone_number' in action.data && action.data.phone_number ? action.data.phone_number : '+258 '
  );
  const [custAddress, setCustAddress] = useState(
    'address' in action.data && action.data.address ? action.data.address : 'Maputo'
  );
  const [custDebt, setCustDebt] = useState(
    'initial_debt_mt' in action.data && action.data.initial_debt_mt ? action.data.initial_debt_mt.toString() : '0'
  );

  // Auto-save on mount if enabled (skip for deletions)
  useEffect(() => {
    if (autoSaveEnabled && !executed && !isDone && !isSubmitting && custName && action.type !== 'delete_customer') {
      handleSaveCustomer(true);
    }
  }, []);

  const handleSaveCustomer = async (isAuto = false) => {
    if (!custName.trim()) {
      if (!isAuto) toast.error('Nome do cliente é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      if (action.type === 'create_customer') {
        const debtNum = parseFloat(custDebt) || 0;
        const res = await chatAgentBridge.createCustomer(
          {
            name: custName.trim(),
            phone: custPhone.trim(),
            address: custAddress.trim(),
            initial_debt: debtNum
          },
          currentUser?.id || 'admin'
        );

        if (!res.success) {
          throw new Error(res.error || 'Falha ao registar cliente');
        }

        setIsDone(true);
        if (isAuto) {
          setAutoSavedNotice(true);
          toast.success(`⚡ Auto-salvo via Bridge: Cliente "${custName}"`, { icon: '🤖' });
        } else {
          toast.success(`Cliente "${custName}" registado com sucesso!`);
        }
      } else if (action.type === 'update_customer') {
        const customerId = 'customer_id' in action.data ? action.data.customer_id : undefined;
        const res = await chatAgentBridge.updateCustomer(
          {
            customerId,
            customerName: action.data.customer_name,
            name: custName.trim(),
            phone: custPhone.trim(),
            address: custAddress.trim()
          },
          currentUser?.id || 'admin'
        );

        if (!res.success) {
          throw new Error(res.error || 'Falha ao atualizar cliente');
        }

        setIsDone(true);
        if (isAuto) {
          setAutoSavedNotice(true);
          toast.success(`⚡ Atualização auto-salva: Cliente "${custName}"`, { icon: '🤖' });
        } else {
          toast.success(`Cliente "${custName}" atualizado com sucesso!`);
        }
      } else if (action.type === 'delete_customer') {
        const customerId = 'customer_id' in action.data ? action.data.customer_id : undefined;
        const res = await chatAgentBridge.deleteCustomer(
          {
            customerId,
            customerName: action.data.customer_name
          },
          currentUser?.id || 'admin'
        );

        if (!res.success) {
          throw new Error(res.error || 'Falha ao remover cliente');
        }

        setIsDone(true);
        toast.success(`Cliente "${action.data.customer_name}" arquivado com sucesso!`);
      }

      onExecuted();
    } catch (err: any) {
      console.error('[useCustomerCard] Customer action error:', err);
      if (!isAuto) toast.error(`Falha: ${err.message || 'Erro ao processar cliente'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isDone,
    isSubmitting,
    autoSavedNotice,
    custName,
    setCustName,
    custPhone,
    setCustPhone,
    custAddress,
    setCustAddress,
    custDebt,
    setCustDebt,
    handleSaveCustomer
  };
}
