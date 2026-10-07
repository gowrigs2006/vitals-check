import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/vitals-check/',
  
  plugins: [react()],

  build: {
    outDir: 'dist'
  }
})
