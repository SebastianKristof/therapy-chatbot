import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { devApiPlugin } from './server/devApiPlugin';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const runtimeKeys = [
    'APP_APPROVED_DEVICES',
    'AI_GATEWAY_API_KEY',
    'AI_GATEWAY_MODEL',
    'OPENAI_API_KEY',
    'OPENAI_TRANSCRIPTION_MODEL',
    'EMBEDDING_PROVIDER',
    'EMBEDDING_GATEWAY_API_KEY',
    'EMBEDDING_GATEWAY_BASE_URL',
    'KNOWLEDGE_BASE_ENABLED',
    'MATERIALS_DIR',
    'KNOWLEDGE_INDEX_DIR',
    'KNOWLEDGE_EMBED_MODEL',
    'KNOWLEDGE_RETRIEVAL_TOP_K',
    'KNOWLEDGE_CHUNK_SIZE',
    'KNOWLEDGE_CHUNK_OVERLAP',
    'GUIDANCE_ENABLED',
    'GUIDANCE_DATA_PATH',
    'GUIDANCE_EMBED_MODEL',
    'GUIDANCE_VERBATIM_THRESHOLD',
    'GUIDANCE_ADAPT_THRESHOLD',
    'GUIDANCE_MATCH_LIMIT',
    'RAG_DEBUG',
  ] as const;

  for (const key of runtimeKeys) {
    if (process.env[key] === undefined && env[key] !== undefined) {
      process.env[key] = env[key];
    }
  }

  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
