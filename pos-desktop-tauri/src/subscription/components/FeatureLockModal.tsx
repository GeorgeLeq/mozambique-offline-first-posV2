/**
 * @file FeatureLockModal.tsx
 * @description Sleek upgrade teaser modal displayed when a user attempts
 * to access a locked Pro feature. Shows value proposition, dynamic pricing in Meticais,
 * and triggers either mobile payment submission or offline code activation.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Lock, Sparkles, Check, ArrowRight, KeyRound, 
  Smartphone, ShieldCheck, HeartHandshake 
} from 'lucide-react';
import { useSubscription } from '../subscriptionContext';

export function FeatureLockModal() {
  const { 
    activeLockModalFeature, 
    lockModalCustomTitle, 
    lockModalCustomReason, 
    closeFeatureLockModal, 
    plans, 
    setTargetPlanForPayment, 
    setIsPaymentModalOpen, 
    setIsOfflineUnlockOpen 
  } = useSubscription();

  // All subscriptions are suspended for the hackathon competition
  return null;

  // Filter plans that include this feature
  const matchingPlans = plans.filter(p => {
    if (activeLockModalFeature === 'advanced_audits') {
      return p.advanced_audits === true || 
        p.id === 'plan_audits_monthly' || 
        p.id === 'plan_pro_annual' || 
        (Array.isArray(p.features_included) && p.features_included.includes('advanced_audits'));
    }
    return Array.isArray(p.features_included) && p.features_included.includes(activeLockModalFeature);
  });
  const primaryPlan = matchingPlans[0] || plans[0];

  const handleSelectPlan = (plan: typeof primaryPlan) => {
    setTargetPlanForPayment(plan);
    closeFeatureLockModal();
    setIsPaymentModalOpen(true);
  };

  const handleOpenOffline = () => {
    closeFeatureLockModal();
    setIsOfflineUnlockOpen(true);
  };

  // Feature metadata & benefits
  const featureMeta: Record<string, { title: string; subtitle: string; benefits: string[] }> = {
    client_debts: {
      title: 'Módulo Gestão de Fiados & Clientes',
      subtitle: 'Controle crédito e recupere capital sem perdas nem cadernos rasgados',
      benefits: [
        'Registo digital de todas as vendas a crédito com recibo térmico',
        'Controle de saldo em dívida e histórico de amortizações parciais',
        'Definição de limite de crédito por cliente para evitar calotes',
        'Envio de extrato de dívida direto para o WhatsApp do cliente'
      ]
    },
    expected_deliveries: {
      title: 'Módulo Reabastecimento & Encomendas',
      subtitle: 'Controle entregas de fornecedores e divergências de preço de custo',
      benefits: [
        'Comparação entre quantidade pedida e recebida na porta da loja',
        'Alerta de inflação de preço de custo do fornecedor',
        'Atualização automática de stock e margens de lucro'
      ]
    },
    advanced_audits: {
      title: 'Módulo Auditoria Avançada & Anti-Furto',
      subtitle: 'Transparência total nos fechos de turno e caixa',
      benefits: [
        'Fecho de caixa cego (o operador não vê quanto o sistema espera)',
        'Registo de quebras, devoluções e anulações suspeitas com PIN',
        'Auditoria detalhada com timestamps imutáveis'
      ]
    },
    unlimited_products: {
      title: 'Catálogo de Produtos Ilimitado',
      subtitle: 'Cadastre quantos produtos e categorias precisar para expandir a sua loja',
      benefits: [
        'Remoção total do limite de 50 produtos do Plano Grátis',
        'Importação em massa de listas de inventário via Excel/CSV',
        'Gestão avançada de stock a granel, caixas e packs fracionados',
        'Etiquetas com códigos de barras geradas automaticamente'
      ]
    },
    custom_permissions: {
      title: 'Módulo de Permissões Granulares',
      subtitle: 'Delegue funções e restrinja acessos específicos para cada operador',
      benefits: [
        'Atribua ou bloqueie permissão de dar descontos no carrinho',
        'Restrinja o acesso a relatórios financeiros e fechos de turno',
        'Controle quem pode anular itens ou realizar sangrias de caixa',
        'Histórico de auditoria de alterações de permissões'
      ]
    }
  };

  const meta = featureMeta[activeLockModalFeature] || {
    title: lockModalCustomTitle || 'Funcionalidade Pro Comercial',
    subtitle: lockModalCustomReason || 'Eleve o nível de controle da sua loja com ferramentas profissionais.',
    benefits: [
      'Controle total da operação sem necessidade de internet constante',
      'Ativação instantânea via M-Pesa ou código offline',
      'Suporte prioritário da equipa de apoio em Moçambique'
    ]
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl relative overflow-hidden select-none"
        >
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          {/* Close button */}
          <button
            onClick={closeFeatureLockModal}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Header Badge & Title */}
          <div className="flex items-center gap-2 mb-3">
            <div className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-800/60 flex items-center gap-1.5">
              <Lock size={12} />
              <span>Módulo Sob Subscrição</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1.5">
              <Sparkles size={12} />
              <span>Plano Pro</span>
            </div>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-100 mb-1">
            {meta.title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 font-medium mb-6">
            {meta.subtitle}
          </p>

          {/* Benefits list */}
          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-slate-200/80 dark:border-zinc-800 mb-6 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              O Que Ganha Com Este Módulo:
            </h4>
            {meta.benefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-300 font-medium">
                <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* Pricing Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {matchingPlans.slice(0, 2).map((plan) => (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className="p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 hover:border-indigo-500 transition-all cursor-pointer relative group flex flex-col justify-between"
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 right-3 bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                    {plan.badge}
                  </span>
                )}
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{plan.name}</h5>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{plan.tagline}</p>
                </div>
                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                  <span className="text-lg font-black text-indigo-700 dark:text-indigo-400">
                    {plan.price_mt.toLocaleString('pt-MZ')} MT
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    {plan.period === 'monthly' ? '/ mês' : '/ 3 meses'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              onClick={() => handleSelectPlan(primaryPlan)}
              className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Smartphone size={16} />
              <span>Ativar com M-Pesa / E-Mola ({primaryPlan.price_mt.toLocaleString('pt-MZ')} MT)</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={handleOpenOffline}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound size={14} className="text-indigo-500" />
              <span>Já tem um Código de Ativação Offline? Inserir Código</span>
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Arquitetura Offline-First • O seu terminal nunca para de faturar</span>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
