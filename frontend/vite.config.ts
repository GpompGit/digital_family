import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3456',
      '/auth': 'http://localhost:3456',
      '/deploy': 'http://localhost:3456'
    }
  }
});
