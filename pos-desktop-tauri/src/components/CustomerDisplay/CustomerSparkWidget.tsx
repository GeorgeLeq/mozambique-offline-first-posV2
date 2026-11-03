/**
 * @file CustomerSparkWidget.tsx
 * @description In-Store Customer Spark AI Assistant widget with voice/text input and strict read-only security.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Send, Bot, ShieldCheck, Sparkles, Check, AlertCircle, Volume2, RotateCcw } from 'lucide-react';
import { handleCustomerQuery, PublicProductItem } from '../../lib/ai/customerSparkClient';
import { 
  getActiveAiDisplayName, 
  checkAiEngineStatus, 
  AiEngineStatus
} from '../../lib/ai/unifiedAiClient';
import { CustomerSparkMessage } from '../../lib/customerDisplay/types';
import { formatCurrency } from '../../lib/utils';
import { useI18n, getLanguage } from '../../i18n';

export function CustomerSparkWidget() {
  const t = useI18n();
  const currentLang = getLanguage();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiInfo, setAiInfo] = useState(() => getActiveAiDisplayName());
  const [engineStatus, setEngineStatus] = useState<AiEngineStatus | null>(null);

  const [messages, setMessages] = useState<CustomerSparkMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: t.aiWelcomeMessage || 'Hello! I am the store AI assistant. Ask me about product prices in Meticais, stock availability, or current promotions!',
      timestamp: Date.now(),
      suggested_chips: [
        t.chip1 || 'Do you have 25kg Rice?',
        t.chip2 || 'Cooking oil price',
        t.chip3 || 'Do you accept M-Pesa & e-Mola?',
        t.chip4 || "Today's promotions"
      ]
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Track online/offline status and active AI engine
  useEffect(() => {
    const updateStatus = () => {
      setAiInfo(getActiveAiDisplayName());
      checkAiEngineStatus().then(st => setEngineStatus(st));
    };
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('ai-config-changed', updateStatus);
    window.addEventListener('ai-provider-changed', updateStatus);
    window.addEventListener('storage', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('ai-config-changed', updateStatus);
      window.removeEventListener('ai-provider-changed', updateStatus);
      window.removeEventListener('storage', updateStatus);
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Initialize Web Speech Recognition if supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-MZ'; // Mozambican Portuguese
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput(transcript);
            submitQuery(transcript, 'voice');
          }
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Speech recognition start failed:', e);
      }
    } else {
      // Voice fallback: prompt sample query
      submitQuery('Tem arroz de 25kg?', 'voice');
    }
  };

  const submitQuery = async (queryText: string, inputType: 'voice' | 'text' = 'text') => {
    const text = queryText.trim();
    if (!text || isLoading) return;

    // Append customer message
    const customerMsg: CustomerSparkMessage = {
      id: crypto.randomUUID(),
      sender: 'customer',
      text,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, customerMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await handleCustomerQuery(text, inputType);
      setMessages((prev) => [...prev, response]);

      // Optional text-to-speech if speech synthesis exists
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(response.text.replace(/[*#]/g, ''));
          utterance.lang = 'pt-PT';
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
        } catch {}
      }
    } catch (e) {
      console.error('Customer Spark query error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: 'Desculpe, ocorreu uma instabilidade momentânea. Pode perguntar ao operador no balcão.',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: t.aiWelcomeMessage || 'How can I assist you? Ask about any product, stock availability, or accepted payment methods.',
        timestamp: Date.now(),
        suggested_chips: [
          t.chip1 || 'Do you have 25kg Rice?',
          t.chip2 || 'Cooking oil price',
          t.chip3 || 'Do you accept M-Pesa & e-Mola?',
          t.chip4 || "Today's promotions"
        ]
      }
    ]);
  };

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden min-h-[340px] max-h-[420px]">
      {/* Widget Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50/80 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Bot size={17} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t.sparkStoreAssistant || 'Store AI Assistant'}
              </h3>
              <span className="px-2 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold text-[10px] rounded-full border border-indigo-200 dark:border-indigo-800">
                {t.sparkStoreAssistantBadge || 'Counter Copilot'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {t.sparkLiveQuestions || 'Live product, stock & price inquiries'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dynamic Detected AI Status Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-colors ${
            engineStatus?.isOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              engineStatus?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`} />
            <span>
              {engineStatus?.isOnline
                ? `${aiInfo.badge} (${engineStatus.latencyMs ?? 20}ms)`
                : `${aiInfo.badge} (${t.aiOffline || 'Offline'})`}
            </span>
          </div>

          {/* Security Guardrail Tag */}
          <div 
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-zinc-800/60 text-slate-750 dark:text-zinc-300 text-[10px] font-bold rounded-xl border border-slate-200 dark:border-zinc-700"
            title={t.safeInquiryTooltip || 'Public catalog only. Zero access to internal profits, customer credit debts, or cash drawer.'}
          >
            <ShieldCheck size={12} className="text-emerald-500" />
            <span className="hidden sm:inline">{t.safeInquiry || 'Secure Inquiry'}</span>
          </div>

          <button
            onClick={clearChat}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-colors cursor-pointer"
            title="Restart Conversation"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-xs">
        {messages.map((msg) => {
          const isUser = msg.sender === 'customer';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-bl-sm border border-slate-200/80 dark:border-zinc-700'
                }`}
              >
                <div className="whitespace-pre-line leading-relaxed font-medium">
                  {msg.text}
                </div>

                {/* Matched Product Cards (if any) */}
                {msg.matched_products && msg.matched_products.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-zinc-700/80 space-y-1.5">
                    {msg.matched_products.map((prod) => (
                      <div
                        key={prod.id}
                        className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-3 text-slate-900 dark:text-white"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs truncate">{prod.name}</p>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400">{prod.category}</span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(prod.price_mt)}
                          </span>
                          <div className="mt-0.5">
                            {prod.is_in_stock ? (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded-full border border-emerald-200 dark:border-emerald-800">
                                {t.inStock || 'In Stock'} ({prod.stock_quantity})
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.2 rounded-full border border-rose-200 dark:border-rose-800">
                                {t.outOfStock || 'Out of Stock'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick suggestion chips */}
              {msg.suggested_chips && msg.suggested_chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {msg.suggested_chips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => submitQuery(chip, 'text')}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-white text-[11px] font-semibold transition-all border border-slate-200 dark:border-zinc-700 cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold p-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
            <span className="text-slate-400 dark:text-zinc-500 text-[11px] ml-1">
              {t.aiChecking || 'Checking live catalog...'}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Row */}
      <div className="p-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2">
        {/* Text Input */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitQuery(input, 'text')}
          placeholder={isListening ? (t.listeningVoice || 'A escutar voz...') : (t.askProductPlaceholder || 'Escreva a sua pergunta aqui...')}
          className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-600"
        />

        {/* Send Button */}
        <button
          onClick={() => submitQuery(input, 'text')}
          disabled={!input.trim() || isLoading}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
          title={t.send || 'Enviar Pergunta'}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
