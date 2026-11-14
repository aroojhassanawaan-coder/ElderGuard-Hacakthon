import type {
  AlertSecurityLevel,
  EmailAttachmentInfo,
  ScamAnalysisResult,
  UrlInspectionDetail,
} from "../src/types/scam.ts";

const RISKY_TLDS = new Set([
  "xyz",
  "top",
  "click",
  "loan",
  "tk",
  "pw",
  "vip",
  "club",
  "cfd",
  "gq",
  "ml",
  "ga",
  "cf",
  "icu",
  "buzz",
  "work",
]);

const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "rb.gy",
  "cutt.ly",
  "is.gd",
  "ow.ly",
  "goo.gl",
  "shorturl.at",
]);

const LURE_KEYWORDS = [
  "login",
  "signin",
  "verify",
  "secure",
  "bank",
  "kyc",
  "prize",
  "claim",
  "reward",
  "lottery",
  "winner",
  "account-check",
  "redelivery",
  "suspicious",
  "urgent",
  "suspend",
  "wallet",
  "paypal",
  "medicare",
  "tax",
];

const DANGEROUS_EXTENSIONS = new Set([
  "exe",
  "scr",
  "bat",
  "cmd",
  "vbs",
  "js",
  "jse",
  "jar",
  "apk",
  "iso",
  "img",
  "msi",
  "docm",
  "xlsm",
  "pptm",
  "html",
  "htm",
  "svg",
  "zip",
  "rar",
  "7z",
]);

export const SAFETY_DISCLAIMER =
  "No scan can guarantee 100 percent safety. Stay careful with surprise links.";

export function extractAllUrls(text: string): string[] {
  const fullMatches = text.match(/(?:https?:\/\/|www\.)[^\s<>"')]+/gi) ?? [];
  const bareMatches =
    text.match(
      /(?<![@\w/.-])\b(?:[a-z0-9-]+\.)+(?:com|org|net|edu|gov|io|co|info|biz|xyz|top|click|loan|tk|pw|online|site|shop|club|vip|in|uk|ca|au|app|dev)(?:\/[^\s<>"')]*)?/gi
    ) ?? [];

  const combined = [...fullMatches, ...bareMatches].map((u) =>
    u.replace(/[.,!?;:]+$/, "")
  );

  const unique: string[] = [];
  const seenNormalized = new Set<string>();
  for (const item of combined) {
    const key = item.replace(/^https?:\/\//i, "").toLowerCase();
    if (!seenNormalized.has(key)) {
      seenNormalized.add(key);
      unique.push(item);
    }
  }
  return unique;
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }
  if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) {
    return true;
  }
  return false;
}

function getApexDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return hostname.toLowerCase();
  return parts.slice(-2).join(".");
}

async function lookupDomainAgeDays(
  hostname: string
): Promise<{ ageDays: number | null; createdDate: string | null }> {
  if (!hostname || isPrivateOrLoopbackHost(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return { ageDays: null, createdDate: null };
  }
  const apex = getApexDomain(hostname);
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(apex)}`, {
      signal: AbortSignal.timeout(2000),
      headers: { Accept: "application/rdap+json, application/json" },
    });
    if (!response.ok) return { ageDays: null, createdDate: null };
    const data = (await response.json()) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>;
    };
    const regEvent = (data.events ?? []).find(
      (ev) => ev.eventAction === "registration" && typeof ev.eventDate === "string"
    );
    if (!regEvent?.eventDate) return { ageDays: null, createdDate: null };
    const createdMs = Date.parse(regEvent.eventDate);
    if (Number.isNaN(createdMs)) return { ageDays: null, createdDate: null };
    const ageDays = Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000));
    return { ageDays, createdDate: regEvent.eventDate.slice(0, 10) };
  } catch {
    return { ageDays: null, createdDate: null };
  }
}

async function inspectRedirects(startUrl: string): Promise<string[]> {
  const chain: string[] = [];
  let current = startUrl;

  for (let hop = 0; hop < 3; hop++) {
    try {
      const parsed = new URL(current);
      if (isPrivateOrLoopbackHost(parsed.hostname)) break;
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") break;

      const resp = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(1800),
      });

      const location = resp.headers.get("location");
      if (resp.status >= 300 && resp.status < 400 && location) {
        const nextUrl = new URL(location, current).toString();
        chain.push(nextUrl);
        current = nextUrl;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return chain;
}

export async function inspectUrlSecurity(rawUrl: string): Promise<UrlInspectionDetail> {
  const trimmed = rawUrl.trim();
  const hasExplicitScheme = /^https?:\/\//i.test(trimmed);
  const usesHttps = /^https:\/\//i.test(trimmed);
  const normalizedUrl = hasExplicitScheme ? trimmed : `https://${trimmed}`;

  let hostname = "";
  let fullLower = normalizedUrl.toLowerCase();
  try {
    const parsed = new URL(normalizedUrl);
    hostname = parsed.hostname.toLowerCase();
    fullLower = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
  } catch {
    hostname = trimmed.split("/")[0].toLowerCase();
  }

  const suspiciousFlags: string[] = [];

  if (!usesHttps) {
    suspiciousFlags.push("Link does not use a secure web address.");
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    suspiciousFlags.push("Link uses raw numbers instead of a real company name.");
  }

  if (hostname.includes("xn--")) {
    suspiciousFlags.push("Link hides look-alike letters in the web address.");
  }

  if (trimmed.includes("@")) {
    suspiciousFlags.push("Link uses an address trick to hide the real website.");
  }

  const tld = hostname.split(".").pop() ?? "";
  if (RISKY_TLDS.has(tld)) {
    suspiciousFlags.push("Website ending is often used by scam pages.");
  }

  if (SHORTENER_HOSTS.has(hostname)) {
    suspiciousFlags.push("Shortened link hides the real destination website.");
  }

  const matchedLure = LURE_KEYWORDS.filter((kw) => fullLower.includes(kw));
  if (matchedLure.length >= 1) {
    suspiciousFlags.push("Web address contains scam lure or fake login words.");
  }

  const hyphenCount = (hostname.match(/-/g) ?? []).length;
  if (hyphenCount >= 2 || hostname.split(".").length >= 4) {
    suspiciousFlags.push("Web address uses extra dashes or hidden sub-names.");
  }

  const [domainAge, redirectChain] = await Promise.all([
    lookupDomainAgeDays(hostname),
    inspectRedirects(normalizedUrl),
  ]);

  if (domainAge.ageDays !== null && domainAge.ageDays < 90) {
    suspiciousFlags.push("This website was created very recently.");
  }

  if (redirectChain.length > 0) {
    try {
      const finalHost = new URL(redirectChain[redirectChain.length - 1]).hostname.toLowerCase();
      if (finalHost && finalHost !== hostname) {
        suspiciousFlags.push("Link secretly sends you to a different website.");
      }
    } catch {
      suspiciousFlags.push("Link forwards to another unknown page.");
    }
  }

  let reputationVerdict: UrlInspectionDetail["reputationVerdict"] = "UNKNOWN";
  if (
    suspiciousFlags.length >= 2 ||
    (domainAge.ageDays !== null && domainAge.ageDays < 30 && matchedLure.length > 0) ||
    hostname.includes("suspicious-link") ||
    hostname.includes("account-check")
  ) {
    reputationVerdict = "MALICIOUS";
  } else if (suspiciousFlags.length === 1 || redirectChain.length > 0) {
    reputationVerdict = "SUSPICIOUS";
  } else if (usesHttps && domainAge.ageDays !== null && domainAge.ageDays >= 365) {
    reputationVerdict = "CLEAN";
  } else {
    reputationVerdict = "UNKNOWN";
  }

  return {
    url: trimmed,
    normalizedUrl,
    usesHttps,
    hostname,
    domainAgeDays: domainAge.ageDays,
    domainCreatedDate: domainAge.createdDate,
    redirectChain,
    suspiciousFlags,
    reputationVerdict,
  };
}

export function inspectAttachments(
  attachments: Array<{ filename: string; mimeType?: string }>
): EmailAttachmentInfo[] {
  return attachments
    .filter((att) => typeof att.filename === "string" && att.filename.trim().length > 0)
    .map((att) => {
      const filename = att.filename.trim();
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const isSuspicious = DANGEROUS_EXTENSIONS.has(ext);
      return {
        filename,
        mimeType: att.mimeType,
        isSuspicious,
        ...(isSuspicious
          ? {
              reason:
                "This file type can hide harmful programs or fake login forms.",
            }
          : {}),
      };
    });
}

export function mapVerdictToSecurityAlert(
  analysis: ScamAnalysisResult,
  urlInspections: UrlInspectionDetail[],
  attachments: EmailAttachmentInfo[] = []
): {
  alertLevel: AlertSecurityLevel;
  alertHeadline: string;
  alertBannerText: string;
  safetyDisclaimer: string;
} {
  const hasMaliciousUrl = urlInspections.some(
    (u) => u.reputationVerdict === "MALICIOUS"
  );
  const hasSuspiciousUrl = urlInspections.some(
    (u) => u.reputationVerdict === "SUSPICIOUS" || u.reputationVerdict === "UNKNOWN"
  );
  const hasSuspiciousAttachment = attachments.some((a) => a.isSuspicious);

  if (analysis.verdict === "Danger" || hasMaliciousUrl || hasSuspiciousAttachment) {
    return {
      alertLevel: "RED",
      alertHeadline: "RED ALERT. Possible scam.",
      alertBannerText: "DANGER! This link may be a scam. DO NOT CLICK OR OPEN IT.",
      safetyDisclaimer: SAFETY_DISCLAIMER,
    };
  }

  if (analysis.verdict === "Caution" || hasSuspiciousUrl) {
    return {
      alertLevel: "YELLOW",
      alertHeadline: "WARNING. Be careful.",
      alertBannerText: "This message has an unverified link. Check before opening.",
      safetyDisclaimer: SAFETY_DISCLAIMER,
    };
  }

  return {
    alertLevel: "GREEN",
    alertHeadline: "SAFE FOR NOW.",
    alertBannerText: "No scam signs found right now. Still stay careful.",
    safetyDisclaimer: SAFETY_DISCLAIMER,
  };
}
