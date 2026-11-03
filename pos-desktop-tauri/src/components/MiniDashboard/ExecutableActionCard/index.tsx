/**
 * @file index.tsx
 * @description Top-level ExecutableActionCard orchestrator component.
 */

import React from 'react';
import { ExecutableActionCardProps } from './types';
import { 
  ProductActionCard, 
  UpdateProductActionCard,
  DeleteProductActionCard,
  DeliveryActionCard, 
  CustomerActionCard, 
  OperatorActionCard,
  AddToCartActionCard,
  ChangeCalculatorActionCard,
  WebSearchActionCard, 
  PromoBannerActionCard,
  AutoSavePreferenceBar 
} from './components';
import { useAutoSavePreference } from './hooks';

export const ExecutableActionCard: React.FC<ExecutableActionCardProps> = ({
  action,
  executed = false,
  currentUser,
  onExecuted,
  onNavigateTab
}) => {
  const { autoSaveEnabled, toggleAutoSave } = useAutoSavePreference();

  const isCrudAction =
    action.type === 'create_product' ||
    action.type === 'batch_create_products' ||
    action.type === 'update_product' ||
    action.type === 'create_delivery' ||
    action.type === 'create_customer' ||
    action.type === 'update_customer' ||
    action.type === 'create_operator' ||
    action.type === 'update_operator' ||
    action.type === 'add_to_cart';

  return (
    <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-indigo-200/80 dark:border-indigo-900/50 shadow-md transition-all text-xs">
      {action.type === 'create_product' && (
        <ProductActionCard
          data={action.data}
          executed={executed}
          autoSaveEnabled={autoSaveEnabled}
          currentUser={currentUser}
          onExecuted={onExecuted}
        />
      )}

      {action.type === 'batch_create_products' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-900/60 pb-2">
            <span className="font-bold text-indigo-700 dark:text-indigo-300 text-xs uppercase tracking-wider">
              Batch Staged Products ({action.data?.products?.length || 0} Items for SQLite)
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">
              Confirm or edit each item below
            </span>
          </div>
          <div className="space-y-3">
            {Array.isArray(action.data?.products) && action.data.products.map((prod, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-white dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700 shadow-2xs">
                <ProductActionCard
                  data={prod}
                  executed={executed}
                  autoSaveEnabled={autoSaveEnabled}
                  currentUser={currentUser}
                  onExecuted={onExecuted}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {action.type === 'update_product' && (
        <UpdateProductActionCard
          data={action.data}
          executed={executed}
          autoSaveEnabled={autoSaveEnabled}
          currentUser={currentUser}
          onExecuted={onExecuted}
        />
      )}

      {action.type === 'delete_product' && (
        <DeleteProductActionCard
          data={action.data}
          executed={executed}
          currentUser={currentUser}
          onExecuted={onExecuted}
        />
      )}

      {action.type === 'create_delivery' && (
        <DeliveryActionCard
          data={action.data}
          executed={executed}
          autoSaveEnabled={autoSaveEnabled}
          currentUser={currentUser}
          onExecuted={onExecuted}
        />
      )}

      {(action.type === 'create_customer' ||
        action.type === 'update_customer' ||
        action.type === 'delete_customer') && (
        <CustomerActionCard
          action={action}
          executed={executed}
          autoSaveEnabled={autoSaveEnabled}
          currentUser={currentUser}
          onExecuted={onExecuted}
        />
      )}

      {(action.type === 'create_operator' ||
        action.type === 'update_operator' ||
        action.type === 'delete_operator') && (
        <OperatorActionCard
          action={action}
          executed={executed}
          autoSaveEnabled={autoSaveEnabled}
          currentUser={currentUser}
          onExecuted={onExecuted}
        />
      )}

      {action.type === 'add_to_cart' && (
        <AddToCartActionCard
          data={action.data}
          executed={executed}
          autoSaveEnabled={autoSaveEnabled}
          currentUser={currentUser}
          onExecuted={onExecuted}
          onNavigateTab={onNavigateTab}
        />
      )}

      {action.type === 'calculate_change' && (
        <ChangeCalculatorActionCard
          data={action.data}
          executed={executed}
          currentUser={currentUser}
          onExecuted={onExecuted}
        />
      )}

      {action.type === 'web_search' && (
        <WebSearchActionCard query={action.query} />
      )}

      {action.type === 'broadcast_promo_banner' && (
        <PromoBannerActionCard
          data={action.data}
          executed={executed}
          onExecuted={onExecuted}
        />
      )}

      {isCrudAction && (
        <AutoSavePreferenceBar
          autoSaveEnabled={autoSaveEnabled}
          setAutoSaveEnabled={toggleAutoSave}
        />
      )}
    </div>
  );
};

export * from './types';
export * from './hooks';
export * from './components';
