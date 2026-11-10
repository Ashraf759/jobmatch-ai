// Résumé Health Report: a free, rule-based check that runs on every upload.
// No AI and no API calls: it reads the résumé text and applies simple, explainable rules.

export type HealthCategory = { key: string; label: string; points: number; max: number; note: string };
export type HealthIssue = { level: "high" | "medium" | "low"; title: string; detail: string; examples?: string[] };
export type HealthReport = {
  score: number;
  grade: string;
  categories: HealthCategory[];
  issues: HealthIssue[];
  strengths: string[];
  stats: {
    words: number;
    pages: number;
    bullets: number;
    quantified: number;
    actionVerbStarts: number;
    sections: string[];
  };
  checked_at: string;
};

const SECTION_PATTERNS: [string, RegExp][] = [
  ["Summary", /^(professional\s+)?(summary|profile|objective|about me)\b/i],
  ["Experience", /^(work\s+|professional\s+|relevant\s+)?(experience|employment|work history|internships?)\b/i],
  ["Education", /^(education|academic background|academics)\b/i],
  ["Skills", /^(technical\s+|core\s+|key\s+)?(skills|technologies|tech stack|competencies|tools)\b/i],
  ["Projects", /^(academic\s+|personal\s+|key\s+)?projects?\b/i],
  ["Certifications", /^(certifications?|licenses?|courses)\b/i],
];

const ACTION_VERBS = new Set(
  (
    "achieved analyzed architected automated boosted built collaborated configured consolidated coordinated created " +
    "cut debugged decreased defined delivered deployed designed developed directed drove enabled engineered enhanced " +
    "established evaluated executed expanded generated grew guided identified implemented improved increased initiated " +
    "integrated launched led maintained managed mentored migrated modeled monitored optimized orchestrated organized " +
    "owned partnered performed planned presented prioritized produced programmed published redesigned reduced refactored " +
    "resolved restructured revamped saved scaled secured shipped simplified solved spearheaded standardized streamlined " +
    "supervised tested trained transformed translated tuned upgraded validated visualized wrote cleaned queried " +
    "researched prototyped documented authored assessed audited forecasted negotiated recruited taught"
  ).split(" "),
);

const WEAK_PHRASES = [
  "responsible for",
  "worked on",
  "helped with",
  "helped to",
  "assisted with",
  "assisted in",
  "duties included",
  "tasked with",
  "involved in",
  "participated in",
  "in charge of",
];

const BUZZWORDS = [
  "hardworking",
  "hard-working",
  "team player",
  "go-getter",
  "self-starter",
  "results-driven",
  "results-oriented",
  "detail-oriented",
  "think outside the box",
  "synergy",
  "dynamic",
  "passionate",
  "highly motivated",
  "best of breed",
  "go-to person",
  "proven track record",
];

const BULLET_START = /^\s*([•●▪◦‣\-–—*·o]|\d+[.)])\s+/;

function clean(line: string) {
  return line.replace(BULLET_START, "").trim();
}

function shorten(s: string, n = 90) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function gradeFor(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  return "Needs work";
}

export function analyzeResume(rawText: string): HealthReport {
  const text = (rawText || "").replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean).length;
  const pages = Math.max(1, Math.ceil(words / 500));
  const lower = text.toLowerCase();

  // ---------- Sections ----------
  const found = new Set<string>();
  for (const line of lines) {
    if (line.length > 40) continue; // headings are short
    const plain = line.replace(/[:|#*_]/g, "").trim();
    for (const [name, re] of SECTION_PATTERNS) if (re.test(plain)) found.add(name);
  }
  const sections = SECTION_PATTERNS.map(([n]) => n).filter((n) => found.has(n));

  // ---------- Bullets ----------
  // A bullet is a line that starts with a bullet symbol, or a sentence-like line that starts with a verb
  const bulletLines = lines
    .filter((l) => BULLET_START.test(l) || (clean(l).split(" ").length >= 6 && ACTION_VERBS.has(firstWord(l))))
    .map(clean)
    .filter((l) => l.split(" ").length >= 4);
  const bullets = bulletLines.length;
  const quantifiedLines = bulletLines.filter((l) => /\d|%|\$/.test(l));
  const quantified = quantifiedLines.length;
  const actionLines = bulletLines.filter((l) => ACTION_VERBS.has(firstWord(l)));
  const actionVerbStarts = actionLines.length;
  const longBullets = bulletLines.filter((l) => l.split(" ").length > 35);

  // ---------- Language ----------
  const weakHits = bulletLines.filter((l) => WEAK_PHRASES.some((p) => l.toLowerCase().includes(p)));
  const buzzHits = BUZZWORDS.filter((b) => lower.includes(b));
  const pronounLines = bulletLines.filter((l) => /\b(i|me|my|mine)\b/i.test(l));

  // ---------- Contact ----------
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{8,}\d)/.test(text);
  const hasLink = /(linkedin\.com|github\.com|portfolio|https?:\/\/)/i.test(text);

  // ---------- Scoring (adds up to 100) ----------
  // Structure (25)
  const structurePts =
    (found.has("Experience") || found.has("Projects") ? 9 : 0) +
    (found.has("Education") ? 6 : 0) +
    (found.has("Skills") ? 6 : 0) +
    (found.has("Summary") ? 4 : 0);

  // Impact (25): share of bullets with a number
  const quantRatio = bullets ? quantified / bullets : 0;
  const impactPts = bullets === 0 ? 5 : Math.round(25 * Math.min(1, quantRatio / 0.6));

  // Language (20): strong verbs, minus weak phrases, buzzwords and "I/my"
  const verbRatio = bullets ? actionVerbStarts / bullets : 0;
  const languagePts = Math.max(
    0,
    Math.round(14 * Math.min(1, verbRatio / 0.7)) +
      6 -
      Math.min(4, weakHits.length) -
      Math.min(3, buzzHits.length) -
      Math.min(3, pronounLines.length),
  );

  // Contact (15)
  const contactPts = (hasEmail ? 6 : 0) + (hasPhone ? 5 : 0) + (hasLink ? 4 : 0);

  // Length (15): 350–900 words (about 1–2 pages) is ideal
  const lengthPts = words >= 350 && words <= 900 ? 15 : words >= 250 && words <= 1200 ? 10 : words >= 150 ? 5 : 2;

  const categories: HealthCategory[] = [
    {
      key: "structure",
      label: "Structure",
      points: structurePts,
      max: 25,
      note: sections.length ? `Found: ${sections.join(", ")}` : "No standard section headings found",
    },
    {
      key: "impact",
      label: "Measurable impact",
      points: impactPts,
      max: 25,
      note: bullets ? `${quantified} of ${bullets} bullet points include a number` : "No bullet points found",
    },
    {
      key: "language",
      label: "Strong language",
      points: languagePts,
      max: 20,
      note: bullets ? `${actionVerbStarts} of ${bullets} bullet points start with an action verb` : "No bullet points found",
    },
    {
      key: "contact",
      label: "Contact info",
      points: contactPts,
      max: 15,
      note: [!hasEmail && "email", !hasPhone && "phone", !hasLink && "LinkedIn/GitHub link"].filter(Boolean).length
        ? `Missing: ${[!hasEmail && "email", !hasPhone && "phone", !hasLink && "LinkedIn/GitHub link"].filter(Boolean).join(", ")}`
        : "Email, phone and a profile link",
    },
    { key: "length", label: "Length", points: lengthPts, max: 15, note: `${words} words, about ${pages} page${pages === 1 ? "" : "s"}` },
  ];
  const score = Math.max(0, Math.min(100, categories.reduce((s, c) => s + c.points, 0)));

  // ---------- Issues, most important first ----------
  const issues: HealthIssue[] = [];
  if (!found.has("Experience") && !found.has("Projects"))
    issues.push({ level: "high", title: "No Experience or Projects section", detail: "Recruiters and ATS software look for a clearly labeled Experience or Projects heading." });
  if (!found.has("Skills"))
    issues.push({ level: "high", title: "No Skills section", detail: "A dedicated Skills section makes it easy for ATS software to match your tools to the job." });
  if (!hasEmail || !hasPhone)
    issues.push({ level: "high", title: "Contact details incomplete", detail: `Add your ${[!hasEmail && "email", !hasPhone && "phone number"].filter(Boolean).join(" and ")} at the top.` });
  if (bullets > 0 && quantRatio < 0.4)
    issues.push({
      level: "medium",
      title: "Few measurable results",
      detail: `Only ${quantified} of ${bullets} bullet points include a number. Add results like time saved, % improved, or users served.`,
      examples: bulletLines.filter((l) => !/\d|%|\$/.test(l)).slice(0, 3).map((l) => shorten(l)),
    });
  if (weakHits.length)
    issues.push({
      level: "medium",
      title: "Weak openings",
      detail: "Phrases like \"responsible for\" or \"worked on\" hide what you did. Start with a strong verb such as Built, Led or Reduced.",
      examples: weakHits.slice(0, 3).map((l) => shorten(l)),
    });
  if (bullets > 0 && verbRatio < 0.5)
    issues.push({ level: "medium", title: "Start more bullets with action verbs", detail: `${actionVerbStarts} of ${bullets} bullet points start with an action verb. Aim for most of them.` });
  if (buzzHits.length)
    issues.push({ level: "low", title: "Overused buzzwords", detail: "These words are common and don't prove anything. Replace them with examples.", examples: buzzHits.slice(0, 5) });
  if (pronounLines.length)
    issues.push({ level: "low", title: "First-person words", detail: "Résumés usually leave out \"I\" and \"my\".", examples: pronounLines.slice(0, 2).map((l) => shorten(l)) });
  if (longBullets.length)
    issues.push({ level: "low", title: "Very long bullet points", detail: "Keep each bullet to one or two lines so it can be skimmed.", examples: longBullets.slice(0, 2).map((l) => shorten(l)) });
  if (!hasLink) issues.push({ level: "low", title: "No LinkedIn or GitHub link", detail: "A profile link helps recruiters learn more about you." });
  if (words > 1200) issues.push({ level: "medium", title: "Too long", detail: `About ${pages} pages. Most early-career résumés fit on 1 to 2 pages.` });
  if (words < 250) issues.push({ level: "medium", title: "Very short", detail: "There may not be enough detail for recruiters or ATS software to match you to jobs." });
  if (!found.has("Summary")) issues.push({ level: "low", title: "No summary", detail: "A 2 to 3 line summary at the top helps a recruiter see your fit in seconds." });

  // ---------- Strengths ----------
  const strengths: string[] = [];
  if (sections.length >= 4) strengths.push("Clear, standard section headings");
  if (bullets && quantRatio >= 0.5) strengths.push("Many bullet points show measurable results");
  if (bullets && verbRatio >= 0.7) strengths.push("Bullet points start with strong action verbs");
  if (hasEmail && hasPhone && hasLink) strengths.push("Complete contact details");
  if (words >= 350 && words <= 900) strengths.push("Good length");
  if (!buzzHits.length && !weakHits.length && bullets) strengths.push("No filler phrases or buzzwords");

  const order = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);

  return {
    score,
    grade: gradeFor(score),
    categories,
    issues,
    strengths,
    stats: { words, pages, bullets, quantified, actionVerbStarts, sections },
    checked_at: new Date().toISOString(),
  };
}

function firstWord(line: string) {
  return clean(line).split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
}
