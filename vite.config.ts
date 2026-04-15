import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000 // 5MB
        },
        manifest: {
          name: 'ConsulData Cotações',
          short_name: 'Cotações',
          description: 'Banco de cotações e gerador de orçamentos da ConsulData',
          theme_color: '#1e8bc3',
          background_color: '#f5f5f5',
          display: 'standalone',
          icons: [
            {
              src: 'https://www.consuldata.com.br/wp-content/uploads/2022/08/LOGO-SITE-1.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://www.consuldata.com.br/wp-content/uploads/2022/08/LOGO-SITE-1.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
