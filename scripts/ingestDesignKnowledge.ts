import path from 'node:path';
import { ingestKnowledgeBase } from '../server/knowledgeBase.js';
import { prepareDesignKnowledge } from './prepareDesignKnowledge.js';

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'knowledge_sources/design_split');

function parseOutputDirectoryArg() {
  const outputArg = process.argv.slice(2).find((arg) => arg.startsWith('--out='));

  if (!outputArg) {
    return DEFAULT_OUTPUT_DIR;
  }

  const rawPath = outputArg.replace('--out=', '').trim();
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

async function main() {
  const outputDir = parseOutputDirectoryArg();
  const splitResult = await prepareDesignKnowledge(outputDir);

  console.log('Prepared split knowledge docs from design specs.');
  console.log(`Output directory: ${splitResult.outputDir}`);
  console.log(`Generated files: ${splitResult.fileCount}`);

  const ingestResult = await ingestKnowledgeBase({
    materialsDir: splitResult.outputDir,
  });

  console.log('Design knowledge ingestion complete.');
  console.log(`Materials directory: ${ingestResult.materialsDir}`);
  console.log(`Index directory: ${ingestResult.indexDir}`);
  console.log(`Indexed files: ${ingestResult.indexedFileCount}`);
  console.log(`Total characters: ${ingestResult.totalCharacters}`);
  console.log(`Embedding model: ${ingestResult.embeddingModel}`);
  console.log(`Chunk size: ${ingestResult.chunkSize}`);
  console.log(`Chunk overlap: ${ingestResult.chunkOverlap}`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`Design knowledge ingestion failed: ${error.message}`);
  } else {
    console.error('Design knowledge ingestion failed.');
  }

  process.exitCode = 1;
});
