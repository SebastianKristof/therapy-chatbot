import { 
  MessageSquare, 
  Zap, 
  ShieldCheck, 
  Calendar, 
  HelpCircle, 
  Eye,
  MessageCircle
} from 'lucide-react';
import { MODE_DEFINITIONS } from './config/modeDefinitions';

const ICONS_BY_MODE = {
  reflect: MessageSquare,
  trigger: Zap,
  reinforce: ShieldCheck,
  prepare: Calendar,
  ask_process: HelpCircle,
  ask_experience: Eye,
  chat: MessageCircle,
};

export const MODES = MODE_DEFINITIONS.map((definition) => ({
  ...definition,
  icon: ICONS_BY_MODE[definition.id] || MessageCircle,
}));
