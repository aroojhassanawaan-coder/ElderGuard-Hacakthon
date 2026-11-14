import type {
  RecoveryScenario,
  SafeChatMessage,
  SampleScenario,
  ScamPatternItem,
} from "../types/scam";

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: "fake-bank-warning",
    label: "Fake Bank Warning",
    channel: "Text / SMS",
    message:
      "BANK SECURITY ALERT: Your debit card will be FROZEN in 2 hours because your account check expired. Tap here right now to confirm your PIN and avoid fees: http://secure-bank-account-check.com/verify",
  },
  {
    id: "grandchild-trouble",
    label: "Grandchild in Trouble",
    channel: "WhatsApp",
    message:
      "Hi Grandma, it's Leo! I'm texting from a friend's phone because mine broke in a minor car accident. Please don't call—the speaker isn't working. I need $750 via Zelle right now for the tow truck and I'll pay you back tonight!",
  },
  {
    id: "digital-arrest-police-irs",
    label: "Police / Tax Threat Call",
    channel: "Phone Call",
    message:
      "Caller claimed to be Officer Miller from the Federal Tax & Police Warrant Unit. They said a warrant was issued for my arrest for unpaid taxes, told me I am under 'Digital Arrest' and must stay on the line without telling anyone, and demanded $2,400 by wire transfer or gift cards within 1 hour.",
  },
  {
    id: "remote-safe-account-scam",
    label: "AnyDesk / Safe Account Bank Scam",
    channel: "Phone Call",
    message:
      "Someone claiming to be from my bank's fraud team told me hackers are inside my checking account. They told me to install AnyDesk QuickSupport for screen sharing and move my savings into a protected government reserve 'safe account' right now.",
  },
  {
    id: "crypto-atm-gift-card-scam",
    label: "Gift Card / Bitcoin ATM Scam",
    channel: "Phone Call",
    message:
      "My electric utility company called saying my power will be shut off in 45 minutes unless I withdraw $1,200 cash, buy Apple Gift Cards or deposit cash into a nearby Bitcoin ATM using their QR code.",
  },
  {
    id: "romance-crypto-longcon",
    label: "Romance / Crypto Long-Con",
    channel: "WhatsApp",
    message:
      "Week 1: Hi dear, I'm so glad we matched on the dating app and moved to WhatsApp. Week 3: Sweetheart, my uncle works on the inside of a secret cryptocurrency and gold trading app and taught me how to make $600 a day. Please deposit $2,500 today so we can build our future together, and pay the 10% withdrawal tax fee to unlock our profits.",
  },
  {
    id: "recovery-scam-upfront-fee",
    label: "Lost Money Recovery Scam",
    channel: "Email",
    message:
      "Hello, we are the Global Cyber Refund & Crypto Recovery Bureau. Our investigators traced the $8,000 you lost to scammers last year and locked it for release. To retrieve your stolen funds today, just send a $450 refundable processing fee by wire transfer or gift card.",
  },
  {
    id: "doorstep-courier-pickup",
    label: "Doorstep Courier / Cash Pickup",
    channel: "Phone Call",
    message:
      "Someone claiming to be from the bank fraud squad said my account was compromised and instructed me to withdraw $5,000 cash and put my debit card inside an envelope because their bonded courier is coming to my house at 3 PM to pick it up for safekeeping.",
  },
  {
    id: "predatory-subscription-billing",
    label: "Unexpected Tech Club Charge",
    channel: "Email",
    message:
      "Receipt Notice: Your recurring annual subscription to Total PC Shield Tech Support Club has auto-renewed for $389.99 and will be charged to your bank account today. To dispute or cancel this software license renewal, call our billing desk immediately.",
  },
  {
    id: "inheritance-sweepstakes-tax",
    label: "Foreign Inheritance / Prize Fee",
    channel: "Email",
    message:
      "Official Probate Notice: You have been named sole beneficiary of an unclaimed estate inheritance worth $2.4 Million from a distant relative overseas, or winner of the European International Sweepstakes. Pay a $650 international clearance tax and shipping fee today to release your funds.",
  },
  {
    id: "safe-clinic-reminder",
    label: "Safe Clinic Reminder",
    channel: "Text / SMS",
    message:
      "Oakridge Family Clinic: Friendly reminder of your routine checkup tomorrow at 10:30 AM with Dr. Patel at 420 Main St. Please arrive 10 minutes early. Call our front desk at the number on your appointment card if you have questions.",
  },
];

export const SAFE_CHAT_MESSAGES: SafeChatMessage[] = [
  {
    id: "chat-1",
    senderName: "+1 (800) 555-0148",
    senderHandle: "Unknown Bank Text",
    channel: "SMS",
    receivedAt: "Today · 9:42 AM",
    isScam: true,
    preview: "URGENT: Your bank account check expired. Tap to stop freeze...",
    fullText:
      "URGENT BANK NOTICE: Your checking account has been put on hold because your account check expired. Update within 2 hours or your money will be frozen: http://firstnational-account-check.com/login",
    bodyParts: [
      {
        type: "text",
        value:
          "URGENT BANK NOTICE: Your checking account has been put on hold because your account check expired. Update within 2 hours or your money will be frozen:",
      },
      {
        type: "link",
        label: "http://firstnational-account-check.com/login",
        url: "http://firstnational-account-check.com/login",
        isRisky: true,
        riskReason:
          "This website pretends to be your bank, but it is fake. Scammers use scary deadlines to steal your password and PIN.",
      },
    ],
  },
  {
    id: "chat-2",
    senderName: "Oakridge Family Clinic",
    senderHandle: "Trusted Clinic Reminder",
    channel: "SMS",
    receivedAt: "Today · 8:15 AM",
    isScam: false,
    preview: "Reminder: Appointment tomorrow at 10:30 AM with Dr. Patel.",
    fullText:
      "Oakridge Family Clinic: Reminder of your appointment tomorrow at 10:30 AM with Dr. Patel. View parking directions at https://oakridgeclinic.example.org/visit or call the number on your appointment card.",
    bodyParts: [
      {
        type: "text",
        value:
          "Oakridge Family Clinic: Reminder of your appointment tomorrow at 10:30 AM with Dr. Patel. View clinic parking directions below or call the number on your appointment card.",
      },
      {
        type: "link",
        label: "https://oakridgeclinic.example.org/visit",
        url: "https://oakridgeclinic.example.org/visit",
        isRisky: false,
        riskReason:
          "This is a normal clinic reminder. It does not ask for money, passwords, or gift cards.",
      },
    ],
  },
  {
    id: "chat-3",
    senderName: "Postal-Delivery-Help",
    senderHandle: "Unknown WhatsApp Sender",
    channel: "WhatsApp",
    receivedAt: "Yesterday · 4:19 PM",
    isScam: true,
    preview: "Your package is held. Pay $2.95 redelivery fee within 12 hours...",
    fullText:
      "Postal Notice: Your package could not be delivered because your street address was missing. Pay the $2.95 redelivery fee within 12 hours or it will be sent back: http://postal-redelivery-fee-check.com/pay",
    bodyParts: [
      {
        type: "text",
        value:
          "Postal Notice: Your package could not be delivered because your street address was missing. Pay the $2.95 redelivery fee within 12 hours or it will be sent back:",
      },
      {
        type: "link",
        label: "http://postal-redelivery-fee-check.com/pay",
        url: "http://postal-redelivery-fee-check.com/pay",
        isRisky: true,
        riskReason:
          "The real post office never asks for a small fee by text. This fake page tries to steal your card number.",
      },
    ],
  },
  {
    id: "chat-4",
    senderName: "Sarah (Daughter)",
    senderHandle: "Saved Family Contact",
    channel: "WhatsApp",
    receivedAt: "Yesterday · 11:05 AM",
    isScam: false,
    preview: "Hi Mom! Still on for Sunday dinner at 5? Bringing lemon pie.",
    fullText:
      "Hi Mom! Still on for Sunday dinner at 5? I'm bringing the lemon pie from the bakery on Maple Street. Call me whenever you're free!",
    bodyParts: [
      {
        type: "text",
        value:
          "Hi Mom! Still on for Sunday dinner at 5? I'm bringing the lemon pie from the bakery on Maple Street. Call me whenever you're free!",
      },
    ],
  },
];

export const SCAM_LIBRARY: ScamPatternItem[] = [];
export const RECOVERY_SCENARIOS: RecoveryScenario[] = [];
