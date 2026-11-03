import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogOut, FileText, Calculator, Keyboard, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDB } from '../../../lib/db';
import { GroupedShiftSale } from './BlindCloseTypes';
import { BlindCloseCalculator } from './BlindCloseCalculator';
import { BlindCloseAudit } from './BlindCloseAudit';
import { useAuth } from '../../../contexts/AuthContext';
import { sanitizeNumeric } from '../../../lib/security/sanitizer';
import { useI18n } from '../../../i18n';
import { VoiceInputButton } from '../../common/VoiceInputButton';
import { ParsedCashUpResult } from '../../../lib/ai/voiceIntentParser';

interface BlindCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClose: (reportedAmount: number, detailsJson?: string) => void;
}

export function BlindCloseModal({ isOpen, onClose, onConfirmClose }: BlindCloseModalProps) {
  const { pos: t, common: commonT } = useI18n();
  const { currentUser, logout } = useAuth();
  const [reportedAmount, setReportedAmount] = useState('');
  const [mode, setMode] = useState<'manual' | 'calculator'>('manual');
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [voiceSummary, setVoiceSummary] = useState<string | null>(null);

  const canBypass = useMemo(() => {
    if (currentUser?.role === 'Admin') return true;
    try {
      const perms = currentUser?.permissions_json ? JSON.parse(currentUser.permissions_json) : [];
      return perms.includes('bypass_blind_close');
    } catch {
      return false;
    }
  }, [currentUser]);
  
  // Shift sales history state
  const [shiftSales, setShiftSales] = useState<GroupedShiftSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [baseCashValue, setBaseCashValue] = useState(10000);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReportedAmount('');
      setCounts({});
      setVoiceSummary(null);
      setMode('manual');
      setIsSalesHistoryOpen(false);
      loadShiftSales();
    }
  }, [isOpen]);

  const handleApplyVoiceCounts = (parsedCounts: Record<number, number>, summaryText?: string) => {
    setCounts(prev => {
      const next = { ...prev };
      for (const [denomStr, count] of Object.entries(parsedCounts)) {
        const denom = parseFloat(denomStr);
        if (count > 0) {
          next[denom] = count;
        }
      }
      return next;
    });
    if (summaryText) {
      setVoiceSummary(summaryText);
    }
    setMode('calculator');
    toast.success('Contagem preenchida por voz via Muse AI!', { icon: '🎙️' });
  };

  const loadShiftSales = async () => {
    setLoadingSales(true);
    try {
      const db = await getDB();
      let shiftStart = '';
      const ss = await db.select('SELECT value FROM settings WHERE key = "current_shift_start"') as any[];
      if (ss.length > 0) shiftStart = ss[0].value;
      
      let dateCondition = '1=1';
      if (shiftStart) {
        const formattedShiftStart = shiftStart.replace('T', ' ').substring(0, 19);
        dateCondition = `s.created_at >= '${formattedShiftStart}'`;
      }
      
      const salesList = await db.select(`
        SELECT s.*, p.name as product_name
        FROM sales s
        LEFT JOIN products p ON s.product_id = p.id
        WHERE ${dateCondition}
        ORDER BY s.created_at DESC
      `) as any[];

      // Group sales items by receipt_id
      const grouped: Record<string, GroupedShiftSale> = {};
      salesList.forEach(item => {
        const rid = item.receipt_id || item.id;
        if (!grouped[rid]) {
          grouped[rid] = {
            receipt_id: rid,
            created_at: item.created_at,
            payment_method: item.payment_method || 'cash',
            status: item.status || 'completed',
            total: 0,
            items: []
          };
        }
        grouped[rid].total += item.total_mt;
        grouped[rid].items.push({
          product_name: item.product_name || 'Produto Desconhecido',
          quantity: item.quantity,
          total_mt: item.total_mt
        });
      });

      const groupedArray = Object.values(grouped).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setShiftSales(groupedArray);

      // Load base cash setting
      const baseCashSetting = await db.select('SELECT value FROM settings WHERE key = "base_cash"') as any[];
      if (baseCashSetting.length > 0) {
        setBaseCashValue(parseFloat(baseCashSetting[0].value) || 0);
      } else {
        setBaseCashValue(10000);
      }

      // Load till payouts in current shift
      let payoutsCondition = '1=1';
      if (shiftStart) {
        const formattedShiftStart = shiftStart.replace('T', ' ').substring(0, 19);
        payoutsCondition = `created_at >= '${formattedShiftStart}'`;
      }
      const payouts = await db.select(`SELECT SUM(amount) as total FROM till_payouts WHERE ${payoutsCondition}`) as any[];
      setTotalPayouts(payouts[0]?.total || 0);
    } catch (e) {
      console.error('Failed to load shift sales history', e);
      toast.error('Erro ao buscar histórico de vendas do turno');
    } finally {
      setLoadingSales(false);
    }
  };

  const calculatedTotal = useMemo(() => {
    return Object.entries(counts).reduce((sum, [val, count]) => {
      return sum + (Number(val) * Number(count));
    }, 0);
  }, [counts]);

  const shiftTotals = useMemo(() => {
    let cash = 0;
    let mpesa = 0;
    let fiado = 0;
    shiftSales.forEach(s => {
      if (s.status === 'voided') return;
      if (s.payment_method === 'cash') cash += s.total;
      else if (s.payment_method === 'mpesa') mpesa += s.total;
      else if (s.payment_method === 'debt' || s.payment_method === 'fiado') fiado += s.total;
    });
    return { cash, mpesa, fiado, total: cash + mpesa + fiado };
  }, [shiftSales]);

  const expectedCashValue = useMemo(() => {
    return baseCashValue + shiftTotals.cash - totalPayouts;
  }, [baseCashValue, shiftTotals.cash, totalPayouts]);

  const currentReportedValue = useMemo(() => {
    if (mode === 'calculator') return calculatedTotal;
    const val = parseFloat(reportedAmount);
    return isNaN(val) ? 0 : val;
  }, [mode, calculatedTotal, reportedAmount]);

  const varianceValue = useMemo(() => {
    return currentReportedValue - expectedCashValue;
  }, [currentReportedValue, expectedCashValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let amount = 0;
    let detailsJson = undefined;

    if (mode === 'calculator') {
      amount = calculatedTotal;
      if (amount <= 0 && Object.keys(counts).length === 0) {
        toast.error('Informe a contagem do caixa.');
        return;
      }
      detailsJson = JSON.stringify({ counts });
    } else {
      amount = sanitizeNumeric(reportedAmount, 0);
      if (amount < 0) {
        toast.error('Informe um valor válido em caixa.');
        return;
      }
    }

    onConfirmClose(amount, detailsJson);
  };

  const handleCountChange = (val: number, countStr: string) => {
    const count = parseInt(countStr, 10);
    setCounts(prev => {
      const newCounts = { ...prev };
      if (isNaN(count) || count < 0) {
        delete newCounts[val];
      } else {
        newCounts[val] = count;
      }
      return newCounts;
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 "
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl lg:max-w-6xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden z-10 border border-slate-200/80 dark:border-white/10 max-h-[92vh] flex flex-col"
        >
          {/* Main Container - Split Screen Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-white/10 min-h-0 flex-1 overflow-hidden">
            
            {/* Left Column: Closure Controls & Input Form (60% width) */}
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col min-h-0 overflow-y-auto">
              <div className="relative pb-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-0 right-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-850 rounded-full transition-colors lg:hidden"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 text-indigo-500 rounded-2xl flex items-center justify-center mb-3 border border-indigo-500/20 shadow-lg shadow-indigo-500/5 transform -rotate-3 hover:rotate-0 transition-all duration-300">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight leading-none">{t.blindCloseTitle || 'O Fecho Cego'}</h2>
                  <p className="text-slate-500 dark:text-zinc-400 mt-2 text-xs max-w-md mx-auto leading-relaxed">
                    {t.blindCloseSubtitle || 'Informe o valor total físico que você tem em caixa neste momento. O sistema auditará a diferença automaticamente em relação aos registros digitais.'}
                  </p>
                </div>
                
                {/* Mode Selector Tab Bar with Muse AI Voice Assistant */}
                <div className="flex flex-wrap items-center bg-slate-100 dark:bg-zinc-950 p-1.5 rounded-2xl mt-5 border border-slate-200/50 dark:border-zinc-855/80 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('manual')}
                    className={`flex-1 min-w-[120px] py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 ${
                      mode === 'manual' 
                        ? 'bg-white dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-slate-150 dark:border-zinc-800' 
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Keyboard size={14} /> {t.typeTotal || 'Digitar Total'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('calculator')}
                    className={`flex-1 min-w-[140px] py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 ${
                      mode === 'calculator' 
                        ? 'bg-white dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-slate-150 dark:border-zinc-800' 
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Calculator size={14} /> {t.billCalculator || 'Calculadora de Notas'}
                  </button>
                  <div className="flex items-center">
                    <VoiceInputButton
                      mode="cash_up"
                      size="sm"
                      label="Contar por Voz"
                      cashierId={currentUser?.id}
                      cashierName={currentUser?.name}
                      shiftId={currentUser?.current_shift_start}
                      onParsedCashUp={(res) => handleApplyVoiceCounts(res.counts, res.matchedPhrases.join(', '))}
                    />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 justify-between mt-5">
                <div className="flex-1 min-h-0">
                  {mode === 'manual' ? (
                    <div className="space-y-4 py-4">
                      <div className="bg-slate-50/50 dark:bg-zinc-950/40 p-8 rounded-[2rem] border border-slate-150 dark:border-zinc-855 flex flex-col items-center gap-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/50 dark:border-indigo-500/10">
                          <Calculator size={20} />
                        </div>
                        <div className="w-full">
                          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2">
                            {t.physicalCashInDrawerMt || 'Valor Físico em Caixa (MT)'}
                          </label>
                          <div className="relative max-w-xs mx-auto">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              autoFocus
                              value={reportedAmount}
                              onChange={(e) => setReportedAmount(e.target.value)}
                              className="w-full text-center text-3xl font-black pl-4 pr-12 py-4 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-mono shadow-sm"
                              placeholder="0,00"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 font-bold text-base font-mono">
                              MT
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <BlindCloseCalculator
                      counts={counts}
                      onCountChange={handleCountChange}
                      calculatedTotal={calculatedTotal}
                      onClear={() => {
                        setCounts({});
                        setVoiceSummary(null);
                      }}
                      onVoiceCounts={handleApplyVoiceCounts}
                      voiceSummary={voiceSummary}
                      cashierId={currentUser?.id}
                      cashierName={currentUser?.name}
                      shiftId={currentUser?.current_shift_start}
                    />
                  )}
                </div>

                {/* STICKY FOOTER IN THE LEFT CARD */}
                <div className="pt-6 shrink-0 mt-5 border-t border-slate-150 dark:border-white/5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 min-w-[100px] py-4 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 font-bold text-sm rounded-2xl transition-all"
                  >
                    {t.backToPos || 'Voltar ao POS'}
                  </button>
                  {canBypass && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await logout();
                          onClose();
                          toast.success('Sessão encerrada com sucesso.');
                        } catch (err) {
                          toast.error('Erro ao terminar sessão.');
                        }
                      }}
                      className="flex-1 min-w-[120px] py-4 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/10 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <LogOut className="w-4 h-4" />
                      {t.exitWithoutClose || 'Sair Sem Fecho'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-[2] min-w-[160px] flex items-center justify-center gap-2 py-4 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <LogOut className="w-5 h-5" />
                    {t.confirmAndCloseShift || 'Confirmar & Fechar Turno'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Shift Audit & Sales History (40% width) */}
            <div className="lg:col-span-5 p-6 sm:p-8 bg-slate-50/50 dark:bg-zinc-950/20 flex flex-col min-h-0 overflow-y-auto relative justify-between">
              
              <button
                type="button"
                onClick={onClose}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors hidden lg:block"
              >
                <X className="w-5 h-5" />
              </button>

              <BlindCloseAudit
                varianceValue={varianceValue}
                baseCashValue={baseCashValue}
                shiftTotals={shiftTotals}
                totalPayouts={totalPayouts}
                expectedCashValue={expectedCashValue}
                shiftSales={shiftSales}
                isSalesHistoryOpen={isSalesHistoryOpen}
                onToggleSalesHistory={() => setIsSalesHistoryOpen(!isSalesHistoryOpen)}
                loadingSales={loadingSales}
              />

            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
