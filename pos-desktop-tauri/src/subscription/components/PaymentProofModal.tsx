/**
 * @file PaymentProofModal.tsx
 * @description Payment details and proof submission modal for M-Pesa & E-Mola in Mozambique.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Smartphone, Copy, Check, Upload, ArrowRight, 
  ShieldCheck, AlertCircle, Sparkles, KeyRound 
} from 'lucide-react';
import { useSubscription } from '../subscriptionContext';
import toast from 'react-hot-toast';

export function PaymentProofModal() {
  const { 
    isPaymentModalOpen, 
    setIsPaymentModalOpen, 
    targetPlanForPayment, 
    shopId, 
    submitPaymentProof,
    setIsOfflineUnlockOpen,
    unlockWithCode
  } = useSubscription();

  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'emola'>('mpesa');
  const [referenceCode, setReferenceCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Subscriptions suspended for Hackathon
  return null;

  const paymentAccounts = {
    mpesa: {
      number: '84 990 1234',
      rawNumber: '849901234',
      name: 'POS Central Moçambique Lda',
      ussd: '*150#'
    },
    emola: {
      number: '86 990 1234',
      rawNumber: '869901234',
      name: 'POS Central Moçambique Lda',
      ussd: '*898#'
    }
  };

  const currentAccount = paymentAccounts[paymentMethod];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceCode.trim()) {
      toast.error('Por favor introduza o Código de Transação do M-Pesa / E-Mola.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitPaymentProof({
        planId: targetPlanForPayment.id,
        featureKey: targetPlanForPayment.features_included[0] || 'client_debts',
        amountMt: targetPlanForPayment.price_mt,
        paymentMethod,
        referenceCode: referenceCode.trim(),
        phoneNumber: phoneNumber.trim()
      });

      if (res.success) {
        toast.success(res.message, { duration: 6000 });
        setIsPaymentModalOpen(false);
        setReferenceCode('');
        setPhoneNumber('');
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error('Erro ao enviar comprovativo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant developer testing unlock
  const handleInstantTestUnlock = () => {
    const res = unlockWithCode('MZPOS-TEST-FIADOS-2026');
    if (res.success) {
      setIsPaymentModalOpen(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-6 md:p-7 shadow-2xl relative select-none"
        >
          {/* Close button */}
          <button
            onClick={() => setIsPaymentModalOpen(false)}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-zinc-100">
                Pagamento & Ativação
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Pague via telemóvel e ative o plano para a sua loja
              </p>
            </div>
          </div>

          {/* Target Plan Banner */}
          <div className="my-4 p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Plano Selecionado</span>
              <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100">{targetPlanForPayment.name}</h4>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                {targetPlanForPayment.price_mt.toLocaleString('pt-MZ')} MT
              </span>
              <p className="text-[10px] text-slate-400">{targetPlanForPayment.period_label}</p>
            </div>
          </div>

          {/* Provider Toggle (M-Pesa vs E-Mola) */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => setPaymentMethod('mpesa')}
              className={`py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                paymentMethod === 'mpesa'
                  ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
              }`}
            >
              <span>M-Pesa (Vodacom)</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('emola')}
              className={`py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                paymentMethod === 'emola'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
              }`}
            >
              <span>E-Mola (Movitel)</span>
            </button>
          </div>

          {/* Official Account Details */}
          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400">
                  Número para Transferência ({paymentMethod.toUpperCase()})
                </span>
                <p className="text-base font-black text-slate-900 dark:text-zinc-100 font-mono">
                  {currentAccount.number}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                  {currentAccount.name}
                </p>
              </div>
              <button
                onClick={() => handleCopy(currentAccount.rawNumber, 'Número')}
                className="p-2 bg-white dark:bg-zinc-800 rounded-xl border border-amber-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                {copiedField === 'Número' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>Copiar</span>
              </button>
            </div>

            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/30 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-zinc-400 font-medium">Referência da Loja:</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-zinc-200">
                <span>{shopId}</span>
                <button
                  onClick={() => handleCopy(shopId, 'ID da Loja')}
                  className="p-1 hover:text-indigo-600"
                  title="Copiar ID da Loja"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Proof Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Código de Transação / ID da Mensagem M-Pesa *
              </label>
              <input
                type="text"
                placeholder="Ex: PP260903.1422.B09123"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs font-bold text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Número de Telefone que Efetuou o Pagamento (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: 84 123 4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !referenceCode.trim()}
              className="w-full py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{isSubmitting ? 'A Enviar Comprovativo...' : 'Enviar Comprovativo para Aprovação'}</span>
              <ArrowRight size={15} />
            </button>
          </form>

          {/* Offline Option and Quick Testing */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsPaymentModalOpen(false);
                setIsOfflineUnlockOpen(true);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
            >
              <KeyRound size={13} />
              <span>Inserir Código Offline</span>
            </button>

            {/* Quick Testing Button */}
            <button
              type="button"
              onClick={handleInstantTestUnlock}
              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
              title="Ativa o Módulo Fiados instantaneamente para testes"
            >
              Simular Desbloqueio (Teste)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
