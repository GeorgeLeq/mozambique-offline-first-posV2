import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Mic, MicOff, Square, Loader2, Sparkles, AlertCircle, ShieldCheck, DatabaseZap } from 'lucide-react';
import { useAudioRecorder } from '../../lib/ai/useAudioRecorder';
import { transcribeAudio, VoiceContextMode } from '../../lib/ai/museVoiceClient';
import { logVoiceInteraction } from '../../lib/ai/voiceAuditService';
import {
  parseSpokenCashUp,
  parsePettyCashVoice,
  parsePOSVoice,
  ParsedCashUpResult,
  ParsedPettyCashResult,
  ParsedPOSVoiceResult,
} from '../../lib/ai/voiceIntentParser';

export interface VoiceInputButtonProps {
  mode: VoiceContextMode;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  cashierId?: string | null;
  cashierName?: string;
  shiftId?: string | null;
  onTranscript?: (text: string) => void;
  onParsedCashUp?: (result: ParsedCashUpResult) => void;
  onParsedPettyCash?: (result: ParsedPettyCashResult) => void;
  onParsedPOSSearch?: (result: ParsedPOSVoiceResult) => void;
}

export function VoiceInputButton({
  mode,
  label,
  size = 'md',
  className = '',
  cashierId,
  cashierName,
  shiftId,
  onTranscript,
  onParsedCashUp,
  onParsedPettyCash,
  onParsedPOSSearch,
}: VoiceInputButtonProps) {
  const {
    isRecording,
    recordingDuration,
    audioLevel,
    error: recorderError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastAuditStatus, setLastAuditStatus] = useState<'offline_queued' | 'synced' | null>(null);

  // Handle start recording
  const handleToggleRecord = async () => {
    setErrorMessage(null);
    if (!isRecording) {
      const success = await startRecording();
      if (!success) {
        setErrorMessage('Não foi possível ativar o microfone.');
      }
    } else {
      setIsProcessing(true);
      try {
        const audioBlob = await stopRecording();
        if (audioBlob && audioBlob.size > 0) {
          const result = await transcribeAudio(audioBlob, mode);
          const text = result.text.trim();
          setLastTranscript(text);

          if (result.isOffline || !text) {
            setErrorMessage('MUSE Transcribe Offline. Conexão necessária.');
            toast.error('MUSE Transcribe está offline. Conecte-se à internet para usar a IA de voz.');
            return;
          }

          if (text) {
            onTranscript?.(text);

            let parsedEntities: any = null;
            if (mode === 'cash_up') {
              const parsed = parseSpokenCashUp(text);
              onParsedCashUp?.(parsed);
              parsedEntities = parsed;
            } else if (mode === 'petty_cash') {
              const parsed = parsePettyCashVoice(text);
              onParsedPettyCash?.(parsed);
              parsedEntities = parsed;
            } else if (mode === 'pos_search') {
              const parsed = parsePOSVoice(text);
              onParsedPOSSearch?.(parsed);
              parsedEntities = parsed;
            }

            // Encrypt and persist to local SQLite store-and-forward queue
            await logVoiceInteraction({
              shiftId,
              cashierId,
              cashierName,
              featureContext: mode,
              transcribedText: text,
              parsedEntities: parsedEntities || undefined,
              audioDurationSeconds: result.durationSeconds,
              confidenceScore: result.confidence,
              isMock: false,
              isOffline: false,
            });

            setLastAuditStatus('synced');
          }
        }
      } catch (err: any) {
        console.error('[VoiceInputButton] Processing error:', err);
        setErrorMessage('Erro ao transcrever áudio com Muse AI.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Quick Demo Simulator for rapid testing without mic noise
  const handleSimulateDemo = async (presetText: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    // Simulate brief latency
    await new Promise((r) => setTimeout(r, 400));
    setLastTranscript(presetText);
    onTranscript?.(presetText);

    let parsedEntities: any = null;
    if (mode === 'cash_up') {
      const parsed = parseSpokenCashUp(presetText);
      onParsedCashUp?.(parsed);
      parsedEntities = parsed;
    } else if (mode === 'petty_cash') {
      const parsed = parsePettyCashVoice(presetText);
      onParsedPettyCash?.(parsed);
      parsedEntities = parsed;
    } else if (mode === 'pos_search') {
      const parsed = parsePOSVoice(presetText);
      onParsedPOSSearch?.(parsed);
      parsedEntities = parsed;
    }

    // Encrypt and persist simulated demo voice log as well
    await logVoiceInteraction({
      shiftId,
      cashierId,
      cashierName,
      featureContext: mode,
      transcribedText: presetText,
      parsedEntities: parsedEntities || undefined,
      audioDurationSeconds: 4,
      confidenceScore: 0.98,
      isMock: true,
      isOffline: !navigator.onLine,
    });

    setLastAuditStatus(!navigator.onLine ? 'offline_queued' : 'synced');
    setIsProcessing(false);
  };

  // Format recording seconds as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const buttonSizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5 rounded-lg',
    md: 'px-3.5 py-2 text-xs font-bold gap-2 rounded-xl',
    lg: 'px-5 py-3 text-sm font-black gap-2.5 rounded-2xl',
  }[size];

  return (
    <div className={`relative inline-flex flex-col items-start ${className}`}>
      {/* Main Mic Button */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggleRecord}
          disabled={isProcessing}
          className={`relative cursor-pointer transition-all border flex items-center shadow-xs select-none ${buttonSizeStyles} ${
            isRecording
              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 ring-4 ring-rose-500/30 animate-pulse'
              : isProcessing
              ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
              : 'bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-zinc-700 hover:border-indigo-500'
          }`}
          title={isRecording ? 'Clique para parar e transcrever' : 'Clique para falar por voz'}
        >
          {isProcessing ? (
            <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          ) : isRecording ? (
            <Square size={14} className="fill-white" />
          ) : (
            <Mic size={16} className="text-indigo-600 dark:text-indigo-400" />
          )}

          <span>
            {isProcessing
              ? 'A transcrever com Muse AI...'
              : isRecording
              ? `A gravar (${formatTime(recordingDuration)})`
              : label || 'Ditar por Voz'}
          </span>

          {/* Live Wave Meter when recording */}
          {isRecording && (
            <div className="flex items-center gap-0.5 ml-1">
              <span
                className="w-1 bg-white rounded-full transition-all"
                style={{ height: `${Math.max(4, Math.min(18, (audioLevel / 100) * 18))}px` }}
              />
              <span
                className="w-1 bg-white rounded-full transition-all"
                style={{ height: `${Math.max(4, Math.min(18, (audioLevel / 80) * 18))}px` }}
              />
              <span
                className="w-1 bg-white rounded-full transition-all"
                style={{ height: `${Math.max(4, Math.min(18, (audioLevel / 120) * 18))}px` }}
              />
            </div>
          )}
        </button>

        {/* Cancel button while recording */}
        {isRecording && (
          <button
            type="button"
            onClick={cancelRecording}
            className="p-2 rounded-xl bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-300 cursor-pointer"
            title="Cancelar gravação"
          >
            <MicOff size={14} />
          </button>
        )}
      </div>

      {/* Error Banner */}
      {(recorderError || errorMessage) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
          <AlertCircle size={12} className="shrink-0" />
          <span>{recorderError || errorMessage}</span>
        </div>
      )}

      {/* Recent Recognized Transcript Indicator */}
      {lastTranscript && !isRecording && !isProcessing && (
        <div className="mt-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-zinc-400 font-mono">
            <Sparkles size={11} className="text-indigo-500 shrink-0" />
            <span className="truncate max-w-[260px] italic">"{lastTranscript}"</span>
          </div>

          {lastAuditStatus === 'offline_queued' && (
            <div className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/80 dark:border-amber-800/50">
              <DatabaseZap size={10} className="text-amber-600 animate-pulse shrink-0" />
              <span>Offline: Salvo e Criptografado no SQLite</span>
            </div>
          )}

          {lastAuditStatus === 'synced' && (
            <div className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/50">
              <ShieldCheck size={10} className="text-emerald-600 shrink-0" />
              <span>Criptografado AES-256 & Auditado</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
