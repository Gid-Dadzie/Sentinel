import {
  ArrowDownToLine,
  Banknote,
  Globe,
  Layers,
  Moon,
  PhoneCall,
  Plane,
  Smartphone,
  Store,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { RuleId } from '../types';

/** One icon per rule, used wherever a rule is named so it is recognisable at a glance. */
export const RULE_ICONS: Record<RuleId, LucideIcon> = {
  amount: Banknote,
  time: Moon,
  country: Globe,
  device: Smartphone,
  rapid: Zap,
  travel: Plane,
  cashout: ArrowDownToLine,
  recipients: Users,
  agent: Store,
  airtime: PhoneCall,
  structuring: Layers,
};
