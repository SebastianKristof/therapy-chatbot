import { Mode } from '../types';

export interface ModeDefinition {
  id: Mode;
  title: string;
  description: string;
  initialPrompt: string;
}

export const MODE_DEFINITIONS: ModeDefinition[] = [
  {
    id: 'reflect',
    title: 'Reflect on what came up',
    description: 'Gentle guided pattern mapping for recent thoughts or sessions.',
    initialPrompt: "I'd like to reflect on what's been coming up for me lately.",
  },
  {
    id: 'trigger',
    title: 'Work through a trigger',
    description: 'Calmly map and understand an emotional trigger.',
    initialPrompt: "I experienced a trigger and I'd like to work through it.",
  },
  {
    id: 'reinforce',
    title: "Reinforce this week's progress",
    description: 'Solidify the positive changes and insights from your sessions.',
    initialPrompt: "I want to reinforce the progress I've made this week.",
  },
  {
    id: 'prepare',
    title: 'Prepare for next session',
    description: 'Clarify what matters most before your next meeting.',
    initialPrompt: "I'd like to prepare for my next session with Dr. Kristof.",
  },
  {
    id: 'ask_process',
    title: 'Ask about hypnosis or the process',
    description: 'Get clear, reassuring answers about how hypnosis works.',
    initialPrompt: 'I have a question about hypnosis or the therapeutic process.',
  },
  {
    id: 'ask_experience',
    title: "Ask about what I'm experiencing",
    description: 'Fast, calming orientation for "Is this normal?" questions.',
    initialPrompt: "I'm experiencing something and I want to know if it's normal.",
  },
];

export const SYSTEM_PROMPT_BASE = `
You are AskDrKristof, a private, structured therapeutic support companion for existing hypnosis clients.
You are an AI trained on Dr. Kristof's materials and approach.
You are NOT Dr. Kristof.
You are NOT for crisis or emergency support.

Tone:
- Calm, quiet, intelligent, private, grounded, respectful, steady.
- Not sterile, not spiritualized, not clinical in a hospital way.
- Confidently calm.
- Avoid "wellness fluff", "marketing speak", or being "cute".

Principles:
- Structured flexibility.
- Lower the effort required for the user to continue.
- Focus on psychological containment.
- Help the user leave with a useful takeaway.

Safety:
- If the user is in crisis or needs emergency help, clearly and calmly state that you are an AI and cannot provide crisis support, and provide general advice to seek professional emergency services.
`;

export function getModeDefinition(mode: Mode) {
  return MODE_DEFINITIONS.find((definition) => definition.id === mode);
}
