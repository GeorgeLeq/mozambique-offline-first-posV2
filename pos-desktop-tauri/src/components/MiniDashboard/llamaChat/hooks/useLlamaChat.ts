/**
 * @file useLlamaChat.ts
 * @description Centralized business logic hook for Muse Agent Llama Chat Modal.
 */

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { MuseChatMessage, MuseAgentChatModalProps, getWelcomeMessage } from '../types';
import { 
  askStoreSentinel, 
  fetchStoreTelemetrySnapshot, 
  StoreTelemetrySnapshot 
} from '../../../../lib/ai/storeSentinelClient';
import { 
  getActiveAiDisplayName, 
  checkAiEngineStatus, 
  AiEngineStatus 
} from '../../../../lib/ai/unifiedAiClient';
import { useAuth } from '../../../../contexts/AuthContext';

export function useLlamaChat({
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const [pacing, setPacing] = useState<'fast' | 'balanced' | 'detailed'>(() => {
    try {
      const saved = localStorage.getItem('sycomm_ai_pacing_mode');
      if (saved === 'fast' || saved === 'balanced' || saved === 'detailed') return saved;
    } catch {}
    return 'balanced';
  });

  const handleShortcutNav = (tab: string) => {
    window.dispatchEvent(new CustomEvent('ai-navigated-shortcut', { detail: { tab } }));
    if (onNavigateTab) {
      onClose();
      onNavigateTab(tab);
    }
  };

  const handlePacingChange = (newPacing: 'fast' | 'balanced' | 'detailed') => {
    setPacing(newPacing);
    try {
      localStorage.setItem('sycomm_ai_pacing_mode', newPacing);
    } catch {}
    toast.success(
      newPacing === 'fast' 
        ? 'Pacing set to Fast (1-2 lines) ⚡' 
        : newPacing === 'detailed' 
        ? 'Pacing set to Detailed (in-depth) 📝' 
        : 'Pacing set to Balanced (2-3 bullets) ⚖️'
    );
  };

  // Load telemetry, AI status, and initial message / saved chat
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

  // Persist session messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('sycomm_ai_chat_history', JSON.stringify(messages.slice(-40)));
      } catch {}
    }
  }, [messages]);

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

  const handleCopyEntireChat = () => {
    if (messages.length === 0) return;
    const transcript = messages.map(m => {
      const sender = m.sender === 'user' ? 'Operator' : 'Store Sentinel AI';
      return `[${m.timestamp}] ${sender}:\n${m.text}`;
    }).join('\n\n------------------------\n\n');
    navigator.clipboard.writeText(transcript);
    toast.success('Transcrição da conversa copiada! / Chat transcript copied');
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Mensagem copiada / Message copied');
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    toast('Geração cancelada / Generation stopped', { icon: '🛑' });
  };

  // Keyboard shortcut: Escape cancels generation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        handleCancelGeneration();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

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

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => Number((prev + 0.1).toFixed(1)));
    }, 100);

    let accumulatedText = '';

    try {
      const response = await askStoreSentinel(q, {
        inputType: 'text',
        lang,
        pacing,
        signal: abortController.signal,
        currentUser: currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          terminal_name: currentUser.terminal_name
        } : null,
        chatHistory,
        onChunk: (chunk: string) => {
          if (!chunk) return;
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
      const isAborted = abortController.signal.aborted || err?.name === 'AbortError' || err?.message?.includes('aborted');
      setMessages(prev => prev.map(msg => {
        if (msg.id === astId) {
          return {
            ...msg,
            text: isAborted
              ? (accumulatedText ? `${accumulatedText}\n\n*[Geração interrompida pelo operador]*` : 'Geração interrompida pelo operador.')
              : (accumulatedText || `Error communicating with AI Copilot: ${err.message || 'Connection failure.'}`),
            isOffline: !isAborted,
            responseTimeMs: durationMs
          };
        }
        return msg;
      }));
    } finally {
      abortControllerRef.current = null;
      clearInterval(timerInterval);
      setIsLoading(false);
    }
  };

  const refreshTelemetry = () => {
    fetchStoreTelemetrySnapshot().then(snap => setTelemetry(snap)).catch(() => {});
  };

  return {
    currentUser,
    messages,
    setMessages,
    inputText,
    setInputText,
    isLoading,
    elapsedSeconds,
    telemetry,
    refreshTelemetry,
    isKeyModalOpen,
    setIsKeyModalOpen,
    aiInfo,
    setAiInfo,
    engineStatus,
    setEngineStatus,
    pacing,
    handlePacingChange,
    handleShortcutNav,
    handleClearChat,
    handleCopyEntireChat,
    handleCopyMessage,
    handleCancelGeneration,
    handleSendQuery
  };
}
