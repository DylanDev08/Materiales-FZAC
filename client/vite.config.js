import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-icons')) return 'icons';
          if (id.includes('@supabase/supabase-js')) return 'supabase';
          if (id.includes('@tanstack/react-query')) return 'query';
          if (id.includes('react')) return 'react';
          return undefined;
        }
      }
    }
  }
});
