/**
 * @file CustomerWhatsAppCard.tsx
 * @description Prominent WhatsApp AI Assistant QR Code card for customer screen.
 * 
 * "Dúvidas sobre preços, stock ou fiado? Fale agora com o nosso assistente no WhatsApp! [+258 84/87 XXX XXXX]"
 */

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MessageSquare, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n';

interface CustomerWhatsAppCardProps {
  shopPhone?: string;
  shopName?: string;
}

export function CustomerWhatsAppCard({
  shopPhone = '+258 84 900 1234',
  shopName = 'BalcãoPOS'
}: CustomerWhatsAppCardProps) {
  const t = useI18n();
  const [copied, setCopied] = useState(false);

  // Clean phone digits for wa.me link
  const cleanPhone = shopPhone.replace(/\D/g, '') || '258849001234';
  const sanitizedPhone = cleanPhone.startsWith('258') ? cleanPhone : `258${cleanPhone}`;

  const defaultMessage = encodeURIComponent(
    `Olá! Gostaria de consultar preços, disponibilidade de stock e fiado na loja ${shopName}.`
  );
  const whatsappUrl = `https://wa.me/${sanitizedPhone}?text=${defaultMessage}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsappUrl);
    setCopied(true);
    toast.success('Link do WhatsApp copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl border border-emerald-200 dark:border-emerald-950/60 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 shadow-lg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />

      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
            <MessageSquare size={19} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              {t.whatsAppAssistant || 'Assistente no WhatsApp'}
              <span className="px-2 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-[9px] rounded-full border border-emerald-300 dark:border-emerald-800">
                24/7
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-semibold">
              {shopPhone}
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-emerald-600 border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer text-xs flex items-center gap-1"
          title={t.copy || 'Copiar Link'}
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          <span className="hidden sm:inline text-[10px]">{copied ? (t.copied || 'Copiado') : (t.copy || 'Copiar')}</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900/90 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        {/* Crisp QR Code */}
        <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100 shrink-0">
          <QRCodeSVG
            value={whatsappUrl}
            size={90}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Instructions */}
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 leading-snug">
            {t.whatsAppPrompt || 'Dúvidas sobre preços, stock ou fiado?'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
            {t.whatsAppScanDesc || 'Aponte a câmara do seu telemóvel para falar agora com o nosso assistente virtual no WhatsApp!'}
          </p>
          <div className="mt-2 flex items-center justify-center sm:justify-start gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <Sparkles size={11} />
            <span>{t.instantMobileAnswers || 'Respostas instantâneas no telemóvel'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
