"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (options: { url: string; withCredentials?: boolean }) => { promise: Promise<PDFDocument> };
    };
  }
}

type PDFDocument = {
  numPages: number;
  getPage: (page: number) => Promise<PDFPage>;
  destroy: () => Promise<void>;
};

type PDFPage = {
  getViewport: (options: { scale: number; rotation?: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
};

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.worker.min.js";

let pdfJsLoading: Promise<NonNullable<Window["pdfjsLib"]>> | null = null;

function loadPdfJs(): Promise<NonNullable<Window["pdfjsLib"]>> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfJsLoading) return pdfJsLoading;

  pdfJsLoading = new Promise((resolve, reject) => {
    const fail = () => {
      pdfJsLoading = null;
      reject(new Error("PDF.js could not be loaded. Check your connection and try again."));
    };
    const complete = (script: HTMLScriptElement) => {
      script.dataset.loaded = "true";
      if (window.pdfjsLib) resolve(window.pdfjsLib);
      else fail();
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-pdfjs="true"]');
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

type Props = { url: string; title: string; downloadName: string };

export function PdfReader({ url, title, downloadName }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PDFDocument | null>(null);
  const renderRef = useRef<{ cancel: () => void } | null>(null);
  const currentScaleRef = useRef(1);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<"width" | "page" | "manual">("width");
  const [rotation, setRotation] = useState(0);
  const [stageWidth, setStageWidth] = useState(900);
  const [stageHeight, setStageHeight] = useState(760);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setStageWidth(rect.width);
        setStageHeight(rect.height);
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPage(1);
    setPageCount(0);
    setRotation(0);
    setFit("width");
    setZoom(1);

    loadPdfJs()
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return pdfjs.getDocument({ url, withCredentials: false }).promise;
      })
      .then((pdf) => {
        if (!active) {
          void pdf.destroy();
          return;
        }
        documentRef.current = pdf;
        setPageCount(pdf.numPages);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "The edition could not be opened.");
        setLoading(false);
      });

    return () => {
      active = false;
      renderRef.current?.cancel();
      const current = documentRef.current;
      documentRef.current = null;
      if (current) void current.destroy();
    };
  }, [url]);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      const pdf = documentRef.current;
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!pdf || !canvas || !stage || !pageCount) return;

      renderRef.current?.cancel();
      try {
        const pdfPage = await pdf.getPage(page);
        if (!active) return;

        const natural = pdfPage.getViewport({ scale: 1, rotation });
        const availableWidth = Math.max(260, stageWidth - 48);
        const availableHeight = Math.max(320, stageHeight - 48);
        const fitWidthScale = availableWidth / natural.width;
        const fitPageScale = Math.min(fitWidthScale, availableHeight / natural.height);
        const scale = fit === "width" ? fitWidthScale : fit === "page" ? fitPageScale : zoom;
        currentScaleRef.current = scale;

        const viewport = pdfPage.getViewport({ scale, rotation });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        const task = pdfPage.render({ canvasContext: context, viewport });
        renderRef.current = task;
        await task.promise;
      } catch (reason) {
        if (active && !(reason instanceof Error && reason.name === "RenderingCancelledException")) {
          setError("A page could not be rendered. Please reload the edition.");
        }
      }
    };

    void renderPage();
    return () => {
      active = false;
      renderRef.current?.cancel();
    };
  }, [page, pageCount, fit, zoom, rotation, stageWidth, stageHeight]);

  const previous = useCallback(() => setPage((value) => Math.max(1, value - 1)), []);
  const next = useCallback(() => setPage((value) => Math.min(pageCount || 1, value + 1)), [pageCount]);
  const zoomIn = useCallback(() => {
    setFit("manual");
    setZoom(Math.min(4, Math.round(currentScaleRef.current * 1.1 * 100) / 100));
  }, []);
  const zoomOut = useCallback(() => {
    setFit("manual");
    setZoom(Math.max(0.5, Math.round(currentScaleRef.current / 1.1 * 100) / 100));
  }, []);
  const fitWidth = useCallback(() => setFit("width"), []);
  const fitPage = useCallback(() => setFit("page"), []);
  const rotateLeft = useCallback(() => setRotation((value) => (value + 270) % 360), []);
  const rotateRight = useCallback(() => setRotation((value) => (value + 90) % 360), []);

  const fullscreen = useCallback(async () => {
    if (!stageRef.current) return;
    try {
      if (document.fullscreenElement === stageRef.current) await document.exitFullscreen();
      else await stageRef.current.requestFullscreen();
    } catch {
      setError("Fullscreen is not available in this browser.");
    }
  }, []);

  const handleStageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches("input, textarea, select, button, a, [contenteditable=true]")) return;

    const key = event.key.toLowerCase();
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      previous();
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      next();
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomIn();
    } else if (event.key === "-") {
      event.preventDefault();
      zoomOut();
    } else if (event.key === "0") {
      event.preventDefault();
      fitWidth();
    } else if (key === "r") {
      event.preventDefault();
      rotateRight();
    } else if (key === "f") {
      event.preventDefault();
      void fullscreen();
    }
  };

  const progress = pageCount ? Math.round((page / pageCount) * 100) : 0;
  const downloadUrl = url + (url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(downloadName);

  return (
    <section className="oo-reader" aria-label="PDF edition reader">
      <div className="oo-reader-toolbar">
        <div className="oo-reader-group" aria-label="Page navigation">
          <button type="button" onClick={previous} disabled={loading || page <= 1} aria-label="Previous page">←</button>
          <label className="oo-page-field">
            <span className="sr-only">Page number</span>
            <input
              aria-label="Page number"
              type="number"
              min={1}
              max={pageCount || 1}
              value={page}
              disabled={!pageCount}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isInteger(value) && value >= 1 && value <= pageCount) setPage(value);
              }}
            />
            <span aria-live="polite">/ {pageCount || "—"}</span>
          </label>
          <button type="button" onClick={next} disabled={loading || page >= pageCount} aria-label="Next page">→</button>
        </div>

        <div className="oo-reader-group" aria-label="Zoom controls">
          <button type="button" onClick={zoomOut} disabled={loading} aria-label="Zoom out">−</button>
          <span className="oo-zoom-label">{fit === "manual" ? Math.round(zoom * 100) + "%" : fit === "width" ? "Fit width" : "Fit page"}</span>
          <button type="button" onClick={zoomIn} disabled={loading} aria-label="Zoom in">+</button>
        </div>

        <div className="oo-reader-group" aria-label="Page display controls">
          <button type="button" onClick={fitWidth} disabled={loading} aria-pressed={fit === "width"}>Fit width</button>
          <button type="button" onClick={fitPage} disabled={loading} aria-pressed={fit === "page"}>Fit page</button>
          <button type="button" onClick={rotateLeft} disabled={loading} aria-label="Rotate page left">↶</button>
          <button type="button" onClick={rotateRight} disabled={loading} aria-label="Rotate page right">↷</button>
          <button type="button" onClick={() => void fullscreen()} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={isFullscreen}>⛶</button>
        </div>

        <div className="oo-reader-group oo-reader-file-actions" aria-label="PDF file actions">
          <a className="oo-reader-open" href={url} target="_blank" rel="noreferrer">Open original PDF ↗</a>
          <a className="oo-reader-download" href={downloadUrl}>Download ↓</a>
        </div>
      </div>

      <div className="oo-reader-progress">
        <label className="oo-reader-progress-label" htmlFor="oo-reader-page-range">
          <span>Reading progress</span>
          <strong aria-live="polite">{pageCount ? "Page " + page + " of " + pageCount + " · " + progress + "%" : "Preparing your edition"}</strong>
        </label>
        <input
          id="oo-reader-page-range"
          type="range"
          min={1}
          max={Math.max(pageCount, 1)}
          value={Math.min(page, pageCount || 1)}
          disabled={!pageCount || loading}
          aria-valuetext={pageCount ? "Page " + page + " of " + pageCount : "Loading edition"}
          onChange={(event) => setPage(Number(event.target.value))}
        />
      </div>

      <div
        className="oo-reader-stage"
        ref={stageRef}
        tabIndex={0}
        onKeyDown={handleStageKeyDown}
        aria-label={title + ". Focus this reading area for keyboard controls."}
      >
        {loading && <p className="oo-reader-status" role="status">Preparing your edition…</p>}
        {error && (
          <div className="oo-reader-error" role="alert">
            <strong>Unable to display this edition</strong>
            <p>{error}</p>
            <a href={url} target="_blank" rel="noreferrer">Open the original PDF directly ↗</a>
          </div>
        )}
        <canvas ref={canvasRef} className="oo-reader-canvas" aria-label={"Page " + page + " of " + pageCount}/>
      </div>
      <p className="oo-reader-hint">Keyboard (focus the page): ← → or Page Up/Down to turn pages · + / − to zoom · 0 to fit width · R to rotate · F for fullscreen</p>
      <p className="oo-reader-accessibility-note">Need selectable text or assistive-technology support? Open the original PDF using the link above.</p>
    </section>
  );
}
