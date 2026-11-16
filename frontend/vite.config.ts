import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

function dominiosLocales() {
  const hosts = new Set(['localhost', '127.0.0.1'])
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) hosts.add(item.address)
    }
  }
  return [...hosts]
}

export default defineConfig({
  plugins: [
    react(),
    basicSsl({
      name: 'lab-control',
      domains: dominiosLocales(),
      certDir: fileURLToPath(new URL('./certs', import.meta.url)),
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      workbox: {
        globIgnores: ['**/ocr/**'],
      },
      manifest: {
        name: 'LAB CONTROL',
        short_name: 'LAB CONTROL',
        description: 'Administración y control de laboratorios de informática',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0B1F3A',
        theme_color: '#0B1F3A',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    https: true,
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  preview: {
    https: true,
    host: true,
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
