import React from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useI18n } from '../../../i18n';

interface DetailsHeaderProps {
  delivery: any;
  isFullScreen: boolean;
  setIsFullScreen: (val: boolean) => void;
  onClose: () => void;
}

export function DetailsHeader({ delivery, isFullScreen, setIsFullScreen, onClose }: DetailsHeaderProps) {
  const t = useI18n();

  return (
    <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-md shrink-0">
      <div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold uppercase tracking-wider mb-1">
          {delivery?.po_number ? `PO-${delivery.po_number}` : 'PO-1001'}
        </span>
        <h2 className="text-xl font-black text-slate-800 dark:text-zinc-50">
          {delivery ? delivery.supplier_name : (t.loadingData || 'A carregar...')}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          title={isFullScreen ? (t.collapseFullscreen || "Reduzir janela") : (t.expandFullscreen || "Expandir ecrã inteiro")}
        >
          {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button
          onClick={onClose}
          className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
