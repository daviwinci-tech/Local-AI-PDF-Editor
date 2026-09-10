import * as pdfjsLib from 'pdfjs-dist';

// Configure worker from reliable CDN matching installed version
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF worker init fallback:', e);
  }
}

export { pdfjsLib };
