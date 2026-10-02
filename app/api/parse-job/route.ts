import { NextResponse } from "next/server";
import { load } from "cheerio";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // don't read pages bigger than 2 MB
const TIMEOUT_MS = 10_000; // give up after 10 seconds
const MAX_REDIRECTS = 3;
const MAX_CHARS = 50_000; // matches the database limit
const MIN_DESCRIPTION = 200; // shorter than this = we probably didn't find the job text

class ParseError extends Error {}

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

async function fetchPage(start: URL) {
  let url = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
      throw new ParseError("That link isn't allowed.");
    }

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobMatchAI/1.0)",
        Accept: "text/html,application/xhtml+xml",
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
        `That site returned an error (${res.status}). Some sites block automated reading. Try pasting the text instead.`
      );
    }

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml")) {
      throw new ParseError("That link isn't a web page we can read.");
    }

    return { html: await readLimited(res), finalUrl: url };
  }
  throw new ParseError("That link redirected too many times.");
}

function tidy(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Turn HTML into readable plain text, keeping line breaks and bullet points
function htmlToText(html: string) {
  const $ = load(`<div id="jm-root">${html}</div>`);
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

function extract(html: string) {
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

  if (job) {
    const data = job as Record<string, unknown>;
    const org = data.hiringOrganization;
    const company =
      typeof org === "string" ? org : org && typeof org === "object" ? String((org as { name?: unknown }).name ?? "") : "";
    let desc = String(data.description ?? "");
    if (/&lt;\w/.test(desc)) desc = load(`<div>${desc}</div>`)("div").text(); // some sites escape the HTML
    const description = htmlToText(desc);
    if (description.length >= MIN_DESCRIPTION) {
      return { title: tidy(String(data.title ?? "")), company: tidy(company), description };
    }
  }

  // 2. Fallback: read the page's main content
  const title =
    $('meta[property="og:title"]').attr("content") || $("h1").first().text() || $("title").text() || "";
  const company = $('meta[property="og:site_name"]').attr("content") || "";

  $("script, style, noscript, svg, nav, header, footer, aside, form").remove();
  const main = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  const description = htmlToText(main.html() ?? "");

  return { title: tidy(title), company: tidy(company), description };
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
    const { html, finalUrl } = await fetchPage(url);
    const parsed = extract(html);

    if (parsed.description.length < MIN_DESCRIPTION) {
      return NextResponse.json(
        { error: "We couldn't find a job description on that page. Try pasting the text instead." },
        { status: 422 }
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
        { error: "That site took too long to respond. Try again, or paste the text instead." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "We couldn't reach that page. Check the link, or paste the text instead." },
      { status: 502 }
    );
  }
}