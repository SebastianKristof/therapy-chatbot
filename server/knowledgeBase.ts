import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DocStoreStrategy,
  Document,
  MetadataMode,
  Settings,
  VectorStoreIndex,
  storageContextFromDefaults,
  type BaseNode,
  type BaseRetriever,
  type NodeWithScore,
} from 'llamaindex';
import { OpenAIEmbedding } from '@llamaindex/openai';
import type { Mode } from '../src/types.js';
import {
  hasEmbeddingCredentials,
  normalizeEmbeddingModelForProvider,
  resolveEmbeddingClientConfig,
} from './embeddingConfig.js';

const DEFAULT_KNOWLEDGE_INDEX_DIR = path.resolve(process.cwd(), 'server/data/knowledge-index');
const DEFAULT_MATERIALS_DIR = path.resolve(process.cwd(), 'materials');
const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_RETRIEVAL_TOP_K = 4;
const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_CHUNK_OVERLAP = 120;
const MAX_CONTEXT_SUMMARY_CHARS = 420;
const MAX_EXCERPT_CHARS = 420;
const REQUIRED_INDEX_FILES = ['doc_store.json', 'index_store.json', 'vector_store.json'];
const DEFAULT_CORPUS = 'general';
const DEFAULT_RULE_TYPE = 'reference';
const DEFAULT_PRIORITY = 0;
const CORPUS_WEIGHTS: Record<string, number> = {
  policy: 400,
  mode_playbook: 300,
  examples: 200,
  ux_copy: 20,
  general: 120,
};

const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.mdx',
  '.markdown',
  '.json',
  '.csv',
  '.html',
  '.htm',
]);

export interface RetrievedKnowledgeItem {
  source: string;
  excerpt: string;
  score?: number;
  corpus: string;
  ruleType: string;
  priority: number;
}

export interface KnowledgeIngestionResult {
  materialsDir: string;
  indexDir: string;
  indexedFileCount: number;
  totalCharacters: number;
  embeddingProvider: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
}

let cachedRetrieverPromise: Promise<BaseRetriever | null> | null = null;

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

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function resolveDirectory(configuredPath: string | undefined, fallbackAbsolutePath: string) {
  const value = readConfiguredValue(configuredPath);

  if (!value) {
    return fallbackAbsolutePath;
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function getKnowledgeIndexDir() {
  return resolveDirectory(process.env.KNOWLEDGE_INDEX_DIR, DEFAULT_KNOWLEDGE_INDEX_DIR);
}

function getMaterialsDir() {
  return resolveDirectory(process.env.MATERIALS_DIR, DEFAULT_MATERIALS_DIR);
}

function getEmbedModel() {
  return readConfiguredValue(process.env.KNOWLEDGE_EMBED_MODEL) || DEFAULT_EMBED_MODEL;
}

function getRetrievalTopK() {
  return parsePositiveInt(readConfiguredValue(process.env.KNOWLEDGE_RETRIEVAL_TOP_K), DEFAULT_RETRIEVAL_TOP_K);
}

function isKnowledgeBaseEnabled() {
  const raw = readConfiguredValue(process.env.KNOWLEDGE_BASE_ENABLED);

  if (!raw) {
    return true;
  }

  return raw.toLowerCase() !== 'false';
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeTextForStorage(text: string) {
  const withoutBom = text.replace(/^\uFEFF/, '');
  return withoutBom.replace(/\r\n/g, '\n').trim();
}

function parseMetadataScalar(rawValue: string) {
  const value = rawValue.trim();

  if (!value) {
    return '';
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value === 'null') {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function parseFrontmatter(content: string) {
  if (!content.startsWith('---\n')) {
    return {
      metadata: {} as Record<string, unknown>,
      body: content,
    };
  }

  const closingIndex = content.indexOf('\n---\n', 4);

  if (closingIndex === -1) {
    return {
      metadata: {} as Record<string, unknown>,
      body: content,
    };
  }

  const metadataRaw = content.slice(4, closingIndex);
  const body = content.slice(closingIndex + '\n---\n'.length).trim();
  const metadata: Record<string, unknown> = {};

  for (const line of metadataRaw.split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf(':');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1);

    if (!key) {
      continue;
    }

    metadata[key] = parseMetadataScalar(rawValue);
  }

  return {
    metadata,
    body,
  };
}

function toPortableRelativePath(baseDir: string, absolutePath: string) {
  return path.relative(baseDir, absolutePath).split(path.sep).join('/');
}

async function listFilesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const sortedEntries = entries.sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(entryPath)));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

async function loadDocumentsFromMaterials(materialsDir: string) {
  const filePaths = await listFilesRecursively(materialsDir);
  const documents: Document[] = [];

  for (const filePath of filePaths) {
    const extension = path.extname(filePath).toLowerCase();

    if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
      continue;
    }

    let rawContent: string;

    try {
      rawContent = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const text = normalizeTextForStorage(rawContent);
    const { metadata: frontmatterMetadata, body } = parseFrontmatter(text);
    const finalBody = body.trim();

    if (!finalBody) {
      continue;
    }

    const relativePath = toPortableRelativePath(materialsDir, filePath);
    const sourceName = path.basename(relativePath);
    const documentId = `material:${relativePath}`;

    documents.push(
      new Document({
        id_: documentId,
        text: finalBody,
        metadata: {
          source: relativePath,
          fileName: sourceName,
          extension,
          ...frontmatterMetadata,
        },
      }),
    );
  }

  return documents;
}

function configureLlamaIndexEmbedding() {
  const clientConfig = resolveEmbeddingClientConfig('knowledge indexing and retrieval embeddings');
  const embeddingModel = normalizeEmbeddingModelForProvider(getEmbedModel(), clientConfig.provider);
  const chunkSize = parsePositiveInt(readConfiguredValue(process.env.KNOWLEDGE_CHUNK_SIZE), DEFAULT_CHUNK_SIZE);
  const requestedChunkOverlap = parseNonNegativeInt(
    readConfiguredValue(process.env.KNOWLEDGE_CHUNK_OVERLAP),
    DEFAULT_CHUNK_OVERLAP,
  );
  const chunkOverlap = Math.min(requestedChunkOverlap, Math.max(0, chunkSize - 1));

  Settings.embedModel = new OpenAIEmbedding({
    apiKey: clientConfig.apiKey,
    baseURL: clientConfig.baseURL,
    model: embeddingModel,
  });
  Settings.chunkSize = chunkSize;
  Settings.chunkOverlap = chunkOverlap;

  return {
    embeddingProvider: clientConfig.provider,
    embeddingModel,
    chunkSize,
    chunkOverlap,
  };
}

function buildRetrievalQuery(mode: Mode, userInput: string, contextSummary?: string) {
  const summary = contextSummary ? normalizeWhitespace(contextSummary).slice(0, MAX_CONTEXT_SUMMARY_CHARS) : '';

  if (!summary) {
    return `mode=${mode}\nuser=${userInput}`;
  }

  return `mode=${mode}\nuser=${userInput}\nsession_memory=${summary}`;
}

function resolveSource(node: BaseNode) {
  const sourceValue = typeof node.metadata?.source === 'string' ? node.metadata.source.trim() : '';

  if (sourceValue) {
    return sourceValue;
  }

  const fileNameValue = typeof node.metadata?.fileName === 'string' ? node.metadata.fileName.trim() : '';

  if (fileNameValue) {
    return fileNameValue;
  }

  return 'material';
}

function metadataStringValue(metadata: Record<string, unknown> | undefined, key: string, fallback = '') {
  const value = metadata?.[key];

  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return fallback;
}

function metadataNumberValue(metadata: Record<string, unknown> | undefined, key: string, fallback = 0) {
  const value = metadata?.[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function metadataBooleanValue(metadata: Record<string, unknown> | undefined, key: string, fallback = true) {
  const value = metadata?.[key];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function isModeCompatible(metadata: Record<string, unknown> | undefined, activeMode: Mode) {
  const modeValue = metadataStringValue(metadata, 'mode', 'any').toLowerCase();

  if (!modeValue || modeValue === 'any') {
    return true;
  }

  return modeValue === activeMode;
}

function corpusWeight(corpus: string) {
  return CORPUS_WEIGHTS[corpus] ?? CORPUS_WEIGHTS.general;
}

function toRetrievedItem(candidate: NodeWithScore, activeMode: Mode): RetrievedKnowledgeItem | null {
  if (!candidate?.node) {
    return null;
  }

  const nodeMetadata = candidate.node.metadata as Record<string, unknown> | undefined;
  const includeInGeneration = metadataBooleanValue(nodeMetadata, 'include_in_generation', true);

  if (!includeInGeneration) {
    return null;
  }

  if (!isModeCompatible(nodeMetadata, activeMode)) {
    return null;
  }

  const excerpt = normalizeWhitespace(candidate.node.getContent(MetadataMode.NONE)).slice(0, MAX_EXCERPT_CHARS);

  if (!excerpt) {
    return null;
  }

  const corpus = metadataStringValue(nodeMetadata, 'corpus', DEFAULT_CORPUS);
  const ruleType = metadataStringValue(nodeMetadata, 'rule_type', DEFAULT_RULE_TYPE);
  const priority = metadataNumberValue(nodeMetadata, 'priority', DEFAULT_PRIORITY);

  return {
    source: resolveSource(candidate.node),
    excerpt,
    score: candidate.score,
    corpus,
    ruleType,
    priority,
  };
}

function dedupeRetrievedItems(items: RetrievedKnowledgeItem[]) {
  const uniqueKeys = new Set<string>();
  const deduped: RetrievedKnowledgeItem[] = [];

  for (const item of items) {
    const key = `${item.source}::${item.excerpt}`.toLowerCase();

    if (uniqueKeys.has(key)) {
      continue;
    }

    uniqueKeys.add(key);
    deduped.push(item);
  }

  return deduped;
}

function sortRetrievedItems(items: RetrievedKnowledgeItem[]) {
  return [...items].sort((left, right) => {
    const leftCorpusWeight = corpusWeight(left.corpus);
    const rightCorpusWeight = corpusWeight(right.corpus);

    if (leftCorpusWeight !== rightCorpusWeight) {
      return rightCorpusWeight - leftCorpusWeight;
    }

    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return (right.score || 0) - (left.score || 0);
  });
}

async function hasPersistedKnowledgeIndex(indexDir: string) {
  const exists = await Promise.all(REQUIRED_INDEX_FILES.map((fileName) => pathExists(path.join(indexDir, fileName))));
  return exists.every(Boolean);
}

async function createKnowledgeRetriever(): Promise<BaseRetriever | null> {
  if (!isKnowledgeBaseEnabled()) {
    return null;
  }

  if (!hasEmbeddingCredentials()) {
    return null;
  }

  const indexDir = getKnowledgeIndexDir();
  const hasPersistedIndex = await hasPersistedKnowledgeIndex(indexDir);

  if (!hasPersistedIndex) {
    return null;
  }

  configureLlamaIndexEmbedding();

  const storageContext = await storageContextFromDefaults({
    persistDir: indexDir,
  });
  const index = await VectorStoreIndex.init({
    storageContext,
  });

  return index.asRetriever({
    similarityTopK: getRetrievalTopK(),
  });
}

async function getKnowledgeRetriever() {
  if (!cachedRetrieverPromise) {
    cachedRetrieverPromise = createKnowledgeRetriever().catch((error) => {
      console.warn('Knowledge retrieval is disabled for this process:', error);
      return null;
    });
  }

  return cachedRetrieverPromise;
}

export async function retrieveKnowledgeContext({
  mode,
  userInput,
  contextSummary,
}: {
  mode: Mode;
  userInput: string;
  contextSummary?: string;
}) {
  const normalizedInput = userInput.trim();

  if (!normalizedInput) {
    return [] as RetrievedKnowledgeItem[];
  }

  try {
    const retriever = await getKnowledgeRetriever();

    if (!retriever) {
      return [];
    }

    const retrievedNodes = await retriever.retrieve(buildRetrievalQuery(mode, normalizedInput, contextSummary));
    const items = dedupeRetrievedItems(
      retrievedNodes
        .map((candidate) => toRetrievedItem(candidate, mode))
        .filter((candidate): candidate is RetrievedKnowledgeItem => candidate !== null),
    );

    return sortRetrievedItems(items).slice(0, getRetrievalTopK());
  } catch (error) {
    console.error('Knowledge retrieval failed:', error);
    return [];
  }
}

export function formatKnowledgeContext(items: RetrievedKnowledgeItem[]) {
  if (items.length === 0) {
    return '';
  }

  return items
    .map(
      (item, index) => `
[${index + 1}] Corpus: ${item.corpus}
Rule Type: ${item.ruleType}
Priority: ${item.priority}
Source: ${item.source}
Similarity: ${typeof item.score === 'number' ? item.score.toFixed(4) : 'n/a'}
Excerpt: ${item.excerpt}
`,
    )
    .join('\n')
    .trim();
}

export async function ingestKnowledgeBase(
  options: {
    materialsDir?: string;
    indexDir?: string;
  } = {},
): Promise<KnowledgeIngestionResult> {
  const materialsDir = options.materialsDir
    ? resolveDirectory(options.materialsDir, path.resolve(process.cwd(), options.materialsDir))
    : getMaterialsDir();
  const indexDir = options.indexDir
    ? resolveDirectory(options.indexDir, path.resolve(process.cwd(), options.indexDir))
    : getKnowledgeIndexDir();
  const materialsDirExists = await pathExists(materialsDir);

  if (!materialsDirExists) {
    throw new Error(
      `Materials directory does not exist: ${materialsDir}. Create it and add text/markdown/json materials before indexing.`,
    );
  }

  const { embeddingProvider, embeddingModel, chunkSize, chunkOverlap } = configureLlamaIndexEmbedding();
  const documents = await loadDocumentsFromMaterials(materialsDir);

  if (documents.length === 0) {
    throw new Error(
      `No supported text materials found in ${materialsDir}. Supported extensions: ${Array.from(
        SUPPORTED_TEXT_EXTENSIONS,
      ).join(', ')}`,
    );
  }

  const storageContext = await storageContextFromDefaults({
    persistDir: indexDir,
  });

  await VectorStoreIndex.fromDocuments(documents, {
    storageContext,
    docStoreStrategy: DocStoreStrategy.UPSERTS_AND_DELETE,
    logProgress: true,
  });

  cachedRetrieverPromise = null;

  return {
    materialsDir,
    indexDir,
    indexedFileCount: documents.length,
    totalCharacters: documents.reduce((total, document) => total + document.text.length, 0),
    embeddingProvider,
    embeddingModel,
    chunkSize,
    chunkOverlap,
  };
}
