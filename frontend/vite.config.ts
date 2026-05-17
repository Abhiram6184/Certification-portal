import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],
    build: {
      outDir: path.resolve(__dirname, '../dist'),
      emptyOutDir: true,
      assetsDir: 'assets'
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4001',
          changeOrigin: true,
        },
      },
      allowedHosts: [
        '8727238891af.ngrok-free.app', // 👈 your ngrok domain
        '.ngrok-free.app',             // 👈 optional: allow all ngrok subdomains
      ],
    },
  }
})

