import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Configure PDF.js worker (same as parsePdf.ts)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PDF_CONFIG = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
};

/**
 * Clone an ArrayBuffer to prevent detachment issues
 */
const cloneArrayBuffer = (buffer: ArrayBuffer): ArrayBuffer => {
  const cloned = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(cloned).set(new Uint8Array(buffer));
  return cloned;
};

/**
 * Render a PDF page to a data URL image for OCR processing
 */
const renderPageToImage = async (
  page: pdfjsLib.PDFPageProxy,
  scale = 2.0 // Higher scale = better OCR accuracy
): Promise<string> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/png');
  canvas.remove();
  return dataUrl;
};

export interface OCRResult {
  pagesText: string[];
  method: 'ocr';
  confidence: number;
}

/**
 * Extract text from PDF using OCR (Tesseract.js)
 * Use this when standard text extraction produces garbled output due to encoding issues
 */
export const extractPDFTextWithOCR = async (
  arrayBuffer: ArrayBuffer,
  language = 'eng',
  onProgress?: (stage: string, progress: number, pageNum?: number) => void
): Promise<OCRResult> => {
  const cloned = cloneArrayBuffer(arrayBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data: cloned, ...PDF_CONFIG });
  const pdf = await loadingTask.promise;
  const pagesText: string[] = [];
  let totalConfidence = 0;
  
  // Create Tesseract worker
  onProgress?.('Initializing OCR engine...', 5);
  console.log('🔍 Starting OCR text extraction...');
  
  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        // Progress is handled per-page below
      }
    }
  });
  
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const progressPercent = 10 + ((i - 1) / pdf.numPages) * 85;
      onProgress?.(`OCR processing page ${i}/${pdf.numPages}...`, progressPercent, i);
      console.log(`📄 OCR: Processing page ${i}/${pdf.numPages}`);
      
      const page = await pdf.getPage(i);
      
      // Render page to image at high resolution for accurate OCR
      const imageDataUrl = await renderPageToImage(page, 2.0);
      
      // OCR the image
      const { data } = await worker.recognize(imageDataUrl);
      pagesText.push(data.text.trim());
      totalConfidence += data.confidence;
      
      console.log(`✅ Page ${i} OCR complete. Confidence: ${data.confidence.toFixed(1)}%`);
    }
    
    const avgConfidence = totalConfidence / pdf.numPages;
    onProgress?.('OCR complete!', 100);
    console.log(`🎉 OCR extraction complete. Average confidence: ${avgConfidence.toFixed(1)}%`);
    
    return { 
      pagesText, 
      method: 'ocr',
      confidence: avgConfidence
    };
    
  } finally {
    await worker.terminate();
  }
};

/**
 * Check if extracted text appears to have encoding issues
 * Returns true if OCR should be used instead
 */
export const detectEncodingIssues = (pagesText: string[]): { 
  hasIssues: boolean; 
  issuePages: number[];
  suspiciousRatio: number;
} => {
  const issuePages: number[] = [];
  let totalSuspicious = 0;
  let totalChars = 0;
  
  for (let i = 0; i < pagesText.length; i++) {
    const text = pagesText[i];
    if (!text || text.length < 10) continue; // Skip empty or very short pages
    
    const charCodes = Array.from(text).map(c => c.charCodeAt(0));
    totalChars += charCodes.length;
    
    // Count suspicious characters:
    // - Extended Latin that aren't common accented chars (128-255 range, excluding common ones)
    // - Private use area (0xE000-0xF8FF)
    // - Greek letters being used as glyph IDs (0x0370-0x03FF when not actually Greek text)
    // - Very high code points that shouldn't appear in normal text
    const suspiciousCount = charCodes.filter(c => {
      // Extended Latin block - but exclude common accented characters
      if (c > 127 && c < 256) {
        // These are common accented chars we should allow
        const commonExtended = 'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß';
        return !commonExtended.includes(String.fromCharCode(c));
      }
      // Private use area - definitely suspicious
      if (c >= 0xE000 && c <= 0xF8FF) return true;
      // Very high unicode that's unlikely in normal text
      if (c > 0xFFF0) return true;
      // Greek block - suspicious if mixed with Latin (glyph IDs often map here)
      if (c >= 0x0370 && c <= 0x03FF) {
        // Only suspicious if the page has mostly Latin chars
        const latinCount = charCodes.filter(cc => cc >= 65 && cc <= 122).length;
        return latinCount / charCodes.length > 0.3;
      }
      return false;
    }).length;
    
    totalSuspicious += suspiciousCount;
    const ratio = suspiciousCount / charCodes.length;
    
    // If more than 5% of characters are suspicious, flag this page
    if (ratio > 0.05) {
      issuePages.push(i + 1);
    }
  }
  
  const overallRatio = totalChars > 0 ? totalSuspicious / totalChars : 0;
  
  return { 
    hasIssues: issuePages.length > 0, 
    issuePages,
    suspiciousRatio: overallRatio
  };
};
