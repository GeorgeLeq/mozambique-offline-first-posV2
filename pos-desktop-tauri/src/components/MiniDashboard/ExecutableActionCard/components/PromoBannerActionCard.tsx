/**
 * @file PromoBannerActionCard.tsx
 * @description Interactive Action Card with Form Controls for Muse Spark Generated Marketing Banners.
 * 
 * Features:
 * 1. Pure Muse Spark AI visual artwork preview.
 * 2. Editable Form Fields: Title, Subtitle, Promotional Price (MT), Original Price (MT), Badge, and Category.
 * 3. Live Canvas Regeneration: As the cashier edits the form, the banner updates live!
 * 4. Strict Confirmation Gate: Only broadcasts to Customer Display when "Save & Broadcast" is clicked.
 */

import React, { useState, useEffect } from 'react';
import { Tv, CheckCircle2, Sparkles, Send, Trash2, Edit3, RefreshCw, Tag, DollarSign, Layers } from 'lucide-react';
import { saveAndBroadcastPromo, removeBroadcastPromo, BroadcastPromoBanner } from '../../../../lib/marketing/promoStore';
import { generatePromoBannerImage } from '../../../../lib/marketing/bannerGenerator';
import { formatCurrency } from '../../../../lib/utils';
import toast from 'react-hot-toast';

interface PromoBannerActionCardProps {
  data: {
    id: string;
    title: string;
    subtitle: string;
    price_mt: number;
    original_price_mt: number;
    badge: string;
    category: string;
    tagline: string;
    imageUrl?: string;
    bgGradient?: string;
  };
  executed?: boolean;
  onExecuted?: () => void;
}

const BADGE_OPTIONS = [
  'SUPER PREÇO',
  'OFERTA DO DIA',
  'FIM DE SEMANA',
  'SUPER GELADA',
  'POUPANÇA FAMILIAR',
  'NOVIDADE'
];

export const PromoBannerActionCard: React.FC<PromoBannerActionCardProps> = ({
  data,
  executed = false,
  onExecuted
}) => {
  const [formState, setFormState] = useState({
    title: data.title || 'Especial da Loja',
    subtitle: data.subtitle || 'Qualidade garantida ao melhor preço no balcão',
    price_mt: Number(data.price_mt) || 150,
    original_price_mt: Number(data.original_price_mt) || Math.round((Number(data.price_mt) || 150) * 1.2),
    badge: data.badge || 'OFERTA DO DIA',
    category: data.category || 'Mercearia'
  });

  const [currentImage, setCurrentImage] = useState<string>(data.imageUrl || '');
  const [isSaved, setIsSaved] = useState(executed);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  // Regenerate live preview image whenever form values change
  useEffect(() => {
    if (formState.title) {
      try {
        const liveArt = generatePromoBannerImage({
          title: formState.title,
          subtitle: formState.subtitle,
          price_mt: formState.price_mt,
          original_price_mt: formState.original_price_mt,
          badge: formState.badge,
          category: formState.category,
          themeColor: formState.badge === 'SUPER GELADA' ? 'blue' : 'amber'
        });
        setCurrentImage(liveArt);
      } catch (e) {
        console.warn('Live banner generation warning:', e);
      }
    }
  }, [formState]);

  const handleSaveAndBroadcast = () => {
    setIsSaving(true);
    try {
      const payload: Omit<BroadcastPromoBanner, 'createdAt' | 'isLive'> = {
        id: data.id || `promo-${Date.now()}`,
        title: formState.title,
        subtitle: formState.subtitle,
        price_mt: formState.price_mt,
        original_price_mt: formState.original_price_mt,
        badge: formState.badge,
        category: formState.category,
        tagline: 'Muse Spark Campaign',
        imageUrl: currentImage,
        bgGradient: 'from-amber-600 via-orange-600 to-amber-700'
      };

      saveAndBroadcastPromo(payload);
      setIsSaved(true);
      setIsEditing(false);
      toast.success('Promotional banner saved locally & broadcast to Customer Display!', {
        icon: '📺'
      });
      onExecuted?.();
    } catch (e: any) {
      toast.error('Failed to broadcast banner: ' + (e?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    toast('Banner candidate discarded.', { icon: '🗑️' });
    onExecuted?.();
  };

  const discountPercent = formState.original_price_mt > formState.price_mt
    ? Math.round(((formState.original_price_mt - formState.price_mt) / formState.original_price_mt) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-indigo-200 dark:border-indigo-900/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-amber-500 text-white flex items-center justify-center shadow-xs">
            <Tv size={15} />
          </div>
          <div>
            <span className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider block">
              Customer Display Visual Campaign
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">
              Muse Spark AI Image + Cashier Form Customization
            </span>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
          isSaved
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 animate-pulse'
            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
        }`}>
          {isSaved ? '● LIVE ON CUSTOMER DISPLAY' : '○ STAGED — CONFIRMATION REQUIRED'}
        </span>
      </div>

      {/* Muse Spark AI Visual Artwork Live Preview */}
      {currentImage && (
        <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-500/30 shadow-md bg-black max-h-60 group">
          <img
            src={currentImage}
            alt={formState.title}
            className="w-full h-auto object-cover max-h-60"
          />
          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-xl text-[10px] font-mono font-bold text-white border border-white/20">
            ✨ Muse Spark • 1200×630
          </div>
        </div>
      )}

      {/* Interactive Form Controls for Cashier */}
      <div className="bg-white dark:bg-zinc-800/95 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-700/60">
          <span className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
            <Edit3 size={13} className="text-indigo-600 dark:text-indigo-400" />
            Personalizar Formulário do Banner Promocional
          </span>
          <span className="text-[10px] text-slate-400">Edição em tempo real</span>
        </div>

        {/* Row 1: Title & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
              Título do Produto / Promoção:
            </label>
            <input
              type="text"
              value={formState.title}
              onChange={(e) => setFormState(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Coca-Cola 330ml Gelada"
              className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
              Categoria:
            </label>
            <input
              type="text"
              value={formState.category}
              onChange={(e) => setFormState(prev => ({ ...prev, category: e.target.value }))}
              placeholder="Ex: Bebidas"
              className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Row 2: Subtitle / Marketing Slogan */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
            Slogan Publicitário / Descrição:
          </label>
          <input
            type="text"
            value={formState.subtitle}
            onChange={(e) => setFormState(prev => ({ ...prev, subtitle: e.target.value }))}
            placeholder="Ex: Refresque o seu dia com a melhor bebida em Moçambique"
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Row 3: Prices & Discount in Meticais (MT) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
              Preço Promocional (MT):
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={formState.price_mt}
                onChange={(e) => setFormState(prev => ({ ...prev, price_mt: Number(e.target.value) || 0 }))}
                className="w-full pl-3 pr-8 py-1.5 text-xs font-mono font-black bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">MT</span>
            </div>
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
              Preço Anterior (MT):
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={formState.original_price_mt}
                onChange={(e) => setFormState(prev => ({ ...prev, original_price_mt: Number(e.target.value) || 0 }))}
                className="w-full pl-3 pr-8 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-500 line-through focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">MT</span>
            </div>
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
              Badge / Etiqueta:
            </label>
            <select
              value={formState.badge}
              onChange={(e) => setFormState(prev => ({ ...prev, badge: e.target.value }))}
              className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {BADGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
        {!isSaved ? (
          <>
            <button
              onClick={handleDiscard}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-medium transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
            >
              <Trash2 size={14} />
              Descartar
            </button>

            <button
              onClick={handleSaveAndBroadcast}
              disabled={isSaving || !formState.title}
              className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={15} />
              Guardar & Transmitir ao Customer Display
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="font-black text-xs block">
                  Guardado Localmente & A Transmitir ao Vivo no Customer Display
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  {formState.title} ({formatCurrency(formState.price_mt)})
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                removeBroadcastPromo();
                setIsSaved(false);
                setIsEditing(true);
                toast('Banner removido do Customer Display.', { icon: '🗑️' });
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
            >
              Retirar da Tela
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
