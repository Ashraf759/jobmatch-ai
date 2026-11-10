// Builds a tailored copy of a résumé: applies the accepted rewrites to the real résumé text,
// adds the suggested summary, and turns the result into a Word file. Runs in the browser, free.
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";

export type Rewrite = { original: string; rewritten: string; why?: string };
export type Wording = { yours: string; theirs: string };
export type Line = { text: string; kind: "name" | "heading" | "bullet" | "text"; changed?: boolean };

const MARK = "\u2063"; // invisible marker for rewritten lines
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const BULLET = /^\s*([•●▪◦‣\-–—*·]|\d+[.)])\s+/;
const HEADING =
  /^(professional\s+)?(summary|profile|objective|about me|(work\s+|professional\s+|relevant\s+)?experience|employment|work history|internships?|education|academic background|(technical\s+|core\s+|key\s+)?skills|technologies|tech stack|competencies|(academic\s+|personal\s+|key\s+)?projects?|certifications?|licenses?|courses|awards|honors|publications|volunteer(ing)?|leadership|activities|interests)\b/i;

function isHeading(line: string) {
  const plain = line.replace(/[:|#*_]/g, "").trim();
  if (plain.length > 40) return false;
  return HEADING.test(plain) || (plain.length >= 7 && plain === plain.toUpperCase() && /[A-Z]/.test(plain) && plain.split(" ").length <= 4);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildTailored(
  text: string,
  opts: { summary: string | null; rewrites: Rewrite[]; wording: Wording[] },
): { lines: Line[]; applied: number; missed: number } {
  let raw = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Swap in each accepted rewrite where its original bullet appears
  let applied = 0;
  for (const rw of opts.rewrites) {
    const target = squash(rw.original);
    if (target.length < 12) continue;
    let done = false;
    for (let i = 0; i < raw.length && !done; i++) {
      const first = squash(raw[i].replace(BULLET, ""));
      if (first.length < 12) continue;
      // Whole bullet on one line
      if (first.includes(target.slice(0, 40)) && first.length >= target.length * 0.8) {
        raw[i] = `• ${MARK}${rw.rewritten}`;
        done = true;
        break;
      }
      // Bullet wrapped over several lines (common in PDFs)
      if (target.startsWith(first.slice(0, Math.min(40, first.length)))) {
        let combined = first;
        let j = i + 1;
        while (j < raw.length && combined.length < target.length * 0.9 && j - i < 5) {
          combined += squash(raw[j]);
          j++;
        }
        if (combined.length >= target.length * 0.8) {
          raw.splice(i, j - i, `• ${MARK}${rw.rewritten}`);
          done = true;
        }
      }
    }
    if (done) applied++;
  }

  // 2. Use the job's wording for short skill names (whole words only)
  for (const w of opts.wording) {
    if (w.yours.length > 30 || w.theirs.length > 40) continue;
    const re = new RegExp(`(?<![\\w.])${escapeRegex(w.yours)}(?![\\w.])`, "gi");
    raw = raw.map((l) => l.replace(re, w.theirs));
  }

  // 3. Classify lines for formatting
  // Word files often lose their bullet symbols, so long sentences under
  // Experience or Projects are treated as bullet points too
  let section = "";
  let lines: Line[] = raw.map((l, i) => {
    if (i === 0) return { text: l, kind: "name" };
    if (isHeading(l)) {
      section = l.toLowerCase();
      return { text: l.replace(/:$/, ""), kind: "heading" };
    }
    if (
      !BULLET.test(l) &&
      /experience|employment|project|internship|leadership|volunteer/.test(section) &&
      l.split(/\s+/).length >= 8 &&
      !/\|/.test(l)
    ) {
      return { text: l.replace(MARK, ""), kind: "bullet", changed: l.startsWith(MARK) };
    }
    if (BULLET.test(l)) {
      const body = l.replace(BULLET, "");
      return { text: body.replace(MARK, ""), kind: "bullet", changed: body.startsWith(MARK) };
    }
    return { text: l, kind: "text" };
  });

  // 4. Put the suggested summary at the top
  if (opts.summary) {
    const first = lines.findIndex((l) => l.kind === "heading");
    const summaryLine: Line = { text: opts.summary, kind: "text", changed: true };
    if (first >= 0 && /summary|profile|objective|about/i.test(lines[first].text)) {
      // Replace the existing summary paragraph
      let end = first + 1;
      while (end < lines.length && lines[end].kind !== "heading") end++;
      lines = [...lines.slice(0, first + 1), summaryLine, ...lines.slice(end)];
    } else {
      const at = first >= 0 ? first : Math.min(2, lines.length);
      lines = [...lines.slice(0, at), { text: "SUMMARY", kind: "heading" }, summaryLine, ...lines.slice(at)];
    }
  }

  return { lines, applied, missed: opts.rewrites.length - applied };
}

export async function makeDocx(lines: Line[]): Promise<Blob> {
  const children = lines.map((l) => {
    if (l.kind === "name")
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: l.text, bold: true, size: 36, font: "Calibri" })],
      });
    if (l.kind === "heading")
      return new Paragraph({
        spacing: { before: 240, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
        children: [new TextRun({ text: l.text.toUpperCase(), bold: true, size: 22, font: "Calibri" })],
      });
    if (l.kind === "bullet")
      return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text: l.text, size: 21, font: "Calibri" })],
      });
    return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: l.text, size: 21, font: "Calibri" })] });
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
  });
  return Packer.toBlob(doc);
}
