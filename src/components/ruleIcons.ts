import { Banknote, Globe, Moon, Plane, Smartphone, Zap, type LucideIcon } from 'lucide-react';
import type { RuleId } from '../types';

/** One icon per rule, used wherever a rule is named so it is recognisable at a glance. */
export const RULE_ICONS: Record<RuleId, LucideIcon> = {
  amount: Banknote,
  time: Moon,
  country: Globe,
  device: Smartphone,
  rapid: Zap,
  travel: Plane,
};
