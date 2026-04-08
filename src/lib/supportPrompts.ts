export interface SupportPrompt {
  label: string;
  prompt: string;
}

import starterPromptsData from '../data/supportPrompts.json';

const STARTER_PROMPTS: SupportPrompt[] = starterPromptsData.starterPrompts;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ');
}

export function getStarterPrompts() {
  return STARTER_PROMPTS;
}

export function getNextSupportPrompts(lastAssistantMessage: string): SupportPrompt[] {
  const text = normalizeText(lastAssistantMessage);

  if (
    text.includes('hypnosis') ||
    text.includes('process') ||
    text.includes('normal') ||
    text.includes('common') ||
    text.includes('expect') ||
    text.includes('reassur') ||
    text.includes('concern')
  ) {
    return [
      { label: 'Explain that more simply', prompt: 'Explain that more simply.' },
      { label: 'Is this common after session?', prompt: 'Is this common after session?' },
      { label: 'What should I expect next?', prompt: 'What should I expect next?' },
      { label: 'When should I reach out?', prompt: 'When should I reach out?' },
    ];
  }

  if (
    text.includes('session') ||
    text.includes('trigger') ||
    text.includes('pattern') ||
    text.includes('reflect') ||
    text.includes('prepare') ||
    text.includes('bring this') ||
    text.includes('what changed') ||
    text.includes('next step')
  ) {
    return [
      { label: 'What pattern stands out?', prompt: 'What pattern stands out?' },
      { label: 'Bring this to session', prompt: 'Bring this to session.' },
      { label: 'What should I do next?', prompt: 'What should I do next?' },
      { label: 'Summarize the main thread', prompt: 'Summarize the main thread.' },
    ];
  }

  if (
    text.includes('feel') ||
    text.includes('stuck') ||
    text.includes('worry') ||
    text.includes('uncertain') ||
    text.includes('confused') ||
    text.includes('question')
  ) {
    return [
      { label: 'Help me name it', prompt: 'Help me name what is happening.' },
      { label: 'Go a little deeper', prompt: 'Help me go a little deeper.' },
      { label: 'What matters most?', prompt: 'What matters most here?' },
      { label: 'Summarize this', prompt: 'Summarize this.' },
    ];
  }

  return [
    { label: 'Go a little deeper', prompt: 'Help me go a little deeper.' },
    { label: 'Summarize this', prompt: 'Summarize this.' },
    { label: 'What should I do next?', prompt: 'What should I do next?' },
    { label: 'Bring this to session', prompt: 'Bring this to session.' },
  ];
}
