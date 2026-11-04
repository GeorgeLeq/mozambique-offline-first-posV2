/**
 * @file index.tsx
 * @description Main LlamaChat Modal Component assembled from modular sub-components and custom hooks.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Bot, Sparkles, Timer, Square } from 'lucide-react';
import { MuseAgentChatModalProps } from './types';
import { useLlamaChat } from './hooks/useLlamaChat';
import { useChatScroll } from './hooks/useChatScroll';
import { LlamaChatHeader } from './components/LlamaChatHeader';
import { LlamaTelemetrySidebar } from './components/LlamaTelemetrySidebar';
import { LlamaChatMessageItem } from './components/LlamaChatMessageItem';
import { LlamaChatInputBar } from './components/LlamaChatInputBar';
import { AiSettingsModal } from '../AiSettingsModal';
import { getActiveAiDisplayName, checkAiEngineStatus } from '../../../lib/ai/unifiedAiClient';

export function MuseAgentChatModal(props: MuseAgentChatModalProps) {
  const {
    isOpen,
    onClose,
    lang = 'en'
  } = props;

  const chat = useLlamaChat(props);
  const scroll = useChatScroll(chat.messages, chat.isLoading);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 w-screen h-screen z-[999999] flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans transition-colors duration-300 isolate">
      {/* Top Header */}
      <LlamaChatHeader
        title={chat.aiInfo.title}
        engineStatus={chat.engineStatus}
        pacing={chat.pacing}
        onClose={onClose}
        onOpenSettings={() => chat.setIsKeyModalOpen(true)}
        onCopyChat={chat.handleCopyEntireChat}
        onClearChat={chat.handleClearChat}
        onPacingChange={chat.handlePacingChange}
      />

      {/* Main Fullscreen Body: Telemetry Sidebar + Chat Canvas */}
      <div className="flex-1 flex overflow-hidden">
        <LlamaTelemetrySidebar
          telemetry={chat.telemetry}
          onRefreshTelemetry={chat.refreshTelemetry}
        />

        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/40 dark:bg-zinc-950/60 transition-colors">
          <div 
            ref={scroll.chatContainerRef}
            onScroll={scroll.handleContainerScroll}
            className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-4"
          >
            {chat.messages.map((m) => (
              <LlamaChatMessageItem
                key={m.id}
                message={m}
                aiTitle={chat.aiInfo.title}
                currentUser={chat.currentUser}
                onActionExecuted={() => {
                  chat.setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, actionExecuted: true } : msg));
                  chat.refreshTelemetry();
                }}
                onNavigateShortcut={chat.handleShortcutNav}
                onCopyMessage={chat.handleCopyMessage}
              />
            ))}

            {chat.isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl rounded-bl-xs p-4 shadow-xs text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                  <span>{chat.aiInfo.title} is analyzing telemetry...</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 shadow-xs animate-pulse shrink-0">
                      <Timer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {chat.elapsedSeconds.toFixed(1)}s
                    </span>
                    <button
                      type="button"
                      onClick={chat.handleCancelGeneration}
                      className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/80 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95 shrink-0"
                      title="Cancel generation (Esc)"
                    >
                      <Square className="w-3 h-3 fill-current text-rose-600 dark:text-rose-400" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div ref={scroll.messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <LlamaChatInputBar
            inputText={chat.inputText}
            setInputText={chat.setInputText}
            isLoading={chat.isLoading}
            aiTitle={chat.aiInfo.title}
            suggestionsContainerRef={scroll.suggestionsContainerRef}
            onSendQuery={chat.handleSendQuery}
            onCancelGeneration={chat.handleCancelGeneration}
            onScrollSuggestions={scroll.handleScrollSuggestions}
          />
        </div>
      </div>

      {/* AI Settings Modal */}
      <AiSettingsModal
        isOpen={chat.isKeyModalOpen}
        onClose={() => chat.setIsKeyModalOpen(false)}
        onSettingsSaved={() => {
          chat.setAiInfo(getActiveAiDisplayName());
          checkAiEngineStatus().then(st => chat.setEngineStatus(st));
        }}
      />
    </div>,
    document.body
  );
}

export default MuseAgentChatModal;
