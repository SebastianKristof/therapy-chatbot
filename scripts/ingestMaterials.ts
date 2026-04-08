import { ingestKnowledgeBase } from '../server/knowledgeBase.js';

function readFlagValue(args: string[], flagName: string) {
  const flagIndex = args.findIndex((arg) => arg === flagName);

  if (flagIndex === -1) {
    return undefined;
  }

  return args[flagIndex + 1];
}

function printUsage() {
  console.log(`
Usage: npm run ingest:materials -- [--materials <dir>] [--index <dir>]

Options:
  --materials   Override materials directory (default: MATERIALS_DIR env var or ./materials)
  --index       Override index directory (default: KNOWLEDGE_INDEX_DIR env var or ./server/data/knowledge-index)
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const materialsDir = readFlagValue(args, '--materials');
  const indexDir = readFlagValue(args, '--index');
  const result = await ingestKnowledgeBase({
    materialsDir,
    indexDir,
  });

  console.log('Knowledge base indexing complete.');
  console.log(`Materials directory: ${result.materialsDir}`);
  console.log(`Index directory: ${result.indexDir}`);
  console.log(`Indexed files: ${result.indexedFileCount}`);
  console.log(`Total characters: ${result.totalCharacters}`);
  console.log(`Embedding model: ${result.embeddingModel}`);
  console.log(`Chunk size: ${result.chunkSize}`);
  console.log(`Chunk overlap: ${result.chunkOverlap}`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`Knowledge indexing failed: ${error.message}`);
  } else {
    console.error('Knowledge indexing failed.');
  }

  process.exitCode = 1;
});
