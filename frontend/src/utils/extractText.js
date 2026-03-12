import * as pdfjsLib from 'pdfjs-dist';

// Point worker to the bundled worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
/**
 * Extract plain text from a File object (.pdf or .txt / .doc).
 * Returns a string.
 */
export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    return extractFromPDF(file);
  }

  // txt / fallback — read as plain text
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function extractFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const textParts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}
