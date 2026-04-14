import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:8080",
  timezone: process.env.TIMEZONE ?? "America/Detroit",
  admin: {
    password: process.env.ADMIN_PASSWORD ?? "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "bigdawgz-admin"
  },
  business: {
    name: "BigDawgz Performance",
    address: "30990 Wixom Rd, Wixom, MI 48393",
    website: "https://www.bigdawgztraining.com",
    waiverUrl: process.env.WAIVER_URL ?? "",
    phone: process.env.BUSINESS_PHONE ?? "305-812-6181"
  },
  slotDurationMinutes: Number(process.env.SLOT_DURATION_MINUTES ?? 60),
  slotBufferMinutes: Number(process.env.SLOT_BUFFER_MINUTES ?? 10),
  calendars: {
    jharel: process.env.CALENDAR_ID_JHAREL ?? "primary",
    nateCollins:
      process.env.CALENDAR_ID_NATE_COLLINS ??
      process.env.CALENDAR_ID_JHAREL ??
      "primary"
  },
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googleServiceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  notifications: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER
  }
};

export function assertGoogleConfig(): { email: string; privateKey: string } {
  return {
    email: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n")
  };
}
