import React from 'react';
import { Key, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

interface NumpadFooterActionsProps {
  onOpenRecovery: () => void;
  onSetIsLoading: (loading: boolean) => void;
}

export function NumpadFooterActions({ onOpenRecovery, onSetIsLoading }: NumpadFooterActionsProps) {
  const { deactivateDevice } = useAuth();

  const handleDeviceWipe = async () => {
    try {
      onSetIsLoading(true);
      const toastId = toast.loading('A executar Device Wipe completo...');
      await deactivateDevice();
      toast.success('Dispositivo totalmente limpo! A redirecionar para activação...', { id: toastId });
    } catch (e) {
      console.error('Device wipe error:', e);
      toast.error('Erro ao efetuar Device Wipe.');
    } finally {
      onSetIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={onOpenRecovery}
        className="mt-8 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1.5"
      >
        <Key size={12} />
        Esqueceu o PIN do Administrador?
      </button>

      <button
        type="button"
        onClick={handleDeviceWipe}
        className="mt-4 text-[10px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-full border border-rose-200 dark:border-rose-900/40 shadow-xs"
        title="Executar Device Wipe total e voltar à activação do dispositivo"
      >
        <Trash2 size={11} />
        <span>DEVICE WIPE</span>
      </button>
    </>
  );
}
