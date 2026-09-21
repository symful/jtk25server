import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

function firebaseConfigPlugin() {
  const requiredKeys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_VAPID_KEY',
  ] as const;

  let env: Record<string, string> = {};

  return {
    name: 'firebase-config',
    config(_config, { mode }) {
      // loadEnv merges process.env + .env / .env.local / .env.[mode] files
      env = loadEnv(mode, __dirname, 'VITE_FIREBASE_');
    },
    buildStart() {
      const missing = requiredKeys.filter((k) => !env[k]);
      if (missing.length > 0) {
        throw new Error(
          `[firebase-config] Missing required env vars: ${missing.join(', ')}.\n` +
          'Set them in .env file (server/web/.env) or CI environment.\n' +
          'Example .env:\n' +
          '  VITE_FIREBASE_API_KEY=...\n' +
          '  VITE_FIREBASE_PROJECT_ID=...\n' +
          '  VITE_FIREBASE_MESSAGING_SENDER_ID=...\n' +
          '  VITE_FIREBASE_APP_ID=...\n' +
          '  VITE_FIREBASE_VAPID_KEY=...',
        );
      }

      const config = JSON.stringify({
        apiKey: env.VITE_FIREBASE_API_KEY,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      }, null, 2);

      const content = `self.FIREBASE_CONFIG = ${config};\n`;
      writeFileSync(resolve(__dirname, 'public', 'firebase-config.js'), content);
    },
  };
}

export default defineConfig({
  plugins: [react(), firebaseConfigPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
