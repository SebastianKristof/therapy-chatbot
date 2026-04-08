import type { FollowUpChip } from '../types';

import starterPromptsData from '../data/supportPrompts.json';

export type SupportPrompt = FollowUpChip;

const STARTER_PROMPTS: SupportPrompt[] = starterPromptsData.starterPrompts;

export function getStarterPrompts() {
  return STARTER_PROMPTS;
}
