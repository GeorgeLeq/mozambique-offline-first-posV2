/**
 * @file CustomerPromoCarousel.tsx
 * @description Promotional banner carousel showcasing daily specials and Muse Image marketing banners.
 * 
 * Rules:
 * 1. Displays the saved/downloaded promotional banner from promoStore.
 * 2. Persists completely offline (images stored locally) until removed from Sentinel Chat.
 * 3. Shows live price in Meticais (MT), percentage discount, and category tags.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronLeft, ChevronRight, Flame, Percent, Tv, Radio } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useI18n } from '../../i18n';
import { 
  getActiveBroadcastPromo, 
  subscribeToBroadcastPromo, 
  BroadcastPromoBanner,
  DEFAULT_PROMO_BANNER
} from '../../lib/marketing/promoStore';

const FALLBACK_PROMOS = [
  DEFAULT_PROMO_BANNER,
  {
    id: 'promo-oleo',
    title: 'Óleo Alimentar Flor 2 Litros',
    subtitle: '100% puro óleo vegetal refinado, ideal para toda culinária',
    price_mt: 220,
    original_price_mt: 260,
    badge: 'OFERTA DO DIA',
    category: 'Mercearia',
    tagline: 'Economize 40 MT por garrafa hoje',
    bgGradient: 'from-emerald-600 via-teal-600 to-emerald-700',
    createdAt: Date.now(),
    isLive: true
  },
  {
    id: 'promo-cerveja',
    title: 'Cerveja 2M 330ml (Grade 24 Unid)',
    subtitle: 'Gela bem e aproveite os melhores momentos com amigos',
    price_mt: 1200,
    original_price_mt: 1350,
    badge: 'FIM DE SEMANA',
    category: 'Bebidas Nacionais',
    tagline: 'Preço de retalhista para todos os clientes',
    bgGradient: 'from-blue-600 via-indigo-600 to-blue-700',
    createdAt: Date.now(),
    isLive: true
  }
];

export function CustomerPromoCarousel() {
  const t = useI18n();
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastPromoBanner | null>(() => getActiveBroadcastPromo());
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Subscribe to live broadcast banner changes from Sentinel Chat
  useEffect(() => {
    setActiveBroadcast(getActiveBroadcastPromo());
    const unsub = subscribeToBroadcastPromo((banner) => {
      setActiveBroadcast(banner);
    });
    return () => unsub();
  }, []);

  // Determine which banner to show
  // If activeBroadcast is saved by user, prioritize it!
  const currentBanner = activeBroadcast || FALLBACK_PROMOS[carouselIndex % FALLBACK_PROMOS.length];

  const discountPercent = Math.round(
    ((currentBanner.original_price_mt - currentBanner.price_mt) / currentBanner.original_price_mt) * 100
  );

  const getTranslatedBadge = (badge: string) => {
    if (badge === 'SUPER PREÇO') return t.superPrice || 'SUPER PREÇO';
    if (badge === 'OFERTA DO DIA') return t.dealOfDay || 'OFERTA DO DIA';
    if (badge === 'FIM DE SEMANA') return t.weekendSpecial || 'FIM DE SEMANA';
    return t.familySavings || badge;
  };

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-zinc-800 bg-zinc-950 text-white min-h-[220px] flex flex-col justify-between select-none">
      {/* If current banner has a downloaded local image URL, display it as rich visual backdrop */}
      {currentBanner.imageUrl ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={currentBanner.imageUrl}
            alt={currentBanner.title}
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
          />
          {/* Subtle gradient vignette to ensure high text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60" />
        </div>
      ) : (
        <>
          {/* Background dynamic gradient glow */}
          <div className={`absolute inset-0 bg-gradient-to-r ${currentBanner.bgGradient || 'from-amber-600 via-orange-600 to-amber-700'} opacity-90 transition-all duration-700`} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_70%)]" />
        </>
      )}

      {/* Top Banner Row */}
      <div className="relative z-10 flex items-center justify-between p-5 pb-0">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider text-white border border-white/30 shadow-xs">
            <Flame size={13} className="text-yellow-300 animate-pulse" />
            {getTranslatedBadge(currentBanner.badge)}
          </span>
          <span className="text-xs font-bold text-white/90 drop-shadow-sm bg-black/30 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
            {currentBanner.category}
          </span>
        </div>

        {/* Live Broadcast Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-300 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md border border-emerald-400/30">
          <Radio size={12} className="animate-pulse text-emerald-400" />
          <span>{activeBroadcast ? 'CAMPANHA ATIVA' : (t.specialOffer || 'ESPECIAL')}</span>
        </div>
      </div>

      {/* Content Row */}
      <div className="relative z-10 px-5 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBanner.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap sm:flex-nowrap items-end justify-between gap-4"
          >
            <div className="flex-1 min-w-[200px]">
              <h3 className="text-2xl font-black text-white tracking-tight drop-shadow-md line-clamp-1">
                {currentBanner.title}
              </h3>
              <p className="text-xs sm:text-sm text-white/90 mt-1 line-clamp-2 drop-shadow-sm font-medium">
                {currentBanner.subtitle}
              </p>
            </div>

            <div className="text-right shrink-0 bg-black/45 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/25 shadow-lg">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-3xl font-black font-mono text-white tracking-tight">
                  {formatCurrency(currentBanner.price_mt)}
                </span>
                {discountPercent > 0 && (
                  <span className="flex items-center text-xs font-black bg-yellow-400 text-zinc-950 px-2 py-0.5 rounded-full shadow-xs">
                    -{discountPercent}%
                  </span>
                )}
              </div>
              {currentBanner.original_price_mt > currentBanner.price_mt && (
                <span className="text-xs line-through text-white/70 font-mono block mt-0.5">
                  {t.beforePrice || 'Antes:'} {formatCurrency(currentBanner.original_price_mt)}
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Indicators & Manual Controls */}
      <div className="relative z-10 flex items-center justify-between px-5 pb-4 pt-1">
        <div className="flex items-center gap-1.5">
          {FALLBACK_PROMOS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCarouselIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === (carouselIndex % FALLBACK_PROMOS.length) ? 'w-7 bg-white shadow-xs' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              title={`Ver promoção ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-white/75 font-medium">
          <Sparkles size={12} className="text-yellow-300" />
          <span>SYCOMM POS • Moçambique</span>
        </div>
      </div>
    </div>
  );
}
export default CustomerPromoCarousel;
