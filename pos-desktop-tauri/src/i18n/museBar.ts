/**
 * @file museBar.ts
 * @description 4-Language localization for the Store Sentinel AI Bar (Powered by Muse Spark & Muse Transcribe).
 * Languages supported: Portuguese (pt), English (en), French (fr), Swahili (sw).
 */

import { LanguageCode } from './types';

export const museBarTranslations: Record<LanguageCode, Record<string, string>> = {
  pt: {
    sentinelAITitle: 'Store Sentinel AI • Muse Spark',
    sentinelPlaceholder: "Pergunte ao Muse AI (ex: 'Qual cliente comprou mais?', 'Como melhorar o meu relatório de vendas?')...",
    voiceButton: 'Voz',
    askButton: 'Perguntar',
    clearText: 'Limpar texto',
    onlineStatusPill: 'MUSE Spark Online',
    offlineStatusPill: 'MUSE AI Offline',
    analyzingTelemetry: 'Consultando telemetria em tempo real no SQLite local e executando modelo Muse Spark...',
    museOfflineMessage: 'MUSE AI está offline. Conecte-se à internet para consultar a inteligência artificial.',
    voiceOfflineMessage: 'MUSE Transcribe está offline. Conecte-se à internet para usar o reconhecimento de voz.'
  },
  en: {
    sentinelAITitle: 'Store Sentinel AI • Muse Spark',
    sentinelPlaceholder: "Ask Muse AI anything (e.g. 'Which customer bought the most product?', 'How can I improve my sales report?')...",
    voiceButton: 'Voice',
    askButton: 'Ask',
    clearText: 'Clear text',
    onlineStatusPill: 'MUSE Spark Online',
    offlineStatusPill: 'MUSE AI Offline',
    analyzingTelemetry: 'Querying real-time telemetry from local SQLite and executing Muse Spark model...',
    museOfflineMessage: 'MUSE AI is currently offline. Please connect to the internet to query the AI assistant.',
    voiceOfflineMessage: 'MUSE Transcribe is offline. Please connect to the internet to use voice transcription.'
  },
  fr: {
    sentinelAITitle: 'Store Sentinel AI • Muse Spark',
    sentinelPlaceholder: "Demandez à Muse AI (ex: 'Quel client a acheté le plus?', 'Comment améliorer mon rapport de ventes?')...",
    voiceButton: 'Voix',
    askButton: 'Demander',
    clearText: 'Effacer le texte',
    onlineStatusPill: 'MUSE Spark En Ligne',
    offlineStatusPill: 'MUSE AI Hors-Ligne',
    analyzingTelemetry: 'Interrogation de la télémétrie en temps réel depuis SQLite local et exécution du modèle Muse Spark...',
    museOfflineMessage: 'MUSE AI est actuellement hors ligne. Veuillez vous connecter à Internet pour interroger l\'assistant IA.',
    voiceOfflineMessage: 'MUSE Transcribe est hors ligne. Veuillez vous connecter à Internet pour utiliser la transcription vocale.'
  },
  sw: {
    sentinelAITitle: 'Store Sentinel AI • Muse Spark',
    sentinelPlaceholder: "Uliza chochote kwa Muse AI (mfano: 'Mteja yupi alinunua bidhaa nyingi zaidi?', 'Jinsi gani naweza kuboresha ripoti yangu ya mauzo?')...",
    voiceButton: 'Sauti',
    askButton: 'Uliza',
    clearText: 'Futa maandishi',
    onlineStatusPill: 'MUSE Spark Mtandaoni',
    offlineStatusPill: 'MUSE AI Nje ya Mtandao',
    analyzingTelemetry: 'Kuchunguza telemetri ya wakati halisi kutoka SQLite ya ndani na kutekeleza modeli ya Muse Spark...',
    museOfflineMessage: 'MUSE AI iko nje ya mtandao kwa sasa. Tafadhali unganisha kwenye mtandao ili kuuliza msaidizi wa AI.',
    voiceOfflineMessage: 'MUSE Transcribe iko nje ya mtandao. Tafadhali unganisha kwenye mtandao ili kutumia unukuzi wa sauti.'
  }
};
