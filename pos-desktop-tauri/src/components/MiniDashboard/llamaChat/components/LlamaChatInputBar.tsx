/**
 * @file LlamaChatInputBar.tsx
 * @description Bottom input bar with scrolling suggestions and text form.
 */

import React, { RefObject } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Square, Send } from 'lucide-react';
import { PROMPT_SUGGESTIONS } from '../types';

interface LlamaChatInputBarProps {
  inputText: string;
  setInputText: (val: string) => void;
  isLoading: boolean;
  aiTitle: string;
  suggestionsContainerRef: RefObject<HTMLDivElement | null>;
  onSendQuery: (query: string) => void;
  onCancelGeneration: () => void;
  onScrollSuggestions: (direction: 'left' | 'right') => void;
}

export const LlamaChatInputBar: React.FC<LlamaChatInputBarProps> = ({
  inputText,
  setInputText,
  isLoading,
  aiTitle,
  suggestionsContainerRef,
  onSendQuery,
  onCancelGeneration,
  onScrollSuggestions
}) => {
  return (
    <div className="p-4 sm:p-5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 shrink-0">
      {/* Horizontally Scrolling Suggestions */}
      <div className="max-w-4xl mx-auto mb-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onScrollSuggestions('left')}
          className="p-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-all cursor-pointer shrink-0 shadow-2xs hover:scale-105 active:scale-95"
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div 
          ref={suggestionsContainerRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 shrink-0 flex items-center gap-1 select-none mr-0.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Sugestões:</span>
          </span>
          {PROMPT_SUGGESTIONS.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => onSendQuery(sug)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-zinc-800/90 dark:hover:bg-indigo-950/70 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/90 dark:border-zinc-700/80 hover:border-indigo-300 dark:hover:border-indigo-700/70 text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sug}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onScrollSuggestions('right')}
          className="p-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition-all cursor-pointer shrink-0 shadow-2xs hover:scale-105 active:scale-95"
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <form 
        onSubmit={(e) => {
          e.preventDefault();
          onSendQuery(inputText);
        }}
        className="max-w-4xl mx-auto flex items-center gap-2.5"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask ${aiTitle} anything (e.g. Which customer bought the most products?)...`}
          className="flex-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden transition-all shadow-inner"
        />

        {isLoading ? (
          <button
            type="button"
            onClick={onCancelGeneration}
            className="px-5 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-600/30 animate-pulse shrink-0"
            title="Cancel generation (Esc)"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/30 shrink-0"
          >
            <span>Send</span>
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
};
