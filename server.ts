import "dotenv/config";
import http from "http";
import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import {
  extractAllUrls,
  inspectUrlSecurity,
  inspectAttachments,
  mapVerdictToSecurityAlert,
  SAFETY_DISCLAIMER,
} from "./server/urlInspector.ts";
import type {
  EmailAttachmentInfo,
  KinshipVerificationResult,
  LiveAlertItem,
  LiveAlertSource,
  RiskLevel,
  SafetyVerdict,
  ScamAnalysisResult,
  UrlInspectionDetail,
} from "./src/types/scam.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-4-hydrogen";

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const ELDERGUARD_SYSTEM_INSTRUCTION = `You are ElderGuard, an advanced AI safety and voice verification shield protecting adults aged 50+ from scams on WhatsApp, text messages, email, and phone calls.

Tone and Zero-Jargon Rules:
- Use calm, respectful, everyday human language.
- STRICTLY AVOID technical jargon such as "phishing", "HTTPS protocol", "IP routing", "JSON", "malware", "trojan", "spoofing", "domain", "KYC", "OTP", or "credential harvesting".
- Instead, say things like: "This website is pretending to be your bank, but it is a fake", "one-time security code", "scary pop-up trick", or "unknown web address".
- Never shame or blame the user; reassure them calmly.
- If a screenshot or image is provided, read all visible text, sender names, and web addresses carefully.

ADA Audio-Friendly Formatting Rules (CRITICAL):
- Format EVERY explanation, reason, safe step, and SPEECH_SUMMARY into short, punchy sentences of MAXIMUM 12 words per sentence.
- Strictly avoid punctuation or symbols that screen readers stutter on: NO em-dashes, NO en-dashes, NO slashes, NO asterisks, NO hash symbols, NO parentheses, NO brackets, NO semicolons, NO ellipses, NO emojis, and NO raw website links inside prose.
- Use simple periods between short sentences.

Output Requirements (strict JSON):
- verdict: Must be exactly "Safe", "Caution", or "Danger".
  - "Safe": Routine legitimate message with no scam signs (riskScore 0 to 24).
  - "Caution": Unclear or mildly suspicious; check before acting (riskScore 25 to 59).
  - "Danger": High-risk scam, false urgency, fake bank website, relative impersonation, or Digital Arrest authority scam (riskScore 60 to 100).
- riskScore: Integer 0 to 100 indicating scam risk.
- riskLevel: Must be one of "Low", "Moderate", "High", or "Critical".
- scamType: Plain-English category name with no slashes or dashes (e.g., "Digital Arrest Authority Scam", "Fake Bank Warning", "Fake Family Emergency Message", "Fake Computer Support Trick", or "Safe Routine Message").
- reasons: 2 to 4 short, plain-language reasons. Maximum 12 words per sentence.
- summary: 2 to 3 calm plain-English sentences. Maximum 12 words per sentence.
- safeCTAs: 2 to 4 clear next steps in plain English. Maximum 12 words per sentence.
- SPEECH_SUMMARY: A warm, calming verbal script optimized for text-to-speech engines to read out loud to visually impaired seniors. Start warmly, state the verdict, give one short reason, and give one calm next step. Maximum 12 words per sentence and zero stuttering symbols.
- detectedUrls: Array of any website links found in the message or screenshot (empty array if none).
- isAuthorityScam: Boolean. Set to true if the message or call describes someone claiming to be police, law enforcement, tax authorities (IRS or CRA), courts, customs, Social Security, Medicare, or a government agency threatening arrest, digital arrest, warrants, fines, or account freezes.
- isRemoteSafeAccountScam: Boolean. Set to true if the message mentions remote access or screen sharing apps (AnyDesk, TeamViewer, QuickSupport, remote control) OR someone claiming to be a bank asking to move money to a safe account or safe government holding account.
- isCryptoGiftCardScam: Boolean. Set to true if the message asks the user to buy gift cards (Apple, Google Play, Amazon, Target, Walmart, Steam, prepaid cards), deposit cash into a Bitcoin or cryptocurrency ATM, send a wire transfer, or hand cash to a courier.
- isRomanceInvestmentScam: Boolean. Set to true if the message or chat history shows an online romance or newly met contact grooming the user toward a cryptocurrency, gold, forex, or trading investment platform.
- isRecoveryScam: Boolean. Set to true if a third party claims they can recover or retrieve previously lost scam funds or stolen cryptocurrency for an upfront fee, retainer, or software payment.
- isDoorstepCourierScam: Boolean. Set to true if someone offers physical in-home tech support or says a courier, driver, agent, or tax official will come to the user's home to pick up cash, gold, jewelry, or bank cards.
- isPredatorySubscriptionScam: Boolean. Set to true if the user shares a bank charge notice, receipt, or renewal warning for an unexpected recurring subscription, negative option billing trap, tech support club, micro-fee, or suspicious software license renewal.
- subscriptionMerchantNote: Short plain-English analysis stating whether the merchant name appears legitimate or matches known predatory negative option billing scam patterns (empty string if not a subscription or charge check).
- isInheritanceSweepstakesScam: Boolean. Set to true if an email or message claims the user won an international sweepstakes, foreign lottery, or unclaimed estate inheritance requiring upfront taxes, fees, customs, or shipping payments.`;

const KINSHIP_SYSTEM_INSTRUCTION = `You are ElderGuard's Family Voice Shield, protecting adults aged 50+ from phone scammers who copy a loved one's voice to pretend they are in an emergency.

Tone and Zero-Jargon Rules:
- Speak calmly, reassuringly, and in simple everyday English. Avoid technical words like "deepfake synthesis", "audio spoofing", or "AI telemetry".
- Say "fake voice scam" or "a stranger pretending to be your family member".

ADA Audio-Friendly Formatting Rules (CRITICAL):
- Format EVERY explanation, bullet point, recommended action, and SPEECH_SUMMARY into short, punchy sentences of MAXIMUM 12 words per sentence.
- Strictly avoid punctuation or symbols that screen readers stutter on: NO em-dashes, NO en-dashes, NO slashes, NO asterisks, NO hash symbols, NO parentheses, NO brackets, NO semicolons, NO ellipses, and NO emojis.

Evaluate what the caller replied when asked the family's private Secret Question or Passphrase:
1. Did the caller clearly and accurately answer the secret passphrase or memory?
2. Or did the caller dodge the question, panic, claim memory loss, get angry, or pressure the user to send money right away?

Output Requirements (strict JSON):
- verdict: Must be "VERIFIED_FAMILY", "DEEPFAKE_ALERT", or "UNCLEAR".
- confidence: Integer 0 to 100.
- headline: Clear plain-English headline with no dashes or slashes:
  - For "VERIFIED_FAMILY": "SAFE TO PROCEED. Real family."
  - For "DEEPFAKE_ALERT": "STOP. Likely fake voice scam."
  - For "UNCLEAR": "PAUSE. Ask the question again."
- explanation: 2 to 3 calm sentences. Maximum 12 words per sentence.
- evasionTacticsDetected: 1 to 3 short points. Maximum 12 words per sentence.
- recommendedAction: 1 to 2 calm instructions. Maximum 12 words per sentence.
- SPEECH_SUMMARY: A warm, calming verbal script optimized for text-to-speech engines to read out loud to visually impaired seniors. Maximum 12 words per sentence and zero stuttering symbols.`;

function extractUrlsFromText(text: string): string[] {
  return extractAllUrls(text);
}

function normalizeRiskLevel(value: unknown, probability: number): RiskLevel {
  if (value === "Low" || value === "Moderate" || value === "High" || value === "Critical") {
    return value;
  }
  if (probability >= 85) return "Critical";
  if (probability >= 60) return "High";
  if (probability >= 25) return "Moderate";
  return "Low";
}

function normalizeVerdict(value: unknown, score: number): SafetyVerdict {
  if (value === "Safe" || value === "Caution" || value === "Danger") {
    return value;
  }
  if (score >= 60) return "Danger";
  if (score >= 25) return "Caution";
  return "Safe";
}

function sanitizeForScreenReader(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/gi, "a web link")
    .replace(/www\.[^\s]+/gi, "a web link")
    .replace(/\bU\.S\./g, "United States")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, "")
    .replace(/\u2026|\.{3,}/g, ".")
    .replace(/\s*[\u2014\u2013]\s*/g, ". ")
    .replace(/[\u2014\u2013]/g, " ")
    .replace(/\s+\/\s+|\//g, " or ")
    .replace(/&/g, " and ")
    .replace(/[*#~^|\\`]/g, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/;/g, ". ")
    .replace(/(?<!\d):/g, ". ")
    .replace(/([a-zA-Z])-([a-zA-Z])/g, "$1 $2")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLongClause(clause: string, maxWords: number): string[] {
  const words = clause.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= maxWords) return [words.join(" ")];

  const subParts = clause
    .split(/,\s+|\s+(?:because|so|but|while|which|unless|before|after)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  if (subParts.length > 1) {
    for (const part of subParts) {
      const partWords = part.split(/\s+/).filter(Boolean);
      if (partWords.length <= maxWords) {
        chunks.push(partWords.join(" "));
      } else {
        for (let i = 0; i < partWords.length; i += maxWords) {
          chunks.push(partWords.slice(i, i + maxWords).join(" "));
        }
      }
    }
    return chunks;
  }

  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

function enforceShortSentences(text: string, maxWords = 12): string {
  const clean = sanitizeForScreenReader(text);
  if (!clean) return "";

  const rawSentences = clean
    .split(/(?<=[.!?])\s+|(?<!\d)\.(?!\d)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const outputSentences: string[] = [];
  for (const sentence of rawSentences) {
    const hasQuestion = sentence.endsWith("?");
    const stripped = sentence.replace(/[.!?]+$/, "").trim();
    if (!stripped) continue;

    const pieces = splitLongClause(stripped, maxWords);
    pieces.forEach((piece, index) => {
      const capitalized = piece.charAt(0).toUpperCase() + piece.slice(1);
      const ending = hasQuestion && index === pieces.length - 1 ? "?" : ".";
      outputSentences.push(`${capitalized.replace(/[,;:\-]+$/, "")}${ending}`);
    });
  }

  return outputSentences.join(" ");
}

function formatAudioFriendlyList(items: string[], maxWords = 12): string[] {
  return items
    .map((item) => enforceShortSentences(item, maxWords))
    .filter((item) => item.length > 0);
}

function buildAnalyzeSpeechSummary(
  data: Omit<ScamAnalysisResult, "SPEECH_SUMMARY">
): string {
  if (data.isDoorstepCourierScam) {
    return enforceShortSentences(
      "Hello. Take a deep breath. Your physical safety comes first. Stop right now. Do not open your door to any courier or home tech visitor. No real bank or police officer sends someone to collect cash or cards. Lock your door and call family or local police right away.",
      12
    );
  }

  if (data.isRemoteSafeAccountScam) {
    return enforceShortSentences(
      "Hello. Take a deep breath. You are safe. Stop. This is a critical fake bank scam. Real banks never ask for screen sharing or safe accounts. Close the app and hang up immediately. Call the number printed on the back of your card.",
      12
    );
  }

  if (data.isInheritanceSweepstakesScam) {
    return enforceShortSentences(
      "Hello. Take a deep breath. You are safe. Stop right now. This is an advance fee prize or inheritance scam. You never pay taxes or shipping to receive a real prize. Once you pay fake fees, scammers disappear. Delete this message calmly.",
      12
    );
  }

  if (data.isCryptoGiftCardScam) {
    return enforceShortSentences(
      "Hello. Take a deep breath. You are safe. Stop right now. Do not buy gift cards or use a Bitcoin machine. No real business, utility, or agency takes gift cards or crypto machines. Keep your cash safely with you and talk to family.",
      12
    );
  }

  if (data.isPredatorySubscriptionScam) {
    return enforceShortSentences(
      "Hello. Take a deep breath. You spotted this charge early. Do not call any phone number printed on the receipt. Call your bank card number on the back of your card. Ask them to dispute the charge and block the merchant.",
      12
    );
  }

  if (data.isRecoveryScam) {
    return enforceShortSentences(
      "Hello. Take a deep breath. You are safe. Stop right now. People promising to recover lost scam money for a fee are scammers too. Do not pay any upfront fee. Talk with a trusted family member first.",
      12
    );
  }

  if (data.isRomanceInvestmentScam) {
    return enforceShortSentences(
      "Hello. Take a deep breath. You are safe and not alone. Online friends who suggest secret crypto or trading sites are running a trap. Never send money to a platform shared online. Talk with family before investing anything.",
      12
    );
  }

  const opener =
    data.verdict === "Safe"
      ? "Hello. Good news. This message looks safe."
      : data.isAuthorityScam
        ? "Hello. Take a deep breath. You are not in trouble. Stop and hang up now."
        : data.verdict === "Danger"
          ? "Hello. Take a deep breath. You are safe. Stop. This is likely a scam."
          : "Hello. Take a deep breath. Pause and check this message carefully.";

  const firstReason = data.reasons[0] ?? data.summary;
  const firstStep = data.safeCTAs[0] ?? "Do not tap any links or send money.";

  return enforceShortSentences(`${opener} ${firstReason} ${firstStep}`, 12);
}

function buildKinshipSpeechSummary(
  data: Omit<KinshipVerificationResult, "SPEECH_SUMMARY">
): string {
  const opener =
    data.verdict === "VERIFIED_FAMILY"
      ? "Hello. Good news. Your caller knew the secret family word."
      : data.verdict === "UNCLEAR"
        ? "Hello. Take a deep breath. The answer was unclear."
        : "Hello. Take a deep breath. You are safe. Stop. This may be a fake voice scam.";

  return enforceShortSentences(
    `${opener} ${data.explanation} ${data.recommendedAction}`,
    12
  );
}

const AUTHORITY_ANCHOR =
  "Take a deep breath. Real agencies never demand instant payment by phone. They never ask for gift cards or digital cash.";

const AUTHORITY_IMMUTABLE_RULES = [
  "Real agencies send official letters by mail first. They never threaten sudden arrest on a call.",
  "Real police and tax agencies never accept gift cards. They never take wire transfers or digital cash.",
];

const REMOTE_SAFE_ACCOUNT_EXPLANATION =
  "Real banks never ask you to install remote control software or transfer money to a safe account.";

const REMOTE_SAFE_ACCOUNT_INSTRUCTION =
  "Close the app, hang up immediately, and call the phone number printed on the back of your credit card.";

const REMOTE_SAFE_ACCOUNT_ANCHOR =
  "Take a deep breath. Your bank is not asking you to move money. Close any screen sharing app and hang up now.";

const CRYPTO_GIFTCARD_STATEMENT =
  "No legitimate business, utility company, court, or government agency ever accepts payment via gift cards or Bitcoin ATMs. Legitimate institutions never ask you to move money to a safe account or pay via crypto or gift cards.";

const CRYPTO_GIFTCARD_ANCHOR =
  "Take a deep breath. Keep your cash and cards safely in your wallet. You do not owe anything.";

const HALT_TRANSACTION_CHECKLIST = [
  "Stop right now and keep your cash or cards inside your wallet.",
  "Do not scratch off card codes, hand cash to a courier, or feed bills into a Bitcoin machine.",
  "Tell the store clerk or bank teller that a caller asked you to pay this way.",
  "Hang up the phone immediately and keep all receipts and cards with you.",
];

const ROMANCE_LONGCON_ANCHOR =
  "Take a deep breath. You did nothing wrong. Caring people never rush you into secret online investments.";

const ROMANCE_LONGCON_WARNING =
  "Warning against long-term grooming: Newly met online friends or romantic contacts who move chats to private apps and introduce crypto or trading platforms are running a trap. Real partners never guide you to invest money on unfamiliar websites.";

const ROMANCE_LONGCON_RED_FLAGS = [
  "Moved quickly from a dating app or social message to private daily chatting.",
  "Shared screenshots of big trading or crypto profits to build trust.",
  "Asked you to deposit savings onto an unfamiliar trading site or blocked withdrawals behind fees.",
];

const RECOVERY_SCAM_ANCHOR =
  "Take a deep breath. You are safe. Do not pay anyone claiming they can win back lost money.";

const RECOVERY_SCAM_WARNING =
  "Warning against secondary exploitation: Third parties who promise they can recover previously lost money or stolen crypto for an upfront fee are scammers targeting you a second time. Real banks and law enforcement never charge upfront fees to retrieve lost funds.";

const RECOVERY_SCAM_RED_FLAGS = [
  "Promises guaranteed recovery of previously lost scam money or stolen crypto.",
  "Asks for an upfront retainer, tax, software fee, or wallet fee before releasing funds.",
  "Claims to be an online recovery agent, hacker, or special refund desk.",
];

const DOORSTEP_COURIER_ANCHOR =
  "Take a deep breath. Stay inside and lock your door. Nobody from your bank or the government is coming to collect cash or cards.";

const DOORSTEP_COURIER_STATEMENT =
  "No legitimate bank, police department, or tech company ever sends a courier to pick up cash or cards from your home.";

const DOORSTEP_COURIER_ACTION =
  "Lock your door, refuse entry to anyone asking for cash, gold, cards, or home computer access, and call a family member or local law enforcement immediately.";

const PREDATORY_SUBSCRIPTION_ANCHOR =
  "Take a deep breath. Do not call any phone number listed on an unexpected charge notice. You can dispute and stop unwanted charges directly with your bank.";

const PREDATORY_SUBSCRIPTION_DEFAULT_NOTE =
  "This billing notice shows signs of predatory negative option billing. Scammers use scary software renewal notices, fake tech support clubs, or recurring micro-fees to trap you into recurring charges or lure you into calling a fake support line.";

const PREDATORY_SUBSCRIPTION_ROADMAP = [
  "Do not call the phone number printed on the receipt.",
  "Call the phone number printed on your credit card.",
  "Ask Bank of America or your card issuer to dispute the charge.",
  "Tell your bank to block that merchant from future billing.",
];

const INHERITANCE_SWEEPSTAKES_ANCHOR =
  "Take a deep breath. Keep your money safely in your pocket. Real prizes and estates never ask you to pay fees first.";

const INHERITANCE_GOLDEN_RULE =
  "You never have to pay money (taxes, fees, or shipping) to collect a legitimate prize or inheritance.";

const ADVANCE_FEE_WARNING =
  "This is an Advance-Fee Scam. Once you pay the fake fee, the scammers disappear.";

function detectDoorstepCourierScam(text: string): boolean {
  const lower = text.toLowerCase();
  const hasPickupItems =
    /\b(cash|gold|bars|jewelry|bank\s*card|debit\s*card|credit\s*card|pin|envelope|parcel|package)\b/i.test(
      lower
    );
  const hasDoorstepCourier =
    /\b(courier|messenger|driver|representative|tax\s*official|officer|agent)\b[\s\S]{0,65}\b(pick\s*up|collect|coming\s*to\s*(?:your|my)\s*(?:home|house|door|address)|doorstep|at\s*your\s*door|send\s*(?:a\s*)?courier)\b/i.test(
      lower
    ) ||
    /\b(send(?:ing)?\s*(?:a\s*)?(?:courier|driver|agent|official)\s*(?:to\s*(?:your|my)\s*(?:home|house|door)|for\s*(?:cash|gold|cards))|pick\s*up\s*(?:cash|gold|your\s*cards|bank\s*cards)\s*(?:from\s*(?:your|my)\s*(?:home|house|door))?)\b/i.test(
      lower
    );
  const hasInHomeTechVisit =
    /\b(in[\s-]home\s*tech\s*support|home\s*tech\s*support|doorstep\s*(?:tech|computer|support)|technician\s*(?:coming|visiting)\s*(?:to\s*)?(?:your|my)\s*(?:home|house|door)|come\s*(?:to|inside)\s*(?:your|my)\s*(?:home|house)\s*to\s*fix\s*(?:your|my)?\s*(?:computer|laptop|wi-fi|internet))\b/i.test(
      lower
    );
  return (hasDoorstepCourier && hasPickupItems) || hasInHomeTechVisit;
}

function detectPredatorySubscriptionScam(text: string): boolean {
  const lower = text.toLowerCase();
  const hasBillingOrChargeContext =
    /\b(bank\s*charge|card\s*charge|statement\s*charge|recurring\s*(?:charge|billing|fee|subscription)|auto[\s-]*renew(?:al|ed)?|negative\s*option|subscription\s*(?:fee|renewal|charge)|receipt|invoice|charged\s*\$?\d|debited\s*\$?\d|billed\s*\$?\d|micro[\s-]*fee|membership\s*fee|annual\s*renewal)\b/i.test(
      lower
    );
  const hasPredatoryOrSuspiciousMerchantSignals =
    /\b(tech\s*support\s*club|pc\s*shield|geek\s*(?:squad|protection|support)|total\s*(?:pc|av|defender)|software\s*license|antivirus\s*renewal|norton\s*lifelock|mcafee\s*total|unexpected|unrecognized|did\s*not\s*authorize|never\s*signed\s*up|didn't\s*order|hidden\s*trial|free\s*trial\s*turned|negative\s*option|cancel\s*within\s*24\s*hours|call\s*(?:immediately\s*)?to\s*cancel|dispute)\b/i.test(
      lower
    );
  return hasBillingOrChargeContext && hasPredatoryOrSuspiciousMerchantSignals;
}

function detectInheritanceOrSweepstakesScam(text: string): boolean {
  const lower = text.toLowerCase();
  const hasPrizeOrInheritanceClaim =
    /\b(international\s*sweepstakes|foreign\s*lottery|euromillions|spanish\s*lottery|el\s*gordo|publishers?\s*clearing\s*house|unclaimed\s*(?:estate|inheritance|funds|fortune)|next\s*of\s*kin|deceased\s*relative|late\s*(?:mr|mrs|dr|sir)\b[\s\S]{0,40}\binheritance|barrister|probate\s*attorney|you\s*have\s*won\s*(?:a\s*)?(?:grand\s*prize|lottery|sweepstakes|million)|winner\s*of\s*(?:the\s*)?(?:international|foreign|global)?\s*(?:lottery|sweepstakes))\b/i.test(
      lower
    );
  const hasUpfrontFeeAsk =
    /\b(tax(?:es)?|fee|fees|shipping|customs|clearance|legal\s*fee|transfer\s*fee|certificate\s*fee|processing|stamp\s*duty|courier\s*fee|pay\s*to\s*claim|claim\s*your\s*(?:prize|inheritance|winnings))\b/i.test(
      lower
    );
  return hasPrizeOrInheritanceClaim && (hasUpfrontFeeAsk || /\b(million|\$\d{3,},\d{3}|estate|lottery|sweepstakes)\b/i.test(lower));
}

function detectCryptoAtmOrGiftCardScam(text: string): boolean {
  const lower = text.toLowerCase();
  const hasGiftCard =
    /\b(gift\s*card|gift\s*cards|apple\s*card|apple\s*gift|itunes\s*card|google\s*play\s*card|google\s*card|steam\s*card|target\s*gift\s*card|walmart\s*gift\s*card|amazon\s*gift\s*card|sephora\s*card|razer\s*gold|vanilla\s*visa|prepaid\s*card|scratch\s*off\s*(?:the\s*)?(?:code|pin|back)|read\s*(?:me\s*)?the\s*(?:card\s*)?(?:numbers|codes|pin))\b/i.test(
      lower
    );
  const hasCryptoAtm =
    /\b(bitcoin\s*atm|crypto\s*atm|cryptocurrency\s*atm|bitcoin\s*machine|crypto\s*machine|bitcoin\s*kiosk|crypto\s*kiosk|coinflip|bitcoin\s*depot|deposit\s*cash\s*(?:into|at)\s*(?:a\s*)?(?:bitcoin|crypto)|feed\s*(?:cash|bills)\s*into\s*(?:a\s*)?(?:bitcoin|crypto|machine|kiosk)|qr\s*code\s*(?:at|on)\s*(?:the\s*)?(?:bitcoin|crypto)\s*(?:atm|machine))\b/i.test(
      lower
    );
  const hasWirePressure =
    /\b(put\s+cash\s+in\s+a\s+(?:box|envelope)|ship\s+cash|wire\s+transfer|western\s+union|moneygram)\b/i.test(
      lower
    ) &&
    /\b(urgent|immediately|bank|fraud|safe|protect|court|police|irs|cra|fine|utility|arrest|warrant|account|box|envelope)\b/i.test(
      lower
    );
  const hasCryptoPaymentToFix =
    /\b(bitcoin|crypto|cryptocurrency|usdt|ethereum|wallet\s*address)\b/i.test(lower) &&
    /\b(deposit|cash|atm|kiosk|machine|pay|fine|fee|tax|debt|bill|utility|electric|water|court|freeze|hacked|fix|clear|resolve|protect)\b/i.test(
      lower
    );
  return hasGiftCard || hasCryptoAtm || hasWirePressure || hasCryptoPaymentToFix;
}

function detectRomanceOrPigButcheringScam(text: string): boolean {
  const lower = text.toLowerCase();
  const explicit = /\b(pig\s*butchering|crypto\s*romance|romance\s*scam|trading\s*mentor)\b/i.test(lower);
  const hasGroomingOrOnlineContact =
    /\b(met\s+online|dating\s+(?:app|site)|hinge|bumble|tinder|match\.com|telegram|whatsapp|sweetheart|my\s+love|soulmate|dear|widowed|divorced|lonely|wrong\s+number|nice\s+to\s+meet\s+you|friend\s+online|mentor|my\s+uncle\s+taught)\b/i.test(
      lower
    );
  const hasInvestmentPitch =
    /\b(crypto|cryptocurrency|bitcoin|usdt|ethereum|trading\s+platform|investment\s+platform|gold\s+trading|forex|liquidity\s+pool|mining\s+pool|guaranteed\s+(?:return|profit)|double\s+your\s+money|withdraw\s+fee|tax\s+to\s+withdraw|trust\s+wallet|coinbase\s+wallet|profits?\s+every\s+day)\b/i.test(
      lower
    );
  return explicit || (hasGroomingOrOnlineContact && hasInvestmentPitch);
}

function detectRecoveryScam(text: string): boolean {
  const lower = text.toLowerCase();
  const hasLostFundsContext =
    /\b(lost\s+(?:money|funds|crypto|bitcoin|savings)|got\s+scammed|scammed\s+(?:before|earlier|last\s+month)|stolen\s+(?:money|funds|crypto)|fraud\s+victim|recover\s+(?:your|my|lost|stolen)\s+(?:money|funds|crypto|bitcoin)|retrieve\s+(?:your|my|lost|stolen)\s+(?:money|funds)|get\s+(?:your|my)\s+money\s+back|fund\s+recovery|asset\s+recovery|cyber\s+recovery|blockchain\s+recovery|chargeback\s+specialist|ethical\s+hacker)\b/i.test(
      lower
    );
  const hasRecoveryOfferOrFee =
    /\b(recover|retrieve|get\s+(?:it|your\s+money)\s+back|trace\s+and\s+return|refund\s+agent|recovery\s+(?:agent|specialist|team|service|firm)|upfront\s+fee|retainer|clearance\s+fee|gas\s+fee|processing\s+fee|software\s+fee|pay\s+a\s+(?:small\s+)?fee\s+first|commission\s+upfront)\b/i.test(
      lower
    );
  return hasLostFundsContext && hasRecoveryOfferOrFee;
}

function buildTrustedAllyMessage(data: {
  verdict: SafetyVerdict;
  scamType: string;
  summary: string;
  detectedUrls?: string[];
  isDoorstepCourierScam?: boolean;
  isRemoteSafeAccountScam?: boolean;
  isCryptoGiftCardScam?: boolean;
  isAuthorityScam?: boolean;
  isRomanceInvestmentScam?: boolean;
  isRecoveryScam?: boolean;
  isPredatorySubscriptionScam?: boolean;
  isInheritanceSweepstakesScam?: boolean;
}): string | undefined {
  const hasUrls = (data.detectedUrls?.length ?? 0) > 0;
  const shouldGenerate =
    data.verdict === "Danger" ||
    (data.verdict === "Caution" && hasUrls) ||
    Boolean(data.isDoorstepCourierScam) ||
    Boolean(data.isRemoteSafeAccountScam) ||
    Boolean(data.isCryptoGiftCardScam) ||
    Boolean(data.isAuthorityScam) ||
    Boolean(data.isRomanceInvestmentScam) ||
    Boolean(data.isRecoveryScam) ||
    Boolean(data.isPredatorySubscriptionScam) ||
    Boolean(data.isInheritanceSweepstakesScam);

  if (!shouldGenerate) return undefined;

  let whatHappened = `I received a message that looks like a ${data.scamType.toLowerCase()}.`;
  if (data.isDoorstepCourierScam) {
    whatHappened =
      "Someone said a courier or technician is coming to my house to collect cash, gold, or bank cards, or to check my computer.";
  } else if (data.isRemoteSafeAccountScam) {
    whatHappened =
      "Someone claiming to be from my bank asked me to share my screen or move money to a safe account.";
  } else if (data.isInheritanceSweepstakesScam) {
    whatHappened =
      "I received an email claiming I won a foreign lottery, sweepstakes, or unclaimed inheritance if I pay a fee first.";
  } else if (data.isPredatorySubscriptionScam) {
    whatHappened =
      "I spotted an unexpected recurring bank charge or software club renewal notice that I did not authorize.";
  } else if (data.isRecoveryScam) {
    whatHappened =
      "Someone offered to recover lost money or crypto in exchange for an upfront fee.";
  } else if (data.isRomanceInvestmentScam) {
    whatHappened =
      "An online contact I recently met has been encouraging me to put money into a crypto or trading website.";
  } else if (data.isCryptoGiftCardScam) {
    whatHappened =
      "Someone asked me to fix an urgent issue by buying gift cards, using a Bitcoin ATM, or wiring money.";
  } else if (data.isAuthorityScam) {
    whatHappened =
      "Someone called pretending to be police or a government agency asking for urgent money.";
  } else if (hasUrls) {
    whatHappened = `I got a message with a suspicious web link (${data.scamType}).`;
  }

  return [
    "Hi [Family Member],",
    "I wanted to share this calmly with you as a quick second pair of eyes.",
    whatHappened,
    "Everything is completely fine—I paused, kept my doors locked and my money safe, and did not click any links.",
    "When you have a spare minute, could we look at this together so I can decide how to handle or block it?",
  ].join(" ");
}

function detectRemoteAccessOrSafeAccountScam(text: string): boolean {
  const lower = text.toLowerCase();
  const hasRemoteAccess =
    /\b(anydesk|any\s+desk|teamviewer|team\s+viewer|quicksupport|quick\s+support|ultraviewer|supremo|rustdesk|logmein|splashtop|zoho\s+assist|screen\s*shar(?:e|ing)|remote\s*(?:access|control|desktop|support)|take\s+control\s+of\s+(?:my|your)\s+(?:computer|screen|phone|device)|share\s+(?:my|your)\s+screen)\b/i.test(
      lower
    );
  const hasSafeAccountOrReserve =
    /\b(safe\s+account|safe\s+government\s+holding\s+account|government\s+holding\s+account|safe\s+holding\s+account|protected\s+account|holding\s+account|security\s+vault|government\s+reserve|federal\s+reserve\s+account|treasury\s+reserve|phantom\s+hacker)\b/i.test(
      lower
    );
  const hasBankMoveFunds =
    /\b(bank|fraud\s+department|bank\s+security|virtual\s+bank|chase|wells\s+fargo|bank\s+of\s+america|citibank|td\s+bank|hsbc|barclays)\b/i.test(
      lower
    ) &&
    /\b(move|transfer|wire|withdraw|deposit|shift)\b[\s\S]{0,60}\b(safe|secure|protected|reserve|holding|another\s+account|new\s+account)\b/i.test(
      lower
    );
  return hasRemoteAccess || hasSafeAccountOrReserve || hasBankMoveFunds;
}

function detectAuthorityImpersonation(text: string): boolean {
  const lower = text.toLowerCase();
  const authorityMentions =
    /\b(police|officer|sheriff|detective|fbi|irs|cra|canada revenue|tax authorit|court|judge|warrant|summons|marshal|customs|border|social security|ssa|medicare|federal|government agency|digital arrest)\b/.test(
      lower
    );
  const threatMentions =
    /\b(arrest|warrant|jail|prison|fine|penalty|freeze|frozen|suspend|suspended|seize|court|lawsuit|deport|bond|bail|stay on the line|do not hang up|gift card|wire transfer|crypto|bitcoin)\b/.test(
      lower
    );
  return authorityMentions && threatMentions;
}

function getOfficialAgencyHint(text: string) {
  const lower = text.toLowerCase();
  if (/\bcra\b|canada revenue/.test(lower)) {
    return {
      agencyName: "Canada Revenue Agency",
      officialNumber: "1-800-959-8281",
      note: "Official CRA individual tax help line.",
    };
  }
  if (/\birs\b|internal revenue|tax/.test(lower)) {
    return {
      agencyName: "IRS Official Helpline",
      officialNumber: "1-800-829-1040",
      note: "Official U.S. tax help line.",
    };
  }
  if (/social security|\bssa\b/.test(lower)) {
    return {
      agencyName: "Social Security Administration",
      officialNumber: "1-800-772-1213",
      note: "Official Social Security help line.",
    };
  }
  if (/medicare/.test(lower)) {
    return {
      agencyName: "Official Medicare Helpline",
      officialNumber: "1-800-633-4227",
      note: "Official Medicare support line.",
    };
  }
  return {
    agencyName: "National Elder Fraud Hotline",
    officialNumber: "1-833-372-8311",
    note: "Free help line for adults 50 and older.",
  };
}

function finalizeAnalysisResult(
  raw: Omit<ScamAnalysisResult, "SPEECH_SUMMARY"> & { SPEECH_SUMMARY?: string }
): ScamAnalysisResult {
  const scamType = raw.isDoorstepCourierScam
    ? "Physical Safety & Doorstep Courier Scam"
    : raw.isRemoteSafeAccountScam
      ? "Phantom Hacker / Virtual Bank Scam"
      : raw.isInheritanceSweepstakesScam
        ? "Advance-Fee Inheritance & Sweepstakes Scam"
        : raw.isRecoveryScam
          ? "Secondary Exploitation Recovery Scam"
          : raw.isRomanceInvestmentScam
            ? "Romance & Fake Investment Long-Con Scam"
            : raw.isPredatorySubscriptionScam
              ? "Predatory Subscription & Negative Option Billing"
              : raw.isCryptoGiftCardScam && !raw.isAuthorityScam
                ? "High-Risk Financial Laundering Tactic (Gift Card / Crypto ATM)"
                : sanitizeForScreenReader(raw.scamType);

  const summary = enforceShortSentences(raw.summary, 12);

  const trustedAllyMessage =
    raw.trustedAllyMessage?.trim() ||
    buildTrustedAllyMessage({
      verdict: raw.verdict,
      scamType,
      summary,
      detectedUrls: raw.detectedUrls,
      isDoorstepCourierScam: raw.isDoorstepCourierScam,
      isRemoteSafeAccountScam: raw.isRemoteSafeAccountScam,
      isCryptoGiftCardScam: raw.isCryptoGiftCardScam,
      isAuthorityScam: raw.isAuthorityScam,
      isRomanceInvestmentScam: raw.isRomanceInvestmentScam,
      isRecoveryScam: raw.isRecoveryScam,
      isPredatorySubscriptionScam: raw.isPredatorySubscriptionScam,
      isInheritanceSweepstakesScam: raw.isInheritanceSweepstakesScam,
    });

  const base: Omit<ScamAnalysisResult, "SPEECH_SUMMARY"> = {
    ...raw,
    scamType,
    reasons: formatAudioFriendlyList(raw.reasons, 12),
    summary,
    explanation: summary,
    safeCTAs: formatAudioFriendlyList(raw.safeCTAs, 12),
    ...(raw.psychologicalAnchor
      ? { psychologicalAnchor: enforceShortSentences(raw.psychologicalAnchor, 12) }
      : {}),
    ...(raw.governmentRules
      ? { governmentRules: formatAudioFriendlyList(raw.governmentRules, 12) }
      : {}),
    ...(raw.isDoorstepCourierScam
      ? {
          isDoorstepCourierScam: true,
          doorstepCourierStatement:
            raw.doorstepCourierStatement ?? DOORSTEP_COURIER_STATEMENT,
          doorstepCourierAction:
            raw.doorstepCourierAction ?? DOORSTEP_COURIER_ACTION,
        }
      : {}),
    ...(raw.isPredatorySubscriptionScam
      ? {
          isPredatorySubscriptionScam: true,
          subscriptionMerchantNote:
            raw.subscriptionMerchantNote ?? PREDATORY_SUBSCRIPTION_DEFAULT_NOTE,
          subscriptionCancellationRoadmap: formatAudioFriendlyList(
            raw.subscriptionCancellationRoadmap ?? PREDATORY_SUBSCRIPTION_ROADMAP,
            12
          ),
        }
      : {}),
    ...(raw.isInheritanceSweepstakesScam
      ? {
          isInheritanceSweepstakesScam: true,
          inheritanceGoldenRule:
            raw.inheritanceGoldenRule ?? INHERITANCE_GOLDEN_RULE,
          advanceFeeWarning: raw.advanceFeeWarning ?? ADVANCE_FEE_WARNING,
        }
      : {}),
    ...(raw.isRemoteSafeAccountScam
      ? {
          isRemoteSafeAccountScam: true,
          remoteSafeAccountExplanation:
            raw.remoteSafeAccountExplanation ?? REMOTE_SAFE_ACCOUNT_EXPLANATION,
          remoteSafeAccountInstruction:
            raw.remoteSafeAccountInstruction ?? REMOTE_SAFE_ACCOUNT_INSTRUCTION,
        }
      : {}),
    ...(raw.isCryptoGiftCardScam
      ? {
          isCryptoGiftCardScam: true,
          cryptoGiftCardStatement:
            raw.cryptoGiftCardStatement ?? CRYPTO_GIFTCARD_STATEMENT,
          haltTransactionChecklist:
            raw.haltTransactionChecklist ?? HALT_TRANSACTION_CHECKLIST,
        }
      : {}),
    ...(raw.isRomanceInvestmentScam ? { isRomanceInvestmentScam: true } : {}),
    ...(raw.isRecoveryScam ? { isRecoveryScam: true } : {}),
    ...(raw.secondaryExploitationWarning
      ? { secondaryExploitationWarning: raw.secondaryExploitationWarning }
      : {}),
    ...(raw.longConRedFlags
      ? { longConRedFlags: formatAudioFriendlyList(raw.longConRedFlags, 12) }
      : {}),
    ...(trustedAllyMessage ? { trustedAllyMessage } : {}),
  };

  const speechSummary =
    typeof raw.SPEECH_SUMMARY === "string" && raw.SPEECH_SUMMARY.trim().length > 0
      ? enforceShortSentences(raw.SPEECH_SUMMARY, 12)
      : buildAnalyzeSpeechSummary(base);

  return {
    ...base,
    SPEECH_SUMMARY: speechSummary,
    speechSummary,
  };
}

function finalizeKinshipResult(
  raw: Omit<KinshipVerificationResult, "SPEECH_SUMMARY"> & { SPEECH_SUMMARY?: string }
): KinshipVerificationResult {
  const verificationStatus: KinshipVerificationResult["verificationStatus"] =
    raw.verdict === "VERIFIED_FAMILY"
      ? "VERIFIED FAMILY"
      : raw.verdict === "DEEPFAKE_ALERT"
        ? "⚠️ DEEPFAKE IMPERSONATION WARNING"
        : "ASK PASSPHRASE AGAIN";

  const base: Omit<KinshipVerificationResult, "SPEECH_SUMMARY"> = {
    ...raw,
    verificationStatus,
    headline: enforceShortSentences(raw.headline, 12),
    explanation: enforceShortSentences(raw.explanation, 12),
    evasionTacticsDetected: formatAudioFriendlyList(raw.evasionTacticsDetected, 12),
    recommendedAction: enforceShortSentences(raw.recommendedAction, 12),
  };

  const speechSummary =
    typeof raw.SPEECH_SUMMARY === "string" && raw.SPEECH_SUMMARY.trim().length > 0
      ? enforceShortSentences(raw.SPEECH_SUMMARY, 12)
      : buildKinshipSpeechSummary(base);

  return {
    ...base,
    SPEECH_SUMMARY: speechSummary,
  };
}

function buildFallbackMessageAnalysis(
  message: string,
  urlInspections: UrlInspectionDetail[] = [],
  attachments: EmailAttachmentInfo[] = []
): ScamAnalysisResult {
  const lower = message.toLowerCase();
  const urls = extractUrlsFromText(message);

  const isDoorstepCourier = detectDoorstepCourierScam(message);
  const isRemoteSafeAccount = detectRemoteAccessOrSafeAccountScam(message);
  const isInheritanceSweepstakes = detectInheritanceOrSweepstakesScam(message);
  const isRecovery = detectRecoveryScam(message);
  const isRomanceInvestment = detectRomanceOrPigButcheringScam(message);
  const isPredatorySubscription = detectPredatorySubscriptionScam(message);
  const isCryptoGiftCard = detectCryptoAtmOrGiftCardScam(message);
  const isAuthority = detectAuthorityImpersonation(message);
  const hasUrgency = /urgent|immediately|2 hours|24 hours|suspended|freeze|locked|arrest|warrant|act now|claim now/.test(lower);
  const hasMoneyOrOauth = /gift card|zelle|venmo|wire|bitcoin|crypto|kyc|otp|pin|password|social security|bank|verify|bond|fine|prize|won|lottery|congratulations|rs\.?\s*\d|claim your/.test(lower);
  const hasPrizeOrLottery = /congratulations|you have won|won rs|lottery|claim your prize|winner|sweepstakes/.test(lower);
  const hasFamilyCrisis = /mom|dad|grandma|grandpa|broken phone|dropped my phone|accident|bail|hospital|friend's number/.test(lower);
  const hasTechPopup = /virus|trojan|defender|microsoft|apple support|do not shut down|error #/.test(lower);
  const hasMaliciousUrl = urlInspections.some((u) => u.reputationVerdict === "MALICIOUS");
  const hasSuspiciousAttachment = attachments.some((a) => a.isSuspicious);

  let baseResult: ScamAnalysisResult;

  if (isDoorstepCourier) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 100,
      riskLevel: "Critical",
      scamType: "Physical Safety & Doorstep Courier Scam",
      reasons: [
        "Claims a courier or home technician is coming to your house.",
        "Asks to collect cash, gold, bank cards, or touch your computer.",
        "No real bank or police officer sends couriers to collect cash.",
      ],
      summary:
        "Critical physical safety alert. Keep your door locked and refuse entry right away.",
      safeCTAs: [
        "Lock your door right now and do not let anyone inside.",
        "Never hand over cash, gold, envelopes, or bank cards at your door.",
        "Call a trusted family member or local police immediately.",
      ],
      detectedUrls: urls,
      isDoorstepCourierScam: true,
      doorstepCourierStatement: DOORSTEP_COURIER_STATEMENT,
      doorstepCourierAction: DOORSTEP_COURIER_ACTION,
      psychologicalAnchor: DOORSTEP_COURIER_ANCHOR,
      ...(isAuthority
        ? {
            isAuthorityScam: true,
            governmentRules: AUTHORITY_IMMUTABLE_RULES,
            officialAgencyHint: getOfficialAgencyHint(message),
          }
        : {}),
      isFallbackDemo: true,
    });
  } else if (isRemoteSafeAccount) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 99,
      riskLevel: "Critical",
      scamType: "Phantom Hacker / Virtual Bank Scam",
      reasons: [
        "Asks you to install screen sharing software or move money to a safe account.",
        "Real banks never ask to control your computer or phone screen.",
        "No real bank or government reserve holds money in a safe account.",
      ],
      summary:
        "Critical Phantom Hacker scam detected. Real banks never ask for remote control software or safe account transfers.",
      safeCTAs: [
        "Close the screen sharing app right away.",
        "Hang up the phone immediately without sharing any code.",
        "Call the phone number printed on the back of your credit card.",
      ],
      detectedUrls: urls,
      isRemoteSafeAccountScam: true,
      remoteSafeAccountExplanation: REMOTE_SAFE_ACCOUNT_EXPLANATION,
      remoteSafeAccountInstruction: REMOTE_SAFE_ACCOUNT_INSTRUCTION,
      psychologicalAnchor: REMOTE_SAFE_ACCOUNT_ANCHOR,
      ...(isCryptoGiftCard
        ? {
            isCryptoGiftCardScam: true,
            cryptoGiftCardStatement: CRYPTO_GIFTCARD_STATEMENT,
            haltTransactionChecklist: HALT_TRANSACTION_CHECKLIST,
          }
        : {}),
      ...(isAuthority
        ? {
            isAuthorityScam: true,
            governmentRules: AUTHORITY_IMMUTABLE_RULES,
            officialAgencyHint: getOfficialAgencyHint(message),
          }
        : {}),
      isFallbackDemo: true,
    });
  } else if (isRecovery) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 98,
      riskLevel: "Critical",
      scamType: "Secondary Exploitation Recovery Scam",
      reasons: [
        "Promises to recover previously lost money or stolen crypto.",
        "Asks for an upfront fee, retainer, or tax before returning funds.",
        "Scammers target previous scam victims a second time with false hope.",
      ],
      summary:
        "Stop right now. This is a second-wave recovery scam targeting you again for upfront fees.",
      safeCTAs: [
        "Do not pay any upfront fee, tax, or retainer.",
        "Block the sender and save copies of their messages.",
        "Report losses only to your bank or the National Elder Fraud Hotline.",
      ],
      detectedUrls: urls,
      isRecoveryScam: true,
      secondaryExploitationWarning: RECOVERY_SCAM_WARNING,
      longConRedFlags: RECOVERY_SCAM_RED_FLAGS,
      psychologicalAnchor: RECOVERY_SCAM_ANCHOR,
      isFallbackDemo: true,
    });
  } else if (isRomanceInvestment) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 97,
      riskLevel: "Critical",
      scamType: "Romance & Fake Investment Long-Con Scam",
      reasons: [
        "Online contact builds closeness quickly then introduces crypto or trading sites.",
        "Shows fake profit screenshots or charges withdrawal fees to trap savings.",
        "Scammers use patience and affection to isolate you from family advice.",
      ],
      summary:
        "Take a deep breath. This looks like a romance and fake investment long-con scam.",
      safeCTAs: [
        "Do not send money or deposit funds into online trading sites.",
        "Pause chatting and share the messages calmly with a trusted family member.",
        "Real friends and partners never ask you to fund unfamiliar trading apps.",
      ],
      detectedUrls: urls,
      isRomanceInvestmentScam: true,
      secondaryExploitationWarning: ROMANCE_LONGCON_WARNING,
      longConRedFlags: ROMANCE_LONGCON_RED_FLAGS,
      psychologicalAnchor: ROMANCE_LONGCON_ANCHOR,
      isFallbackDemo: true,
    });
  } else if (isCryptoGiftCard) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 99,
      riskLevel: "Critical",
      scamType: "High-Risk Financial Laundering Tactic (Gift Card / Crypto ATM)",
      reasons: [
        "Asks you to pay with gift cards, a Bitcoin machine, wire, or cash courier.",
        "Scammers use irreversible payment tools so cash vanishes fast.",
        "No real business, utility, or agency takes gift cards or crypto machines.",
      ],
      summary:
        "Stop right now. This is a high-risk money laundering scam using irreversible payments.",
      safeCTAs: [
        "Keep your cash and gift cards safely inside your wallet.",
        "Walk away from the Bitcoin machine, courier, or store register right now.",
        "Hang up the phone and speak with a trusted family member.",
      ],
      detectedUrls: urls,
      isCryptoGiftCardScam: true,
      cryptoGiftCardStatement: CRYPTO_GIFTCARD_STATEMENT,
      haltTransactionChecklist: HALT_TRANSACTION_CHECKLIST,
      psychologicalAnchor: CRYPTO_GIFTCARD_ANCHOR,
      ...(isAuthority
        ? {
            isAuthorityScam: true,
            governmentRules: AUTHORITY_IMMUTABLE_RULES,
            officialAgencyHint: getOfficialAgencyHint(message),
          }
        : {}),
      isFallbackDemo: true,
    });
  } else if (isAuthority) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 99,
      riskLevel: "Critical",
      scamType: "Digital Arrest Authority Scam",
      reasons: [
        "Scammers pretend to be police, tax agents, or court officers.",
        "They threaten sudden arrest or frozen accounts to scare you.",
        "They demand gift cards, wire transfers, or instant secrecy.",
      ],
      summary:
        "This is a fake police or government scare trick. Real officers do not call to demand money or keep you on the line.",
      safeCTAs: [
        "Hang up the phone right now. You are not in trouble.",
        "Never send gift cards, wire transfers, or digital cash.",
        "Call a trusted family member or the official agency number.",
      ],
      detectedUrls: urls,
      isAuthorityScam: true,
      psychologicalAnchor: AUTHORITY_ANCHOR,
      governmentRules: AUTHORITY_IMMUTABLE_RULES,
      officialAgencyHint: getOfficialAgencyHint(message),
      isFallbackDemo: true,
    });
  } else if (isInheritanceSweepstakes || hasPrizeOrLottery) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 98,
      riskLevel: "Critical",
      scamType: "Advance-Fee Inheritance & Sweepstakes Scam",
      reasons: [
        "Promises surprise sweepstakes winnings, foreign lottery cash, or an unclaimed inheritance.",
        "Asks you to pay taxes, shipping, or clearance fees first.",
        "Real prizes and estates never ask winners to send money upfront.",
      ],
      summary:
        "This is an Advance Fee Scam. Once you pay the fake fee, the scammers disappear.",
      safeCTAs: [
        "Never pay taxes, shipping, or legal fees to collect money.",
        "Do not share bank numbers or tap links inside prize notices.",
        "Delete the message and check calmly with a family member.",
      ],
      detectedUrls: urls,
      isInheritanceSweepstakesScam: true,
      inheritanceGoldenRule: INHERITANCE_GOLDEN_RULE,
      advanceFeeWarning: ADVANCE_FEE_WARNING,
      psychologicalAnchor: INHERITANCE_SWEEPSTAKES_ANCHOR,
      isFallbackDemo: true,
    });
  } else if (isPredatorySubscription) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 89,
      riskLevel: "High",
      scamType: "Predatory Subscription & Negative Option Billing",
      reasons: [
        "Shows signs of an unwanted recurring charge or fake support club renewal.",
        "Tries to pressure you into calling a fake refund phone number.",
        "You can dispute unwanted charges safely with your real bank card issuer.",
      ],
      summary:
        "Stop and check this charge calmly. Use your real bank number to dispute it.",
      safeCTAs: [
        "Do not call any phone number written on the charge notice.",
        "Call the number on the back of your Bank of America or credit card.",
        "Ask your bank to dispute the charge and block the merchant.",
      ],
      detectedUrls: urls,
      isPredatorySubscriptionScam: true,
      subscriptionMerchantNote: PREDATORY_SUBSCRIPTION_DEFAULT_NOTE,
      subscriptionCancellationRoadmap: PREDATORY_SUBSCRIPTION_ROADMAP,
      psychologicalAnchor: PREDATORY_SUBSCRIPTION_ANCHOR,
      isFallbackDemo: true,
    });
  } else if (hasFamilyCrisis && (hasMoneyOrOauth || hasUrgency)) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 96,
      riskLevel: "Critical",
      scamType: "Fake Family Emergency Message",
      reasons: [
        "Claims a loved one is hurt with a broken phone.",
        "Rushes you to send money before you can check.",
        "Asks you not to call their normal saved number.",
      ],
      summary:
        "This looks like a fake family emergency scam. Strangers pretend to be your grandchild from an unknown number.",
      safeCTAs: [
        "Do not send money, gift cards, or bank transfers.",
        "Call your relative on the number already saved in your phone.",
        "Ask another family member to help you check.",
      ],
      detectedUrls: urls,
      isFallbackDemo: true,
    });
  } else if (hasTechPopup) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 97,
      riskLevel: "Critical",
      scamType: "Fake Computer Support Trick",
      reasons: [
        "Uses loud virus alarms to make you panic.",
        "Tells you not to restart your computer.",
        "Real computer companies never put support numbers in pop-ups.",
      ],
      summary:
        "This is a fake computer warning. Scammers want you to call them and pay for fake repairs.",
      safeCTAs: [
        "Do not call the phone number on the screen.",
        "Close the window or restart your computer safely.",
        "Never let a stranger connect to your computer.",
      ],
      detectedUrls: urls,
      isFallbackDemo: true,
    });
  } else if (
    hasMaliciousUrl ||
    hasSuspiciousAttachment ||
    (urls.length > 0 && (hasUrgency || hasMoneyOrOauth))
  ) {
    baseResult = finalizeAnalysisResult({
      verdict: "Danger",
      riskScore: 93,
      riskLevel: "High",
      scamType: hasSuspiciousAttachment ? "Unsafe Email Attachment or Link" : "Fake Bank Warning",
      reasons: [
        hasSuspiciousAttachment
          ? "Includes a risky file attachment that may hide harmful code."
          : "Tries to rush you with urgent threats or sudden account warnings.",
        "This web link pretends to be trusted, but looks fake.",
        "Real banks never ask for passwords through text links.",
      ],
      summary:
        "This message tries to trick you into opening a dangerous link. Your account stays safe if you do not tap.",
      safeCTAs: [
        "Do not tap the web link or open attachments.",
        "Call the real company using a trusted saved number.",
        "Delete this message right away.",
      ],
      detectedUrls: urls,
      isFallbackDemo: true,
    });
  } else if (hasUrgency || hasMoneyOrOauth || urls.length > 0) {
    baseResult = finalizeAnalysisResult({
      verdict: "Caution",
      riskScore: 52,
      riskLevel: "Moderate",
      scamType: "Unverified Message",
      reasons: [
        "Includes a web link or request you should check first.",
        "Unknown links are treated carefully until verified.",
      ],
      summary:
        "This message asks you to reply or open a link. Call the person or company on a saved number first.",
      safeCTAs: [
        "Do not tap links inside unexpected messages.",
        "Call the company using a phone number you already trust.",
      ],
      detectedUrls: urls,
      isFallbackDemo: true,
    });
  } else {
    baseResult = finalizeAnalysisResult({
      verdict: "Safe",
      riskScore: 8,
      riskLevel: "Low",
      scamType: "Safe Routine Message",
      reasons: [
        "No urgent demand for money or gift cards.",
        "No strange web links asking you to sign in.",
        "No suspicious attachments or threat language found.",
      ],
      summary:
        "This looks like a normal, safe reminder. It has no urgent pressure or unsafe links.",
      safeCTAs: [
        "Check your calendar to confirm your appointment.",
        "Never reply with private bank or card numbers.",
      ],
      detectedUrls: urls,
      isFallbackDemo: true,
    });
  }

  const securityMeta = mapVerdictToSecurityAlert(baseResult, urlInspections, attachments);
  return {
    ...baseResult,
    alertLevel: securityMeta.alertLevel,
    safetyDisclaimer: securityMeta.safetyDisclaimer,
    urlInspections,
  };
}

function buildFallbackKinshipEvaluation(
  expectedPassphrase: string,
  callerReply: string
): KinshipVerificationResult {
  const passWords = expectedPassphrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const replyLower = callerReply.toLowerCase();

  const evasionSignals = [
    /can't remember|cannot remember|don't remember|forgot|forget/,
    /hurt|hospital|bleeding|crash|police|jail|panic/,
    /just send|hurry|right now|no time|stop asking|why are you asking|trust me/,
    /money|zelle|wire|gift card|venmo|cash/,
  ];

  const hasExactMatch =
    expectedPassphrase.trim().length > 0 &&
    (replyLower.includes(expectedPassphrase.trim().toLowerCase()) ||
      (passWords.length > 0 && passWords.every((w) => replyLower.includes(w))));

  const matchedEvasionCount = evasionSignals.filter((rx) => rx.test(replyLower)).length;

  if (hasExactMatch && matchedEvasionCount === 0) {
    return finalizeKinshipResult({
      verdict: "VERIFIED_FAMILY",
      confidence: 96,
      headline: "SAFE TO PROCEED. Real family.",
      explanation:
        "The caller gave your secret family word clearly. They did not dodge your question.",
      evasionTacticsDetected: [
        "Caller knew your private family secret word.",
        "No pressure to rush or hide the call.",
      ],
      recommendedAction:
        "You can keep talking calmly. Take your time with any request.",
      isFallbackDemo: true,
    });
  }

  if (!hasExactMatch || matchedEvasionCount > 0) {
    return finalizeKinshipResult({
      verdict: "DEEPFAKE_ALERT",
      confidence: 95,
      headline: "STOP. Likely fake voice scam.",
      explanation:
        "The caller did not say your secret family word. Scammers copy voices, but do not know family secrets.",
      evasionTacticsDetected: [
        "Did not give your secret family word.",
        matchedEvasionCount > 0
          ? "Used panic excuses to push you into sending money."
          : "Gave the wrong answer to your secret question.",
      ],
      recommendedAction:
        "Hang up calmly right now. Call your real relative on their saved number.",
      isFallbackDemo: true,
    });
  }

  return finalizeKinshipResult({
    verdict: "UNCLEAR",
    confidence: 50,
    headline: "PAUSE. Ask the question again.",
    explanation:
      "The reply was not clear enough to confirm. Ask your secret question one more time.",
    evasionTacticsDetected: ["The caller's answer was too short or unclear."],
    recommendedAction:
      "Ask for the secret word again. If they make excuses, hang up right away.",
    isFallbackDemo: true,
  });
}

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0]
) {
  try {
    return await ai.models.generateContent({
      ...params,
      model: PRIMARY_MODEL,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("NOT_FOUND")) {
      return await ai.models.generateContent({
        ...params,
        model: FALLBACK_MODEL,
      });
    }
    throw err;
  }
}

function decodeBase64Url(input: string): string {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function extractGmailBodyAndAttachments(payload: GmailPart | undefined): {
  bodyText: string;
  attachments: Array<{ filename: string; mimeType?: string }>;
} {
  const texts: string[] = [];
  const attachments: Array<{ filename: string; mimeType?: string }> = [];

  function walk(part?: GmailPart) {
    if (!part) return;
    if (part.filename && part.filename.trim().length > 0) {
      attachments.push({ filename: part.filename.trim(), mimeType: part.mimeType });
    }
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain") {
        texts.push(decoded);
      } else if (part.mimeType === "text/html" && texts.length === 0) {
        texts.push(decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
      }
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return { bodyText: texts.join("\n").trim(), attachments };
}

async function analyzeScamContent(options: {
  message: string;
  channel?: string;
  imageBase64?: string;
  imageMimeType?: string;
  attachments?: EmailAttachmentInfo[];
}): Promise<{
  analysis: ScamAnalysisResult;
  urlInspections: UrlInspectionDetail[];
}> {
  const trimmedMessage = options.message.trim();
  const hasImage =
    typeof options.imageBase64 === "string" &&
    options.imageBase64.length > 0 &&
    typeof options.imageMimeType === "string";
  const attachments = options.attachments ?? [];

  const extractedUrls = extractAllUrls(trimmedMessage).slice(0, 4);
  const urlInspections = await Promise.all(
    extractedUrls.map((url) => inspectUrlSecurity(url))
  );

  const ai = getGeminiClient();
  if (!ai) {
    return {
      analysis: buildFallbackMessageAnalysis(trimmedMessage, urlInspections, attachments),
      urlInspections,
    };
  }

  try {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (hasImage && options.imageBase64 && options.imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: options.imageMimeType,
          data: options.imageBase64,
        },
      });
    }

    const urlSummaryText =
      urlInspections.length > 0
        ? urlInspections
            .map(
              (u) =>
                `- ${u.url} (HTTPS: ${u.usesHttps ? "Yes" : "No"}, Domain age days: ${u.domainAgeDays ?? "Unknown"}, Redirects: ${u.redirectChain.length}, Reputation: ${u.reputationVerdict}, Flags: ${u.suspiciousFlags.join(" ") || "None"})`
            )
            .join("\n")
        : "None found in text";

    const attachmentSummaryText =
      attachments.length > 0
        ? attachments
            .map((a) => `- ${a.filename} (Suspicious: ${a.isSuspicious ? "Yes" : "No"})`)
            .join("\n")
        : "None";

    parts.push({
      text: [
        options.channel && options.channel !== "Any"
          ? `Message Channel: ${options.channel}`
          : "Message Channel: Not specified",
        trimmedMessage
          ? `Message Content:\n"""\n${trimmedMessage}\n"""`
          : "No typed text was provided; please analyze the attached screenshot thoroughly.",
        `Automated URL Security Inspection (Never trust a URL just because it uses HTTPS):\n${urlSummaryText}`,
        `Attachments:\n${attachmentSummaryText}`,
      ].join("\n\n"),
    });

    const response = await callGeminiWithFallback(ai, {
      model: PRIMARY_MODEL,
      contents: { parts },
      config: {
        systemInstruction: ELDERGUARD_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: {
              type: Type.STRING,
              format: "enum",
              enum: ["Safe", "Caution", "Danger"],
              description: "Safety verdict: Safe, Caution, or Danger.",
            },
            riskScore: {
              type: Type.INTEGER,
              minimum: 0,
              maximum: 100,
              description: "Scam risk score from 0 to 100.",
            },
            riskLevel: {
              type: Type.STRING,
              format: "enum",
              enum: ["Low", "Moderate", "High", "Critical"],
              description: "Risk level: Low, Moderate, High, or Critical.",
            },
            scamType: {
              type: Type.STRING,
              description: "Concise scam category name.",
            },
            reasons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2 to 4 short plain-language reasons, maximum 12 words per sentence.",
            },
            summary: {
              type: Type.STRING,
              description: "Plain-English summary for older adults, maximum 12 words per sentence.",
            },
            safeCTAs: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Safe step-by-step instructions, maximum 12 words per sentence.",
            },
            SPEECH_SUMMARY: {
              type: Type.STRING,
              description:
                "Warm, calming verbal script optimized for text-to-speech engines for visually impaired seniors, maximum 12 words per sentence, no stuttering symbols.",
            },
            detectedUrls: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Any website links found in the text or screenshot.",
            },
            isAuthorityScam: {
              type: Type.BOOLEAN,
              description:
                "True if someone claims to be police, IRS or CRA, courts, or government agencies threatening arrest, fines, or account freezes.",
            },
            isRemoteSafeAccountScam: {
              type: Type.BOOLEAN,
              description:
                "True if the message mentions remote access or screen sharing software (AnyDesk, TeamViewer, QuickSupport) or someone claiming to be a bank asking to move money to a safe account or government reserve.",
            },
            isCryptoGiftCardScam: {
              type: Type.BOOLEAN,
              description:
                "True if the message asks the user to buy gift cards, deposit cash into a Bitcoin/crypto ATM, send an urgent wire transfer, or hand cash to a courier.",
            },
            isRomanceInvestmentScam: {
              type: Type.BOOLEAN,
              description:
                "True if the message or chat history shows an online romance or new online contact grooming the user into cryptocurrency or investment platforms.",
            },
            isRecoveryScam: {
              type: Type.BOOLEAN,
              description:
                "True if a third party promises to recover previously lost money or stolen crypto in exchange for an upfront fee or retainer.",
            },
            isDoorstepCourierScam: {
              type: Type.BOOLEAN,
              description:
                "True if someone offers physical in-home tech support or says a courier, driver, or tax official will pick up cash, gold, or bank cards from the user's home.",
            },
            isPredatorySubscriptionScam: {
              type: Type.BOOLEAN,
              description:
                "True if the message is a bank charge notification, software renewal receipt, tech support club notice, or unexpected recurring subscription / negative option billing charge.",
            },
            subscriptionMerchantNote: {
              type: Type.STRING,
              description:
                "Short plain-English analysis stating whether the merchant name appears legitimate or matches known predatory negative option billing scam patterns.",
            },
            isInheritanceSweepstakesScam: {
              type: Type.BOOLEAN,
              description:
                "True if an email or message claims the user won an international sweepstakes, foreign lottery, or unclaimed estate inheritance.",
            },
          },
          required: [
            "verdict",
            "riskScore",
            "riskLevel",
            "scamType",
            "reasons",
            "summary",
            "safeCTAs",
            "SPEECH_SUMMARY",
            "detectedUrls",
            "isAuthorityScam",
            "isRemoteSafeAccountScam",
            "isCryptoGiftCardScam",
            "isRomanceInvestmentScam",
            "isRecoveryScam",
            "isDoorstepCourierScam",
            "isPredatorySubscriptionScam",
            "subscriptionMerchantNote",
            "isInheritanceSweepstakesScam",
          ],
        },
      },
    });

    const rawText = (response.text ?? "").trim();
    const parsed = JSON.parse(rawText) as Partial<ScamAnalysisResult>;
    const isDoorstepCourierScam =
      Boolean(parsed.isDoorstepCourierScam) || detectDoorstepCourierScam(trimmedMessage);
    const isRemoteSafeAccountScam =
      Boolean(parsed.isRemoteSafeAccountScam) ||
      detectRemoteAccessOrSafeAccountScam(trimmedMessage);
    const isInheritanceSweepstakesScam =
      Boolean(parsed.isInheritanceSweepstakesScam) ||
      detectInheritanceOrSweepstakesScam(trimmedMessage);
    const isRecoveryScam =
      Boolean(parsed.isRecoveryScam) || detectRecoveryScam(trimmedMessage);
    const isRomanceInvestmentScam =
      Boolean(parsed.isRomanceInvestmentScam) ||
      detectRomanceOrPigButcheringScam(trimmedMessage);
    const isPredatorySubscriptionScam =
      Boolean(parsed.isPredatorySubscriptionScam) ||
      detectPredatorySubscriptionScam(trimmedMessage);
    const isCryptoGiftCardScam =
      Boolean(parsed.isCryptoGiftCardScam) ||
      detectCryptoAtmOrGiftCardScam(trimmedMessage);
    const isAuthorityScam =
      Boolean(parsed.isAuthorityScam) || detectAuthorityImpersonation(trimmedMessage);
    const hasMaliciousInspection = urlInspections.some(
      (u) => u.reputationVerdict === "MALICIOUS"
    );
    const hasSuspiciousAttachment = attachments.some((a) => a.isSuspicious);
    const rawScore = Math.max(0, Math.min(100, Math.round(Number(parsed.riskScore ?? 0))));
    const riskScore =
      isDoorstepCourierScam ||
      isRemoteSafeAccountScam ||
      isCryptoGiftCardScam ||
      isInheritanceSweepstakesScam ||
      isRecoveryScam ||
      isRomanceInvestmentScam
        ? Math.max(97, rawScore)
        : isAuthorityScam
          ? Math.max(92, rawScore)
          : isPredatorySubscriptionScam
            ? Math.max(82, rawScore)
            : hasMaliciousInspection || hasSuspiciousAttachment
              ? Math.max(85, rawScore)
              : rawScore;

    const aiUrls = Array.isArray(parsed.detectedUrls)
      ? parsed.detectedUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      : [];
    const mergedUrls = Array.from(new Set([...extractedUrls, ...aiUrls]));

    // Inspect any additional URLs discovered inside screenshots by Gemini
    const extraUrls = mergedUrls.filter((u) => !extractedUrls.includes(u)).slice(0, 2);
    const extraInspections = await Promise.all(extraUrls.map((u) => inspectUrlSecurity(u)));
    const allInspections = [...urlInspections, ...extraInspections];

    let normalizedVerdict: SafetyVerdict =
      isDoorstepCourierScam ||
      isRemoteSafeAccountScam ||
      isInheritanceSweepstakesScam ||
      isRecoveryScam ||
      isRomanceInvestmentScam ||
      isCryptoGiftCardScam ||
      isAuthorityScam ||
      hasMaliciousInspection ||
      hasSuspiciousAttachment
        ? "Danger"
        : isPredatorySubscriptionScam && parsed.verdict === "Safe"
          ? "Caution"
          : normalizeVerdict(parsed.verdict, riskScore);

    // Handle unknown URLs as potentially unsafe (at least Caution) until verified
    if (
      normalizedVerdict === "Safe" &&
      allInspections.some(
        (u) => u.reputationVerdict === "UNKNOWN" || u.reputationVerdict === "SUSPICIOUS"
      )
    ) {
      normalizedVerdict = "Caution";
    }

    const aiMerchantNote =
      typeof parsed.subscriptionMerchantNote === "string" &&
      parsed.subscriptionMerchantNote.trim().length > 12
        ? parsed.subscriptionMerchantNote.trim()
        : undefined;

    const baseAnalysis = finalizeAnalysisResult({
      verdict: normalizedVerdict,
      riskScore: normalizedVerdict === "Caution" ? Math.max(35, riskScore) : riskScore,
      riskLevel:
        normalizedVerdict === "Danger"
          ? isDoorstepCourierScam ||
            isRemoteSafeAccountScam ||
            isInheritanceSweepstakesScam ||
            isRecoveryScam ||
            isRomanceInvestmentScam ||
            isCryptoGiftCardScam ||
            isAuthorityScam
            ? "Critical"
            : normalizeRiskLevel(parsed.riskLevel, Math.max(70, riskScore))
          : normalizeRiskLevel(parsed.riskLevel, riskScore),
      scamType: isDoorstepCourierScam
        ? "Physical Safety & Doorstep Courier Scam"
        : isRemoteSafeAccountScam
          ? "Phantom Hacker / Virtual Bank Scam"
          : isInheritanceSweepstakesScam
            ? "Advance-Fee Inheritance & Sweepstakes Scam"
            : isRecoveryScam
              ? "Secondary Exploitation Recovery Scam"
              : isRomanceInvestmentScam
                ? "Romance & Fake Investment Long-Con Scam"
                : isPredatorySubscriptionScam
                  ? "Predatory Subscription & Negative Option Billing"
                  : isCryptoGiftCardScam && !isAuthorityScam
                    ? "High-Risk Financial Laundering Tactic (Gift Card / Crypto ATM)"
                    : isAuthorityScam
                      ? "Digital Arrest Authority Scam"
                      : typeof parsed.scamType === "string" && parsed.scamType.trim()
                        ? parsed.scamType.trim()
                        : "Suspicious Message",
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : [],
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "Please check this message first. Call a trusted saved number.",
      safeCTAs: Array.isArray(parsed.safeCTAs)
        ? parsed.safeCTAs.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : ["Do not tap any links or share personal details."],
      SPEECH_SUMMARY:
        isDoorstepCourierScam ||
        isRemoteSafeAccountScam ||
        isInheritanceSweepstakesScam ||
        isRecoveryScam ||
        isRomanceInvestmentScam ||
        isPredatorySubscriptionScam ||
        isCryptoGiftCardScam
          ? undefined
          : typeof parsed.SPEECH_SUMMARY === "string"
            ? parsed.SPEECH_SUMMARY
            : undefined,
      detectedUrls: mergedUrls,
      ...(isDoorstepCourierScam
        ? {
            isDoorstepCourierScam: true,
            doorstepCourierStatement: DOORSTEP_COURIER_STATEMENT,
            doorstepCourierAction: DOORSTEP_COURIER_ACTION,
            psychologicalAnchor: DOORSTEP_COURIER_ANCHOR,
          }
        : {}),
      ...(isRemoteSafeAccountScam
        ? {
            isRemoteSafeAccountScam: true,
            remoteSafeAccountExplanation: REMOTE_SAFE_ACCOUNT_EXPLANATION,
            remoteSafeAccountInstruction: REMOTE_SAFE_ACCOUNT_INSTRUCTION,
            ...(!isDoorstepCourierScam ? { psychologicalAnchor: REMOTE_SAFE_ACCOUNT_ANCHOR } : {}),
          }
        : {}),
      ...(isInheritanceSweepstakesScam
        ? {
            isInheritanceSweepstakesScam: true,
            inheritanceGoldenRule: INHERITANCE_GOLDEN_RULE,
            advanceFeeWarning: ADVANCE_FEE_WARNING,
            ...(!isDoorstepCourierScam && !isRemoteSafeAccountScam
              ? { psychologicalAnchor: INHERITANCE_SWEEPSTAKES_ANCHOR }
              : {}),
          }
        : {}),
      ...(isPredatorySubscriptionScam
        ? {
            isPredatorySubscriptionScam: true,
            subscriptionMerchantNote: aiMerchantNote ?? PREDATORY_SUBSCRIPTION_DEFAULT_NOTE,
            subscriptionCancellationRoadmap: PREDATORY_SUBSCRIPTION_ROADMAP,
            ...(!isDoorstepCourierScam &&
            !isRemoteSafeAccountScam &&
            !isInheritanceSweepstakesScam
              ? { psychologicalAnchor: PREDATORY_SUBSCRIPTION_ANCHOR }
              : {}),
          }
        : {}),
      ...(isRecoveryScam
        ? {
            isRecoveryScam: true,
            secondaryExploitationWarning: RECOVERY_SCAM_WARNING,
            longConRedFlags: RECOVERY_SCAM_RED_FLAGS,
            ...(!isDoorstepCourierScam && !isRemoteSafeAccountScam
              ? { psychologicalAnchor: RECOVERY_SCAM_ANCHOR }
              : {}),
          }
        : {}),
      ...(isRomanceInvestmentScam
        ? {
            isRomanceInvestmentScam: true,
            ...(!isRecoveryScam
              ? {
                  secondaryExploitationWarning: ROMANCE_LONGCON_WARNING,
                  longConRedFlags: ROMANCE_LONGCON_RED_FLAGS,
                }
              : {}),
            ...(!isDoorstepCourierScam && !isRemoteSafeAccountScam && !isRecoveryScam
              ? { psychologicalAnchor: ROMANCE_LONGCON_ANCHOR }
              : {}),
          }
        : {}),
      ...(isCryptoGiftCardScam
        ? {
            isCryptoGiftCardScam: true,
            cryptoGiftCardStatement: CRYPTO_GIFTCARD_STATEMENT,
            haltTransactionChecklist: HALT_TRANSACTION_CHECKLIST,
            ...(!isDoorstepCourierScam &&
            !isRemoteSafeAccountScam &&
            !isInheritanceSweepstakesScam &&
            !isRecoveryScam &&
            !isRomanceInvestmentScam
              ? { psychologicalAnchor: CRYPTO_GIFTCARD_ANCHOR }
              : {}),
          }
        : {}),
      ...(isAuthorityScam
        ? {
            isAuthorityScam: true,
            psychologicalAnchor: isDoorstepCourierScam
              ? DOORSTEP_COURIER_ANCHOR
              : isRemoteSafeAccountScam
                ? REMOTE_SAFE_ACCOUNT_ANCHOR
                : isRecoveryScam
                  ? RECOVERY_SCAM_ANCHOR
                  : isRomanceInvestmentScam
                    ? ROMANCE_LONGCON_ANCHOR
                    : isCryptoGiftCardScam
                      ? CRYPTO_GIFTCARD_ANCHOR
                      : AUTHORITY_ANCHOR,
            governmentRules: AUTHORITY_IMMUTABLE_RULES,
            officialAgencyHint: getOfficialAgencyHint(trimmedMessage),
          }
        : {}),
    });

    const securityMeta = mapVerdictToSecurityAlert(baseAnalysis, allInspections, attachments);
    return {
      analysis: {
        ...baseAnalysis,
        alertLevel: securityMeta.alertLevel,
        safetyDisclaimer: securityMeta.safetyDisclaimer,
        urlInspections: allInspections,
      },
      urlInspections: allInspections,
    };
  } catch (err) {
    console.error("Gemini analysis fallback triggered:", err);
    return {
      analysis: buildFallbackMessageAnalysis(trimmedMessage, urlInspections, attachments),
      urlInspections,
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const liveAlerts: LiveAlertItem[] = [];
  const wsClients = new Set<WebSocket>();

  function broadcastWs(payload: unknown) {
    const serialized = JSON.stringify(payload);
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  function recordAndBroadcastAlert(alert: LiveAlertItem): LiveAlertItem {
    const existing = liveAlerts.find((item) => item.id === alert.id);
    if (existing) {
      return existing;
    }
    liveAlerts.unshift(alert);
    if (liveAlerts.length > 50) {
      liveAlerts.length = 50;
    }
    broadcastWs({ type: "alerts:new", alert });
    return alert;
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      realtimeWsPath: "/ws/alerts",
      alertCount: liveAlerts.length,
    });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { message, channel, imageBase64, imageMimeType } = req.body as {
        message?: string;
        channel?: string;
        imageBase64?: string;
        imageMimeType?: string;
      };

      const trimmedMessage = typeof message === "string" ? message.trim() : "";
      const hasImage =
        typeof imageBase64 === "string" &&
        imageBase64.length > 0 &&
        typeof imageMimeType === "string";

      if (!trimmedMessage && !hasImage) {
        return res.status(400).json({
          error: "Please paste a message or upload a screenshot to scan.",
        });
      }

      const { analysis } = await analyzeScamContent({
        message: trimmedMessage,
        channel,
        imageBase64,
        imageMimeType,
      });

      return res.json(analysis);
    } catch (err) {
      console.error("Error in /api/analyze:", err);
      return res.status(500).json({
        error: "We could not complete the scan right now. Please try again in a moment.",
      });
    }
  });

  app.post("/api/verify-caller", async (req, res) => {
    try {
      const { secretQuestion, expectedPassphrase, callerReply } = req.body as {
        secretQuestion?: string;
        expectedPassphrase?: string;
        callerReply?: string;
      };

      const reply = typeof callerReply === "string" ? callerReply.trim() : "";
      const passphrase = typeof expectedPassphrase === "string" ? expectedPassphrase.trim() : "";
      const question = typeof secretQuestion === "string" ? secretQuestion.trim() : "";

      if (!reply) {
        return res.status(400).json({
          error: "Please type or speak what the caller replied so ElderGuard can evaluate it.",
        });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json(buildFallbackKinshipEvaluation(passphrase, reply));
      }

      const prompt = `Family Secret Challenge Question: "${question || "What is our family secret passphrase?"}"
Expected Family Secret Passphrase / Answer: "${passphrase || "Not specified"}"
What the Caller Replied: "${reply}"

Evaluate whether the caller genuinely knew the private passphrase/answer or used scammer evasion, panic, or pressure tactics.`;

      const response = await callGeminiWithFallback(ai, {
        model: PRIMARY_MODEL,
        contents: prompt,
        config: {
          systemInstruction: KINSHIP_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: {
                type: Type.STRING,
                format: "enum",
                enum: ["DEEPFAKE_ALERT", "VERIFIED_FAMILY", "UNCLEAR"],
              },
              confidence: {
                type: Type.INTEGER,
                minimum: 0,
                maximum: 100,
              },
              headline: { type: Type.STRING },
              explanation: { type: Type.STRING },
              evasionTacticsDetected: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedAction: { type: Type.STRING },
              SPEECH_SUMMARY: {
                type: Type.STRING,
                description:
                  "Warm, calming verbal script optimized for text-to-speech engines for visually impaired seniors, maximum 12 words per sentence, no stuttering symbols.",
              },
            },
            required: [
              "verdict",
              "confidence",
              "headline",
              "explanation",
              "evasionTacticsDetected",
              "recommendedAction",
              "SPEECH_SUMMARY",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "").trim()) as Partial<KinshipVerificationResult>;
      const verdict =
        parsed.verdict === "VERIFIED_FAMILY" ||
        parsed.verdict === "DEEPFAKE_ALERT" ||
        parsed.verdict === "UNCLEAR"
          ? parsed.verdict
          : "DEEPFAKE_ALERT";

      return res.json(
        finalizeKinshipResult({
          verdict,
          confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 85)))),
          headline:
            typeof parsed.headline === "string" && parsed.headline.trim()
              ? parsed.headline.trim()
              : verdict === "VERIFIED_FAMILY"
                ? "SAFE TO PROCEED. Real family."
                : verdict === "UNCLEAR"
                  ? "PAUSE. Ask the question again."
                  : "STOP. Likely fake voice scam.",
          explanation:
            typeof parsed.explanation === "string" && parsed.explanation.trim()
              ? parsed.explanation.trim()
              : "Please hang up first. Call your family member on their saved number.",
          evasionTacticsDetected: Array.isArray(parsed.evasionTacticsDetected)
            ? parsed.evasionTacticsDetected.filter(
                (item): item is string => typeof item === "string" && item.trim().length > 0
              )
            : [],
          recommendedAction:
            typeof parsed.recommendedAction === "string" && parsed.recommendedAction.trim()
              ? parsed.recommendedAction.trim()
              : "Hang up now. Call your relative on their saved phone number.",
          SPEECH_SUMMARY:
            typeof parsed.SPEECH_SUMMARY === "string" ? parsed.SPEECH_SUMMARY : undefined,
        })
      );
    } catch (err) {
      console.error("Error in /api/verify-caller:", err);
      const { expectedPassphrase = "", callerReply = "" } = (req.body ?? {}) as {
        expectedPassphrase?: string;
        callerReply?: string;
      };
      if (callerReply.trim()) {
        return res.json(buildFallbackKinshipEvaluation(expectedPassphrase, callerReply));
      }
      return res.status(500).json({
        error: "Could not evaluate the caller's response right now.",
      });
    }
  });

  app.post("/api/followup", async (req, res) => {
    try {
      const { question, originalMessage, analysis } = req.body as {
        question?: string;
        originalMessage?: string;
        analysis?: ScamAnalysisResult;
      };

      const trimmedQuestion = typeof question === "string" ? question.trim() : "";
      if (!trimmedQuestion) {
        return res.status(400).json({ error: "Please enter a question to ask ElderGuard." });
      }

      const ai = getGeminiClient();
      if (!ai) {
        const fallbackAnswer = enforceShortSentences(
          "Stay calm and do not reply. Do not tap any links. Call your bank or family using a saved number.",
          12
        );
        return res.json({
          answer: fallbackAnswer,
          SPEECH_SUMMARY: fallbackAnswer,
        });
      }

      const prompt = `Original Message Checked:
"""
${originalMessage || "(Screenshot was analyzed)"}
"""

Previous ElderGuard Assessment:
- Verdict: ${analysis?.verdict ?? "Unknown"}
- Scam Type: ${analysis?.scamType ?? "Unknown"}
- Risk Score: ${analysis?.riskScore ?? 0} out of 100
- Summary: ${analysis?.summary ?? ""}

User's Follow-up Question:
"${trimmedQuestion}"

Answer calmly in 2 to 3 short sentences. Maximum 12 words per sentence. Avoid slashes, dashes, brackets, and technical words.`;

      const response = await callGeminiWithFallback(ai, {
        model: PRIMARY_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            "You are ElderGuard AI, a calm assistant for adults aged 50+. Use short sentences of maximum 12 words. Avoid punctuation or symbols that screen readers stutter on.",
        },
      });

      const cleanAnswer = enforceShortSentences(
        (response.text ?? "").trim() ||
          "Do not reply or tap any links. Call a saved number to check.",
        12
      );

      return res.json({
        answer: cleanAnswer,
        SPEECH_SUMMARY: cleanAnswer,
      });
    } catch (err) {
      console.error("Error in /api/followup:", err);
      const safeFallback = enforceShortSentences(
        "Take a breath. Do not tap links or send money. Call a saved number.",
        12
      );
      return res.json({
        answer: safeFallback,
        SPEECH_SUMMARY: safeFallback,
      });
    }
  });

  // Real-time alert feed endpoints
  app.get("/api/alerts", (_req, res) => {
    res.json({ alerts: liveAlerts });
  });

  app.post("/api/alerts/ack", (req, res) => {
    const { alertId } = (req.body ?? {}) as { alertId?: string };
    if (!alertId) {
      return res.status(400).json({ error: "Missing alertId." });
    }
    const target = liveAlerts.find((a) => a.id === alertId);
    if (target) {
      target.acknowledged = true;
      broadcastWs({ type: "alerts:ack", alertId });
    }
    return res.json({ ok: true });
  });

  app.delete("/api/alerts", (_req, res) => {
    liveAlerts.length = 0;
    broadcastWs({ type: "alerts:clear" });
    return res.json({ ok: true });
  });

  // Real-time incoming WhatsApp / SMS / Email ingestion endpoint (companion bridge or simulation)
  app.post("/api/ingest/message", async (req, res) => {
    try {
      const {
        eventId,
        source,
        sender,
        subject,
        message,
        attachments: rawAttachments,
        consentGranted,
      } = (req.body ?? {}) as {
        eventId?: string;
        source?: LiveAlertSource;
        sender?: string;
        subject?: string;
        message?: string;
        attachments?: Array<{ filename: string; mimeType?: string }>;
        consentGranted?: boolean;
      };

      if (consentGranted === false) {
        return res.status(403).json({
          error: "User consent is required before scanning incoming messages.",
        });
      }

      const trimmedMessage = typeof message === "string" ? message.trim() : "";
      if (!trimmedMessage) {
        return res.status(400).json({ error: "Incoming message text is required." });
      }

      const alertSource: LiveAlertSource =
        source === "WhatsApp" || source === "SMS" || source === "Gmail" ? source : "WhatsApp";
      const attachments = inspectAttachments(rawAttachments ?? []);
      const combinedForAnalysis = [
        sender ? `Sender: ${sender}` : "",
        subject ? `Subject: ${subject}` : "",
        trimmedMessage,
      ]
        .filter(Boolean)
        .join("\n");

      const { analysis, urlInspections } = await analyzeScamContent({
        message: combinedForAnalysis,
        channel: alertSource === "SMS" ? "Text / SMS" : alertSource === "Gmail" ? "Email" : "WhatsApp",
        attachments,
      });

      const securityMeta = mapVerdictToSecurityAlert(analysis, urlInspections, attachments);
      const id =
        typeof eventId === "string" && eventId.trim()
          ? eventId.trim()
          : `alert-${crypto.randomUUID()}`;

      const item: LiveAlertItem = {
        id,
        source: alertSource,
        sender: typeof sender === "string" && sender.trim() ? sender.trim() : "Unknown Sender",
        ...(subject ? { subject } : {}),
        messagePreview:
          trimmedMessage.length > 140 ? `${trimmedMessage.slice(0, 137)}...` : trimmedMessage,
        fullMessage: trimmedMessage,
        ...(attachments.length > 0 ? { attachments } : {}),
        receivedAt: new Date().toISOString(),
        alertLevel: securityMeta.alertLevel,
        alertHeadline: securityMeta.alertHeadline,
        alertBannerText: securityMeta.alertBannerText,
        safetyDisclaimer: securityMeta.safetyDisclaimer,
        analysis,
        urlInspections,
        acknowledged: false,
      };

      const saved = recordAndBroadcastAlert(item);
      return res.json({ alert: saved });
    } catch (err) {
      console.error("Error in /api/ingest/message:", err);
      return res.status(500).json({
        error: "Could not process the incoming message right now.",
      });
    }
  });

  // Authorized Gmail inbox scanner using client-side OAuth Bearer token
  app.post("/api/gmail/scan", async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!token) {
        return res.status(401).json({
          error: "Please sign in with Google to allow ElderGuard to check your emails.",
        });
      }

      const { consentGranted, seenIds } = (req.body ?? {}) as {
        consentGranted?: boolean;
        seenIds?: string[];
      };
      if (consentGranted !== true) {
        return res.status(403).json({
          error: "Explicit permission is required before scanning Gmail messages.",
        });
      }

      const listResp = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=in:inbox",
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!listResp.ok) {
        const errStatus = listResp.status;
        return res.status(errStatus === 401 || errStatus === 403 ? 401 : 502).json({
          error:
            errStatus === 401 || errStatus === 403
              ? "Your Google email permission expired. Please tap Sign in with Google again."
              : "Could not reach Gmail right now. Please try again in a moment.",
        });
      }

      const listData = (await listResp.json()) as {
        messages?: Array<{ id: string }>;
      };
      const messageRefs = listData.messages ?? [];
      const alreadySeen = new Set([
        ...(seenIds ?? []),
        ...liveAlerts.map((a) => a.id),
      ]);

      const unseenRefs = messageRefs.filter((m) => !alreadySeen.has(`gmail-${m.id}`));
      const newAlerts: LiveAlertItem[] = [];

      for (const ref of unseenRefs.slice(0, 4)) {
        const msgResp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=full`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!msgResp.ok) continue;

        const msgData = (await msgResp.json()) as {
          id: string;
          snippet?: string;
          payload?: GmailPart & {
            headers?: Array<{ name: string; value: string }>;
          };
        };

        const headers = msgData.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

        const fromHeader = getHeader("From") || "Unknown Email Sender";
        const subjectHeader = getHeader("Subject") || "No Subject";
        const replyToHeader = getHeader("Reply-To");
        const { bodyText, attachments: rawAttachments } = extractGmailBodyAndAttachments(
          msgData.payload
        );
        const attachments = inspectAttachments(rawAttachments);
        const textToScan = bodyText || msgData.snippet || "";

        const combined = [
          `From: ${fromHeader}`,
          replyToHeader && replyToHeader !== fromHeader ? `Reply-To: ${replyToHeader}` : "",
          `Subject: ${subjectHeader}`,
          textToScan.slice(0, 2500),
        ]
          .filter(Boolean)
          .join("\n");

        const { analysis, urlInspections } = await analyzeScamContent({
          message: combined,
          channel: "Email",
          attachments,
        });

        const securityMeta = mapVerdictToSecurityAlert(analysis, urlInspections, attachments);
        const alertItem: LiveAlertItem = {
          id: `gmail-${msgData.id}`,
          source: "Gmail",
          sender: fromHeader,
          subject: subjectHeader,
          messagePreview:
            (msgData.snippet || textToScan).slice(0, 140) || "Email message scanned",
          fullMessage: textToScan.slice(0, 1500),
          ...(attachments.length > 0 ? { attachments } : {}),
          receivedAt: new Date().toISOString(),
          alertLevel: securityMeta.alertLevel,
          alertHeadline: securityMeta.alertHeadline,
          alertBannerText: securityMeta.alertBannerText,
          safetyDisclaimer: securityMeta.safetyDisclaimer,
          analysis,
          urlInspections,
          acknowledged: false,
        };

        const saved = recordAndBroadcastAlert(alertItem);
        newAlerts.push(saved);
      }

      return res.json({
        scannedCount: messageRefs.length,
        newAlerts,
      });
    } catch (err) {
      console.error("Error in /api/gmail/scan:", err);
      return res.status(500).json({
        error: "Could not finish checking Gmail right now. Please try again.",
      });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(process.env.DISABLE_HMR === "true"
          ? { hmr: false, ws: false }
          : { hmr: { server: httpServer }, ws: { server: httpServer } }),
      },
      appType: "spa",
    });
    if (process.env.DISABLE_HMR === "true") {
      app.get("/@vite/client", (_req, res) => {
        res.type("application/javascript").send(`
          const sheetsMap = new Map();
          const linkSheetsMap = new Map();
          if (typeof document !== "undefined") {
            document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
              sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
            });
            document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
              linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
            });
          }
          let lastInsertedStyle;
          export function updateStyle(id, content) {
            if (linkSheetsMap.has(id)) return;
            let style = sheetsMap.get(id);
            if (!style) {
              style = document.createElement("style");
              style.setAttribute("type", "text/css");
              style.setAttribute("data-vite-dev-id", id);
              style.textContent = content;
              if (!lastInsertedStyle) {
                document.head.appendChild(style);
                setTimeout(() => { lastInsertedStyle = undefined; }, 0);
              } else {
                lastInsertedStyle.insertAdjacentElement("afterend", style);
              }
              lastInsertedStyle = style;
            } else if (style.textContent !== content) {
              style.textContent = content;
            }
            sheetsMap.set(id, style);
          }
          export function removeStyle(id) {
            if (linkSheetsMap.has(id)) {
              document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
              linkSheetsMap.delete(id);
            }
            const style = sheetsMap.get(id);
            if (style && style.parentNode) {
              style.parentNode.removeChild(style);
              sheetsMap.delete(id);
            }
          }
          export function createHotContext() {
            return {
              data: {},
              accept() {},
              acceptExports() {},
              dispose() {},
              prune() {},
              decline() {},
              invalidate() {},
              on() {},
              off() {},
              send() {},
            };
          }
          export function injectQuery(url, queryToInject) {
            if (url[0] !== "." && url[0] !== "/") return url;
            const pathname = url.replace(/[?#].*$/, "");
            const { search, hash } = new URL(url, "http://vite.dev");
            return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
          }
          export class ErrorOverlay {}
        `);
      });
    }

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = (request.url ?? "").split("?")[0];
    if (pathname === "/ws/alerts") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ type: "alerts:init", alerts: liveAlerts }));
    ws.on("close", () => {
      wsClients.delete(ws);
    });
    ws.on("error", () => {
      wsClients.delete(ws);
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`ElderGuard AI server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start ElderGuard AI server:", err);
  process.exit(1);
});
