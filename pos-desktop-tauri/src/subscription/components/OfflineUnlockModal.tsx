/**
 * @file OfflineUnlockModal.tsx
 * @description Dialog for unlocking modules 100% offline via 16-character cryptographic codes.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, KeyRound, Copy, Check, ShieldCheck, Sparkles, 
  MessageSquare, Phone, ArrowRight, HelpCircle 
} from 'lucide-react';
import { useSubscription } from '../subscriptionContext';
import { generateOfflineActivationCode } from '../cryptoLicense';
import toast from 'react-hot-toast';

export function OfflineUnlockModal() {
  const { 
    isOfflineUnlockOpen, 
    setIsOfflineUnlockOpen, 
    shopId, 
    deviceId, 
    hardwareFingerprint,
    unlockWithCode 
  } = useSubscription();

  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Subscriptions suspended for Hackathon
  return null;

  const handleCopyShopInfo = () => {
    const text = `Loja: ${shopId} | Terminal: ${deviceId} | HWID: ${hardwareFingerprint}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Identificadores copiados!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Por favor introduza o código de ativação.');
      return;
    }

    const res = unlockWithCode(code.trim());
    if (res.success) {
      setIsOfflineUnlockOpen(false);
      setCode('');
    } else {
      toast.error(res.message);
    }
  };

  // Helper to generate a genuine cryptographic code for demonstration
  const handleGenerateDemoCode = () => {
    const generated = generateOfflineActivationCode(shopId, deviceId, 'client_debts', 30);
    setCode(generated);
    toast.success('Código criptográfico gerado para esta loja! Clique em "Ativar Módulo".');
  };

  const whatsappMessage = encodeURIComponent(
    `Olá Suporte POS Central! Gostaria de ativar o Módulo Fiados na minha loja. Meu ID de Loja é ${shopId}, Terminal ${deviceId} e HWID ${hardwareFingerprint}.`
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 md:p-7 shadow-2xl relative select-none"
        >
          {/* Close button */}
          <button
            onClick={() => setIsOfflineUnlockOpen(false)}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-zinc-100">
                Ativação Offline
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Desbloqueie módulos sem necessitar de internet
              </p>
            </div>
          </div>

          {/* Shop ID info card */}
          <div className="my-4 p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">O Seu ID de Loja:</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{shopId}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Terminal Físico:</span>
              <span className="font-mono text-slate-700 dark:text-zinc-300">{deviceId.slice(0, 18)}...</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Hardware ID (HWID):</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{hardwareFingerprint}</span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <button
                onClick={handleCopyShopInfo}
                className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>Copiar Identificador</span>
              </button>

              <a
                href={`https://wa.me/258849901234?text=${whatsappMessage}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <MessageSquare size={13} />
                <span>Pedir no WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Code Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Introduza o Código de Ativação (16 Caracteres)
              </label>
              <input
                type="text"
                placeholder="MZPOS-XXXX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-sm font-black text-slate-900 dark:text-zinc-100 text-center tracking-widest placeholder:tracking-normal placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                autoFocus
                required
              />
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 text-center">
                Fornecido pela equipa central após pagamento via M-Pesa
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Validar & Ativar Módulo</span>
              <ArrowRight size={15} />
            </button>
          </form>

          {/* Demo Helper Generator */}
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800 text-center">
            <button
              type="button"
              onClick={handleGenerateDemoCode}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Gerar Código de Teste Válido (Demonstração)</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
