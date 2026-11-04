/**
 * @file LlamaChatMessageItem.tsx
 * @description Single message bubble component supporting action cards, sequential queues, highlights, and shortcuts.
 */

import React from 'react';
import { Bot, Copy, ExternalLink } from 'lucide-react';
import { MuseChatMessage } from '../types';
import { ExecutableActionCard } from '../../ExecutableActionCard';
import { SequentialActionQueue } from '../../ExecutableActionCard/components/SequentialActionQueue';

interface LlamaChatMessageItemProps {
  message: MuseChatMessage;
  aiTitle: string;
  currentUser: any;
  onActionExecuted: () => void;
  onNavigateShortcut: (tab: string) => void;
  onCopyMessage: (text: string) => void;
}

export const LlamaChatMessageItem: React.FC<LlamaChatMessageItemProps> = ({
  message: m,
  aiTitle,
  currentUser,
  onActionExecuted,
  onNavigateShortcut,
  onCopyMessage
}) => {
  return (
    <div className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
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
            onAllExecuted={onActionExecuted}
            onNavigateTab={(tab) => onNavigateShortcut(tab)}
          />
        ) : m.executableAction ? (
          <ExecutableActionCard
            action={m.executableAction}
            executed={m.actionExecuted}
            currentUser={currentUser}
            onExecuted={onActionExecuted}
            onNavigateTab={(tab) => onNavigateShortcut(tab)}
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
                onClick={() => onNavigateShortcut(act.tab)}
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
              onClick={() => onCopyMessage(m.text)}
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
              {aiTitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
