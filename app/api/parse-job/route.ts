import { NextResponse } from "next/server";
import { load } from "cheerio";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 3 * 1024 * 1024; // don't read pages bigger than 3 MB
const TIMEOUT_MS = 12_000; // give up after 12 seconds
const MAX_REDIRECTS = 4;
const MAX_CHARS = 50_000; // matches the database limit
const MIN_DESCRIPTION = 200; // shorter than this = we probably didn't find the job text

// Looks like a normal browser, because many job sites block obvious bots
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

class ParseError extends Error {}

type Parsed = { title: string; company: string; description: string };

// Basic safety: never let the server fetch internal or private addresses
function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (h.includes(":")) return true; // block raw IPv6 addresses
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const a = Number(ip[1]);
    const b = Number(ip[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ParseError("That page is too large to read. Try pasting the text instead.");
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

// Fetch a page (or a site's public job API) safely, following redirects ourselves
async function fetchText(start: URL, kind: "html" | "json") {
  let url = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
      throw new ParseError("That link isn't allowed.");
    }

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        ...BROWSER_HEADERS,
        Accept: kind === "json" ? "application/json" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    // Follow redirects ourselves, so each new address gets the safety check too
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new ParseError("That page redirected somewhere we couldn't follow.");
      url = new URL(location, url);
      continue;
    }

    if (!res.ok) {
      throw new ParseError(
        `That site returned an error (${res.status}). Some sites block automated reading. Paste the job description instead.`,
      );
    }

    const type = res.headers.get("content-type") ?? "";
    if (kind === "html" && !type.includes("html") && !type.includes("xml") && !type.includes("text/plain")) {
      throw new ParseError("That link isn't a web page we can read.");
    }

    return { text: await readLimited(res), finalUrl: url };
  }
  throw new ParseError("That link redirected too many times.");
}

function tidy(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Turn HTML into readable plain text, keeping line breaks and bullet points
function htmlToText(html: string) {
  let source = html;
  if (/&lt;\w/.test(source)) source = load(`<div>${source}</div>`)("div").text(); // some sites escape the HTML
  const $ = load(`<div id="jm-root">${source}</div>`);
  $("script, style, noscript, svg").remove();
  $("br").replaceWith("\n");
  $("li").each((_, el) => {
    $(el).prepend("• ");
  });
  $("p, div, li, h1, h2, h3, h4, h5, h6, ul, ol, section, article, tr").each((_, el) => {
    $(el).append("\n");
  });
  return tidy($("#jm-root").text());
}

// ---------- Known job sites: use their public job data instead of the page ----------

async function fromGreenhouse(url: URL): Promise<Parsed | null> {
  // boards.greenhouse.io/{board}/jobs/{id}  or  job-boards.greenhouse.io/{board}/jobs/{id}
  if (!/(^|\.)greenhouse\.io$/.test(url.hostname)) return null;
  const m = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  const board = m?.[1] ?? url.searchParams.get("for");
  const id = m?.[2] ?? url.searchParams.get("token");
  if (!board || !id) return null;
  const { text } = await fetchText(new URL(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`), "json");
  const data = JSON.parse(text);
  return { title: tidy(String(data.title ?? "")), company: tidy(String(data.company_name ?? board)), description: htmlToText(String(data.content ?? "")) };
}

async function fromLever(url: URL): Promise<Parsed | null> {
  // jobs.lever.co/{company}/{id}
  if (url.hostname !== "jobs.lever.co") return null;
  const m = url.pathname.match(/^\/([^/]+)\/([0-9a-f-]{20,})/i);
  if (!m) return null;
  const { text } = await fetchText(new URL(`https://api.lever.co/v0/postings/${m[1]}/${m[2]}`), "json");
  const d = JSON.parse(text);
  const lists = Array.isArray(d.lists)
    ? d.lists.map((l: { text?: string; content?: string }) => `${l.text ?? ""}\n${htmlToText(String(l.content ?? ""))}`).join("\n\n")
    : "";
  const description = tidy([d.descriptionPlain ?? htmlToText(String(d.description ?? "")), lists, d.additionalPlain ?? ""].join("\n\n"));
  return { title: tidy(String(d.text ?? "")), company: m[1], description };
}

async function fromWorkday(url: URL): Promise<Parsed | null> {
  // {tenant}.wd5.myworkdayjobs.com/{locale?}/{site}/job/{location}/{title_id}
  if (!url.hostname.endsWith(".myworkdayjobs.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] && /^[a-z]{2}-[A-Z]{2}$/.test(parts[0])) parts.shift(); // drop "en-US"
  const jobAt = parts.indexOf("job");
  if (jobAt < 1) return null;
  const tenant = url.hostname.split(".")[0];
  const site = parts[jobAt - 1];
  const rest = parts.slice(jobAt + 1).join("/");
  const api = new URL(`https://${url.hostname}/wday/cxs/${tenant}/${site}/job/${rest}`);
  const { text } = await fetchText(api, "json");
  const d = JSON.parse(text);
  const info = d.jobPostingInfo ?? {};
  return {
    title: tidy(String(info.title ?? "")),
    company: tidy(String(d.hiringOrganization?.name ?? tenant)),
    description: htmlToText(String(info.jobDescription ?? "")),
  };
}

async function fromLinkedIn(url: URL): Promise<Parsed | null> {
  // linkedin.com/jobs/view/{id}  or  ...?currentJobId={id}
  if (!/(^|\.)linkedin\.com$/.test(url.hostname)) return null;
  const id = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/)?.[1] ?? url.searchParams.get("currentJobId");
  if (!id) return null;
  // LinkedIn's public "guest" job page works without logging in
  const { text } = await fetchText(new URL(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`), "html");
  const $ = load(text);
  return {
    title: tidy($(".top-card-layout__title, .topcard__title, h2").first().text()),
    company: tidy($(".topcard__org-name-link, .topcard__flavor a, .topcard__flavor").first().text()),
    description: htmlToText($(".show-more-less-html__markup, .description__text").first().html() ?? ""),
  };
}

// ---------- Any other site ----------

// Many job sites include structured "JobPosting" data (schema.org) in the page
function findJobPosting(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
  if (obj["@graph"]) return findJobPosting(obj["@graph"]);
  return null;
}

function extract(html: string): Parsed {
  const $ = load(html);

  // 1. Best case: structured job data
  let job: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (job) return;
    try {
      job = findJobPosting(JSON.parse($(el).text()));
    } catch {
      // ignore broken JSON on the page
    }
  });

  const metaTitle = $('meta[property="og:title"]').attr("content") || $("h1").first().text() || $("title").text() || "";
  const metaCompany = $('meta[property="og:site_name"]').attr("content") || "";

  if (job) {
    const data = job as Record<string, unknown>;
    const org = data.hiringOrganization;
    const company =
      typeof org === "string" ? org : org && typeof org === "object" ? String((org as { name?: unknown }).name ?? "") : "";
    const description = htmlToText(String(data.description ?? ""));
    if (description.length >= MIN_DESCRIPTION) {
      return { title: tidy(String(data.title ?? metaTitle)), company: tidy(company || metaCompany), description };
    }
  }

  // 2. Fallback: read the page's main content
  $("script, style, noscript, svg, nav, header, footer, aside, form").remove();
  const main = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  let description = htmlToText(main.html() ?? "");

  // 3. Last resort: the page's own summary
  if (description.length < MIN_DESCRIPTION) {
    const meta = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
    if (meta.length > description.length) description = tidy(meta);
  }

  return { title: tidy(metaTitle), company: tidy(metaCompany), description };
}

export async function POST(request: Request) {
  // Only logged-in users can use this
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  let raw = "";
  try {
    const body = await request.json();
    raw = typeof body?.url === "string" ? body.url.trim() : "";
  } catch {
    return NextResponse.json({ error: "Please send a link." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid link." }, { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return NextResponse.json({ error: "Please use a link that starts with https://" }, { status: 400 });
  }

  try {
    // Known job sites first (more reliable), then the page itself
    let parsed: Parsed | null = null;
    for (const reader of [fromGreenhouse, fromLever, fromWorkday, fromLinkedIn]) {
      try {
        parsed = await reader(url);
      } catch {
        parsed = null; // fall back to reading the page
      }
      if (parsed && parsed.description.length >= MIN_DESCRIPTION) break;
      parsed = null;
    }

    let finalUrl = url;
    if (!parsed) {
      const page = await fetchText(url, "html");
      finalUrl = page.finalUrl;
      parsed = extract(page.text);
    }

    // Found the title but not enough description: return what we have, and say so
    if (parsed.description.length < MIN_DESCRIPTION) {
      if (parsed.title) {
        return NextResponse.json({
          title: parsed.title,
          company: parsed.company,
          description: parsed.description,
          source_url: finalUrl.toString(),
          warning: "We found the job title, but not the full description. Paste the description to analyze this job.",
        });
      }
      return NextResponse.json(
        { error: "We couldn't find a job description on that page. Paste the description instead." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      title: parsed.title,
      company: parsed.company,
      description: parsed.description.slice(0, MAX_CHARS),
      source_url: finalUrl.toString(),
    });
  } catch (err) {
    if (err instanceof ParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return NextResponse.json(
        { error: "That site took too long to respond. Try again, or paste the description instead." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "We couldn't reach that page. Check the link, or paste the description instead." },
      { status: 502 },
    );
  }
}
