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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  followUpChips?: FollowUpChip[];
}

export interface ChatSession {
  id: string;
  mode: Mode;
  messages: Message[];
  summary?: string;
  createdAt: number;
}
