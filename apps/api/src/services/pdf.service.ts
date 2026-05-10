import fontkit from "@pdf-lib/fontkit";
import type { ClientEmail, MeetingSummary, RepNote } from "@scoach/types";
import { readFile } from "node:fs/promises";
import { type PDFDocument, PDFDocument as PDFDoc, type PDFFont, type PDFPage, rgb } from "pdf-lib";

/**
 * Render a MeetingSummary into a multi-page PDF using pdf-lib.
 *
 * Sections:
 *   1. Header with title, client, date, duration
 *   2. At-a-glance: score, deal health, confidence, hint stats, sentiment delta
 *   3. What went well
 *   4. Where to push deeper
 *   5. Stated vs actual needs (two columns)
 *   6. Action items (with checkbox glyphs)
 *   7. Upsell opportunities
 *   8. Risks
 *   9. Top moments
 *  10. Client email (full body, ready to share)
 *  11. Reference links
 *  12. Private notes (rep-only)
 *  13. Full transcript
 *
 * Hebrew text renders left-to-right (pdf-lib has no Bidi engine) — readable
 * but not visually RTL. Documented in apps/api/assets/fonts/README.md.
 */

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 54;
const FOOTER_RESERVE = 40;

const COLORS = {
  text: rgb(0.13, 0.13, 0.14),
  muted: rgb(0.4, 0.42, 0.44),
  faint: rgb(0.55, 0.57, 0.6),
  hairline: rgb(0.85, 0.86, 0.87),
  blue: rgb(0.10, 0.45, 0.91),
  green: rgb(0.12, 0.56, 0.24),
  yellow: rgb(0.78, 0.43, 0),
  red: rgb(0.69, 0, 0.13),
  surfaceTint: rgb(0.96, 0.97, 0.99),
  surfaceTint2: rgb(0.94, 0.96, 0.99),
  greenTint: rgb(0.92, 0.97, 0.93),
  yellowTint: rgb(0.99, 0.96, 0.88),
  redTint: rgb(0.99, 0.93, 0.93),
};

let _regular: Uint8Array | null = null;
let _bold: Uint8Array | null = null;
async function loadFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  if (!_regular) {
    _regular = new Uint8Array(
      await readFile(new URL("../../assets/fonts/NotoSansHebrew-Regular.ttf", import.meta.url)),
    );
  }
  if (!_bold) {
    _bold = new Uint8Array(
      await readFile(new URL("../../assets/fonts/NotoSansHebrew-Bold.ttf", import.meta.url)),
    );
  }
  return { regular: _regular, bold: _bold };
}

export interface RenderSummaryPdfOptions {
  notes?: RepNote[];
  sentimentValues?: number[];
}

export async function renderSummaryPdf(
  summary: MeetingSummary,
  opts: RenderSummaryPdfOptions = {},
): Promise<Uint8Array> {
  const pdf = await PDFDoc.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${summary.meeting.client} — ${summary.meeting.title}`);
  pdf.setAuthor("Sally — AI Sales Assistant");
  pdf.setCreator("Sally — AI Sales Assistant");

  const fontBytes = await loadFonts();
  const font = await pdf.embedFont(fontBytes.regular, { subset: true });
  const bold = await pdf.embedFont(fontBytes.bold, { subset: true });

  const ctx: RenderCtx = {
    pdf,
    font,
    bold,
    page: pdf.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
  };

  drawHeader(ctx, summary);
  drawAtAGlance(ctx, summary, opts.sentimentValues ?? []);

  if (summary.internal.wentWell.length > 0) {
    sectionHeader(ctx, "WHAT WENT WELL", COLORS.green);
    bulletList(ctx, summary.internal.wentWell);
    sectionGap(ctx);
  }

  if (summary.internal.couldImprove.length > 0) {
    sectionHeader(ctx, "WHERE TO PUSH DEEPER", COLORS.yellow);
    bulletList(ctx, summary.internal.couldImprove);
    sectionGap(ctx);
  }

  if (summary.internal.needs && (summary.internal.needs.stated.length > 0 || summary.internal.needs.actual.length > 0)) {
    drawNeedsTable(ctx, summary.internal.needs.stated, summary.internal.needs.actual);
    sectionGap(ctx);
  }

  if (summary.internal.actionItems.length > 0) {
    sectionHeader(ctx, "ACTION ITEMS", COLORS.muted);
    for (const a of summary.internal.actionItems) {
      drawCheckLine(ctx, `[${a.who}] ${a.what}  —  due ${a.due}`);
    }
    sectionGap(ctx);
  }

  if (summary.internal.upsell.length > 0) {
    sectionHeader(ctx, "UPSELL OPPORTUNITIES", COLORS.blue);
    for (const u of summary.internal.upsell) {
      const arr = u.estimatedMonthlyArr ? `  ·  est. $${u.estimatedMonthlyArr.toLocaleString()}/mo` : "";
      labeledBullet(ctx, u.name, `${u.reason}${arr}`);
    }
    sectionGap(ctx);
  }

  if (summary.internal.risks.length > 0) {
    sectionHeader(ctx, "RISKS", COLORS.red);
    bulletList(ctx, summary.internal.risks);
    sectionGap(ctx);
  }

  if (summary.internal.topMoments.length > 0) {
    sectionHeader(ctx, "TOP MOMENTS", COLORS.muted);
    for (const m of summary.internal.topMoments) {
      drawMonoBullet(ctx, m.t, `${m.type} — "${m.quote}"`);
    }
    sectionGap(ctx);
  }

  drawClientEmail(ctx, summary.client);

  if (summary.references.length > 0) {
    sectionHeader(ctx, "REFERENCE LINKS", COLORS.blue);
    for (const r of summary.references) {
      labeledBullet(ctx, r.title, r.href);
    }
    sectionGap(ctx);
  }

  if (opts.notes && opts.notes.length > 0) {
    sectionHeader(ctx, "PRIVATE NOTES (REP ONLY)", COLORS.muted);
    for (const n of opts.notes) {
      drawMonoBullet(ctx, n.t || "—", n.text);
    }
    sectionGap(ctx);
  }

  drawFooter(ctx.page, ctx.font, summary.generatedAt);

  return pdf.save();
}

interface RenderCtx {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function safe(s: string, f: PDFFont): string {
  let out = "";
  for (const ch of s) {
    try {
      f.encodeText(ch);
      out += ch;
    } catch {
      // Skip characters the embedded font can't encode (rare codepoints, emoji).
    }
  }
  return out;
}

function ensureSpace(ctx: RenderCtx, neededHeight: number): void {
  if (ctx.y - neededHeight < MARGIN + FOOTER_RESERVE) {
    drawFooter(ctx.page, ctx.font, new Date().toISOString());
    ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;
  }
}

function drawText(
  ctx: RenderCtx,
  text: string,
  opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number; spacing?: number; lineHeight?: number } = {},
): void {
  const f = opts.font ?? ctx.font;
  const size = opts.size ?? 11;
  const color = opts.color ?? COLORS.text;
  const x = opts.x ?? MARGIN;
  const maxWidth = opts.maxWidth ?? PAGE_W - MARGIN * 2;
  const spacing = opts.spacing ?? 4;
  const lineHeight = opts.lineHeight ?? size * 1.35;

  const wrapped = wrapLines(safe(text, f), f, size, maxWidth);
  ensureSpace(ctx, wrapped.length * lineHeight + spacing);
  for (const segment of wrapped) {
    ctx.page.drawText(segment, { x, y: ctx.y, size, font: f, color });
    ctx.y -= lineHeight;
  }
  ctx.y -= spacing;
}

function wrapLines(text: string, f: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const paragraphs = text.split("\n");
  const out: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      const widthOk = f.widthOfTextAtSize(candidate, size) <= maxWidth;
      if (widthOk) {
        cur = candidate;
      } else {
        if (cur) out.push(cur);
        // Single very long word — hard-truncate by characters.
        if (f.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            if (f.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              if (chunk) out.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          cur = chunk;
        } else {
          cur = w;
        }
      }
    }
    if (cur) out.push(cur);
  }
  return out.length > 0 ? out : [""];
}

function drawHeader(ctx: RenderCtx, summary: MeetingSummary): void {
  drawText(ctx, "Sally — AI Sales Assistant", { font: ctx.bold, size: 9, color: COLORS.muted, spacing: 2 });
  drawText(ctx, summary.meeting.title || "Meeting", { font: ctx.bold, size: 20, spacing: 4, lineHeight: 24 });
  const sub = `${summary.meeting.client} · ${new Date(summary.meeting.date).toLocaleDateString()} · ${summary.meeting.duration}`;
  drawText(ctx, sub, { color: COLORS.muted, size: 10, spacing: 4 });
  if (summary.meeting.participants.length > 0) {
    drawText(ctx, `Participants: ${summary.meeting.participants.join(", ")}`, {
      color: COLORS.muted,
      size: 9,
      spacing: 12,
    });
  }
  rule(ctx);
}

function drawAtAGlance(ctx: RenderCtx, summary: MeetingSummary, sentimentValues: number[]): void {
  ensureSpace(ctx, 90);
  // Drawn as a filled tile.
  const tileH = 70;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - tileH,
    width: PAGE_W - MARGIN * 2,
    height: tileH,
    color: COLORS.surfaceTint,
    borderColor: COLORS.hairline,
    borderWidth: 0.5,
  });

  const innerY = ctx.y - 14;
  const colW = (PAGE_W - MARGIN * 2) / 4;

  function tile(idx: number, label: string, value: string, valueColor: ReturnType<typeof rgb>): void {
    const x = MARGIN + idx * colW + 12;
    ctx.page.drawText(safe(label, ctx.font), {
      x,
      y: innerY,
      size: 9,
      font: ctx.bold,
      color: COLORS.muted,
    });
    ctx.page.drawText(safe(value, ctx.bold), {
      x,
      y: innerY - 26,
      size: 18,
      font: ctx.bold,
      color: valueColor,
    });
  }

  const hi = summary.internal;
  const scoreColor = hi.score >= 70 ? COLORS.green : hi.score >= 40 ? COLORS.yellow : COLORS.red;
  const healthColor = hi.health === "hot" ? COLORS.green : hi.health === "warm" ? COLORS.yellow : COLORS.red;

  tile(0, "SCORE", `${hi.score}/100`, scoreColor);
  tile(1, "DEAL HEALTH", hi.health.charAt(0).toUpperCase() + hi.health.slice(1), healthColor);

  const hintsTotal = hi.hintsSurfaced ?? 0;
  const hintsActed = hi.hintsActed ?? 0;
  tile(2, "HINTS", `${hintsTotal}${hintsTotal > 0 ? `  /  ${hintsActed} used` : ""}`, COLORS.text);

  let sentimentLabel = "—";
  if (sentimentValues.length > 0) {
    const first = sentimentValues[0] ?? 50;
    const last = sentimentValues[sentimentValues.length - 1] ?? 50;
    const delta = last - first;
    sentimentLabel = `${delta >= 0 ? "+" : ""}${delta}`;
  } else if (hi.sentimentDelta != null) {
    sentimentLabel = `${hi.sentimentDelta >= 0 ? "+" : ""}${hi.sentimentDelta}`;
  }
  tile(3, "SENTIMENT Δ", sentimentLabel, COLORS.blue);

  ctx.y -= tileH + 6;
  drawText(ctx, `Confidence: ${Math.round(hi.confidence * 100)}%`, {
    color: COLORS.muted,
    size: 9,
    spacing: 12,
  });
  rule(ctx);
}

function drawNeedsTable(ctx: RenderCtx, stated: string[], actual: string[]): void {
  sectionHeader(ctx, "STATED vs. ACTUAL NEEDS", COLORS.muted);
  const colW = (PAGE_W - MARGIN * 2 - 16) / 2;

  // Estimate rows: count of items, plus header
  const rowsLeft = stated.length + 1;
  const rowsRight = actual.length + 1;
  const rows = Math.max(rowsLeft, rowsRight);
  ensureSpace(ctx, rows * 14 + 12);

  const startY = ctx.y;
  drawText(ctx, "CLIENT STATED", { font: ctx.bold, size: 8.5, color: COLORS.muted, spacing: 4, x: MARGIN });
  let leftY = ctx.y;
  ctx.y = startY;
  drawText(ctx, "COACH INFERRED", { font: ctx.bold, size: 8.5, color: COLORS.blue, spacing: 4, x: MARGIN + colW + 16 });
  let rightY = ctx.y;

  for (let i = 0; i < Math.max(stated.length, actual.length); i++) {
    const sIdx = stated[i];
    const aIdx = actual[i];
    if (sIdx) {
      ctx.y = leftY;
      drawText(ctx, `• ${sIdx}`, { size: 11, x: MARGIN, maxWidth: colW, spacing: 2 });
      leftY = ctx.y;
    }
    if (aIdx) {
      ctx.y = rightY;
      drawText(ctx, `• ${aIdx}`, { size: 11, x: MARGIN + colW + 16, maxWidth: colW, color: COLORS.text, spacing: 2 });
      rightY = ctx.y;
    }
  }
  ctx.y = Math.min(leftY, rightY) - 4;
}

function sectionHeader(ctx: RenderCtx, label: string, color: ReturnType<typeof rgb>): void {
  ensureSpace(ctx, 22);
  drawText(ctx, label, { font: ctx.bold, size: 10, color, spacing: 6 });
}

function bulletList(ctx: RenderCtx, items: string[]): void {
  for (const item of items) {
    drawText(ctx, `• ${item}`, { size: 11, spacing: 2 });
  }
}

function labeledBullet(ctx: RenderCtx, label: string, body: string): void {
  drawText(ctx, `• ${label}`, { font: ctx.bold, size: 11, spacing: 1 });
  drawText(ctx, `   ${body}`, { size: 10, color: COLORS.muted, spacing: 4 });
}

function drawCheckLine(ctx: RenderCtx, body: string): void {
  ensureSpace(ctx, 16);
  // Square checkbox glyph.
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 1,
    width: 9,
    height: 9,
    borderColor: COLORS.muted,
    borderWidth: 0.7,
  });
  drawText(ctx, `   ${body}`, { size: 11, spacing: 4, x: MARGIN + 4 });
}

function drawMonoBullet(ctx: RenderCtx, kicker: string, body: string): void {
  drawText(ctx, kicker, { font: ctx.bold, size: 9, color: COLORS.muted, spacing: 1 });
  drawText(ctx, body, { size: 11, spacing: 6 });
}

function sectionGap(ctx: RenderCtx): void {
  ctx.y -= 4;
  rule(ctx);
}

function rule(ctx: RenderCtx): void {
  ensureSpace(ctx, 12);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 4 },
    end: { x: PAGE_W - MARGIN, y: ctx.y + 4 },
    thickness: 0.4,
    color: COLORS.hairline,
  });
  ctx.y -= 10;
}

function drawClientEmail(ctx: RenderCtx, email: ClientEmail): void {
  sectionHeader(ctx, "CLIENT EMAIL — READY TO SEND", COLORS.muted);
  drawText(ctx, `Subject: ${email.subject}`, { font: ctx.bold, size: 11, spacing: 6 });

  // Render bodyText (manual edits) if present, otherwise structured pieces.
  if (email.bodyText && email.bodyText.trim().length > 0) {
    drawText(ctx, email.bodyText, { size: 10.5, spacing: 6, lineHeight: 14.5 });
  } else {
    if (email.greeting) drawText(ctx, email.greeting, { size: 10.5, spacing: 6 });
    for (const para of email.body) {
      // Strip the **bold** markup so it doesn't look like noise in the PDF.
      const cleaned = para.replace(/\*\*(.*?)\*\*/g, "$1");
      drawText(ctx, cleaned, { size: 10.5, spacing: 6, lineHeight: 14.5 });
    }
    if (email.signoff) drawText(ctx, email.signoff, { size: 10.5, spacing: 6 });
  }
  if (email.edited) {
    drawText(ctx, `(Manually edited${email.editedAt ? ` ${new Date(email.editedAt).toLocaleString()}` : ""})`, {
      size: 8.5,
      color: COLORS.faint,
      spacing: 6,
    });
  }
  sectionGap(ctx);
}

function drawFooter(page: PDFPage, font: PDFFont, generatedAt: string): void {
  const footer = `Generated ${new Date(generatedAt).toLocaleString()}  ·  Sally — AI Sales Assistant  ·  Confidential`;
  page.drawText(safe(footer, font), {
    x: MARGIN,
    y: 28,
    size: 8,
    font,
    color: COLORS.faint,
  });
}
