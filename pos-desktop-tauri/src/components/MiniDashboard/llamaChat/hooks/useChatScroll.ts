/**
 * @file useChatScroll.ts
 * @description Hook managing auto-scroll behavior, scroll listeners, and horizontal suggestions scroll.
 */

import { useRef, useEffect } from 'react';
import { MuseChatMessage } from '../types';

export function useChatScroll(messages: MuseChatMessage[], isLoading: boolean) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabledRef = useRef<boolean>(true);
  const rafScrollRef = useRef<number | null>(null);

  // Scroll listener to detect when user intentionally scrolls up to inspect history
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

  const handleScrollSuggestions = (direction: 'left' | 'right') => {
    if (suggestionsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -250 : 250;
      suggestionsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isAutoScrollEnabledRef.current) return;

    if (isLoading) {
      if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
      rafScrollRef.current = requestAnimationFrame(() => {
        if (chatContainerRef.current && isAutoScrollEnabledRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
    } else {
      scrollToBottom('smooth');
    }

    return () => {
      if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
    };
  }, [messages, isLoading]);

  return {
    chatContainerRef,
    messagesEndRef,
    suggestionsContainerRef,
    handleContainerScroll,
    scrollToBottom,
    handleScrollSuggestions
  };
}
