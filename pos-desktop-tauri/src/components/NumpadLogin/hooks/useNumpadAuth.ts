import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useCashShiftPrompt } from './useCashShiftPrompt';
import { NumpadAuthHookResult } from '../types';

export function useNumpadAuth(): NumpadAuthHookResult {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const cashShift = useCashShiftPrompt({ pin, setPin, setError });

  // Automatically submit PIN when 4-digit demo PIN or 6 digits are typed
  useEffect(() => {
    if (
      (pin.length === 6 || (pin.length === 4 && ['1234', '1001', '2001', '3001'].includes(pin))) &&
      !cashShift.isCashPromptOpen &&
      !isLoading
    ) {
      handleLogin(pin);
    }
  }, [pin, cashShift.isCashPromptOpen, isLoading]);

  // Handle physical keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        if (cashShift.isCashPromptOpen && e.key === 'Enter') {
          e.preventDefault();
          cashShift.handleConfirmCashShift();
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (cashShift.isCashPromptOpen) {
          cashShift.handleConfirmCashShift();
        } else {
          handleLogin(pin || '1234');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cashShift.isCashPromptOpen, pin, cashShift.cashInputValue, cashShift.pendingUser]);

  const handleLogin = async (currentPin: string) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await login(currentPin);
      
      if (res.success) {
        if (res.requiresCashInput && res.user) {
          cashShift.openCashShiftPrompt(res.user, res.defaultCash);
        }
      } else {
        if (res.blocked) {
          toast.error('ACESSO BLOQUEADO! Por favor, contacte o seu administrador.', { duration: 4000 });
        } else if (res.lockdown) {
          toast.error('SISTEMA EM BLOQUEIO DE EMERGÊNCIA! Apenas Administradores podem entrar.', { duration: 5000 });
        } else {
          toast.error('PIN incorreto!');
        }
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumberClick = (num: string) => {
    if (cashShift.isCashPromptOpen) {
      cashShift.setCashInputValue(prev => {
        if (prev === '0') return num;
        return prev + num;
      });
    } else {
      if (pin.length < 6) {
        setPin(prev => prev + num);
        setError(false);
      }
    }
  };

  const handleDelete = () => {
    if (cashShift.isCashPromptOpen) {
      cashShift.setCashInputValue(prev => prev.slice(0, -1) || '0');
    } else {
      setPin(prev => prev.slice(0, -1));
      setError(false);
    }
  };

  const handleClear = () => {
    if (cashShift.isCashPromptOpen) {
      cashShift.setCashInputValue('0');
    } else {
      setPin('');
      setError(false);
    }
  };

  return {
    pin,
    error,
    isLoading,
    handleNumberClick,
    handleDelete,
    handleClear,
    handleLogin,
    pendingUser: cashShift.pendingUser,
    isCashPromptOpen: cashShift.isCashPromptOpen,
    cashInputValue: cashShift.cashInputValue,
    setCashInputValue: cashShift.setCashInputValue,
    handleConfirmCashShift: cashShift.handleConfirmCashShift,
    handleCancelCashShift: cashShift.handleCancelCashShift
  };
}
