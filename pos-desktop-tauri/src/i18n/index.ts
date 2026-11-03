import { LanguageCode, LocaleResource, SUPPORTED_LANGUAGES } from './types';
import pt from './locales/pt';
import en from './locales/en';
import fr from './locales/fr';
import sw from './locales/sw';
import { deliveriesTranslations } from './deliveries';
import { commonTranslations } from './legacyCommon';
import { customerDisplayTranslations } from './customerDisplay';
import { museBarTranslations } from './museBar';

export type { LanguageCode, LocaleResource };
export { SUPPORTED_LANGUAGES, deliveriesTranslations, customerDisplayTranslations, museBarTranslations };

export const locales: Record<LanguageCode, LocaleResource> = {
  pt,
  en,
  fr,
  sw
};

/**
 * Get current selected language from localStorage or default to 'pt'
 */
export function getLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem('locale_lang');
    if (saved && (saved === 'pt' || saved === 'en' || saved === 'fr' || saved === 'sw')) {
      return saved as LanguageCode;
    }
  } catch {}
  return 'en';
}

/**
 * Set and persist current language, dispatching 'locale-changed' event across the app
 */
export function setLanguage(lang: LanguageCode) {
  try {
    localStorage.setItem('locale_lang', lang);
    window.dispatchEvent(new Event('locale-changed'));
  } catch (e) {
    console.error('Failed to set language:', e);
  }
}

/**
 * Merged dictionary for backwards-compatibility with existing useI18n consumers
 */
export const translations: Record<LanguageCode, Record<string, any>> = {
  pt: {
    ...commonTranslations.pt,
    ...deliveriesTranslations.pt,
    ...customerDisplayTranslations.pt,
    ...museBarTranslations.pt,
    ...pt.deliveries,
    ...pt.barcodes,
    ...pt.common,
    ...pt.products,
    ...pt.pos,
    ...pt.customers,
    ...pt.audits,
    ...pt.settings,
    ...pt.employees,
    ...pt.cashierControl,
    ...pt.shiftReports,
    ...pt.scanHistory,
    products: pt.products.products || 'produtos',
    // Add nested namespaces for modern modular usage
    pos: pt.pos,
    common: pt.common,
    customers: pt.customers,
    audits: pt.audits,
    settings: pt.settings,
    deliveries: pt.deliveries,
    barcodes: pt.barcodes,
    employees: pt.employees,
    cashierControl: pt.cashierControl,
    shiftReports: pt.shiftReports,
    scanHistory: pt.scanHistory,
    commonNamespace: pt.common,
    productsNamespace: pt.products,
    posNamespace: pt.pos,
    customersNamespace: pt.customers,
    auditsNamespace: pt.audits,
    settingsNamespace: pt.settings,
    deliveriesNamespace: pt.deliveries,
    barcodesNamespace: pt.barcodes,
    employeesNamespace: pt.employees,
    cashierControlNamespace: pt.cashierControl,
    shiftReportsNamespace: pt.shiftReports,
    scanHistoryNamespace: pt.scanHistory
  },
  en: {
    ...commonTranslations.en,
    ...deliveriesTranslations.en,
    ...customerDisplayTranslations.en,
    ...museBarTranslations.en,
    ...en.deliveries,
    ...en.barcodes,
    ...en.common,
    ...en.products,
    ...en.pos,
    ...en.customers,
    ...en.audits,
    ...en.settings,
    ...en.employees,
    ...en.cashierControl,
    ...en.shiftReports,
    ...en.scanHistory,
    products: en.products.products || 'products',
    pos: en.pos,
    common: en.common,
    customers: en.customers,
    audits: en.audits,
    settings: en.settings,
    deliveries: en.deliveries,
    barcodes: en.barcodes,
    employees: en.employees,
    cashierControl: en.cashierControl,
    shiftReports: en.shiftReports,
    scanHistory: en.scanHistory,
    commonNamespace: en.common,
    productsNamespace: en.products,
    posNamespace: en.pos,
    customersNamespace: en.customers,
    auditsNamespace: en.audits,
    settingsNamespace: en.settings,
    deliveriesNamespace: en.deliveries,
    barcodesNamespace: en.barcodes,
    employeesNamespace: en.employees,
    cashierControlNamespace: en.cashierControl,
    shiftReportsNamespace: en.shiftReports,
    scanHistoryNamespace: en.scanHistory
  },
  fr: {
    ...commonTranslations.fr,
    ...deliveriesTranslations.fr,
    ...customerDisplayTranslations.fr,
    ...museBarTranslations.fr,
    ...fr.deliveries,
    ...fr.barcodes,
    ...fr.common,
    ...fr.products,
    ...fr.pos,
    ...fr.customers,
    ...fr.audits,
    ...fr.settings,
    ...fr.employees,
    ...fr.cashierControl,
    ...fr.shiftReports,
    ...fr.scanHistory,
    products: fr.products.products || 'produits',
    pos: fr.pos,
    common: fr.common,
    customers: fr.customers,
    audits: fr.audits,
    settings: fr.settings,
    deliveries: fr.deliveries,
    barcodes: fr.barcodes,
    employees: fr.employees,
    cashierControl: fr.cashierControl,
    shiftReports: fr.shiftReports,
    scanHistory: fr.scanHistory,
    commonNamespace: fr.common,
    productsNamespace: fr.products,
    posNamespace: fr.pos,
    customersNamespace: fr.customers,
    auditsNamespace: fr.audits,
    settingsNamespace: fr.settings,
    deliveriesNamespace: fr.deliveries,
    barcodesNamespace: fr.barcodes,
    employeesNamespace: fr.employees,
    cashierControlNamespace: fr.cashierControl,
    shiftReportsNamespace: fr.shiftReports,
    scanHistoryNamespace: fr.scanHistory
  },
  sw: {
    ...commonTranslations.sw,
    ...deliveriesTranslations.sw,
    ...customerDisplayTranslations.sw,
    ...museBarTranslations.sw,
    ...sw.deliveries,
    ...sw.barcodes,
    ...sw.common,
    ...sw.products,
    ...sw.pos,
    ...sw.customers,
    ...sw.audits,
    ...sw.settings,
    ...sw.employees,
    ...sw.cashierControl,
    ...sw.shiftReports,
    ...sw.scanHistory,
    products: sw.products.products || 'bidhaa',
    pos: sw.pos,
    common: sw.common,
    customers: sw.customers,
    audits: sw.audits,
    settings: sw.settings,
    deliveries: sw.deliveries,
    barcodes: sw.barcodes,
    employees: sw.employees,
    cashierControl: sw.cashierControl,
    shiftReports: sw.shiftReports,
    scanHistory: sw.scanHistory,
    commonNamespace: sw.common,
    productsNamespace: sw.products,
    posNamespace: sw.pos,
    customersNamespace: sw.customers,
    auditsNamespace: sw.audits,
    settingsNamespace: sw.settings,
    deliveriesNamespace: sw.deliveries,
    barcodesNamespace: sw.barcodes,
    employeesNamespace: sw.employees,
    cashierControlNamespace: sw.cashierControl,
    shiftReportsNamespace: sw.shiftReports,
    scanHistoryNamespace: sw.scanHistory
  }
};

import React from 'react';

/**
 * Hook to subscribe to current language and automatically re-render when language changes
 */
export function useCurrentLanguage(lang?: LanguageCode): LanguageCode {
  const [currentLang, setCurrentLang] = React.useState<LanguageCode>(lang || getLanguage());

  React.useEffect(() => {
    if (lang) {
      setCurrentLang(lang);
      return;
    }
    const handleLocaleChange = () => setCurrentLang(getLanguage());
    window.addEventListener('locale-changed', handleLocaleChange);
    return () => window.removeEventListener('locale-changed', handleLocaleChange);
  }, [lang]);

  return currentLang;
}

/**
 * General i18n hook returning merged flat keys + nested modules
 */
export function useI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return translations[currentLang] || translations.en;
}

/**
 * Hook returning dedicated ProductTranslations
 */
export function useProductsI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).products;
}

/**
 * Hook returning dedicated CommonTranslations
 */
export function useCommonI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).common;
}

/**
 * Hook returning dedicated PosTranslations
 */
export function usePosI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).pos;
}

/**
 * Helper hook to re-render component on locale-changed event
 */
export function useLocale(): [LanguageCode, (lang: LanguageCode) => void] {
  const currentLang = useCurrentLanguage();
  return [currentLang, setLanguage];
}

/**
 * Hook returning deliveries translations
 */
export function useDeliveriesI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).deliveries;
}

/**
 * Hook returning barcodes translations
 */
export function useBarcodesI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).barcodes;
}

/**
 * Hook returning dedicated CustomersTranslations
 */
export function useCustomersI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).customers;
}

/**
 * Hook returning dedicated EmployeesTranslations
 */
export function useEmployeesI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).employees;
}

/**
 * Hook returning dedicated CashierControlTranslations
 */
export function useCashierControlI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).cashierControl;
}

/**
 * Hook returning dedicated ShiftReportsTranslations
 */
export function useShiftReportsI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).shiftReports;
}

/**
 * Hook returning dedicated ScanHistoryTranslations
 */
export function useScanHistoryI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).scanHistory;
}

/**
 * Hook returning dedicated AuditsTranslations
 */
export function useAuditsI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).audits;
}

export function useAuditLogsI18n(lang?: LanguageCode) {
  return useAuditsI18n(lang);
}

/**
 * Hook returning dedicated SettingsTranslations
 */
export function useSettingsI18n(lang?: LanguageCode) {
  const currentLang = useCurrentLanguage(lang);
  return (locales[currentLang] || locales.en).settings;
}

