// =============================================================================
// main.tsx — React Application Entry Point
// =============================================================================
//
// This is the FIRST file that runs when the app loads in the browser.
// It does three things:
//   1. Import global setup (i18n, CSS, PDF.js worker)
//   2. Find the <div id="root"> element in index.html
//   3. Render the React app into that element
//
// STRICT MODE:
// <StrictMode> is a React development tool that:
//   - Runs components TWICE in development to catch side effects
//   - Warns about deprecated React patterns
//   - Has NO effect in production builds
// It may cause useEffect to fire twice during development — this is normal.
//
// PDF.JS WORKER:
// react-pdf uses PDF.js to render PDFs in the browser. PDF.js does heavy
// parsing work in a Web Worker (a background thread) so it doesn't freeze
// the UI. We need to tell it where the worker script file is located.
// import.meta.url is the URL of THIS file — Vite resolves the worker path
// relative to it at build time.
// =============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { pdfjs } from 'react-pdf';
import App from './App';
import './i18n';       // initialize i18n (language detection + translations) — must import before App
import './index.css';  // global CSS (Tailwind CSS directives)

// Configure PDF.js web worker location for react-pdf thumbnail rendering
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Mount the React app into the DOM.
// document.getElementById('root')! — the "!" tells TypeScript "I'm sure this element exists"
// (it's defined in index.html as <div id="root"></div>)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
