import type { MeetingSummary } from "@scoach/types";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Render a MeetingSummary into a PDF using pdf-lib.
 * Sprint 5: client-friendly internal summary (Score, Health, Wins, Risks, Action Items).
 * Future: Sprint 5+ branded template + cloud-style header.
 */
export async function renderSummaryPdf(summary: MeetingSummary): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${summary.meeting.client} — ${summary.meeting.title}`);
  pdf.setAuthor("SuperCloud Sales Coach");
  pdf.setCreator("SuperCloud Sales Coach");

  const page = pdf.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = height - 60;
  const margin = 60;

  function line(text: string, opts: { font?: typeof font; size?: number; color?: ReturnType<typeof rgb>; spacing?: number } = {}) {
    const f = opts.font ?? font;
    const size = opts.size ?? 11;
    const color = opts.color ?? rgb(0.13, 0.13, 0.14);
    const spacing = opts.spacing ?? 6;
    page.drawText(text, { x: margin, y, size, font: f, color, maxWidth: width - margin * 2 });
    y -= size + spacing;
  }
  function spacer(px = 14) {
    y -= px;
  }
  function rule() {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.86, 0.87),
    });
    spacer(10);
  }

  // Header
  line("SuperCloud Sales Coach", { font: bold, size: 9, color: rgb(0.4, 0.42, 0.44), spacing: 2 });
  line(summary.meeting.title, { font: bold, size: 18, spacing: 4 });
  line(
    `${summary.meeting.client} · ${new Date(summary.meeting.date).toLocaleDateString()} · ${summary.meeting.duration}`,
    { color: rgb(0.4, 0.42, 0.44), size: 10, spacing: 12 },
  );
  rule();

  // At a glance
  line("AT A GLANCE", { font: bold, size: 10, color: rgb(0.4, 0.42, 0.44), spacing: 8 });
  line(`Score: ${summary.internal.score}/100   ·   Deal health: ${summary.internal.health}   ·   Confidence: ${Math.round(summary.internal.confidence * 100)}%`, { size: 11, spacing: 12 });
  rule();

  // Went well
  line("WHAT WENT WELL", { font: bold, size: 10, color: rgb(0.12, 0.56, 0.24), spacing: 8 });
  for (const w of summary.internal.wentWell) line(`• ${w}`);
  spacer();
  rule();

  // Could improve
  line("WHERE TO PUSH DEEPER", { font: bold, size: 10, color: rgb(0.78, 0.43, 0), spacing: 8 });
  for (const w of summary.internal.couldImprove) line(`• ${w}`);
  spacer();
  rule();

  // Action items
  line("ACTION ITEMS", { font: bold, size: 10, color: rgb(0.4, 0.42, 0.44), spacing: 8 });
  for (const a of summary.internal.actionItems) {
    line(`• [${a.who}] ${a.what}  ·  due ${a.due}`);
  }
  spacer();
  rule();

  // Footer
  line(
    `Generated ${new Date(summary.generatedAt).toLocaleString()}  ·  SuperCloud Sales Coach`,
    { size: 8, color: rgb(0.55, 0.57, 0.6) },
  );

  return pdf.save();
}
