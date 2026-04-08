export type Mode = 
  | 'reflect' 
  | 'trigger' 
  | 'reinforce' 
  | 'prepare' 
  | 'ask_process' 
  | 'ask_experience' 
  | 'chat';

export interface FollowUpChip {
  label: string;
  prompt: string;
}

export interface RagDebugKnowledgeItem {
  source: string;
  excerpt: string;
  score?: number;
  corpus: string;
  ruleType: string;
  priority: number;
}

export interface RagDebugInfo {
  mode: Mode;
  supportIntent: 'open_conversation' | 'guided_reflection' | 'process_question';
  usedVerbatimGuidance: boolean;
  guidanceMatchId?: string;
  guidanceMatchScore?: number;
  guidanceContextApplied: boolean;
  knowledgeItems: RagDebugKnowledgeItem[];
  knowledgeContextPreview: string;
}

export interface ContextSummaryPayload {
  contextSummary?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  followUpChips?: FollowUpChip[];
  ragDebug?: RagDebugInfo;
}

export interface ChatSession {
  id: string;
  mode: Mode;
  messages: Message[];
  summary?: string;
  createdAt: number;
}
