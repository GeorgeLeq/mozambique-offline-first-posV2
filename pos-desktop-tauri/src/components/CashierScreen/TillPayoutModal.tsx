import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, DollarSign, Wallet, Lock, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDB } from '../../lib/db';
import { findUserByPin } from '../../lib/security/crypto';
import { useAuth } from '../../contexts/AuthContext';
import { sanitizeString, sanitizeNumeric } from '../../lib/security/sanitizer';
import { useI18n } from '../../i18n';
import { VoiceInputButton } from '../common/VoiceInputButton';
import { ParsedPettyCashResult } from '../../lib/ai/voiceIntentParser';
import { Sparkles } from 'lucide-react';

interface TillPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function TillPayoutModal({ isOpen, onClose, userId }: TillPayoutModalProps) {
  const { pos: t, common: commonT } = useI18n();
  const { currentUser } = useAuth();

  const REASONS = [
    t?.reasonSupplierPayment || 'Pagamento a Fornecedor',
    t?.reasonStoreExpenses || 'Despesas da Loja',
    t?.reasonOwnerWithdrawal || 'Levantamento (Dono)',
    t?.reasonOther || 'Outro'
  ];

  const [step, setStep] = useState<'form' | 'auth'>('form');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manager PIN Authorization states
  const [managerPin, setManagerPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [authorizedManagerName, setAuthorizedManagerName] = useState<string | null>(null);

  // Security configuration states loaded from SQLite
  const [authTriggerOpenDrawer, setAuthTriggerOpenDrawer] = useState<boolean>(true);
  const [lastVoiceNote, setLastVoiceNote] = useState<string | null>(null);

  // Handle voice recognition from Muse Voice Transcribe
  const handleVoicePayoutParsed = (result: ParsedPettyCashResult) => {
    if (result.amount > 0) {
      setAmount(String(result.amount));
    }
    if (result.reason) {
      setNote(result.reason);
      const lower = result.reason.toLowerCase();
      if (lower.includes('fornecedor') || lower.includes('mercadoria') || lower.includes('encomenda') || lower.includes('factura')) {
        setReason(REASONS[0]);
      } else if (lower.includes('dono') || lower.includes('patrao') || lower.includes('patrão') || lower.includes('gerente')) {
        setReason(REASONS[2]);
      } else {
        setReason(REASONS[1]);
      }
    }
    setLastVoiceNote(`Reconhecido: ${result.amount > 0 ? `${result.amount} MT — ` : ''}${result.reason}`);
    toast.success('Saída preenchida por voz com Muse AI!', { icon: '🎙️' });
  };

  // Reset states on close
  const handleCloseModal = () => {
    setAmount('');
    setReason(REASONS[0]);
    setNote('');
    setLastVoiceNote(null);
    setStep('form');
    setManagerPin('');
    setPinError('');
    setAuthorizedManagerName(null);
    onClose();
  };

  // Main saving logic after manager auth is secured
  const executePayoutSave = async (authorizedBy: string) => {
    const val = sanitizeNumeric(amount, 0);
    const cleanReason = sanitizeString(reason);
    const cleanNote = sanitizeString(note);
    const cleanAuthBy = sanitizeString(authorizedBy);
    setIsSubmitting(true);
    try {
      const db = await getDB();
      const id = crypto.randomUUID();

      await db.execute(
        'INSERT INTO till_payouts (id, amount, reason, note, user_id, is_synced) VALUES (?, ?, ?, ?, ?, 0)',
        [id, val, cleanReason, cleanNote, userId]
      );

      // Fetch cashier name for rich logging
      const userRes = await db.select('SELECT name FROM users WHERE id = ?', [userId]) as any[];
      const userName = userRes.length > 0 ? userRes[0].name : 'Operador';

      // Create a high-risk operational alert notification
      const notifId = crypto.randomUUID();
      await db.execute(`
        INSERT INTO notifications (id, type, title, message, is_read, action_url, sync_status)
        VALUES (?, ?, ?, ?, 0, ?, 0)
      `, [
        notifId,
        'TILL_PAYOUT',
        'Saída de Caixa',
        `Saída de ${val} MT registada por ${userName}. Autorizado por: ${authorizedBy}. Motivo: ${reason}.${note ? ` Observação: ${note}` : ''}`,
        'audit'
      ]);

      // Write local audit log
      await db.execute(
        `INSERT INTO audit_logs (id, user_id, action, details, sync_status) VALUES (?, ?, ?, ?, 0)`,
        [crypto.randomUUID(), userId, 'TILL_PAYOUT_APPROVED', `Saida de ${val} MT autorizada por ${authorizedBy}. Motivo: ${reason}.`]
      );

      toast.success('Saída de caixa registada com sucesso!');
      
      // Clean up and close
      setAmount('');
      setReason(REASONS[0]);
      setNote('');
      setStep('form');
      setManagerPin('');
      setAuthorizedManagerName(null);
      onClose();
    } catch (error) {
      console.error('Failed to save till payout:', error);
      toast.error('Erro ao registar a saída.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load security settings from local SQLite database on open
  useEffect(() => {
    async function loadSecuritySettings() {
      if (!isOpen) return;
      try {
        const db = await getDB();
        const settings = await db.select(
          'SELECT key, value FROM settings WHERE key IN (?)',
          ['auth_trigger_open_drawer']
        ) as any[];
        
        settings.forEach(row => {
          if (row.key === 'auth_trigger_open_drawer') {
            setAuthTriggerOpenDrawer(row.value === 'true');
          }
        });
      } catch (err) {
        console.error('Failed to load TillPayout security settings:', err);
      }
    }
    loadSecuritySettings();
  }, [isOpen]);

  // Submit form handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    
    if (!val || val <= 0) {
      toast.error('Insira um valor válido');
      return;
    }

    if (authTriggerOpenDrawer) {
      // Need manager authorization
      setStep('auth');
    } else {
      // Direct save without auth
      executePayoutSave(currentUser?.name || 'Operador de Caixa');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const db = await getDB();
      // First try Admin/Manager PIN
      const adminUser = await findUserByPin(db, managerPin, ['Admin', 'Manager']);

      if (adminUser && !adminUser.__role_mismatch) {
        const adminName = adminUser.name;
        setAuthorizedManagerName(adminName);
        toast.success(`Autorizado por ${adminName}`);
        await executePayoutSave(adminName);
      } else {
        // Fallback: check emergency tokens by code first
        const tokens = await db.select(
          'SELECT * FROM emergency_tokens WHERE code = ? AND is_used = 0',
          [managerPin]
        ) as any[];

        // Find the token matching this cashier and not expired, or allow fallback for simulated/unauthenticated cashiers in testing mode
        const matchedToken = tokens.find(t => 
          (!t.expires_at || new Date(t.expires_at) > new Date()) &&
          (!t.cashier_id || 
           !currentUser?.id || 
           t.cashier_id === currentUser?.id || 
           currentUser?.id === 'sim-cashier' || 
           currentUser?.id === 'unknown')
        );

        if (matchedToken) {
          // Token valid - revoke it and proceed
          const payoutAmount = parseFloat(amount) || 0;
          await db.execute(
            'UPDATE emergency_tokens SET is_used = 1, used_at = CURRENT_TIMESTAMP, used_amount = ?, used_for = ?, sync_status = 0 WHERE id = ?', 
            [payoutAmount, `Saída Caixa: ${reason || 'Sem motivo'}`, matchedToken.id]
          );
          const authName = 'Código de Emergência';
          setAuthorizedManagerName(authName);
          toast.success('Autorizado via código de emergência.');
          await executePayoutSave(authName);
        } else {
          setPinError('PIN Inválido ou Sem Permissão!');
          toast.error('Erro de autorização. Verifique o PIN.');
        }
      }
    } catch (err) {
      console.error('Failed to verify PIN:', err);
      toast.error('Erro ao verificar PIN.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 ">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-white/10"
          >
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                    <Wallet size={24} className="text-indigo-500" />
                    {t.tillPayoutTitle || 'Saída de Caixa (Payout)'}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 mt-1">
                    {t.cashPayoutRecord || 'Registo de saída de numerário'}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {step === 'form' ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Muse Voice Transcribe Payout Assistant */}
                  <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-indigo-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-indigo-950/30 p-3.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                        <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Ditar Saída por Voz (Muse AI)</span>
                      </div>
                      <VoiceInputButton
                        mode="petty_cash"
                        size="sm"
                        label="Ditar Saída"
                        cashierId={currentUser?.id}
                        cashierName={currentUser?.name}
                        shiftId={currentUser?.current_shift_start}
                        onParsedPettyCash={handleVoicePayoutParsed}
                      />
                    </div>
                    {lastVoiceNote && (
                      <div className="text-[11px] font-mono font-medium text-indigo-700 dark:text-indigo-300 bg-white/70 dark:bg-zinc-900/70 px-2.5 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        {lastVoiceNote}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      {t.amountMt || 'Valor (MT)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-2xl text-2xl font-black text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="0.00"
                        required
                        autoFocus
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
                        <DollarSign size={20} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      {t.reason || 'Motivo'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {REASONS.map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                            reason === r
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      {t.notesOptional || 'Observações (Opcional)'}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
                      placeholder={t.additionalDetailsPlaceholder || "Detalhes adicionais..."}
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!amount || parseFloat(amount) <= 0}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/15 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      {authTriggerOpenDrawer ? (
                        <>
                          {t.continueToAuthorization || 'Continuar para Autorização'} <Lock size={16} />
                        </>
                      ) : (
                        <>
                          {t.recordCashPayout || 'Registar Saída de Caixa'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 text-center">
                    <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">{t.requestedPayout || 'Saída Solicitada'}</p>
                    <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400 font-mono mt-1">
                      {parseFloat(amount).toFixed(2)} MT
                    </p>
                    <p className="text-xs font-bold text-indigo-500 mt-2 uppercase tracking-wider">
                      {reason}
                    </p>
                  </div>

                  <form onSubmit={handlePinSubmit} className="space-y-4">
                    <div className="relative">
                      <input
                        type="password"
                        value={managerPin}
                        onChange={(e) => {
                          setManagerPin(e.target.value);
                          setPinError('');
                        }}
                        placeholder={t.pinOrEmergencyCodePlaceholder || "PIN ou Código de Emergência..."}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-center text-xl font-bold tracking-widest text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        maxLength={8}
                        autoFocus
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <Lock size={20} />
                      </div>
                    </div>
                    {pinError && (
                      <p className="text-center text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 py-2 rounded-lg">
                        {pinError}
                      </p>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStep('form');
                          setManagerPin('');
                          setPinError('');
                        }}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-300 font-bold text-sm rounded-xl transition-all"
                      >
                        {commonT.back || 'Voltar'}
                      </button>
                      <button
                        type="submit"
                        disabled={!managerPin || isSubmitting}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:text-slate-500 dark:disabled:text-zinc-600 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          commonT.loading || 'A Processar...'
                        ) : (
                          <>
                            <Check size={16} /> {t.authorize || 'Autorizar'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
