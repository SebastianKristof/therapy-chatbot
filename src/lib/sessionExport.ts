import type { Message } from '../types';

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

export function buildTranscriptMarkdown(messages: Message[], title: string, summary?: string) {
  const lines = [
    `# ${title}`,
    '',
    `Generated: ${new Date().toLocaleString()}`,
  ];

  if (summary) {
    lines.push('', '## Summary', '', summary);
  }

  lines.push('', '## Transcript', '');

  for (const message of messages) {
    lines.push(
      `**${message.role === 'assistant' ? 'AskDrKristof' : 'You'}** (${formatTimestamp(message.timestamp)})`,
      '',
      message.content,
      '',
    );
  }

  return lines.join('\n');
}
