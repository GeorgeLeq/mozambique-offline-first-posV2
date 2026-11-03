/**
 * @file MuseAgentChatModal.tsx
 * @description Full Deep-Dive Interactive AI Studio & Agentic Chat with Meta MUSE Spark 1.3.
 * Fullscreen view with dark/light theme support and English localization.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, Sparkles, Mic, MicOff, RefreshCw, KeyRound, 
  TrendingUp, AlertTriangle, Users, ExternalLink,
  Bot, ChevronRight, CheckCircle2, ShieldAlert, ArrowLeft,
  AlertCircle, Copy, Trash2, Check, Timer, Zap, Clock
} from 'lucide-react';
import { 
  askStoreSentinel, 
  fetchStoreTelemetrySnapshot, 
  StoreTelemetrySnapshot,
  SentinelAction,
  ExecutableAiAction
} from '../../lib/ai/storeSentinelClient';
import { transcribeAudio } from '../../lib/ai/museVoiceClient';
import { useAudioRecorder } from '../../lib/ai/useAudioRecorder';
import { 
  getActiveAiDisplayName,
  checkAiEngineStatus,
  AiEngineStatus,
  getActiveAiProvider
} from '../../lib/ai/unifiedAiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ExecutableActionCard } from './ExecutableActionCard';
import { SequentialActionQueue } from './ExecutableActionCard/components/SequentialActionQueue';
import { AiSettingsModal } from './AiSettingsModal';
import { ThemeToggle } from '../ThemeToggle';
import { useStoreSentinelProfiler, SENTINEL_GEARS } from '../../lib/ai/unified/profilerStore';
import toast from 'react-hot-toast';

interface MuseChatMessage {
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

interface MuseAgentChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  initialQuery?: string;
  lang?: string;
}

export function MuseAgentChatModal({
  isOpen,
  onClose,
  onNavigateTab,
  initialQuery,
  lang = 'en'
}: MuseAgentChatModalProps) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<MuseChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [telemetry, setTelemetry] = useState<StoreTelemetrySnapshot | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [aiInfo, setAiInfo] = useState(() => getActiveAiDisplayName());
  const [engineStatus, setEngineStatus] = useState<AiEngineStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabledRef = useRef<boolean>(true);
  const rafScrollRef = useRef<number | null>(null);
  const profiler = useStoreSentinelProfiler();

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();

  // Scroll listener to detect when the user intentionally scrolls up to inspect history
  const handleContainerScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isAutoScrollEnabledRef.current = distanceFromBottom < 80;
  };

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    if (!chatContainerRef.current) return;
    if (behavior === 'smooth') {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Load telemetry, AI status, and initial message
  useEffect(() => {
    if (isOpen) {
      setAiInfo(getActiveAiDisplayName());
      checkAiEngineStatus().then(status => setEngineStatus(status));
      fetchStoreTelemetrySnapshot().then(snap => setTelemetry(snap)).catch(() => {});
      
      const handleConfigChange = () => {
        setAiInfo(getActiveAiDisplayName());
        checkAiEngineStatus().then(status => setEngineStatus(status));
      };
      window.addEventListener('ai-config-changed', handleConfigChange);
      window.addEventListener('ai-provider-changed', handleConfigChange);
      window.addEventListener('online', handleConfigChange);
      window.addEventListener('offline', handleConfigChange);
      
      if (messages.length === 0) {
        // Try restoring saved chat history first so switching tabs never loses chat!
        let hasRestored = false;
        try {
          const savedChat = localStorage.getItem('sycomm_ai_chat_history');
          if (savedChat) {
            const parsed = JSON.parse(savedChat);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              hasRestored = true;
            }
          }
        } catch {}

        if (!hasRestored) {
          setMessages([
            {
              id: 'init-1',
              sender: 'assistant',
              text: getWelcomeMessage(lang, getActiveAiDisplayName().title),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              actions: [
                { label: 'View Sales Reports', tab: 'reports' },
                { label: 'Check Critical Stock', tab: 'products' },
                { label: 'Customers & Debts', tab: 'clients' }
              ]
            }
          ]);
        }
      }

      if (initialQuery && initialQuery.trim() !== '') {
        handleSendQuery(initialQuery);
      }

      return () => {
        window.removeEventListener('ai-config-changed', handleConfigChange);
        window.removeEventListener('ai-provider-changed', handleConfigChange);
        window.removeEventListener('online', handleConfigChange);
        window.removeEventListener('offline', handleConfigChange);
      };
    }
  }, [isOpen]);

  // Persist session messages to localStorage so switching tabs or closing modal retains full chat
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('sycomm_ai_chat_history', JSON.stringify(messages.slice(-40)));
      } catch {}
    }
  }, [messages]);

  useEffect(() => {
    if (!isAutoScrollEnabledRef.current) return;

    if (isLoading) {
      // During active token streaming, throttle instant scroll via requestAnimationFrame.
      // Avoid continuous smooth scroll animations which cancel each other and cause violent jitter/glitching.
      if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
      rafScrollRef.current = requestAnimationFrame(() => {
        if (chatContainerRef.current && isAutoScrollEnabledRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
    } else {
      // When streaming completes or message is finalized, smoothly settle at bottom
      scrollToBottom('smooth');
    }

    return () => {
      if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
    };
  }, [messages, isLoading]);

  // Handler to clear chat and start a fresh session
  const handleClearChat = () => {
    try {
      localStorage.removeItem('sycomm_ai_chat_history');
    } catch {}
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: 'assistant',
        text: getWelcomeMessage(lang, getActiveAiDisplayName().title),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: 'View Sales Reports', tab: 'reports' },
          { label: 'Check Critical Stock', tab: 'products' },
          { label: 'Customers & Debts', tab: 'clients' }
        ]
      }
    ]);
    toast.success('Conversa reiniciada / New chat started');
  };

  // Handler to copy entire chat transcript to clipboard
  const handleCopyEntireChat = () => {
    if (messages.length === 0) return;
    const transcript = messages.map(m => {
      const sender = m.sender === 'user' ? 'Operator' : 'Store Sentinel AI';
      return `[${m.timestamp}] ${sender}:\n${m.text}`;
    }).join('\n\n------------------------\n\n');
    navigator.clipboard.writeText(transcript);
    toast.success('Transcrição da conversa copiada! / Chat transcript copied');
  };

  // Handler to copy a single message
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Mensagem copiada / Message copied');
  };

  const handleSendQuery = async (queryToSend: string) => {
    const q = queryToSend.trim();
    if (!q || isLoading) return;

    setInputText('');
    const userMsgId = `usr-${Date.now()}`;
    const newMsg: MuseChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Construct clean session history for multi-turn conversation memory (last 2 turns for Core i3 speed)
    // Filters out any malformed JSON or rogue symbols from prior turns to keep context pristine
    const chatHistory = messages
      .filter(m => !m.isOffline && m.text && !m.text.includes('{') && !m.text.includes('}') && m.text.trim().length > 2)
      .slice(-4)
      .map(m => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text.trim()
      }));

    const astId = `ast-${Date.now()}`;
    const initialAssistantMsg: MuseChatMessage = {
      id: astId,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg, initialAssistantMsg]);
    setIsLoading(true);
    setElapsedSeconds(0);
    const startTime = performance.now();

    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => Number((prev + 0.1).toFixed(1)));
    }, 100);

    isAutoScrollEnabledRef.current = true;
    let accumulatedText = '';

    try {
      const response = await askStoreSentinel(q, {
        inputType: 'text',
        lang,
        currentUser: currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          terminal_name: currentUser.terminal_name
        } : null,
        chatHistory,
        onChunk: (chunk: string) => {
          if (!chunk) return;
          // Guard against both delta chunks and accumulated chunks to prevent quadratic text ballooning
          if (chunk.length >= accumulatedText.length && chunk.startsWith(accumulatedText)) {
            accumulatedText = chunk;
          } else {
            accumulatedText += chunk;
          }
          const cleanText = accumulatedText
            .replace(/\{[a-zA-Z0-9_\[\]\s:"',-]+\}\s*/g, '')
            .replace(/\{\s*\}/g, '');
          setMessages(prev => prev.map(msg => msg.id === astId ? { ...msg, text: cleanText } : msg));
        }
      });

      const durationMs = Math.round(performance.now() - startTime);

      setMessages(prev => prev.map(msg => {
        if (msg.id === astId) {
          return {
            ...msg,
            text: response.answer || accumulatedText,
            actions: response.suggestedActions,
            executableAction: response.executableAction,
            executableActions: response.executableActions,
            highlight: response.telemetryHighlight,
            isOffline: response.isOffline,
            responseTimeMs: durationMs
          };
        }
        return msg;
      }));
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      setMessages(prev => prev.map(msg => {
        if (msg.id === astId) {
          return {
            ...msg,
            text: accumulatedText || `Error communicating with AI Copilot: ${err.message || 'Connection failure.'}`,
            isOffline: true,
            responseTimeMs: durationMs
          };
        }
        return msg;
      }));
    } finally {
      clearInterval(timerInterval);
      setIsLoading(false);
    }
  };

  const handleToggleVoice = async () => {
    if (isRecording) {
      try {
        const audioBlob = await stopRecording();
        if (audioBlob) {
          toast.loading('Transcribing voice audio...', { id: 'voice-tx' });
          const txRes = await transcribeAudio(audioBlob, 'generic', lang);
          toast.dismiss('voice-tx');
          if (txRes.text && txRes.text.trim()) {
            handleSendQuery(txRes.text);
          } else if (txRes.isOffline) {
            toast.error('Voice service is offline. Check API key or connection.');
          } else {
            toast.error('No speech detected. Please speak again.');
          }
        }
      } catch (err) {
        toast.dismiss('voice-tx');
        toast.error('Voice transcription failed.');
      }
    } else {
      if (!engineStatus?.isOnline) {
        toast.error('AI Engine is offline. Configure provider or API key in AI Settings.');
        return;
      }
      try {
        await startRecording();
        toast('Recording voice for AI Copilot...', { icon: '🎙️' });
      } catch (err) {
        toast.error('Microphone unavailable or permission denied.');
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 w-screen h-screen z-[999999] flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans transition-colors duration-300 isolate">
      {/* Top Fullscreen Header */}
      <div className="px-5 sm:px-8 py-3.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Exit Deep Dive View"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                {aiInfo.title}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                Meta Llama
              </span>

              {/* Dynamic Health & Online Status Badge: Local AI / ON */}
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(true)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border cursor-pointer transition-all ${
                  engineStatus?.isOnline
                    ? engineStatus.provider === 'baseten-muse'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                }`}
                title="Click to configure AI Engine (Local Ollama, Embedded GGUF, or Baseten Fallback)"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  engineStatus?.isOnline 
                    ? (engineStatus.provider === 'baseten-muse' ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500 animate-pulse') 
                    : 'bg-rose-500'
                }`} />
                <span>
                  {engineStatus?.isOnline 
                    ? (engineStatus.provider === 'baseten-muse' ? 'Muse Spark / ON' : 'Local AI / ON') 
                    : 'Local AI / OFF'}
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 hidden sm:block">
              Pure Meta Llama Copilot for SYCOMM POS (Mozambique) • Live SQLite Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Entire Chat Transcript Button */}
          <button
            onClick={handleCopyEntireChat}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Copy complete chat transcript to clipboard"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span className="hidden sm:inline">Copy Chat</span>
          </button>

          {/* Clear / New Chat Button */}
          <button
            onClick={handleClearChat}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-300 border border-slate-200 dark:border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Clear chat and start fresh session"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* Theme Toggle Button */}
          <div className="flex items-center">
            <ThemeToggle />
          </div>

          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Configure AI Deployment (Local Ollama, Embedded GGUF, or Groq)"
          >
            <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">AI Settings</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Fullscreen Body: Split View (Telemetry Sidebar + Chat Canvas) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Telemetry Sidebar */}
        <div className="w-80 bg-slate-100/70 dark:bg-zinc-900/40 border-r border-slate-200 dark:border-zinc-800 p-5 overflow-y-auto hidden md:flex flex-col gap-4 text-xs shrink-0 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
            <span className="font-extrabold text-slate-600 dark:text-zinc-400 uppercase tracking-wider text-[11px]">
              Live SQLite Telemetry
            </span>
            <button 
              onClick={() => fetchStoreTelemetrySnapshot().then(snap => setTelemetry(snap))}
              className="text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
              title="Refresh local database snapshot"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Store Sentinel Profiler Card (Dynamic Gear Shifting & Inference Telemetry) */}
          <div className="p-4 rounded-2xl bg-zinc-900 text-white border-2 border-indigo-500 shadow-lg space-y-3 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-ping" style={{ backgroundColor: profiler.gearInfo?.color || '#10b981' }} />
                <span className="font-black text-xs text-indigo-400 uppercase tracking-wider truncate">
                  Store Sentinel Profiler
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0">
                {profiler.latestMetrics?.isOnlineFallback ? 'Cloud Fallback' : 'Local 1B'}
              </span>
            </div>

            {/* Active Lane Badge Banner */}
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="flex items-center justify-between text-xs font-black">
                <span style={{ color: profiler.gearInfo?.color || '#10b981' }}>
                  {profiler.gearInfo?.name || 'Lane 3: POS Operations'}
                </span>
                <span className="font-mono text-emerald-400 text-[10px]">
                  ⚡ {profiler.latestMetrics?.evalDuration || `${profiler.latestMetrics?.latencyMs || 20}ms`}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1 font-medium">
                {profiler.gearInfo?.tagline || 'Exact Stock, Fiado & Cash Register in SQLite'}
              </p>
            </div>

            {/* 4-Gear Transmission Indicator */}
            <div>
              <div className="text-[10px] text-zinc-400 font-extrabold mb-1.5 uppercase tracking-wider">
                Dynamic Lane Gears
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {([1, 2, 3, 4] as const).map(gearNum => {
                  const gearObj = SENTINEL_GEARS[gearNum];
                  const isActive = profiler.activeGear === gearNum;
                  return (
                    <div
                      key={gearNum}
                      className={`px-2 py-1.5 rounded-xl text-[10px] font-black transition-all border flex items-center justify-between ${
                        isActive
                          ? `${gearObj.badgeBg} ${gearObj.badgeText} ${gearObj.badgeBorder} ring-2 ring-indigo-500/40 scale-[1.02] shadow-sm`
                          : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 opacity-80'
                      }`}
                    >
                      <span>{gearObj.shortCode}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Token & Inference Metrics */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-300 border border-zinc-700/80">
                <div className="text-[9px] text-zinc-400 font-bold uppercase">PROMPT</div>
                <div className="font-black text-white text-xs mt-0.5">
                  {profiler.latestMetrics?.promptTokens ?? 0} t
                </div>
              </div>
              <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-300 border border-zinc-700/80">
                <div className="text-[9px] text-zinc-400 font-bold uppercase">GENERATED</div>
                <div className="font-black text-white text-xs mt-0.5">
                  {profiler.latestMetrics?.generatedTokens ?? 0} t
                </div>
              </div>
            </div>

            <div className="text-[10px] text-zinc-400 font-mono truncate pt-1 border-t border-zinc-800">
              Model: <strong className="text-zinc-200">{profiler.latestMetrics?.model || 'pos-parser'}</strong>
            </div>
          </div>

          {telemetry && (
            <>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold">Today's Sales</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  {telemetry.todaySalesTotal.toLocaleString()} MT
                </div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 font-medium">
                  {telemetry.todaySalesCount} invoices issued
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold">Critical Stock Items</span>
                </div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {telemetry.lowStockProducts.length} items
                </div>
                {telemetry.lowStockProducts.length > 0 && (
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 truncate">
                    e.g. {telemetry.lowStockProducts[0].name}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 mb-1">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span className="font-semibold">Active Operators</span>
                </div>
                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                  {telemetry.users.length} users
                </div>
              </div>
            </>
          )}

          {/* Quick Deep Dive Questions */}
          <div className="mt-auto pt-4 border-t border-slate-200 dark:border-zinc-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-2.5">
              Interactive AI Actions & Prompts
            </span>
            <div className="flex flex-col gap-1.5">
              {[
                'Who is logged in?',
                'Can you create a new product: Coca-Cola 330ml 50MT?',
                'Create restock delivery: 10 boxes of 2M beer',
                'Register new customer: António Muchanga',
                'Search web for rice 25kg wholesale prices in Maputo',
                'Which products are low on stock?'
              ].map((q, idx) => (
                <button
                  key={idx}
                  disabled={isLoading}
                  onClick={() => handleSendQuery(q)}
                  className="text-left p-2.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 text-xs font-medium transition-all cursor-pointer leading-snug shadow-xs"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Chat Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/40 dark:bg-zinc-950/60 transition-colors">
          <div 
            ref={chatContainerRef}
            onScroll={handleContainerScroll}
            className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-4"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-1 shadow-xs">
                    <Bot className="w-5 h-5" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs shadow-md'
                    : m.isOffline
                    ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-bl-xs shadow-xs'
                    : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 rounded-bl-xs shadow-xs'
                }`}>
                  <p className="whitespace-pre-line font-normal">{m.text}</p>

                  {/* Executable In-Chat Action Cards (Single Card or Sequential Queue) */}
                  {m.executableActions && m.executableActions.length > 1 ? (
                    <SequentialActionQueue
                      actions={m.executableActions}
                      currentUser={currentUser}
                      onAllExecuted={() => {
                        setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, actionExecuted: true } : msg));
                        fetchStoreTelemetrySnapshot().then(snap => setTelemetry(snap)).catch(() => {});
                      }}
                      onNavigateTab={(tab) => {
                        if (onNavigateTab) {
                          onClose();
                          onNavigateTab(tab);
                        }
                      }}
                    />
                  ) : m.executableAction ? (
                    <ExecutableActionCard
                      action={m.executableAction}
                      executed={m.actionExecuted}
                      currentUser={currentUser}
                      onExecuted={() => {
                        setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, actionExecuted: true } : msg));
                        fetchStoreTelemetrySnapshot().then(snap => setTelemetry(snap)).catch(() => {});
                      }}
                      onNavigateTab={(tab) => {
                        if (onNavigateTab) {
                          onClose();
                          onNavigateTab(tab);
                        }
                      }}
                    />
                  ) : null}

                  {/* Highlight pill */}
                  {m.highlight && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs">
                      <span className="text-slate-500 dark:text-zinc-400 font-medium">{m.highlight.metricLabel}:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {m.highlight.metricValue}
                      </span>
                    </div>
                  )}

                  {/* Actions buttons */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Shortcuts:
                      </span>
                      {m.actions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (onNavigateTab) {
                              onClose();
                              onNavigateTab(act.tab);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                        >
                          <span>{act.label}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-[10px] text-slate-400 dark:text-zinc-500 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>{m.timestamp}</span>
                      {m.responseTimeMs !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[9px] border border-indigo-200/60 dark:border-indigo-800/80 flex items-center gap-1">
                          ⚡ {m.responseTimeMs >= 1000 ? `${(m.responseTimeMs / 1000).toFixed(2)}s` : `${m.responseTimeMs}ms`}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(m.text)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          m.sender === 'user'
                            ? 'text-indigo-200 hover:text-white hover:bg-white/10'
                            : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title="Copy message text"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    {m.sender === 'assistant' && (
                      <span className="font-mono text-indigo-500 dark:text-indigo-400 font-semibold">
                        {aiInfo.title}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl rounded-bl-xs p-4 shadow-xs text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                  <span>{aiInfo.title} is analyzing telemetry...</span>
                  <span className="ml-auto font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 shadow-xs animate-pulse shrink-0">
                    <Timer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {elapsedSeconds.toFixed(1)}s
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="p-4 sm:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 shrink-0">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery(inputText);
              }}
              className="max-w-4xl mx-auto flex items-center gap-2.5"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Ask ${aiInfo.title} anything (e.g. Which customer bought the most products?)...`}
                className="flex-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden transition-all shadow-inner"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <span>Send</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* AI Engine & Multi-Provider Configuration Modal */}
      <AiSettingsModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSettingsSaved={() => {
          setAiInfo(getActiveAiDisplayName());
          checkAiEngineStatus().then(st => setEngineStatus(st));
        }}
      />
    </div>,
    document.body
  );
}

function getWelcomeMessage(lang: string, _modelTitle: string): string {
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
