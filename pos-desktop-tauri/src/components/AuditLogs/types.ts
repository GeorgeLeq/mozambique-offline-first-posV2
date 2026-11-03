export type AuditLog = {
  id: string;
  user_id: string;
  action: string;
  details: string;
  user_name?: string;
  hash?: string;
  prev_hash?: string;
  sequence_no?: number;
  created_at: string;
  sync_status?: number;
};

export type AuditCategory = 
  | 'Todos'
  | 'Produtos'
  | 'Vendas'
  | 'Sessão / Login'
  | 'Operadores & Caixa'
  | 'Reabastecimento'
  | 'Comandos IA & App Móvel'
  | 'Geral';

export type AuditDateRange = 'all' | 'today' | 'week' | 'month';

export interface AuditStats {
  totalLogs: number;
  todayLogsCount: number;
  criticalCount: number;
  syncedCount: number;
  pendingSyncCount: number;
  uniqueOperatorsCount: number;
}
