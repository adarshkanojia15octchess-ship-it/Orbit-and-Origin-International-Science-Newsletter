"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createIssueRecord } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

async function hasPrefix(file: File, prefix: number[]) {
  const bytes = new Uint8Array(await file.slice(0, prefix.length).arrayBuffer());
  return prefix.every((value, index) => bytes[index] === value);
}

async function validPdf(file: File) {
  return file.size > 0 &&
    file.size <= MAX_PDF_BYTES &&
    (file.type === "application/pdf" || file.type === "") &&
    await hasPrefix(file, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

async function coverExtension(file: File): Promise<"jpg" | "png" | "webp" | null> {
  if (!file.size || file.size > MAX_COVER_BYTES) return null;
  if ((file.type === "image/jpeg" || file.type === "") && await hasPrefix(file, [0xff, 0xd8, 0xff])) return "jpg";
  if ((file.type === "image/png" || file.type === "") && await hasPrefix(file, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if ((file.type === "image/webp" || file.type === "") &&
      await hasPrefix(file, [0x52, 0x49, 0x46, 0x46]) &&
      new TextDecoder().decode(new Uint8Array(await file.slice(8, 12).arrayBuffer())) === "WEBP") return "webp";
  return null;
}

export default function FounderIssueUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const issueNumber = Number(values.get("issue_number"));
    const title = String(values.get("title") || "").trim();
    const description = String(values.get("description") || "").trim();
    const publicationDate = String(values.get("publication_date") || "");
    const departments = values.getAll("departments").filter((value): value is string => typeof value === "string");
    const pdf = values.get("pdf");
    const cover = values.get("cover");

    setError("");
    setSuccess("");

    if (!Number.isInteger(issueNumber) || issueNumber < 1 || issueNumber > 999999 ||
        title.length < 3 || title.length > 160 ||
        description.length < 10 || description.length > 2000 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(publicationDate) || departments.length < 1) {
      setError("Complete the issue number, title, description, date and at least one department.");
      return;
    }
    if (!(pdf instanceof File) || !(await validPdf(pdf))) {
      setError("Choose a real PDF file no larger than 25 MB.");
      return;
    }
    if (!(cover instanceof File)) {
      setError("Choose a JPEG, PNG or WebP cover image no larger than 8 MB.");
      return;
    }
    const coverType = await coverExtension(cover);
    if (!coverType) {
      setError("The cover must be a valid JPEG, PNG or WebP image no larger than 8 MB.");
      return;
    }

    setBusy(true);
    let supabase: ReturnType<typeof createClient> | null = null;
    let pdfPath = "";
    let coverPath = "";
    try {
      supabase = createClient();
      const objectBase = `issues/${issueNumber}/${crypto.randomUUID()}`;
      pdfPath = `${objectBase}.pdf`;
      coverPath = `${objectBase}-cover.${coverType}`;

      setProgress("Uploading the edition PDF directly to private storage…");
      const pdfUpload = await supabase.storage.from("issue-drafts").upload(pdfPath, pdf, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });
      if (pdfUpload.error) throw new Error("PDF upload failed. Check your administrator session and Supabase storage policy.");

      setProgress("Uploading the cover artwork…");
      const coverMime = coverType === "jpg" ? "image/jpeg" : `image/${coverType}`;
      const coverUpload = await supabase.storage.from("issue-drafts").upload(coverPath, cover, {
        contentType: coverMime,
        cacheControl: "3600",
        upsert: false,
      });
      if (coverUpload.error) throw new Error("Cover upload failed. The PDF will be removed from private storage; please try again.");

      setProgress("Verifying the uploaded files and saving the issue record…");
      const record = new FormData();
      record.set("issue_number", String(issueNumber));
      record.set("title", title);
      record.set("description", description);
      record.set("publication_date", publicationDate);
      for (const department of departments) record.append("departments", department);
      record.set("pdf_path", pdfPath);
      record.set("cover_path", coverPath);

      const saved = await createIssueRecord(record);
      if (!saved.ok) throw new Error(saved.message || "The issue record could not be saved.");

      setSuccess(`Issue ${String(issueNumber).padStart(3, "0")} has been saved as a private draft. It is not public until you publish it.`);
      setProgress("");
      form.reset();
      router.refresh();
    } catch (reason) {
      if (supabase && (pdfPath || coverPath)) {
        await supabase.storage.from("issue-drafts").remove([pdfPath, coverPath].filter(Boolean));
      }
      setError(reason instanceof Error ? reason.message : "The upload could not be completed. Please try again.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oo-founder-upload-layout">
      <form className="oo-founder-upload-form" onSubmit={handleSubmit}>
        <div className="oo-founder-form-grid">
          <label className="form-field">Issue number<input name="issue_number" type="number" min="1" max="999999" defaultValue="3" required disabled={busy}/></label>
          <label className="form-field">Publication date<input name="publication_date" type="date" defaultValue="2026-11-21" required disabled={busy}/></label>
        </div>
        <label className="form-field">Edition title<input name="title" type="text" minLength={3} maxLength={160} defaultValue="The Mapped Cosmos" required disabled={busy}/></label>
        <label className="form-field">Public description<textarea name="description" rows={4} minLength={10} maxLength={2000} defaultValue="Euclid opens a new window onto the invisible Universe. This edition explores Euclid's DR1-Foundation release, the cosmic web and gravitational-lensing candidates, alongside FLIP exoplanet imaging, ISRO's NVS-03 and NASA's ESCAPADE mission." required disabled={busy}/></label>
        <fieldset className="oo-founder-departments" disabled={busy}>
          <legend>Departments represented</legend>
          <label><input type="checkbox" name="departments" value="tapestry-of-worlds" defaultChecked/> Tapestry of Worlds</label>
          <label><input type="checkbox" name="departments" value="frontier-tech" defaultChecked/> Frontier Tech</label>
          <label><input type="checkbox" name="departments" value="universal-record" defaultChecked/> The Universal Record</label>
        </fieldset>
        <label className="form-field">Complete issue PDF <span className="oo-founder-field-hint">PDF · maximum 25 MB</span><input type="file" name="pdf" accept="application/pdf,.pdf" required disabled={busy}/></label>
        <label className="form-field">Cover image <span className="oo-founder-field-hint">JPEG, PNG or WebP · maximum 8 MB</span><input type="file" name="cover" accept="image/jpeg,image/png,image/webp" required disabled={busy}/></label>
        {error && <p className="oo-founder-error" role="alert">{error}</p>}
        {success && <p className="oo-founder-notice" role="status">{success}</p>}
        {progress && <p className="oo-founder-upload-progress" role="status">{progress}</p>}
        <div className="oo-founder-form-actions">
          <button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload and save as draft ↗"}</button>
          <span>Large files upload directly to private Supabase storage. Nothing is public until you publish.</span>
        </div>
      </form>
      <aside className="oo-founder-upload-note">
        <span className="kicker">READY FOR ISSUE 003</span>
        <strong>The Mapped Cosmos</strong>
        <p>The details are prefilled from the attached 10-page Issue 003 edition. Confirm them, select the PDF from your device and add its cover artwork.</p>
        <dl>
          <div><dt>Release date</dt><dd>21 November 2026</dd></div>
          <div><dt>Departments</dt><dd>All three editorial departments</dd></div>
          <div><dt>Upload state</dt><dd>Private draft until you publish</dd></div>
        </dl>
        <Link href="/issues" target="_blank">See the public archive ↗</Link>
      </aside>
    </div>
  );
}
