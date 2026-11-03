/**
 * @file useWebSearchCard.ts
 * @description Hook managing Mozambique retail market insights search state and query execution.
 */

import { useState, useEffect } from 'react';
import { searchMarketInsights, MarketSearchResult } from '../../../../lib/ai/webSearchClient';
import toast from 'react-hot-toast';

export function useWebSearchCard(initialQuery: string) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([]);

  useEffect(() => {
    if (searchQuery && searchResults.length === 0) {
      handlePerformWebSearch();
    }
  }, [initialQuery]);

  const handlePerformWebSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    try {
      const res = await searchMarketInsights(searchQuery);
      setSearchResults(res);
    } catch (_err) {
      toast.error('Could not fetch market search results.');
    } finally {
      setIsSearching(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    handlePerformWebSearch
  };
}
