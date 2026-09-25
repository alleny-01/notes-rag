import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// React-PDF imports the bare `pdfjs-dist` package internally. Point only that
// package entry and its viewer helper at PDF.js's transpiled legacy build so
// iOS/WebKit receives the same compatibility runtime as client-side extraction.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^pdfjs-dist$/,
        replacement: fileURLToPath(new URL('./node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url)),
      },
      {
        find: /^pdfjs-dist\/web\/pdf_viewer\.mjs$/,
        replacement: fileURLToPath(new URL('./node_modules/pdfjs-dist/legacy/web/pdf_viewer.mjs', import.meta.url)),
      },
    ],
  },
})
