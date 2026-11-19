export type PdfViewport = { width: number; height: number };

export type PdfDocument = {
  numPages: number;
  getPage: (page: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

export type PdfPage = {
  getViewport: (options: { scale: number; rotation?: number }) => PdfViewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => { promise: Promise<void>; cancel: () => void };
};

type PdfJsApi = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: {
    url?: string;
    data?: Uint8Array;
    withCredentials?: boolean;
  }) => { promise: Promise<PdfDocument> };
};

declare global {
  interface Window {
    pdfjsLib?: PdfJsApi;
  }
}

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.worker.min.js";

let pdfJsLoading: Promise<PdfJsApi> | null = null;

export function loadPdfJs(): Promise<PdfJsApi> {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return Promise.resolve(window.pdfjsLib);
  }
  if (pdfJsLoading) return pdfJsLoading;

  pdfJsLoading = new Promise((resolve, reject) => {
    let activeScript: HTMLScriptElement | null = null;
    const fail = () => {
      activeScript?.remove();
      pdfJsLoading = null;
      reject(new Error("PDF.js could not be loaded. Check your connection and try again."));
    };
    const complete = (script: HTMLScriptElement) => {
      script.dataset.loaded = "true";
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      } else {
        fail();
      }
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-pdfjs="true"]');
    activeScript = script;
    if (script?.dataset.loaded === "true" && !window.pdfjsLib) {
      script.remove();
      script = null;
    }

    if (script) {
      script.addEventListener("load", () => complete(script as HTMLScriptElement), { once: true });
      script.addEventListener("error", fail, { once: true });
      return;
    }

    const nextScript = document.createElement("script");
    activeScript = nextScript;
    nextScript.src = PDFJS_SCRIPT;
    nextScript.async = true;
    nextScript.crossOrigin = "anonymous";
    nextScript.dataset.pdfjs = "true";
    nextScript.onload = () => complete(nextScript);
    nextScript.onerror = fail;
    document.head.appendChild(nextScript);
  });

  return pdfJsLoading;
}

/**
 * Render the first page as a PNG cover preview. The issue PDF is rendered
 * locally in the browser; no file bytes are sent to a third-party service.
 */
export async function createPdfFirstPageCover(file: File): Promise<Blob> {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  try {
    if (pdf.numPages < 1) throw new Error("The selected PDF contains no pages.");

    const firstPage = await pdf.getPage(1);
    const natural = firstPage.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 1200 / natural.width);
    const viewport = firstPage.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not prepare a cover preview.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await firstPage.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("The first page could not be converted into a cover preview."));
      }, "image/png");
    });

    return blob;
  } finally {
    await pdf.destroy();
  }
}
