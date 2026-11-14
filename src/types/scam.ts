export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";
export type SafetyVerdict = "Safe" | "Caution" | "Danger";

export type ScamChannel =
  | "Any"
  | "Text / SMS"
  | "WhatsApp"
  | "Email"
  | "Phone Call"
  | "Pop-up / Website";

export interface OfficialAgencyHint {
  agencyName: string;
  officialNumber: string;
  note: string;
}

export type AlertSecurityLevel = "RED" | "YELLOW" | "GREEN";
export type LiveAlertSource = "WhatsApp" | "SMS" | "Gmail" | "Manual";

export interface UrlInspectionDetail {
  url: string;
  normalizedUrl: string;
  usesHttps: boolean;
  hostname: string;
  domainAgeDays: number | null;
  domainCreatedDate: string | null;
  redirectChain: string[];
  suspiciousFlags: string[];
  reputationVerdict: "MALICIOUS" | "SUSPICIOUS" | "UNKNOWN" | "CLEAN";
}

export interface EmailAttachmentInfo {
  filename: string;
  mimeType?: string;
  isSuspicious: boolean;
  reason?: string;
}

export interface LiveAlertItem {
  id: string;
  source: LiveAlertSource;
  sender: string;
  subject?: string;
  messagePreview: string;
  fullMessage: string;
  attachments?: EmailAttachmentInfo[];
  receivedAt: string;
  alertLevel: AlertSecurityLevel;
  alertHeadline: string;
  alertBannerText: string;
  safetyDisclaimer: string;
  analysis: ScamAnalysisResult;
  urlInspections: UrlInspectionDetail[];
  acknowledged: boolean;
}

export interface ScamAnalysisResult {
  verdict: SafetyVerdict;
  alertLevel?: AlertSecurityLevel;
  riskScore: number;
  riskLevel: RiskLevel;
  scamType: string;
  reasons: string[];
  summary: string;
  safeCTAs: string[];
  SPEECH_SUMMARY: string;
  safetyDisclaimer?: string;
  detectedUrls?: string[];
  urlInspections?: UrlInspectionDetail[];
  isAuthorityScam?: boolean;
  psychologicalAnchor?: string;
  governmentRules?: string[];
  officialAgencyHint?: OfficialAgencyHint;
  isRemoteSafeAccountScam?: boolean;
  remoteSafeAccountExplanation?: string;
  remoteSafeAccountInstruction?: string;
  isCryptoGiftCardScam?: boolean;
  cryptoGiftCardStatement?: string;
  haltTransactionChecklist?: string[];
  isRomanceInvestmentScam?: boolean;
  isRecoveryScam?: boolean;
  secondaryExploitationWarning?: string;
  longConRedFlags?: string[];
  isDoorstepCourierScam?: boolean;
  doorstepCourierStatement?: string;
  doorstepCourierAction?: string;
  isPredatorySubscriptionScam?: boolean;
  subscriptionMerchantNote?: string;
  subscriptionCancellationRoadmap?: string[];
  isInheritanceSweepstakesScam?: boolean;
  inheritanceGoldenRule?: string;
  advanceFeeWarning?: string;
  trustedAllyMessage?: string;
  explanation?: string;
  speechSummary?: string;
  isFallbackDemo?: boolean;
}

export interface KinshipVerificationResult {
  verdict: "DEEPFAKE_ALERT" | "VERIFIED_FAMILY" | "UNCLEAR";
  verificationStatus?: "VERIFIED FAMILY" | "⚠️ DEEPFAKE IMPERSONATION WARNING" | "ASK PASSPHRASE AGAIN";
  confidence: number;
  headline: string;
  explanation: string;
  evasionTacticsDetected: string[];
  recommendedAction: string;
  SPEECH_SUMMARY: string;
  isFallbackDemo?: boolean;
}

export interface KinshipConfig {
  question: string;
  passphrase: string;
  updatedAt: string;
}

export interface TrustedContact {
  name: string;
  phone: string;
  email: string;
}

export interface SafeChatMessage {
  id: string;
  senderName: string;
  senderHandle: string;
  channel: "WhatsApp" | "SMS";
  receivedAt: string;
  preview: string;
  bodyParts: Array<
    | { type: "text"; value: string }
    | { type: "link"; label: string; url: string; isRisky: boolean; riskReason: string }
  >;
  isScam: boolean;
  fullText: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  channel: ScamChannel;
  messageSnippet: string;
  fullMessage: string;
  hasScreenshot: boolean;
  result: ScamAnalysisResult;
}

export interface FollowUpItem {
  question: string;
  answer: string;
}

export interface SampleScenario {
  id: string;
  label: string;
  channel: ScamChannel;
  message: string;
}

export interface ScamPatternItem {
  id: string;
  title: string;
  category: string;
  typicalChannels: string;
  howItWorks: string;
  commonRedFlags: string[];
  whatToDo: string;
  exampleMessage: string;
  exampleChannel: ScamChannel;
}

export interface RecoveryScenario {
  id: string;
  title: string;
  urgencyNote: string;
  steps: string[];
  officialResources: Array<{
    name: string;
    detail: string;
    contact: string;
  }>;
}
