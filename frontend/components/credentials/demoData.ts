export type CredStatus = "new" | "ignored" | "remediated";
export type CredSource =
  | "Combolists"
  | "Stealer Logs"
  | "Data Breaches"
  | "Paste Sites"
  | "Telegram Leaks";

export interface Credential {
  id: string;
  importedAt: string;
  identity: string;
  password: string;
  source: CredSource;
  description?: string;
  leakedAt?: string;
  breachedAt?: string;
  piiTags?: string[];
  urls: string[];
  status: CredStatus;
  verified?: "verified" | "not_verified" | "unknown";
  riskScore: number;
}

const SAMPLE_DOMAINS = [
  "transilience.ai",
  "aegis.corp",
  "client-vault.io",
  "partner-hub.net",
  "internal.gov",
  "secure-portal.com",
];

const SOURCES: CredSource[] = [
  "Combolists",
  "Stealer Logs",
  "Data Breaches",
  "Paste Sites",
  "Telegram Leaks",
];

const STATUSES: CredStatus[] = ["new", "ignored", "remediated"];

const FIRST = ["alex", "sam", "taylor", "morgan", "jordan", "casey", "drew", "robin", "sky", "parker", "quinn", "reese"];
const LAST = ["chen", "patel", "nguyen", "rivera", "kumar", "singh", "wilson", "murphy", "khan", "garcia", "lopez", "martin"];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateCredentials(count = 109826): Credential[] {
  const rnd = seeded(42);
  const out: Credential[] = [];
  const cap = Math.min(count, 250);
  for (let i = 0; i < cap; i++) {
    const f = FIRST[Math.floor(rnd() * FIRST.length)];
    const l = LAST[Math.floor(rnd() * LAST.length)];
    const d = SAMPLE_DOMAINS[Math.floor(rnd() * SAMPLE_DOMAINS.length)];
    const year = 2024 + Math.floor(rnd() * 2);
    const month = 1 + Math.floor(rnd() * 12);
    const day = 1 + Math.floor(rnd() * 28);
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const urlCount = Math.floor(rnd() * 4);
    const urls: string[] = [];
    for (let u = 0; u < urlCount; u++) {
      urls.push(`https://${d}/login?ref=${Math.floor(rnd() * 9999)}`);
    }
    out.push({
      id: `cred_${i}_${Math.floor(rnd() * 1e8)}`,
      importedAt: iso,
      identity: `${f}.${l}@${d}`,
      password: [
        "P@ssw0rd!",
        "qwerty123",
        "Summer2024",
        "Welcome#1",
        "CorpAdmin!",
        "letmein2024",
        "F@lconSky99",
      ][Math.floor(rnd() * 7)],
      source: SOURCES[Math.floor(rnd() * SOURCES.length)],
      description: rnd() > 0.6 ? "Leaked via public combolist aggregation" : undefined,
      leakedAt: rnd() > 0.5 ? iso : undefined,
      breachedAt: rnd() > 0.7 ? iso : undefined,
      piiTags: rnd() > 0.6 ? ["email", "plain-text-password"] : [],
      urls,
      status: STATUSES[Math.floor(rnd() * STATUSES.length)],
      verified: rnd() > 0.85 ? "verified" : rnd() > 0.3 ? "not_verified" : "unknown",
      riskScore: Math.floor(50 + rnd() * 50),
    });
  }
  return out;
}

export const TOTAL_DB_RESULTS = 109826;
