/**
 * @file CustomerFaqView.tsx
 * @description Interactive FAQ Questions panel for retail customers on the Customer Display.
 * 
 * Tailored for Mozambique retail:
 * Covers M-Pesa/e-Mola, Fiado (customer credit), WhatsApp digital receipts, and returns.
 */

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Smartphone, CreditCard, Receipt, Clock, Truck } from 'lucide-react';
import { useI18n } from '../../i18n';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  icon: React.ReactNode;
  category: string;
}

export function CustomerFaqView() {
  const t = useI18n();
  const [openId, setOpenId] = useState<string | null>('faq-1');

  const faqs: FaqItem[] = [
    {
      id: 'faq-1',
      question: 'Aceitam pagamentos por M-Pesa e e-Mola?',
      answer: 'Sim! Aceitamos pagamentos imediatos por M-Pesa (Vodacom) e e-Mola (Movitel) diretamente no balcão. O operador confirma a transação em tempo real sem taxa adicional.',
      icon: <Smartphone size={16} className="text-emerald-500" />,
      category: 'Pagamentos'
    },
    {
      id: 'faq-2',
      question: 'Como funciona o Fiado (crédito de cliente)?',
      answer: 'O fiado é concedido a clientes regulares cadastrados no sistema com limite de crédito autorizado. Basta informar o seu nome ou número de telefone ao operador antes do fecho da conta.',
      icon: <CreditCard size={16} className="text-amber-500" />,
      category: 'Crédito & Fiado'
    },
    {
      id: 'faq-3',
      question: 'Posso receber o recibo no meu WhatsApp?',
      answer: 'Sim! O nosso sistema envia o recibo fiscal digital diretamente para o seu WhatsApp com a lista de produtos, preços e código de verificação.',
      icon: <Receipt size={16} className="text-indigo-500" />,
      category: 'Recibos'
    },
    {
      id: 'faq-4',
      question: 'Fazem entregas de compras grandes ou fardos?',
      answer: 'Realizamos entregas ao domicílio para compras volumosas (sacos de arroz 25kg, fardos de farinha, grades de bebidas). Peça o agendamento ao operador.',
      icon: <Truck size={16} className="text-blue-500" />,
      category: 'Entregas'
    },
    {
      id: 'faq-5',
      question: 'Qual é o horário de atendimento da loja?',
      answer: 'Segunda a Sábado das 07:30 às 19:30. Domingos e Feriados das 08:00 às 13:30.',
      icon: <Clock size={16} className="text-rose-500" />,
      category: 'Horário'
    }
  ];

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-md p-5 select-none">
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold border border-amber-200 dark:border-amber-800">
          <HelpCircle size={18} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
            Perguntas Frequentes (FAQ)
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Informações úteis sobre pagamentos, entregas e fiado
          </p>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div
              key={faq.id}
              className={`rounded-2xl border transition-all ${
                isOpen
                  ? 'bg-indigo-50/60 dark:bg-zinc-800/80 border-indigo-200 dark:border-indigo-900/60 shadow-xs'
                  : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200/70 dark:border-zinc-800 hover:bg-slate-100/70'
              }`}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full p-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0 p-1 rounded-lg bg-white dark:bg-zinc-700/80 shadow-2xs">
                    {faq.icon}
                  </div>
                  <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-zinc-200">
                    {faq.question}
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-3.5 pt-0 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed border-t border-indigo-100 dark:border-zinc-700/60 mt-1">
                  <p className="pt-2">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
