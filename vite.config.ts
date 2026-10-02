import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Подставляет адрес сайта в мета-теги index.html (%SITE_URL%) — нужен для превью ссылок
function siteUrl(url: string): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', url.replace(/\/$/, '')),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), siteUrl(env.VITE_SITE_URL || 'http://localhost:5173')],
    server: {
      port: 5173,
      // В разработке запросы /api проксируются на локальный бэкенд
      proxy: {
        '/api': 'http://localhost:4000',
      },
    },
  }
})
