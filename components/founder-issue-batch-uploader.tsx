"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createIssueRecord } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import { createPdfFirstPageCover } from "@/src/editorial/pdfjs";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const MAX_BATCH_FILES = 8;

const departments = [
  { value: "tapestry-of-worlds", label: "Tapestry of Worlds" },
  { value: "frontier-tech", label: "Frontier Tech" },
  { value: "universal-record", label: "The Universal Record" },
] as const;

type Department = (typeof departments)[number]["value"];
type RowStatus = "queued" | "uploading" | "saved" | "error";

type BatchDraft = {
  id: string;
  pdf: File;
  issueNumber: string;
  title: string;
  description: string;
  publicationDate: string;
  selectedDepartments: Department[];
  cover: File | null;
  status: RowStatus;
  message: string;
};

async function hasPrefix(file: File, prefix: number[]) {
  const bytes = new Uint8Array(await file.slice(0, prefix.length).arrayBuffer());
  return prefix.every((value, index) => bytes[index] === value);
}

function suggestMetadata(filename: string) {
  const base = filename.replace(/\.pdf$/i, "");
  const match =
    base.match(/(?:issue|edition)\s*[-_ ]*0*(\d{1,6})/i) ??
    base.match(/^0*(\d{1,6})[\s_-]/);

  let title = base;
  if (match) {
    title = base
      .replace(/^.*?(?:issue|edition)\s*[-_ ]*0*\d{1,6}[\s_-]*/i, "")
      .replace(/^0*\d{1,6}[\s_-]*/, "");
  }
  title = title.replace(/[_-]+/g, " ").trim();

  return {
    issueNumber: match?.[1] ? String(Number(match[1])) : "",
    title: title.length >= 3 ? title : "",
  };
}

async function isValidPdf(file: File) {
  return file.size > 0 &&
    file.size <= MAX_PDF_BYTES &&
    file.name.toLowerCase().endsWith(".pdf") &&
    (file.type === "application/pdf" || file.type === "") &&
    await hasPrefix(file, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

async function coverExtension(file: File): Promise<"jpg" | "png" | "webp" | null> {
  if (!file.size || file.size > MAX_COVER_BYTES) return null;
  if ((file.type === "image/jpeg" || file.type === "") && await hasPrefix(file, [0xff, 0xd8, 0xff])) return "jpg";
  if ((file.type === "image/png" || file.type === "") &&
      await hasPrefix(file, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if ((file.type === "image/webp" || file.type === "") &&
      await hasPrefix(file, [0x52, 0x49, 0x46, 0x46]) &&
      new TextDecoder().decode(new Uint8Array(await file.slice(8, 12).arrayBuffer())) === "WEBP") return "webp";
  return null;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateDraft(row: BatchDraft) {
  const issueNumber = Number(row.issueNumber);
  if (!Number.isInteger(issueNumber) || issueNumber < 1 || issueNumber > 999999) {
    return "Enter a valid issue number.";
  }
  if (row.title.trim().length < 3 || row.title.trim().length > 160) {
    return "The title must contain 3–160 characters.";
  }
  if (row.description.trim().length < 10 || row.description.trim().length > 2000) {
    return "Add a description of 10–2,000 characters.";
  }
  if (!validDate(row.publicationDate)) {
    return "Enter a valid publication date.";
  }
  if (row.selectedDepartments.length === 0) {
    return "Select at least one department.";
  }
  return null;
}

function sizeLabel(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export default function FounderIssueBatchUploader() {
  const router = useRouter();
  const [items, setItems] = useState<BatchDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [queueError, setQueueError] = useState("");

  function updateItem(id: string, patch: Partial<BatchDraft>) {
    setItems((current) => current.map((item) =>
      item.id === id && item.status !== "saved"
        ? { ...item, ...patch, message: patch.status ? (patch.message || "") : "" }
        : item
    ));
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    setQueueError("");
    setNotice("");

    const additions: BatchDraft[] = [];
    const warnings: string[] = [];
    const existingNames = new Set(items.map((item) => item.pdf.name + ":" + item.pdf.size));

    for (const file of selected) {
      if (items.length + additions.length >= MAX_BATCH_FILES) {
        warnings.push("The batch is limited to eight PDFs.");
        break;
      }
      const fingerprint = file.name + ":" + file.size;
      if (existingNames.has(fingerprint)) {
        warnings.push(file.name + " is already in this batch.");
        continue;
      }
      if (!(await isValidPdf(file))) {
        warnings.push(file.name + " is not a valid PDF under 25 MB.");
        continue;
      }

      existingNames.add(fingerprint);
      const suggested = suggestMetadata(file.name);
      additions.push({
        id: crypto.randomUUID(),
        pdf: file,
        issueNumber: suggested.issueNumber,
        title: suggested.title,
        description: "",
        publicationDate: "",
        selectedDepartments: [],
        cover: null,
        status: "queued",
        message: "",
      });
    }

    if (additions.length) {
      setItems((current) => [...current, ...additions].slice(0, MAX_BATCH_FILES));
    }
    if (warnings.length) setQueueError(warnings.join(" "));
    if (additions.length) setNotice(additions.length + " PDF" + (additions.length === 1 ? "" : "s") + " added. Complete each edition's details before saving.");
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setQueueError("");
  }

  async function uploadBatch() {
    if (busy) return;
    const pending = items.filter((item) => item.status !== "saved");
    if (!pending.length) return;

    setBusy(true);
    setQueueError("");
    setNotice("Checking the publication library for duplicate issue numbers…");

    try {
      const supabase = createClient();
      const { data: existingRows, error: listError } = await supabase
        .from("issues")
        .select("issue_number");
      if (listError) throw new Error("The existing issue library could not be checked. No files were uploaded.");

      const existingNumbers = new Set<number>((existingRows || []).map((row) => Number(row.issue_number)));
      const seenNumbers = new Set<number>();
      const ready: BatchDraft[] = [];

      for (const item of pending) {
        const problem = validateDraft(item);
        const number = Number(item.issueNumber);
        if (problem) {
          updateItem(item.id, { status: "error", message: problem });
          continue;
        }
        if (seenNumbers.has(number)) {
          updateItem(item.id, { status: "error", message: "This issue number is repeated in the current batch." });
          continue;
        }
        seenNumbers.add(number);
        if (existingNumbers.has(number)) {
          updateItem(item.id, { status: "error", message: "Issue " + String(number).padStart(3, "0") + " already exists. This importer never overwrites an existing issue." });
          continue;
        }
        ready.push(item);
      }

      if (!ready.length) {
        setNotice("");
        return;
      }

      let savedCount = 0;
      for (let index = 0; index < ready.length; index += 1) {
        const item = ready[index];
        const issueNumber = Number(item.issueNumber);
        let pdfPath = "";
        let coverPath = "";

        updateItem(item.id, {
          status: "uploading",
          message: "Preparing PDF and cover artwork…",
        });
        setNotice("Saving edition " + (index + 1) + " of " + ready.length + " as a private draft…");

        try {
          let coverFile: File;
          if (item.cover) {
            const extension = await coverExtension(item.cover);
            if (!extension) throw new Error("The selected cover must be a valid JPEG, PNG or WebP under 8 MB.");
            coverFile = item.cover;
          } else {
            const preview = await createPdfFirstPageCover(item.pdf);
            if (preview.size > MAX_COVER_BYTES) throw new Error("The first-page cover preview exceeds 8 MB.");
            coverFile = new File([preview], "issue-" + issueNumber + "-cover.png", { type: "image/png" });
          }

          const extension = await coverExtension(coverFile);
          if (!extension) throw new Error("A valid cover preview could not be prepared.");

          const objectBase = "issues/" + issueNumber + "/" + crypto.randomUUID();
          pdfPath = objectBase + ".pdf";
          coverPath = objectBase + "-cover." + extension;

          const pdfUpload = await supabase.storage.from("issue-drafts").upload(pdfPath, item.pdf, {
            contentType: "application/pdf",
            cacheControl: "3600",
            upsert: false,
          });
          if (pdfUpload.error) throw new Error("PDF upload failed. Check the administrator storage policy.");

          const coverMime = extension === "jpg" ? "image/jpeg" : "image/" + extension;
          const coverUpload = await supabase.storage.from("issue-drafts").upload(coverPath, coverFile, {
            contentType: coverMime,
            cacheControl: "3600",
            upsert: false,
          });
          if (coverUpload.error) throw new Error("Cover upload failed. The incomplete private upload will be removed.");

          const record = new FormData();
          record.set("issue_number", String(issueNumber));
          record.set("title", item.title.trim());
          record.set("description", item.description.trim());
          record.set("publication_date", item.publicationDate);
          for (const department of item.selectedDepartments) record.append("departments", department);
          record.set("pdf_path", pdfPath);
          record.set("cover_path", coverPath);

          const created = await createIssueRecord(record);
          if (!created.ok) throw new Error(created.message || "The issue record could not be saved.");

          existingNumbers.add(issueNumber);
          savedCount += 1;
          updateItem(item.id, { status: "saved", message: "Private draft saved. It is not public until you publish it." });
        } catch (reason) {
          if (pdfPath || coverPath) {
            await supabase.storage.from("issue-drafts").remove([pdfPath, coverPath].filter(Boolean));
          }
          updateItem(item.id, {
            status: "error",
            message: reason instanceof Error ? reason.message : "This edition could not be uploaded.",
          });
        }
      }

      setNotice(
        savedCount + " of " + ready.length + " edition" + (ready.length === 1 ? "" : "s") +
        " saved as private drafts. Review each one in the publication library before publishing."
      );
      router.refresh();
    } catch (reason) {
      setQueueError(reason instanceof Error ? reason.message : "The batch could not be checked. Please try again.");
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = items.filter((item) => item.status !== "saved").length;
  const savedCount = items.filter((item) => item.status === "saved").length;

  return (
    <div className="oo-batch-uploader">
      <div className="oo-batch-intro">
        <div>
          <strong>Bring the archive together.</strong>
          <p>Select up to eight issue PDFs. Each file gets its own issue number, title, publication date, description and department selection.</p>
        </div>
        <span className="oo-batch-limit">PDF · 25 MB EACH · 8 EDITIONS</span>
      </div>

      <label className="oo-batch-file-picker">
        <span className="oo-batch-file-icon" aria-hidden="true">＋</span>
        <span><strong>Select issue PDFs</strong><small>Choose several editions at once · PDF files only</small></span>
        <input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => void handleFilesChange(event)} disabled={busy || items.length >= MAX_BATCH_FILES}/>
      </label>

      {queueError && <p className="oo-founder-error" role="alert">{queueError}</p>}
      {notice && <p className="oo-founder-notice" role="status">{notice}</p>}

      {items.length > 0 && (
        <div className="oo-batch-list">
          <div className="oo-batch-list-heading">
            <span>{items.length} selected edition{items.length === 1 ? "" : "s"}</span>
            <span>{savedCount} saved as draft · {pendingCount} remaining</span>
          </div>

          {items.map((item, index) => (
            <article className={"oo-batch-card oo-batch-card-" + item.status} key={item.id}>
              <div className="oo-batch-card-top">
                <div>
                  <span className="kicker">EDITION {String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.pdf.name}</strong>
                  <small>{sizeLabel(item.pdf.size)}</small>
                </div>
                <div className="oo-batch-card-state">
                  <span className={"oo-batch-status oo-batch-status-" + item.status}>
                    {item.status === "saved" ? "Draft saved" : item.status === "uploading" ? "Uploading" : item.status === "error" ? "Needs attention" : "Ready for details"}
                  </span>
                  <button type="button" className="oo-batch-remove" onClick={() => removeItem(item.id)} disabled={busy || item.status === "saved"} aria-label={"Remove " + item.pdf.name}>Remove</button>
                </div>
              </div>

              <div className="oo-batch-fields">
                <label>Issue number
                  <input type="number" min="1" max="999999" value={item.issueNumber} disabled={busy || item.status === "saved"} onChange={(event) => updateItem(item.id, { issueNumber: event.target.value })}/>
                </label>
                <label>Edition title
                  <input type="text" minLength={3} maxLength={160} value={item.title} disabled={busy || item.status === "saved"} onChange={(event) => updateItem(item.id, { title: event.target.value })} placeholder="Enter the published title"/>
                </label>
                <label>Publication date
                  <input type="date" value={item.publicationDate} disabled={busy || item.status === "saved"} onChange={(event) => updateItem(item.id, { publicationDate: event.target.value })}/>
                </label>
                <label className="oo-batch-description">Public description
                  <textarea rows={3} minLength={10} maxLength={2000} value={item.description} disabled={busy || item.status === "saved"} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="Write the description exactly as it should appear in the archive."/>
                </label>
              </div>

              <fieldset className="oo-batch-departments" disabled={busy || item.status === "saved"}>
                <legend>Departments represented</legend>
                {departments.map((department) => (
                  <label key={department.value}>
                    <input
                      type="checkbox"
                      checked={item.selectedDepartments.includes(department.value)}
                      onChange={(event) => {
                        const selected = event.target.checked
                          ? [...item.selectedDepartments, department.value]
                          : item.selectedDepartments.filter((value) => value !== department.value);
                        updateItem(item.id, { selectedDepartments: selected });
                      }}
                    />
                    {department.label}
                  </label>
                ))}
              </fieldset>

              <label className="oo-batch-cover">
                <span>Separate cover image <small>Optional · JPEG, PNG or WebP · maximum 8 MB</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || item.status === "saved"} onChange={(event) => updateItem(item.id, { cover: event.target.files?.[0] || null })}/>
                <small>{item.cover ? item.cover.name : "No separate cover selected. The first PDF page will be used as the preview cover."}</small>
              </label>

              {item.message && <p className={item.status === "error" ? "oo-founder-error" : "oo-founder-notice"} role="status">{item.message}</p>}
            </article>
          ))}
        </div>
      )}

      <div className="oo-batch-actions">
        <button type="button" onClick={() => void uploadBatch()} disabled={busy || pendingCount === 0}>
          {busy ? "Saving editions…" : "Upload selected editions as drafts ↗"}
        </button>
        <span>Files are uploaded directly to private Supabase storage. No edition is published automatically.</span>
      </div>
    </div>
  );
}
