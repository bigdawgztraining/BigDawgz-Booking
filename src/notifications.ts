import nodemailer from "nodemailer";
import twilio from "twilio";
import { formatInTimeZone } from "date-fns-tz";
import { config } from "./config.js";
import type { AdminBooking, BookingInput } from "./googleCalendar.js";
import { getTrainer } from "./trainers.js";

export async function sendBookingNotifications(
  input: BookingInput & { end: string; waiverRequired?: boolean }
) {
  const results = await Promise.allSettled([
    sendBookingEmail(input),
    sendBookingText(input)
  ]);

  return {
    emailSent: results[0].status === "fulfilled",
    textSent: results[1].status === "fulfilled"
  };
}

export async function sendPackageBookingNotifications(
  input: BookingInput & {
    sessions: Array<{ start: string; end: string }>;
    waiverRequired?: boolean;
  }
) {
  const results = await Promise.allSettled([
    sendPackageBookingEmail(input),
    sendPackageBookingText(input)
  ]);

  return {
    emailSent: results[0].status === "fulfilled",
    textSent: results[1].status === "fulfilled"
  };
}

export async function sendCancellationEmail(booking: AdminBooking) {
  if (!booking.email) {
    return { emailSent: false };
  }

  await sendEmail({
    to: booking.email,
    subject: `BigDawgz Booking Canceled: ${booking.service}`,
    text: [
      `Hi ${booking.customerName},`,
      "",
      `Your ${booking.service} booking has been canceled.`,
      `Trainer: ${booking.trainer}`,
      `Date: ${formatDate(booking.start)}`,
      `Time: ${formatTimeRange(booking.start, booking.end)}`,
      `Location: ${config.business.address}`,
      `Website: ${config.business.website}`,
      "",
      `If you need to change or cancel this session, please reply back to this email or text us at ${config.business.phone}.`,
      config.business.name
    ].join("\n")
  });

  return { emailSent: true };
}

export async function sendRescheduleEmail(previous: AdminBooking, updated: AdminBooking) {
  if (!updated.email && !previous.email) {
    return { emailSent: false };
  }

  await sendEmail({
    to: updated.email ?? previous.email ?? "",
    subject: `BigDawgz Booking Rescheduled: ${updated.service}`,
    text: [
      `Hi ${updated.customerName},`,
      "",
      `Your ${updated.service} booking has been rescheduled.`,
      `Trainer: ${updated.trainer}`,
      "",
      `Previous time: ${formatDate(previous.start)} from ${formatTimeRange(previous.start, previous.end)}`,
      `New time: ${formatDate(updated.start)} from ${formatTimeRange(updated.start, updated.end)}`,
      `Location: ${config.business.address}`,
      `Website: ${config.business.website}`,
      "",
      `If you need to change or cancel this session, please reply back to this email or text us at ${config.business.phone}.`,
      "",
      "We look forward to seeing you.",
      config.business.name
    ].join("\n")
  });

  return { emailSent: true };
}

async function sendBookingEmail(input: BookingInput & { end: string; waiverRequired?: boolean }) {
  const trainer = getTrainer(input.trainerId);
  const fullName = `${input.customer.firstName} ${input.customer.lastName}`.trim();

  await sendEmail({
    to: input.customer.email,
    subject: `BigDawgz Booking Confirmed: ${serviceTitle(input.service)}`,
    text: [
      `Hi ${fullName},`,
      "",
      `Your ${serviceTitle(input.service)} booking is confirmed.`,
      `Trainer: ${trainer.name}`,
      `Date: ${formatDate(input.start)}`,
      `Time: ${formatTimeRange(input.start, input.end)}`,
      `Location: ${config.business.address}`,
      config.business.waiverUrl && input.waiverRequired !== false
        ? `First time training with us? Please complete your waiver before your session: ${config.business.waiverUrl}`
        : "",
      "",
      `If you need to change or cancel this session, please reply back to this email or text us at ${config.business.phone}.`,
      "",
      "We look forward to seeing you.",
      config.business.name
    ].join("\n")
  });
}

async function sendPackageBookingEmail(
  input: BookingInput & {
    sessions: Array<{ start: string; end: string }>;
    waiverRequired?: boolean;
  }
) {
  const trainer = getTrainer(input.trainerId);
  const fullName = `${input.customer.firstName} ${input.customer.lastName}`.trim();
  const sessionLines = input.sessions
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(
      (session) =>
        `- ${formatDate(session.start)} from ${formatTimeRange(session.start, session.end)}`
    );

  await sendEmail({
    to: input.customer.email,
    subject: `BigDawgz Package Confirmed: ${serviceTitle(input.service)}`,
    text: [
      `Hi ${fullName},`,
      "",
      `Your ${serviceTitle(input.service)} package is confirmed.`,
      `Trainer: ${trainer.name}`,
      `Sessions booked: ${input.sessions.length}`,
      `Location: ${config.business.address}`,
      "",
      "Scheduled sessions:",
      ...sessionLines,
      config.business.waiverUrl && input.waiverRequired !== false
        ? `\nFirst time training with us? Please complete your waiver before your first session: ${config.business.waiverUrl}`
        : "",
      "",
      `If you need to change or cancel a session, please reply back to this email or text us at ${config.business.phone}.`,
      "",
      "We look forward to seeing you.",
      config.business.name
    ]
      .filter(Boolean)
      .join("\n")
  });
}

async function sendBookingText(input: BookingInput & { end: string }) {
  const {
    twilioAccountSid,
    twilioAuthToken,
    twilioFromNumber
  } = config.notifications;

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber || !input.customer.phone) {
    return;
  }

  const client = twilio(twilioAccountSid, twilioAuthToken);

  await client.messages.create({
    from: twilioFromNumber,
    to: input.customer.phone,
    body: `BigDawgz booking confirmed: ${serviceTitle(input.service)} on ${formatDate(
      input.start
    )} at ${formatTimeRange(input.start, input.end)}. ${config.business.address}. Need to change or cancel? Reply to this text or call/text ${config.business.phone}.`
  });
}

async function sendPackageBookingText(
  input: BookingInput & { sessions: Array<{ start: string; end: string }> }
) {
  const {
    twilioAccountSid,
    twilioAuthToken,
    twilioFromNumber
  } = config.notifications;

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber || !input.customer.phone) {
    return;
  }

  const client = twilio(twilioAccountSid, twilioAuthToken);
  const sortedSessions = input.sessions.slice().sort((a, b) => a.start.localeCompare(b.start));
  const firstSession = sortedSessions[0];
  const lastSession = sortedSessions[sortedSessions.length - 1];

  await client.messages.create({
    from: twilioFromNumber,
    to: input.customer.phone,
    body: `BigDawgz package confirmed: ${sortedSessions.length} ${serviceTitle(
      input.service
    )} session${sortedSessions.length === 1 ? "" : "s"} booked starting ${formatDate(
      firstSession.start
    )}. Last scheduled session: ${formatDate(lastSession.start)}. ${config.business.address}. Need changes? Reply to this text or call/text ${config.business.phone}.`
  });
}

async function sendEmail(input: { to: string; subject: string; text: string }) {
  const transporter = buildTransporter();
  const { smtpFrom } = config.notifications;

  if (!transporter || !smtpFrom || !input.to) {
    return;
  }

  await transporter.sendMail({
    from: smtpFrom,
    to: input.to,
    subject: input.subject,
    text: input.text
  });
}

function buildTransporter() {
  const {
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom
  } = config.notifications;

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

function formatDate(start: string) {
  return formatInTimeZone(start, config.timezone, "EEEE, MMMM d");
}

function formatTimeRange(start: string, end: string) {
  return `${formatInTimeZone(start, config.timezone, "h:mm a")} - ${formatInTimeZone(
    end,
    config.timezone,
    "h:mm a"
  )} ${timezoneAbbrev()}`;
}

function timezoneAbbrev() {
  return config.timezone === "America/Detroit" ? "EST" : config.timezone;
}

function serviceTitle(service: BookingInput["service"]) {
  switch (service) {
    case "personal-training":
      return "Personal Training";
    case "pitching":
      return "Pitching / Baseball";
    case "ladies-night":
      return "Ladies Night";
    case "speed-agility-14-plus":
      return "Speed & Agility 14+";
    case "speed-agility-8-13":
      return "Speed & Agility 8-13";
  }
}
