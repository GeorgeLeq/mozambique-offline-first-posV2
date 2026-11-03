/**
 * @file StoreSentinelBar.tsx
 * @description Executive Store Sentinel AI Bar for the POS Dashboard.
 * Integrates Meta's MUSE Spark 1.3 with MUSE Voice Transcribe and offline SQLite local telemetry.
 * Supports deep-dive multi-turn agent conversation modal.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Database, 
  ExternalLink, 
  X, 
  Wifi, 
  Maximize2,
  KeyRound,
  Bot
} from 'lucide-react';
import { VoiceInputButton } from '../common/VoiceInputButton';
import { 
  askStoreSentinel, 
  SentinelResponse, 
  SentinelAction,
  isMuseOnline,
  getMuseApiKey,
  setMuseApiKey
} from '../../lib/ai/storeSentinelClient';
import { 
  getActiveAiProvider, 
  getActiveAiDisplayName,
  getOllamaModel, 
  getEmbeddedModelName, 
  checkAiEngineStatus, 
  AiEngineStatus,
  AiProvider 
} from '../../lib/ai/unifiedAiClient';
import { MuseAgentChatModal } from './MuseAgentChatModal';
import { AiSettingsModal } from './AiSettingsModal';
import { useStoreSentinelProfiler } from '../../lib/ai/unified/profilerStore';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import toast from 'react-hot-toast';

interface StoreSentinelBarProps {
  onNavigate: (tab: string) => void;
  className?: string;
}

export function StoreSentinelBar({ onNavigate, className = '' }: StoreSentinelBarProps) {
  const { currentUser } = useAuth();
  const t = useI18n();
  const [query, setQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [response, setResponse] = useState<SentinelResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [aiInfo, setAiInfo] = useState(() => getActiveAiDisplayName());
  const [engineStatus, setEngineStatus] = useState<AiEngineStatus | null>(null);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);
  const [isKeyConfigOpen, setIsKeyConfigOpen] = useState(false);
  const profiler = useStoreSentinelProfiler();

  // Track online/offline status and active engine
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
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('ai-config-changed', updateStatus);
      window.removeEventListener('ai-provider-changed', updateStatus);
    };
  }, []);

  // Execute question against Store Sentinel AI
  const handleAsk = async (textToAsk?: string, inputType: 'voice' | 'text' = 'text') => {
    const targetQuery = (textToAsk ?? query).trim();
    if (!targetQuery || isAsking) return;

    setIsAsking(true);
    setResponse(null);
    setIsExpanded(true);

    try {
      const result = await askStoreSentinel(targetQuery, {
        inputType,
        transcription: inputType === 'voice' ? targetQuery : undefined,
        currentUser: currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          terminal_name: currentUser.terminal_name
        } : null,
        lang: t.locale || 'en'
      });
      setResponse(result);
    } catch (err) {
      console.error('[StoreSentinelBar] Query execution error:', err);
    } finally {
      setIsAsking(false);
    }
  };

  // Handle voice transcription incoming from Muse Voice Transcribe
  const handleVoiceTranscript = (transcribedText: string) => {
    if (!transcribedText) return;
    setQuery(transcribedText);
    handleAsk(transcribedText, 'voice');
  };

  const handleActionClick = (action: SentinelAction) => {
    if (onNavigate) {
      onNavigate(action.tab);
    }
  };

  const getMetricBadgeColor = (status?: string) => {
    switch (status) {
      case 'alert':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'good':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'info':
      default:
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    }
  };

  return (
    <div className={`w-full relative z-20 flex flex-col gap-2 ${className}`}>
      {/* Search & Voice Bar */}
      <div className="relative rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-indigo-200/80 dark:border-indigo-500/30 p-2 sm:p-2.5 shadow-sm transition-all focus-within:shadow-md focus-within:border-indigo-500 dark:focus-within:border-indigo-400">
        <div className="flex items-center gap-2">
          
          {/* AI Badge Icon */}
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 text-white shrink-0 shadow-sm shadow-indigo-500/20">
            {isAsking ? (
              <Loader2 size={18} className="animate-spin text-indigo-200" />
            ) : (
              <Sparkles size={18} className="text-amber-300 animate-pulse" />
            )}
          </div>

          {/* Text Input */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder={t.sentinelPlaceholder || "Ask Store Sentinel AI (e.g. 'Which customer bought the most?' or 'How can I improve sales?')..."}
              className="w-full bg-transparent border-0 outline-hidden text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 py-1"
            />
          </div>

          {/* Dynamic Local AI Status Pill: "Local AI / ON" */}
          <button
            type="button"
            onClick={() => setIsKeyConfigOpen(true)}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shrink-0 transition-all cursor-pointer ${
              engineStatus?.isOnline
                ? engineStatus.provider === 'baseten-muse'
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-800 hover:border-purple-400 shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400 shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:border-rose-400 shadow-xs'
            }`}
            title="Configure Local AI Engine & Cloud Fallback"
          >
            <span className={`w-2 h-2 rounded-full ${
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

          {/* Compact Store Sentinel Profiler Indicator (Shows active gear shifting in real time!) */}
          <div
            onClick={() => setIsDeepDiveOpen(true)}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700 text-[10px] font-mono font-bold text-slate-700 dark:text-zinc-300 shrink-0 cursor-pointer hover:border-indigo-400 transition-all shadow-2xs"
            title={`Store Sentinel Profiler: ${profiler.gearInfo.name} | Latency: ${profiler.latestMetrics.latencyMs}ms | Tokens: ${profiler.latestMetrics.promptTokens ?? 0} in, ${profiler.latestMetrics.generatedTokens ?? 0} out. Click to open Deep Dive.`}
          >
            <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: profiler.gearInfo.color }} />
            <span className="font-extrabold uppercase tracking-tight" style={{ color: profiler.gearInfo.color }}>
              {profiler.gearInfo.shortCode}
            </span>
            <span className="text-slate-300 dark:text-zinc-600 font-normal">|</span>
            <span className="text-slate-600 dark:text-zinc-300">
              ⚡ {profiler.latestMetrics.evalDuration || `${profiler.latestMetrics.latencyMs}ms`}
            </span>
            {profiler.latestMetrics.generatedTokens !== undefined && (
              <>
                <span className="text-slate-300 dark:text-zinc-600 font-normal">|</span>
                <span className="text-slate-500 dark:text-zinc-400">
                  {profiler.latestMetrics.generatedTokens}t
                </span>
              </>
            )}
          </div>

          {/* Deep Dive Full Studio Button */}
          <button
            type="button"
            onClick={() => setIsDeepDiveOpen(true)}
            className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold shrink-0"
            title="Open Deep Dive full chat studio with Meta MUSE Agent"
          >
            <Maximize2 size={14} />
            <span className="hidden lg:inline text-[11px]">Deep Dive</span>
          </button>

          {/* Clear button if text exists */}
          {query && !isAsking && (
            <button
              onClick={() => setQuery('')}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-colors cursor-pointer"
              title={t.clearText || 'Clear text'}
            >
              <X size={14} />
            </button>
          )}



          {/* Send / Query Button */}
          <button
            onClick={() => handleAsk()}
            disabled={!query.trim() || isAsking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {isAsking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span className="hidden sm:inline">{t.askButton || 'Ask'}</span>
          </button>
        </div>
      </div>

      {/* Response Drawer / Card */}
      <AnimatePresence>
        {isExpanded && (response || isAsking) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl bg-gradient-to-br from-indigo-950/90 via-slate-900/95 to-zinc-950/95 text-white p-4 shadow-xl border border-indigo-500/30 relative overflow-hidden"
          >
            {/* Background glow accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Response Header */}
            <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles size={13} />
                </span>
                <span className="text-xs font-black tracking-wide text-indigo-200">
                  {getActiveAiDisplayName().title}
                </span>
                
                {/* Engine Mode Pill */}
                {response && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    response.isOffline 
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {response.isOffline ? (
                      <>
                        <Database size={9} />
                        <span>Offline</span>
                      </>
                    ) : (
                      <>
                        <Wifi size={9} />
                        <span>Online</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsDeepDiveOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[11px] font-semibold transition-all cursor-pointer"
                >
                  <Bot size={13} />
                  <span>Deep Dive (Chat)</span>
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close response"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Response Content Body */}
            <div className="relative z-10 py-3 text-xs sm:text-sm text-zinc-100 leading-relaxed font-normal">
              {isAsking ? (
                <div className="flex items-center gap-3 py-2 text-indigo-300">
                  <Loader2 size={18} className="animate-spin text-indigo-400" />
                  <span className="animate-pulse">
                    Querying real-time SQLite telemetry &amp; executing Meta MUSE Spark agent...
                  </span>
                </div>
              ) : response ? (
                <div className="space-y-3">
                  <p className="text-zinc-100 font-medium whitespace-pre-line">
                    {response.answer}
                  </p>

                  {/* Telemetry Metric Highlight if provided */}
                  {response.telemetryHighlight && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                      <span className="text-zinc-400 font-semibold">{response.telemetryHighlight.metricLabel}:</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded-md border text-[11px] ${getMetricBadgeColor(response.telemetryHighlight.status)}`}>
                        {response.telemetryHighlight.metricValue}
                      </span>
                    </div>
                  )}

                  {/* Suggested Quick Drill-Down Action Buttons */}
                  {response.suggestedActions.length > 0 && (
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Action Shortcuts:
                      </span>
                      {response.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleActionClick(action)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer border border-indigo-400/30 hover:scale-[1.02]"
                        >
                          <span>{action.label}</span>
                          <ExternalLink size={11} className="opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deep Dive Agentic Chat Modal */}
      <MuseAgentChatModal
        isOpen={isDeepDiveOpen}
        onClose={() => setIsDeepDiveOpen(false)}
        onNavigateTab={(tab) => {
          setIsDeepDiveOpen(false);
          onNavigate(tab);
        }}
        initialQuery={query}
        lang={t.locale || 'en'}
      />

      {/* AI Engine & Deployment Configuration Modal */}
      <AiSettingsModal
        isOpen={isKeyConfigOpen}
        onClose={() => setIsKeyConfigOpen(false)}
      />
    </div>
  );
}
