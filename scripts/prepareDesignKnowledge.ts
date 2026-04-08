import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Mode } from '../src/types.js';

const DESIGN_DIR = path.resolve(process.cwd(), 'design');
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'knowledge_sources/design_split');

type GuidanceMode = Mode | 'any';
type KnowledgeCorpus = 'policy' | 'mode_playbook' | 'examples' | 'ux_copy';

interface SectionChunk {
  sourceDoc: string;
  heading: string;
  body: string;
  order: number;
}

interface ChunkMetadata {
  source_doc: string;
  source_section: string;
  corpus: KnowledgeCorpus;
  rule_type: string;
  mode: GuidanceMode;
  risk_category: string;
  priority: number;
  include_in_generation: boolean;
}

interface PreparedChunk {
  metadata: ChunkMetadata;
  relativePath: string;
  content: string;
}

export interface PrepareDesignKnowledgeResult {
  outputDir: string;
  fileCount: number;
  manifestPath: string;
}

const MODE_DETECTION_RULES: Array<{ mode: GuidanceMode; patterns: string[] }> = [
  { mode: 'reflect', patterns: ['mode 1', 'reflect on what came up'] },
  { mode: 'trigger', patterns: ['mode 2', 'work through a trigger', 'trigger reflection'] },
  { mode: 'reinforce', patterns: ['mode 3', 'reinforce this week', 'reinforcement'] },
  { mode: 'prepare', patterns: ['mode 4', 'prepare for next session', 'session prep'] },
  { mode: 'ask_process', patterns: ['mode 5', 'ask about hypnosis', 'the process'] },
  {
    mode: 'ask_experience',
    patterns: ['mode 6', 'is this normal', 'ask about what i’m experiencing', "ask about what i'm experiencing"],
  },
  { mode: 'chat', patterns: ['ask something else', 'fallback mode', 'fallback behavior'] },
];

function normalizeText(value: string) {
  return value.toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function yamlValue(value: string | number | boolean) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function detectMode(text: string): GuidanceMode {
  const normalized = normalizeText(text);

  for (const rule of MODE_DETECTION_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return rule.mode;
    }
  }

  return 'any';
}

function startsWithAny(text: string, patterns: string[]) {
  const normalized = normalizeText(text);
  return patterns.some((pattern) => normalized.includes(pattern));
}

function classifyChunk(chunk: SectionChunk): ChunkMetadata {
  const { sourceDoc, heading, body } = chunk;
  const sourceText = normalizeText(`${heading}\n${body}`);
  const headingText = normalizeText(heading);
  const isPrd1 = sourceDoc.includes('prd-1');
  const isPrd2 = sourceDoc.includes('prd-2');
  const isPrd3 = sourceDoc.includes('prd-3');
  const isPrd4 = sourceDoc.includes('prd-4');
  const isPrd5 = sourceDoc.includes('prd-5');
  const isPrd6 = sourceDoc.includes('prd-6');

  let corpus: KnowledgeCorpus = 'mode_playbook';
  let ruleType = 'playbook_rule';
  let priority = 70;
  let includeInGeneration = true;

  if (isPrd5) {
    corpus = 'policy';
    ruleType = 'safety_policy';
    priority = 100;
  } else if (isPrd6) {
    corpus = 'ux_copy';
    ruleType = 'ux_policy';
    priority = 20;
    includeInGeneration = false;
  } else if (isPrd4) {
    corpus = 'examples';
    ruleType = 'example_good';
    priority = 62;
  } else if (isPrd3 || isPrd2 || isPrd1) {
    corpus = 'mode_playbook';
    ruleType = 'playbook_rule';
    priority = 74;
  }

  if (
    startsWithAny(headingText, [
      'bad tone examples',
      'anti-pattern',
      'anti-patterns',
      'bad vs good comparison',
      'what mvp v1 should intentionally not optimize for',
      'example bad answers',
      'example bad',
    ])
  ) {
    ruleType = 'example_bad';
    includeInGeneration = false;
  }

  if (startsWithAny(sourceText, ['escalation', 'out-of-scope', 'misuse category', 'safety / escalation'])) {
    corpus = 'policy';
    priority = Math.max(priority, 95);
    ruleType = startsWithAny(sourceText, ['example']) ? 'escalation_example' : 'safety_policy';
    includeInGeneration = true;
  }

  if (
    startsWithAny(headingText, ['summary output design', 'summary generation', 'summary format', 'summary layer'])
  ) {
    ruleType = 'summary_template';
    priority = Math.max(priority, 82);
  }

  if (startsWithAny(headingText, ['memory & continuity principles', 'memory rule'])) {
    ruleType = 'memory_policy';
    priority = Math.max(priority, 84);
  }

  if (startsWithAny(headingText, ['process-education rule', 'ask about hypnosis', 'misconception'])) {
    ruleType = 'process_education';
    priority = Math.max(priority, 83);
    if (!isPrd5 && !isPrd6) {
      corpus = 'mode_playbook';
    }
  }

  if (startsWithAny(headingText, ['practitioner value layer', 'practitioner-facing summary'])) {
    ruleType = 'practitioner_signal';
    priority = Math.max(priority, 79);
  }

  if (startsWithAny(sourceText, ['normalize without overclaiming', 'do not over-normalize'])) {
    corpus = 'policy';
    ruleType = 'normalization_guardrail';
    priority = Math.max(priority, 96);
  }

  if (startsWithAny(sourceText, ['do not over-interpret', 'interpretation rules'])) {
    corpus = 'policy';
    ruleType = 'interpretation_guardrail';
    priority = Math.max(priority, 96);
  }

  if (isPrd4 && startsWithAny(headingText, ['what “good” looks like', 'what "good" looks like', 'good interaction'])) {
    corpus = 'examples';
    ruleType = 'quality_anchor';
    priority = Math.max(priority, 68);
  }

  if (isPrd4 && startsWithAny(headingText, ['bad vs good comparison'])) {
    corpus = 'examples';
    ruleType = 'example_contrast';
    priority = Math.max(priority, 66);
  }

  if (isPrd6) {
    includeInGeneration = false;
  }

  const mode = detectMode(heading);
  const riskCategoryMatch = heading.match(/category\s+([a-j])/i);
  const riskCategory = riskCategoryMatch?.[1]?.toUpperCase() || 'none';

  return {
    source_doc: sourceDoc,
    source_section: heading,
    corpus,
    rule_type: ruleType,
    mode,
    risk_category: riskCategory,
    priority,
    include_in_generation: includeInGeneration,
  };
}

function splitTopLevelSections(markdown: string, sourceDoc: string): SectionChunk[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections: SectionChunk[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];
  let order = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^#\s+(.+)/);

    if (headingMatch) {
      const nextHeading = headingMatch[1].trim();

      if (currentHeading && currentLines.join('\n').trim()) {
        sections.push({
          sourceDoc,
          heading: currentHeading,
          body: currentLines.join('\n').trim(),
          order,
        });
      }

      currentHeading = nextHeading;
      currentLines = [line];
      order += 1;
      continue;
    }

    if (currentHeading) {
      currentLines.push(line);
    }
  }

  if (currentHeading && currentLines.join('\n').trim()) {
    sections.push({
      sourceDoc,
      heading: currentHeading,
      body: currentLines.join('\n').trim(),
      order,
    });
  }

  return sections.filter((section) => !section.heading.toLowerCase().startsWith('askdrkristof'));
}

function buildFrontmatter(metadata: ChunkMetadata) {
  return `---
source_doc: ${yamlValue(metadata.source_doc)}
source_section: ${yamlValue(metadata.source_section)}
corpus: ${yamlValue(metadata.corpus)}
rule_type: ${yamlValue(metadata.rule_type)}
mode: ${yamlValue(metadata.mode)}
risk_category: ${yamlValue(metadata.risk_category)}
priority: ${yamlValue(metadata.priority)}
include_in_generation: ${yamlValue(metadata.include_in_generation)}
---
`;
}

async function collectPreparedChunks(): Promise<PreparedChunk[]> {
  const files = (await readdir(DESIGN_DIR))
    .filter((fileName) => fileName.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right));
  const chunks: PreparedChunk[] = [];

  for (const sourceDoc of files) {
    const sourcePath = path.join(DESIGN_DIR, sourceDoc);
    const sourceMarkdown = await readFile(sourcePath, 'utf8');
    const sections = splitTopLevelSections(sourceMarkdown, sourceDoc);

    for (const section of sections) {
      const metadata = classifyChunk(section);
      const sourceBase = sourceDoc.replace(/\.md$/i, '');
      const sectionSlug = slugify(section.heading || `section-${section.order}`);
      const fileName = `${sourceBase}--${String(section.order).padStart(3, '0')}--${sectionSlug}.md`;
      const relativePath = path.join(metadata.corpus, fileName);

      chunks.push({
        metadata,
        relativePath,
        content: `${buildFrontmatter(metadata)}\n${section.body.trim()}\n`,
      });
    }
  }

  return chunks;
}

export async function prepareDesignKnowledge(outputDir = DEFAULT_OUTPUT_DIR): Promise<PrepareDesignKnowledgeResult> {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const chunks = await collectPreparedChunks();

  for (const chunk of chunks) {
    const absolutePath = path.join(outputDir, chunk.relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, chunk.content, 'utf8');
  }

  const manifest = chunks.map((chunk) => ({
    path: chunk.relativePath.split(path.sep).join('/'),
    ...chunk.metadata,
  }));
  const manifestPath = path.join(outputDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const readmePath = path.join(outputDir, 'README.md');
  await writeFile(
    readmePath,
    `# Design Split Knowledge Source

This folder is generated from \`design/*.md\` by \`scripts/prepareDesignKnowledge.ts\`.

It creates metadata-tagged split source docs grouped into:
- \`policy\`
- \`mode_playbook\`
- \`examples\`
- \`ux_copy\`

Use this folder as \`MATERIALS_DIR\` when ingesting into the RAG index.
`,
    'utf8',
  );

  return {
    outputDir,
    fileCount: chunks.length,
    manifestPath,
  };
}

async function main() {
  const outputDirArg = process.argv.slice(2).find((arg) => arg.startsWith('--out='));
  const outputDir = outputDirArg ? outputDirArg.replace('--out=', '').trim() : DEFAULT_OUTPUT_DIR;
  const result = await prepareDesignKnowledge(path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir));

  console.log('Design knowledge split complete.');
  console.log(`Output directory: ${result.outputDir}`);
  console.log(`Generated files: ${result.fileCount}`);
  console.log(`Manifest: ${result.manifestPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    if (error instanceof Error) {
      console.error(`Design knowledge split failed: ${error.message}`);
    } else {
      console.error('Design knowledge split failed.');
    }

    process.exitCode = 1;
  });
}
