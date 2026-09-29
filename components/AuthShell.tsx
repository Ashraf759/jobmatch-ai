import Link from "next/link";

type Status = "Applied" | "Interview" | "Offer" | "Saved";

const STATUS_COLORS: Record<Status, [string, string]> = {
  Applied: ["#2A3350", "#B9C6FF"],
  Interview: ["#3A3120", "#F6CF8E"],
  Offer: ["#1F3A31", "#8FDDBC"],
  Saved: ["#2E323C", "#C9CDD6"],
};

const BASE: [string, string, Status][] = [
  ["Frontend Engineer", "Northwind Labs", "Applied"],
  ["Product Engineer", "Parcel & Pine", "Interview"],
  ["Full-Stack Developer", "Copperline", "Offer"],
  ["Data Analyst Intern", "Harbor Analytics", "Interview"],
  ["ML Engineer Intern", "Fieldstone AI", "Applied"],
  ["Software Engineer I", "Lumen Health", "Saved"],
];

// Repeated twice so the upward scroll loops seamlessly
const STREAM = [...BASE, ...BASE];

function initials(company: string) {
  return company
    .split(/\s|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export const authInputClass =
  "h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-white px-4 text-base text-ink placeholder:text-faint transition focus:border-signal focus:shadow-[0_0_0_4px_rgba(42,69,214,0.15)] focus:outline-none";

export const authButtonClass =
  "mt-1.5 flex min-h-[54px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[14px] bg-signal text-base font-semibold text-white transition duration-150 hover:-translate-y-px hover:shadow-[0_12px_24px_-14px_rgba(42,69,214,0.8)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

export function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function AuthShell({
  mode,
  children,
}: {
  mode: "login" | "signup";
  children: React.ReactNode;
}) {
  const tabClass = (active: boolean) =>
    `flex min-h-11 items-center justify-center rounded-[10px] text-sm font-semibold transition ${
      active ? "bg-card text-ink shadow-[0_2px_8px_-2px_rgba(20,22,27,0.2)]" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="grid min-h-screen grid-cols-1 bg-paper font-body text-ink lg:grid-cols-2">
      {/* ---------- Left: form side ---------- */}
      <div className="flex flex-col px-6 py-12 lg:px-24">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <svg width="32" height="32" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="32" height="32" rx="10" fill="#14161B" />
            <circle cx="13.5" cy="17" r="6" stroke="#F5F2EB" strokeWidth="2.2" />
            <circle cx="20.5" cy="17" r="6" stroke="#7C93FF" strokeWidth="2.2" />
          </svg>
          <span className="font-display text-[21px] font-bold tracking-[-0.02em]">JobMatch</span>
        </Link>

        <div className="my-auto flex w-full max-w-[440px] animate-fade-in flex-col gap-7 py-12">
          <nav aria-label="Account" className="grid grid-cols-2 rounded-[14px] bg-paper-2 p-[5px]">
            <Link href="/login" aria-current={mode === "login" ? "page" : undefined} className={tabClass(mode === "login")}>
              Sign in
            </Link>
            <Link href="/signup" aria-current={mode === "signup" ? "page" : undefined} className={tabClass(mode === "signup")}>
              Create account
            </Link>
          </nav>
          {children}
        </div>

        <div className="font-mono text-xs text-muted">MSCS 3999 Capstone · Clark University</div>
      </div>

      {/* ---------- Right: animated ink panel ---------- */}
      <div className="relative m-5 ml-0 hidden min-h-[760px] flex-col justify-end overflow-hidden rounded-[32px] bg-ink bg-dots p-14 text-paper lg:flex">
        <div className="absolute left-14 right-14 top-0 h-[560px] overflow-hidden">
          <div className="flex animate-scroll-up flex-col gap-3.5 pt-12">
            {STREAM.map(([role, company, status], i) => {
              const [bg, fg] = STATUS_COLORS[status];
              const indent = i % 3 === 1 ? 48 : i % 3 === 2 ? 24 : 0;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3.5 rounded-2xl border border-ink-line bg-ink-soft px-[18px] py-4"
                  style={{ marginLeft: indent }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold"
                    style={{ background: bg, color: fg }}
                  >
                    {initials(company)}
                  </span>
                  <span className="flex grow flex-col gap-[3px]">
                    <span className="text-[15px] font-semibold">{role}</span>
                    <span className="text-[13px] text-mist">{company}</span>
                  </span>
                  <span className="rounded-full px-2.5 py-1.5 text-xs font-semibold" style={{ background: bg, color: fg }}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className="absolute inset-x-0 bottom-0 h-[200px]"
            style={{ background: "linear-gradient(to bottom, rgba(20,22,27,0), #14161B)" }}
          />
        </div>

        <div className="relative flex flex-col gap-3.5">
          <h2 className="font-display text-[52px] font-bold leading-none tracking-[-0.045em]">
            Pick up right where you left off.
          </h2>
          <p className="max-w-[460px] text-[17px] leading-normal text-fog">
            Every role, every status change, every follow-up — waiting on your board.
          </p>
        </div>
      </div>
    </div>
  );
}