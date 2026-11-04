/**
 * @file types.ts
 * @description Centralized Type Definitions and Constants for LlamaChat Modal.
 */

import { SentinelAction, ExecutableAiAction } from '../../../lib/ai/storeSentinelClient';

export interface MuseChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: SentinelAction[];
  executableAction?: ExecutableAiAction;
  executableActions?: ExecutableAiAction[];
  actionExecuted?: boolean;
  highlight?: { metricLabel: string; metricValue: string; status: string };
  isOffline?: boolean;
  responseTimeMs?: number;
}

export interface MuseAgentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  initialQuery?: string;
  lang?: string;
}

export const PROMPT_SUGGESTIONS = [
  'Lets add a product',
  'Lets add 2 customers, 2 products and 1 delivery',
  'i want the latest shift reports',
  'create a poem about a frog',
  'create a promotional summary for Coca-Cola 2L',
  'i want the product stock levels',
  'i want the store overview',
  'what is our delivery status',
  'what is our debt level?',
  'What was João Cossa scanned history?'
];

export function getWelcomeMessage(lang: string, _modelTitle: string): string {
  switch (lang) {
    case 'pt':
      return `Olá! Sou o seu copiloto de inteligência para o SYCOMM POS. Estou ligado em tempo real ao registo de vendas, stock de prateleira, fiados e turnos de caixa. Em que posso ajudar na loja hoje?`;
    case 'fr':
      return `Salut! Je suis votre copilote de magasin pour SYCOMM POS. Je suis connecté en direct à votre caisse, votre stock, vos crédits clients et vos turnes. Comment puis-je vous aider aujourd'hui?`;
    case 'sw':
      return `Habari! Mimi ni msaidizi wako wa duka wa SYCOMM POS. Nimeunganishwa moja kwa moja na mauzo, hisa, na madeni ya wateja. Nikusaidie nini leo dukani?`;
    case 'en':
    default:
      return `Hey! I'm your store copilot for SYCOMM POS. I'm connected to your live register, shelf stock, customer debts (fiado), and cashier shifts. How can I help you run the shop today?`;
  }
}
