import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FollowUpChip, Mode } from '../src/types.js';

type GuidanceBehavior = 'adapt' | 'verbatim';
type GuidanceMode = Mode | 'any';

interface GuidanceEntry {
  id: string;
  mode: GuidanceMode;
  behavior: GuidanceBehavior;
  question: string;
  answer: string;
  followUpChips: FollowUpChip[];
  normalizedQuestion: string;
  questionTokens: Set<string>;
}

interface GuidanceMatch {
  entry: GuidanceEntry;
  score: number;
  lexicalScore: number;
  semanticScore?: number;
}

interface GuidanceFileCache {
  dataPath: string;
  mtimeMs: number;
  entries: GuidanceEntry[];
  embeddingsByEntryId: Map<string, number[]>;
}

export interface GuidanceResolution {
  verbatimResponse?: {
    text: string;
    followUpChips: FollowUpChip[];
    matchId: string;
    score: number;
  };
  guidanceContext: string;
}

const DEFAULT_GUIDANCE_DATA_PATH = path.resolve(process.cwd(), 'materials/guidance.json');
const DEFAULT_GUIDANCE_EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_VERBATIM_THRESHOLD = 0.9;
const DEFAULT_ADAPT_THRESHOLD = 0.78;
const DEFAULT_MATCH_LIMIT = 3;

const VALID_MODES = new Set<Mode>([
  'reflect',
  'trigger',
  'reinforce',
  'prepare',
  'ask_process',
  'ask_experience',
  'chat',
]);

let guidanceCache: GuidanceFileCache | null = null;

function readConfiguredValue(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return undefined;
  }

  return normalized;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseThreshold(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value || '');

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, parsed));
}

function resolveDirectoryOrFile(configuredPath: string | undefined, fallbackAbsolutePath: string) {
  const value = readConfiguredValue(configuredPath);

  if (!value) {
    return fallbackAbsolutePath;
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function isGuidanceEnabled() {
  const raw = readConfiguredValue(process.env.GUIDANCE_ENABLED);

  if (!raw) {
    return true;
  }

  return raw.toLowerCase() !== 'false';
}

function getGuidanceDataPath() {
  return resolveDirectoryOrFile(process.env.GUIDANCE_DATA_PATH, DEFAULT_GUIDANCE_DATA_PATH);
}

function getGuidanceEmbeddingModel() {
  return (
    readConfiguredValue(process.env.GUIDANCE_EMBED_MODEL) ||
    readConfiguredValue(process.env.KNOWLEDGE_EMBED_MODEL) ||
    DEFAULT_GUIDANCE_EMBED_MODEL
  );
}

function getVerbatimThreshold() {
  return parseThreshold(readConfiguredValue(process.env.GUIDANCE_VERBATIM_THRESHOLD), DEFAULT_VERBATIM_THRESHOLD);
}

function getAdaptThreshold() {
  return parseThreshold(readConfiguredValue(process.env.GUIDANCE_ADAPT_THRESHOLD), DEFAULT_ADAPT_THRESHOLD);
}

function getGuidanceMatchLimit() {
  return parsePositiveInt(readConfiguredValue(process.env.GUIDANCE_MATCH_LIMIT), DEFAULT_MATCH_LIMIT);
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string) {
  const normalized = normalizeText(value);
  const tokens = normalized.split(' ').filter(Boolean);
  return new Set(tokens);
}

function scoreLexicalSimilarity(userInput: string, candidateQuestion: string) {
  const normalizedUser = normalizeText(userInput);
  const normalizedQuestion = normalizeText(candidateQuestion);

  if (!normalizedUser || !normalizedQuestion) {
    return 0;
  }

  if (normalizedUser === normalizedQuestion) {
    return 1;
  }

  if (
    (normalizedUser.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedUser)) &&
    Math.min(normalizedUser.length, normalizedQuestion.length) >= 22
  ) {
    return 0.94;
  }

  const userTokens = tokenize(normalizedUser);
  const questionTokens = tokenize(normalizedQuestion);

  if (userTokens.size === 0 || questionTokens.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of userTokens) {
    if (questionTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = userTokens.size + questionTokens.size - intersection;

  if (union <= 0) {
    return 0;
  }

  return intersection / union;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function toNormalizedSemanticScore(cosine: number) {
  return Math.max(0, Math.min(1, (cosine + 1) / 2));
}

function isGuidanceMode(value: unknown): value is GuidanceMode {
  return value === 'any' || (typeof value === 'string' && VALID_MODES.has(value as Mode));
}

function parseFollowUpChips(value: unknown): FollowUpChip[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  const chips: FollowUpChip[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
    const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';

    if (!label || !prompt) {
      continue;
    }

    const key = `${label}::${prompt}`.toLowerCase();

    if (unique.has(key)) {
      continue;
    }

    unique.add(key);
    chips.push({
      label: label.slice(0, 48),
      prompt: prompt.slice(0, 180),
    });

    if (chips.length === 4) {
      break;
    }
  }

  return chips;
}

function parseGuidanceEntries(raw: unknown): GuidanceEntry[] {
  const rawEntries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown[] }).entries)
      ? (raw as { entries: unknown[] }).entries
      : [];

  const entries: GuidanceEntry[] = [];

  for (let index = 0; index < rawEntries.length; index += 1) {
    const item = rawEntries[index];

    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
    const answer = typeof candidate.answer === 'string' ? candidate.answer.trim() : '';

    if (!question || !answer) {
      continue;
    }

    const idValue = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const id = idValue || `guidance-${index + 1}`;
    const mode = isGuidanceMode(candidate.mode) ? candidate.mode : 'any';
    const behavior = candidate.behavior === 'verbatim' ? 'verbatim' : 'adapt';
    const normalizedQuestion = normalizeText(question);

    entries.push({
      id,
      mode,
      behavior,
      question,
      answer,
      followUpChips: parseFollowUpChips(candidate.followUpChips),
      normalizedQuestion,
      questionTokens: tokenize(normalizedQuestion),
    });
  }

  return entries;
}

async function loadGuidanceEntries() {
  if (!isGuidanceEnabled()) {
    return [] as GuidanceEntry[];
  }

  const dataPath = getGuidanceDataPath();

  if (!(await pathExists(dataPath))) {
    return [];
  }

  const fileStat = await stat(dataPath);

  if (guidanceCache && guidanceCache.dataPath === dataPath && guidanceCache.mtimeMs === fileStat.mtimeMs) {
    return guidanceCache.entries;
  }

  try {
    const rawContents = await readFile(dataPath, 'utf8');
    const parsed = JSON.parse(rawContents) as unknown;
    const entries = parseGuidanceEntries(parsed);
    guidanceCache = {
      dataPath,
      mtimeMs: fileStat.mtimeMs,
      entries,
      embeddingsByEntryId: new Map<string, number[]>(),
    };
    return entries;
  } catch (error) {
    console.warn('Failed to parse guidance data. Skipping guidance matching for now.', error);
    return [];
  }
}

function extractOpenAIErrorMessage(rawBody: string) {
  try {
    const parsed = JSON.parse(rawBody) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || rawBody;
  } catch {
    return rawBody;
  }
}

async function embedTexts(texts: string[]) {
  const apiKey = readConfiguredValue(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for semantic guidance matching.');
  }

  if (texts.length === 0) {
    return [] as number[][];
  }

  const model = getGuidanceEmbeddingModel();
  const allEmbeddings: number[][] = [];
  const batchSize = 64;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: batch,
      }),
    });
    const rawBody = await response.text();

    if (!response.ok) {
      const message = extractOpenAIErrorMessage(rawBody);
      throw new Error(`OpenAI embeddings request failed: ${message}`);
    }

    const parsed = JSON.parse(rawBody) as { data?: Array<{ embedding?: number[] }> };
    const batchEmbeddings = Array.isArray(parsed.data) ? parsed.data.map((item) => item.embedding || []) : [];

    if (batchEmbeddings.length !== batch.length || batchEmbeddings.some((embedding) => embedding.length === 0)) {
      throw new Error('OpenAI embeddings response was invalid.');
    }

    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}

async function ensureCachedEmbeddings(entries: GuidanceEntry[]) {
  if (!guidanceCache || entries.length === 0) {
    return false;
  }

  if (!readConfiguredValue(process.env.OPENAI_API_KEY)) {
    return false;
  }

  const missing = entries.filter((entry) => !guidanceCache?.embeddingsByEntryId.has(entry.id));

  if (missing.length === 0) {
    return true;
  }

  try {
    const embeddings = await embedTexts(missing.map((entry) => entry.question));

    missing.forEach((entry, index) => {
      const vector = embeddings[index];

      if (vector && vector.length > 0) {
        guidanceCache?.embeddingsByEntryId.set(entry.id, vector);
      }
    });

    return true;
  } catch (error) {
    console.warn('Semantic guidance embeddings are unavailable. Falling back to lexical matching only.', error);
    return false;
  }
}

function isModeMatch(entryMode: GuidanceMode, activeMode: Mode) {
  return entryMode === 'any' || entryMode === activeMode;
}

function combineSimilarityScores(lexicalScore: number, semanticScore?: number) {
  if (semanticScore === undefined) {
    return lexicalScore;
  }

  return semanticScore * 0.72 + lexicalScore * 0.28;
}

function buildFallbackFollowUpChips(): FollowUpChip[] {
  return [
    {
      label: 'Go deeper',
      prompt: 'I want to go a bit deeper on this.',
    },
    {
      label: 'Make it practical',
      prompt: 'Can you make this practical for my next session?',
    },
  ];
}

function buildGuidanceContext(matches: GuidanceMatch[]) {
  if (matches.length === 0) {
    return '';
  }

  return matches
    .map(
      (match, index) => `
[${index + 1}] Guidance ID: ${match.entry.id}
Mode: ${match.entry.mode}
Behavior: ${match.entry.behavior}
When user asks: ${match.entry.question}
Preferred response pattern:
${match.entry.answer}
`,
    )
    .join('\n')
    .trim();
}

export async function resolveGuidanceForTurn({
  mode,
  userInput,
}: {
  mode: Mode;
  userInput: string;
}): Promise<GuidanceResolution> {
  const normalizedInput = userInput.trim();

  if (!normalizedInput) {
    return { guidanceContext: '' };
  }

  const allEntries = await loadGuidanceEntries();

  if (allEntries.length === 0) {
    return { guidanceContext: '' };
  }

  const entries = allEntries.filter((entry) => isModeMatch(entry.mode, mode));

  if (entries.length === 0) {
    return { guidanceContext: '' };
  }

  const canUseSemantic = await ensureCachedEmbeddings(entries);
  let queryEmbedding: number[] | undefined;

  if (canUseSemantic) {
    try {
      const [embedding] = await embedTexts([normalizedInput]);
      queryEmbedding = embedding;
    } catch (error) {
      console.warn('Query embedding failed for guidance matching. Using lexical score only.', error);
    }
  }

  const matches: GuidanceMatch[] = entries
    .map((entry) => {
      const lexicalScore = scoreLexicalSimilarity(normalizedInput, entry.normalizedQuestion);
      let semanticScore: number | undefined;

      if (queryEmbedding && guidanceCache?.embeddingsByEntryId.has(entry.id)) {
        const entryEmbedding = guidanceCache.embeddingsByEntryId.get(entry.id);

        if (entryEmbedding) {
          semanticScore = toNormalizedSemanticScore(cosineSimilarity(queryEmbedding, entryEmbedding));
        }
      }

      return {
        entry,
        lexicalScore,
        semanticScore,
        score: combineSimilarityScores(lexicalScore, semanticScore),
      };
    })
    .sort((left, right) => right.score - left.score);

  const verbatimThreshold = getVerbatimThreshold();
  const adaptThreshold = getAdaptThreshold();
  const matchLimit = getGuidanceMatchLimit();
  const verbatimMatch = matches.find((match) => match.entry.behavior === 'verbatim' && match.score >= verbatimThreshold);

  if (verbatimMatch) {
    return {
      verbatimResponse: {
        text: verbatimMatch.entry.answer,
        followUpChips:
          verbatimMatch.entry.followUpChips.length > 0
            ? verbatimMatch.entry.followUpChips
            : buildFallbackFollowUpChips(),
        matchId: verbatimMatch.entry.id,
        score: verbatimMatch.score,
      },
      guidanceContext: '',
    };
  }

  const adaptMatches = matches
    .filter((match) => match.entry.behavior === 'adapt' && match.score >= adaptThreshold)
    .slice(0, matchLimit);

  return {
    guidanceContext: buildGuidanceContext(adaptMatches),
  };
}
