/**
 * Translations for Expected Deliveries & Restock Management Module
 */
import { LanguageCode } from './types';
import { deliveries as ptDeliveries } from './locales/pt/deliveries';
import { deliveries as enDeliveries } from './locales/en/deliveries';
import { deliveries as frDeliveries } from './locales/fr/deliveries';
import { deliveries as swDeliveries } from './locales/sw/deliveries';

export const deliveriesTranslations: Record<LanguageCode, Record<string, string>> = {
  pt: ptDeliveries,
  en: enDeliveries,
  fr: frDeliveries,
  sw: swDeliveries,
};

export { ptDeliveries, enDeliveries, frDeliveries, swDeliveries };
