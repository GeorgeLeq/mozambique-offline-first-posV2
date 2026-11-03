/**
 * @file SubscriptionBadge.tsx
 * @description Header badge displaying active subscription tier (Free, Pro, or Expiring)
 * and triggering the dedicated Subscription Page.
 */

import React from 'react';
import { Crown, Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { useSubscription } from '../subscriptionContext';

interface SubscriptionBadgeProps {
  className?: string;
  showText?: boolean;
}

export function SubscriptionBadge(_props: SubscriptionBadgeProps) {
  // Subscriptions suspended for Hackathon competition: hide badge completely
  return null;
}
