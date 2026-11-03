import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getDB } from '../../../lib/db';
import { CartItem } from './useCart';
import { calculateActiveShiftStats, closeShiftRecord } from '../../../lib/shift/shiftManager';

export function useShiftManagement(
  currentUser: any,
  cart: CartItem[],
  isBlindCloseModalOpen: boolean,
  isTillPayoutOpen: boolean,
  setIsBlindCloseModalOpen: (val: boolean) => void,
  logout: () => void
) {
  const [dailyTotal, setDailyTotal] = useState(0); // Expected amount
  const [shiftStats, setShiftStats] = useState<any>(null);

  // Load daily total (mocked as total of all sales)
  useEffect(() => {
    const loadDailyTotal = async () => {
      try {
        const db = await getDB();
        
        let shiftStart = '';
        try {
          const ss = await db.select('SELECT value FROM settings WHERE key = "current_shift_start"') as any[];
          if (ss.length > 0) shiftStart = ss[0].value;
        } catch(e) {}
        
        let dateCondition = '1=1';
        if (shiftStart) {
          // SQLite CURRENT_TIMESTAMP is in format 'YYYY-MM-DD HH:MM:SS'
          // shiftStart is in ISO format 'YYYY-MM-DDTHH:MM:SS.mmmZ'
          // we need to format it to match SQLite
          const formattedShiftStart = shiftStart.replace('T', ' ').substring(0, 19);
          dateCondition = `created_at >= '${formattedShiftStart}'`;
        }

        // Calculate expected physical cash: base cash + cash sales - refunds - payouts
        const sales: any[] = await db.select(`SELECT total_mt, payment_method, payment_details FROM sales WHERE ${dateCondition}`);
        
        let cashSalesTotal = 0;
        let mpesaSalesTotal = 0;
        let emolaSalesTotal = 0;
        let fiadoSalesTotal = 0;

        for (const s of sales) {
          if (s.total_mt > 0) {
            if (s.payment_method === 'cash') {
              cashSalesTotal += s.total_mt;
            } else if (s.payment_method === 'm-pesa' || s.payment_method === 'mpesa') {
              mpesaSalesTotal += s.total_mt;
            } else if (s.payment_method === 'e-mola' || s.payment_method === 'emola') {
              emolaSalesTotal += s.total_mt;
            } else if (s.payment_method === 'fiado') {
              fiadoSalesTotal += s.total_mt;
            } else if (s.payment_method === 'mixed') {
              try {
                if (s.payment_details) {
                  const splits = JSON.parse(s.payment_details);
                  const splitCash = parseFloat(splits.cash) || 0;
                  const splitMpesa = parseFloat(splits.mpesa) || 0;
                  const splitEmola = parseFloat(splits.emola) || 0;
                  const splitTotal = splitCash + splitMpesa + splitEmola;
                  
                  if (splitTotal > 0) {
                    const cashRatio = splitCash / splitTotal;
                    const mpesaRatio = splitMpesa / splitTotal;
                    const emolaRatio = splitEmola / splitTotal;

                    cashSalesTotal += s.total_mt * cashRatio;
                    mpesaSalesTotal += s.total_mt * mpesaRatio;
                    emolaSalesTotal += s.total_mt * emolaRatio;
                  } else {
                    cashSalesTotal += s.total_mt;
                  }
                } else {
                  cashSalesTotal += s.total_mt;
                }
              } catch (e) {
                cashSalesTotal += s.total_mt;
              }
            }
          }
        }

        const refundsTotal = sales.filter(s => s.total_mt < 0).reduce((sum, s) => sum + s.total_mt, 0);
        const refundsCashTotal = sales.filter(s => s.payment_method === 'cash' && s.total_mt < 0).reduce((sum, s) => sum + s.total_mt, 0);

        let refundsList: any[] = [];
        try {
          refundsList = await db.select(`
            SELECT s.total_mt, s.authorized_by, p.name as product_name
            FROM sales s
            LEFT JOIN products p ON s.product_id = p.id
            WHERE ${dateCondition} AND s.total_mt < 0
          `) as any[];
        } catch (e) {
          console.warn('Failed to load refunds list', e);
        }

        let debtPayments: any[] = [];
        try {
          debtPayments = await db.select(`SELECT amount_paid_mt as amount, payment_method FROM debt_payments WHERE ${dateCondition}`);
        } catch (e) {
          try {
            debtPayments = await db.select(`SELECT amount_mt as amount, payment_method FROM debt_payments WHERE ${dateCondition}`);
          } catch (e2) {
            console.warn('Failed to load debt payments from either column:', e2);
          }
        }
        const cashDebtPayments = debtPayments.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + (s.amount || 0), 0);
        const mpesaDebtPayments = debtPayments.filter(s => s.payment_method === 'mpesa').reduce((sum, s) => sum + (s.amount || 0), 0);

        let tillPayoutsTotal = 0;
        let tillPayoutsCount = 0;
        try {
          const payouts: any[] = await db.select(`SELECT * FROM till_payouts WHERE ${dateCondition}`);
          tillPayoutsTotal = payouts.reduce((sum, p) => sum + (p.amount_mt ?? p.amount ?? 0), 0);
          tillPayoutsCount = payouts.length;
        } catch (e) {
          console.warn('Failed to load till payouts', e);
        }
        
        let scansCount = 0;
        try {
          const scans: any[] = await db.select(`SELECT count(*) as count FROM scan_history WHERE ${dateCondition}`);
          if (scans.length > 0) {
            scansCount = scans[0].count;
          }
        } catch (e) {
          console.warn('Failed to load scan history counts', e);
        }

        let baseCash = 10000;
        try {
          let loaded = false;
          if (currentUser?.id) {
            const userShiftCashRow = await db.select('SELECT value FROM settings WHERE key = ?', [`current_shift_cash_${currentUser.id}`]) as any[];
            if (userShiftCashRow.length > 0) {
              baseCash = parseFloat(userShiftCashRow[0].value) || 0;
              loaded = true;
            }
          }
          if (!loaded) {
            const settings: any[] = await db.select('SELECT value FROM settings WHERE key = "base_cash"');
            if (settings.length > 0) {
              baseCash = parseFloat(settings[0].value) || 0;
            }
          }
        } catch (e) {
          console.warn('Failed to load base_cash', e);
        }

        const totalExpectedCash = baseCash + cashSalesTotal + cashDebtPayments - tillPayoutsTotal + refundsCashTotal;
        
        setShiftStats({
          baseCash,
          cashSalesTotal,
          cashDebtPayments,
          mpesaSalesTotal,
          emolaSalesTotal,
          fiadoSalesTotal,
          mpesaDebtPayments,
          tillPayoutsTotal,
          tillPayoutsCount,
          scansCount,
          refundsTotal,
          refundsCashTotal,
          refundsList,
          totalExpectedCash
        });
        
        setDailyTotal(totalExpectedCash);
      } catch (e) {
        console.error('Failed to load daily total', e);
      }
    };
    loadDailyTotal();
  }, [cart, isBlindCloseModalOpen, isTillPayoutOpen]); // Refresh when cart changes (sale completes) or modals open/close

  const handleCloseShift = async (reportedAmount: number, detailsJson?: string) => {
    try {
      await closeShiftRecord(currentUser, reportedAmount, detailsJson, shiftStats);
      toast.success('Turno fechado com sucesso.');
      setIsBlindCloseModalOpen(false);
      logout();
    } catch (error) {
      console.error('Failed to close shift:', error);
      toast.error('Erro ao fechar turno');
    }
  };

  return { dailyTotal, shiftStats, handleCloseShift };
}
