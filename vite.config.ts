import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { devApiPlugin } from './server/devApiPlugin';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  process.env.AI_GATEWAY_API_KEY = env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_MODEL = env.AI_GATEWAY_MODEL || process.env.AI_GATEWAY_MODEL;
  process.env.OPENAI_API_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  process.env.OPENAI_TRANSCRIPTION_MODEL =
    env.OPENAI_TRANSCRIPTION_MODEL || process.env.OPENAI_TRANSCRIPTION_MODEL;

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
