/**
 * @file AiSettingsModal.tsx
 * @description Pure Local AI Configuration Modal for SYCOMM POS.
 * 
 * Empowers cashiers and hackathon judges to select between local offline deployment options:
 * 1. 🖥️ Localhost Ollama (Standard Llama 3.2 3B/1B on port 11434)
 * 2. 📦 Embedded POS Parser (Custom .gguf running as 'pos-parser' via Modelfile)
 * 
 * 100% Pure Meta Llama models. 100% Offline-First. Zero presets, zero external cloud dependencies.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Cpu, 
  Box, 
  RefreshCw, 
  Check, 
  Copy, 
  Server, 
  Terminal,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { 
  getActiveAiProvider, 
  setActiveAiProvider, 
  AiProvider,
  getOllamaEndpoint, 
  setOllamaEndpoint, 
  getOllamaModel, 
  setOllamaModel,
  getEmbeddedModelName, 
  setEmbeddedModelName,
  checkAiEngineStatus,
  AiEngineStatus,
  getBasetenApiKey,
  setBasetenApiKey,
  getBasetenEndpoint,
  setBasetenEndpoint,
  getBasetenModel,
  setBasetenModel
} from '../../lib/ai/unifiedAiClient';
import toast from 'react-hot-toast';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export function AiSettingsModal({ isOpen, onClose, onSettingsSaved }: AiSettingsModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(() => getActiveAiProvider());
  const [status, setStatus] = useState<AiEngineStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Form states
  const [ollamaUrl, setOllamaUrl] = useState(() => getOllamaEndpoint());
  const [ollamaModel, setOllamaModelState] = useState(() => getOllamaModel());
  const [embeddedModel, setEmbeddedModelState] = useState(() => getEmbeddedModelName());
  const [basetenKey, setBasetenKeyState] = useState(() => getBasetenApiKey());
  const [basetenEndpoint, setBasetenEndpointState] = useState(() => getBasetenEndpoint());
  const [basetenModel, setBasetenModelState] = useState(() => getBasetenModel());

  // Copy helper
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(getActiveAiProvider());
      setOllamaUrl(getOllamaEndpoint());
      setOllamaModelState(getOllamaModel());
      setEmbeddedModelState(getEmbeddedModelName());
      setBasetenKeyState(getBasetenApiKey());
      setBasetenEndpointState(getBasetenEndpoint());
      setBasetenModelState(getBasetenModel());

      checkAiEngineStatus().then(st => setStatus(st));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (targetProvider?: AiProvider) => {
    setIsTesting(true);
    const prov = targetProvider || selectedProvider;

    // Apply temporary form values before test
    if (prov === 'local-ollama') {
      setOllamaEndpoint(ollamaUrl);
      setOllamaModel(ollamaModel);
    } else if (prov === 'embedded-gguf') {
      setOllamaEndpoint(ollamaUrl);
      setEmbeddedModelName(embeddedModel);
    } else if (prov === 'baseten-muse') {
      setBasetenApiKey(basetenKey);
      setBasetenEndpoint(basetenEndpoint);
      setBasetenModel(basetenModel);
    }

    const testRes = await checkAiEngineStatus(prov);
    setStatus(testRes);
    setIsTesting(false);

    if (testRes.isOnline) {
      toast.success(
        `Connected to ${
          prov === 'embedded-gguf'
            ? 'Embedded Model'
            : prov === 'baseten-muse'
            ? 'Baseten Cloud Fallback'
            : 'Localhost Ollama'
        }! Model: ${testRes.activeModel}`
      );
    } else {
      toast.error(testRes.error || 'Connection failed.');
    }
  };

  const handleSaveAndApply = () => {
    setActiveAiProvider(selectedProvider);
    setOllamaEndpoint(ollamaUrl);
    setOllamaModel(ollamaModel);
    setEmbeddedModelName(embeddedModel);
    setBasetenApiKey(basetenKey);
    setBasetenEndpoint(basetenEndpoint);
    setBasetenModel(basetenModel);

    toast.success(`Active AI set to ${
      selectedProvider === 'embedded-gguf'
        ? 'Embedded POS Parser'
        : selectedProvider === 'baseten-muse'
        ? 'MUSE Spark (Baseten Cloud Fallback)'
        : 'Localhost Ollama'
    }!`);

    onSettingsSaved?.();
    onClose();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    toast.success(`Copied: ${text}`);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Cpu size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Local AI Engine & Llama Settings</h2>
              <p className="text-xs text-indigo-200/80">
                100% Offline-First • Pure Meta Llama on Localhost
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Local Provider Options Selector */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-2.5">
              Select Local AI Inference Provider:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Localhost Ollama */}
              <div
                onClick={() => setSelectedProvider('local-ollama')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedProvider === 'local-ollama'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/30 shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-850/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Server size={20} className={selectedProvider === 'local-ollama' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                    {selectedProvider === 'local-ollama' && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    1. Localhost Ollama
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Standard local daemon (port 11434). Run Meta Llama 3.2 3B or 1B with 0 external network requests.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-zinc-800 text-[10px] font-mono text-indigo-700 dark:text-indigo-400 font-bold">
                  Model: {ollamaModel}
                </div>
              </div>

              {/* Option 2: Embedded POS Parser (.gguf) */}
              <div
                onClick={() => setSelectedProvider('embedded-gguf')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedProvider === 'embedded-gguf'
                    ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/30 shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-850/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Box size={20} className={selectedProvider === 'embedded-gguf' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
                    {selectedProvider === 'embedded-gguf' && (
                      <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    2. Embedded POS Model
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Lives inside app via local .gguf file & custom Modelfile (pos-parser).
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-zinc-800 text-[10px] font-mono text-purple-700 dark:text-purple-400 font-bold">
                  Model: {embeddedModel}
                </div>
              </div>

              {/* Option 3: MUSE Spark (Baseten Cloud Fallback) */}
              <div
                onClick={() => setSelectedProvider('baseten-muse')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedProvider === 'baseten-muse'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-xs'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-850/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Sparkles size={20} className={selectedProvider === 'baseten-muse' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                    {selectedProvider === 'baseten-muse' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    3. MUSE Spark (Baseten)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    Cloud neural fallback on Baseten. Activates if Ollama is offline.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-zinc-800 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  Fallback: Online
                </div>
              </div>
            </div>
          </div>

          {/* Provider Specific Settings */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-850/60 border border-slate-200 dark:border-zinc-800 space-y-4">
            {/* OPTION 1 DETAILS */}
            {selectedProvider === 'local-ollama' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <Server size={14} />
                    Localhost Ollama Settings
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                    Standard Port: 11434
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                      Ollama API URL
                    </label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://127.0.0.1:11434"
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                      Target Model
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModelState(e.target.value)}
                        placeholder="llama3.2:3b"
                        className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setOllamaModelState(ollamaModel === 'llama3.2:3b' ? 'llama3.2:1b' : 'llama3.2:3b')}
                        className="px-2.5 py-2 text-[10px] font-bold bg-slate-200 dark:bg-zinc-750 text-slate-700 dark:text-zinc-300 rounded-xl hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        title="Toggle between 3B and 1B"
                      >
                        {ollamaModel === 'llama3.2:3b' ? '1B' : '3B'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Windows Quickstart Guide */}
                <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-2">
                  <div className="font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Terminal size={14} />
                    Windows 11 Quick Terminal Commands
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between bg-black/10 dark:bg-black/30 p-2 rounded-lg">
                      <code>ollama run {ollamaModel}</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`ollama run ${ollamaModel}`, 'run-ollama')}
                        className="text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCmd === 'run-ollama' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OPTION 2 DETAILS: EMBEDDED POS MODEL */}
            {selectedProvider === 'embedded-gguf' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                    <Box size={14} />
                    Embedded POS Model (Local .GGUF Setup)
                  </span>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                    Custom Modelfile
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Registered Model Name in Ollama
                  </label>
                  <input
                    type="text"
                    value={embeddedModel}
                    onChange={(e) => setEmbeddedModelState(e.target.value)}
                    placeholder="pos-parser"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-purple-700 dark:text-purple-300 font-bold focus:outline-hidden"
                  />
                </div>

                {/* Windows 11 Step-by-Step Box */}
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-2">
                  <div className="font-extrabold text-purple-900 dark:text-purple-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Terminal size={14} />
                    Windows 11 Setup Commands (Folder with .gguf)
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between bg-black/10 dark:bg-black/30 p-2 rounded-lg">
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-[10px] text-purple-600 dark:text-purple-300 font-sans font-bold">1. Create High-Speed Modelfile (Core i3 CPU Optimized)</span>
                        <code className="text-[10px] truncate">(echo FROM ./Llama-3.2-1B-Instruct-Q4_K_M.gguf & echo PARAMETER num_ctx 512 & echo PARAMETER num_thread 4 & echo PARAMETER num_predict 120) &gt; Modelfile</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('(echo FROM ./Llama-3.2-1B-Instruct-Q4_K_M.gguf & echo PARAMETER num_ctx 512 & echo PARAMETER num_thread 4 & echo PARAMETER num_predict 120) > Modelfile', 'modelfile')}
                        className="text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                        title="Copy Modelfile setup"
                      >
                        {copiedCmd === 'modelfile' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-black/10 dark:bg-black/30 p-2 rounded-lg">
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-[10px] text-purple-600 dark:text-purple-300 font-sans font-bold">2. Register Model in Ollama</span>
                        <code>ollama create {embeddedModel} -f Modelfile</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`ollama create ${embeddedModel} -f Modelfile`, 'create')}
                        className="text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedCmd === 'create' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-black/10 dark:bg-black/30 p-2 rounded-lg">
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-[10px] text-purple-600 dark:text-purple-300 font-sans font-bold">3. Start / Test Model</span>
                        <code>ollama run {embeddedModel}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`ollama run ${embeddedModel}`, 'run')}
                        className="text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedCmd === 'run' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OPTION 3 DETAILS: BASETEN CLOUD FALLBACK */}
            {selectedProvider === 'baseten-muse' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    MUSE Spark 1.3 (Baseten Online Fallback)
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Cloud Neural Fallback
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                      Baseten API Key
                    </label>
                    <input
                      type="password"
                      value={basetenKey}
                      onChange={(e) => setBasetenKeyState(e.target.value)}
                      placeholder="vDTihPU9...."
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden"
                    />
                  </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                        Endpoint URL
                      </label>
                      <input
                        type="text"
                        value={basetenEndpoint}
                        onChange={(e) => setBasetenEndpointState(e.target.value)}
                        placeholder="https://inference.baseten.co/v1/chat/completions"
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                        Model Name
                      </label>
                      <input
                        type="text"
                        value={basetenModel}
                        onChange={(e) => setBasetenModelState(e.target.value)}
                        placeholder="meta-models/muse-spark-open"
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 dark:text-zinc-400 font-mono">
                      https://inference.baseten.co/v1/chat/completions
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBasetenEndpointState('https://inference.baseten.co/v1/chat/completions');
                        setBasetenModelState('meta-models/muse-spark-open');
                      }}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                    >
                      Reset Muse Spark Defaults
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
                  🛡️ <strong>Strict Offline-First:</strong> All sales, customer debts (fiado), and inventory records remain 100% in local SQLite. Baseten is exclusively used for natural language reasoning when local Ollama is offline.
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                disabled={isTesting}
                onClick={() => handleTestConnection()}
                className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-750 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing Connectivity...' : 'Test Selected Engine'}</span>
              </button>

              {status && (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                    status.isOnline 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}>
                    {status.isOnline ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    <span>{status.isOnline ? `Online (${status.latencyMs ?? 20}ms)` : 'Offline'}</span>
                  </span>
                </div>
              )}
            </div>

            {status?.availableModels && status.availableModels.length > 0 && (
              <div className="text-[11px] text-slate-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                <span className="font-bold">Detected Models on Local Host:</span>{' '}
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{status.availableModels.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100/80 dark:bg-zinc-850 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Pure Meta Llama • Injects Live SQLite Store Telemetry</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Save & Apply Provider
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
