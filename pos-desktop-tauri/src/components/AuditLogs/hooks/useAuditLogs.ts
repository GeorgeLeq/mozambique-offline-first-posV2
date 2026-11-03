import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDB } from '../../../lib/db';
import { sanitizeString } from '../../../lib/security/sanitizer';
import { AuditLog, AuditCategory, AuditDateRange, AuditStats } from '../types';
import toast from 'react-hot-toast';

export const getActionCategory = (action: string): AuditCategory => {
  const act = (action || '').toUpperCase();
  if (act.includes('MUSE') || act.includes('AI_') || act.includes('VOICE') || act.includes('COMPANION') || act.includes('SPARK')) {
    return 'Comandos IA & App Móvel';
  }
  if (act.includes('PRODUCT') || act.includes('ALIAS') || act.includes('STOCK')) {
    return 'Produtos';
  }
  if (act.includes('SALE') || act.includes('DISCOUNT') || act.includes('VOID') || act.includes('RECEIPT')) {
    return 'Vendas';
  }
  if (act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('SESSION')) {
    return 'Sessão / Login';
  }
  if (act.includes('CASHIER') || act.includes('USER') || act.includes('PERMISSION') || act.includes('PIN')) {
    return 'Operadores & Caixa';
  }
  if (act.includes('RESTOCK') || act.includes('DELIVERY') || act.includes('ORDER') || act.includes('PURCHASE')) {
    return 'Reabastecimento';
  }
  return 'Geral';
};

export const isCriticalAction = (action: string): boolean => {
  const act = (action || '').toUpperCase();
  return (
    act.includes('DELETE') ||
    act.includes('VOID') ||
    act.includes('DISCOUNT') ||
    act.includes('PERMISSION') ||
    act.includes('PIN') ||
    act.includes('FAIL') ||
    act.includes('BLOCKED') ||
    act.includes('PRICE_OVERRIDE') ||
    act.includes('DRAWER')
  );
};

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>('Todos');
  const [dateRange, setDateRange] = useState<AuditDateRange>('all');
  const [highlightedLogId, setHighlightedLogId] = useState<string | null>(null);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const db = await getDB();
      const loadedLogs = (await db.select('SELECT * FROM audit_logs ORDER BY created_at DESC')) as AuditLog[];

      // Also pull AI & Companion App commands so the manager sees full trail of voice/text actions
      let aiLogsAsAudits: AuditLog[] = [];
      try {
        const aiCommands = (await db.select('SELECT * FROM ai_command_logs ORDER BY created_at DESC LIMIT 50')) as any[];
        aiLogsAsAudits = (aiCommands || []).map((cmd) => {
          const originLabel = cmd.device_origin === 'companion_app' ? 'App Móvel (Boss on the Go)' : 'POS Balcão';
          const typeLabel = cmd.input_type === 'voice' ? 'Voz Muse' : 'Texto';
          return {
            id: cmd.id,
            user_id: cmd.user_id || 'ai-assistant',
            user_name: cmd.user_name || originLabel,
            action: `MUSE_AI_${(cmd.tool_called || cmd.detected_intent || 'COMMAND').toUpperCase()}`,
            details: `[${originLabel} - ${typeLabel}] "${cmd.raw_input || cmd.transcription || ''}". Estado: ${cmd.execution_status}`,
            created_at: cmd.created_at || cmd.client_timestamp,
            sync_status: cmd.sync_status ?? 1,
          };
        });
      } catch (err) {
        console.warn('Could not load ai_command_logs into audits:', err);
      }

      // Merge and deduplicate by ID, then sort DESC
      const existingAuditIds = new Set((loadedLogs || []).map((l) => l.id));
      const combined = [...(loadedLogs || [])];
      for (const aiL of aiLogsAsAudits) {
        if (!existingAuditIds.has(aiL.id)) {
          combined.push(aiL);
        }
      }
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLogs(combined);

      const loadedUsers = (await db.select('SELECT id, name FROM users')) as { id: string; name: string }[];
      const mapping: Record<string, string> = {};
      if (Array.isArray(loadedUsers)) {
        loadedUsers.forEach((u) => {
          mapping[u.id] = u.name;
        });
      }
      setUserMap(mapping);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
      toast.error('Erro ao carregar registos de auditoria');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, dateRange]);

  // Filter logs locally
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const page = getActionCategory(log.action);
      const matchesCategory = selectedCategory === 'Todos' || page === selectedCategory;

      const uName = log.user_name || userMap[log.user_id] || log.user_id || 'System';
      const cleanSearch = sanitizeString(searchTerm).toLowerCase();
      const matchesSearch = 
        !cleanSearch ||
        log.action.toLowerCase().includes(cleanSearch) ||
        (log.details && log.details.toLowerCase().includes(cleanSearch)) ||
        uName.toLowerCase().includes(cleanSearch) ||
        (log.id && log.id.toLowerCase().includes(cleanSearch)) ||
        (log.user_id && log.user_id.toLowerCase().includes(cleanSearch));

      let matchesDate = true;
      if (dateRange !== 'all') {
        const logDate = new Date(log.created_at);
        const now = new Date();
        if (dateRange === 'today') {
          matchesDate = logDate.toDateString() === now.toDateString();
        } else if (dateRange === 'week') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          matchesDate = logDate >= sevenDaysAgo;
        } else if (dateRange === 'month') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          matchesDate = logDate >= thirtyDaysAgo;
        }
      }

      return matchesCategory && matchesSearch && matchesDate;
    });
  }, [logs, selectedCategory, searchTerm, userMap, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Todos: logs.length,
      Produtos: 0,
      Vendas: 0,
      'Sessão / Login': 0,
      'Operadores & Caixa': 0,
      Reabastecimento: 0,
      Geral: 0
    };
    logs.forEach(l => {
      const cat = getActionCategory(l.action);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.Geral++;
      }
    });
    return counts;
  }, [logs]);

  // Summary statistics
  const stats: AuditStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    let todayCount = 0;
    let criticalCount = 0;
    let syncedCount = 0;
    let pendingSyncCount = 0;
    const operatorSet = new Set<string>();

    logs.forEach(l => {
      if (new Date(l.created_at).toDateString() === todayStr) {
        todayCount++;
      }
      if (isCriticalAction(l.action)) {
        criticalCount++;
      }
      if (l.sync_status === 1) {
        syncedCount++;
      } else {
        pendingSyncCount++;
      }
      if (l.user_id) {
        operatorSet.add(l.user_id);
      }
    });

    return {
      totalLogs: logs.length,
      todayLogsCount: todayCount,
      criticalCount,
      syncedCount,
      pendingSyncCount,
      uniqueOperatorsCount: operatorSet.size
    };
  }, [logs]);

  const exportCSV = useCallback(() => {
    try {
      if (filteredLogs.length === 0) {
        toast.error('Nenhum registo para exportar');
        return;
      }
      const headers = ['ID', 'Data/Hora', 'Ação', 'Categoria', 'Operador', 'Detalhes', 'Status Sincronização'];
      const rows = filteredLogs.map(l => [
        `"${l.id}"`,
        `"${new Date(l.created_at).toLocaleString('pt-PT')}"`,
        `"${l.action.replace(/"/g, '""')}"`,
        `"${getActionCategory(l.action)}"`,
        `"${(l.user_name || userMap[l.user_id] || l.user_id || 'Sistema').replace(/"/g, '""')}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.sync_status === 1 ? 'Sincronizado' : 'Local SQLite'}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `auditoria_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Ficheiro CSV exportado com sucesso!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro ao exportar CSV');
    }
  }, [filteredLogs, userMap]);

  return {
    logs,
    filteredLogs,
    paginatedLogs,
    userMap,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    dateRange,
    setDateRange,
    highlightedLogId,
    setHighlightedLogId,
    selectedLogForDetails,
    setSelectedLogForDetails,
    isLoading,
    currentPage,
    setCurrentPage,
    totalPages,
    categoryCounts,
    stats,
    loadLogs,
    exportCSV
  };
}
