import { google } from "googleapis";
import { addMinutes, format, isBefore, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { assertGoogleConfig, config } from "./config.js";
import { getServiceDefinition, getTrainer, ServiceType, Trainer } from "./trainers.js";

type AdminServiceType = ServiceType | "other";

export type AvailabilityCheckInput = {
  trainerId: string;
  startIso: string;
  endIso: string;
};

export type BookingInput = {
  service: ServiceType;
  trainerId: string;
  start: string;
  durationMinutes: number;
  plan: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    athleteName?: string;
    age?: string;
    notes?: string;
  };
};

export type AdminBooking = {
  id: string;
  calendarId: string;
  title: string;
  serviceId?: AdminServiceType;
  service: string;
  trainer: string;
  start: string;
  end: string;
  customerName: string;
  phone?: string;
  email?: string;
  notes?: string;
  htmlLink?: string;
  attendanceStatus?: "scheduled" | "completed" | "no-show";
};

type CalendarEventShape = {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  htmlLink?: string | null;
  extendedProperties?: { private?: Record<string, string> | null } | null;
};

type AttendanceStatus = "scheduled" | "completed" | "no-show";

const googleConfig = () => {
  const { email, privateKey } = assertGoogleConfig();
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"]
  });
};

function calendarClient() {
  return google.calendar({
    version: "v3",
    auth: googleConfig()
  });
}

function calendarDayViewLink(startIso: string) {
  const date = new Date(startIso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `https://calendar.google.com/calendar/u/0/r/day/${year}/${month}/${day}`;
}

type SlotStatus = {
  available: boolean;
  spotsLeft?: number;
};

function canServicesOverlap(serviceA?: string, serviceB?: string) {
  if (!serviceA || !serviceB) {
    return false;
  }

  const overlapPairs = new Set([
    "pitching|speed-agility-14-plus",
    "speed-agility-14-plus|pitching",
    "pitching|speed-agility-8-13",
    "speed-agility-8-13|pitching"
  ]);

  return overlapPairs.has(`${serviceA}|${serviceB}`);
}

function inferServiceFromSummary(summary?: string | null): ServiceType | undefined {
  const value = (summary ?? "").toLowerCase();

  if (value.includes("ladies night")) {
    return "ladies-night";
  }

  if (value.includes("speed") && value.includes("agility") && value.includes("14")) {
    return "speed-agility-14-plus";
  }

  if (
    value.includes("speed") &&
    value.includes("agility") &&
    (value.includes("8-13") || value.includes("8 13"))
  ) {
    return "speed-agility-8-13";
  }

  if (value.includes("pitch")) {
    return "pitching";
  }

  if (value.includes("personal training")) {
    return "personal-training";
  }

  return undefined;
}

function eventServiceId(event: {
  extendedProperties?: { private?: Record<string, string> | null } | null;
  summary?: string | null;
}): AdminServiceType | undefined {
  const explicit = event.extendedProperties?.private?.bigdawgzService;
  if (explicit === "other") {
    return "other";
  }

  return explicit ? (explicit as ServiceType) : inferServiceFromSummary(event.summary);
}

function isAppBookingEvent(event: {
  extendedProperties?: { private?: Record<string, string> | null } | null;
}) {
  return Boolean(event.extendedProperties?.private?.bigdawgzService);
}

function attendanceStatusFromEvent(event: CalendarEventShape): AttendanceStatus {
  const value = event.extendedProperties?.private?.attendanceStatus;
  if (value === "completed" || value === "no-show") {
    return value;
  }
  return "scheduled";
}

function trainerWindow(trainer: Trainer, date: string) {
  const weekday = Number(format(parseISO(`${date}T00:00:00`), "i"));
  return trainer.weeklyHours[weekday] ?? [];
}

function weekdayNumber(date: string) {
  return Number(format(parseISO(`${date}T00:00:00`), "i"));
}

function monthNumber(date: string) {
  return Number(format(parseISO(`${date}T00:00:00`), "M"));
}

function isPitchingWeekend(date: string) {
  const weekday = weekdayNumber(date);
  return weekday === 6 || weekday === 7;
}

function pitchingWeekendWindow(date: string) {
  const month = monthNumber(date);
  const inSpringSummer = month >= 4 && month <= 8;

  if (inSpringSummer) {
    return [{ start: "09:00", end: "17:00" }];
  }

  return [{ start: "09:00", end: "21:00" }];
}

function serviceWindow(service: ServiceType, date: string) {
  const serviceDefinition = getServiceDefinition(service);
  const weekday = weekdayNumber(date);

  if (service === "pitching" && isPitchingWeekend(date)) {
    return pitchingWeekendWindow(date);
  }

  return serviceDefinition.serviceHours?.[weekday] ?? [];
}

function zonedDateTime(date: string, time: string) {
  return fromZonedTime(`${date}T${time}:00`, config.timezone);
}

export async function isTrainerAvailable(input: AvailabilityCheckInput): Promise<boolean> {
  const events = await listEventsForWindow({
    trainerId: input.trainerId,
    startIso: input.startIso,
    endIso: input.endIso
  });
  return events.length === 0;
}

async function listEventsForWindow(input: {
  trainerId: string;
  startIso: string;
  endIso: string;
  ignoreEventId?: string;
}) {
  const client = calendarClient();
  const trainer = getTrainer(input.trainerId);
  const response = await client.events.list({
    calendarId: trainer.calendarId,
    timeMin: input.startIso,
    timeMax: input.endIso,
    singleEvents: true,
    maxResults: 50,
    orderBy: "startTime"
  });

  return (response.data.items ?? []).filter((event) => event.id !== input.ignoreEventId);
}

async function getSlotStatus(input: {
  service: ServiceType;
  trainerId: string;
  startIso: string;
  endIso: string;
  ignoreEventId?: string;
}): Promise<SlotStatus> {
  const service = getServiceDefinition(input.service);

  if (service.bookingMode === "one-on-one") {
    const events = await listEventsForWindow({
      trainerId: input.trainerId,
      startIso: input.startIso,
      endIso: input.endIso,
      ignoreEventId: input.ignoreEventId
    });
    const blocking = events.filter((event) => {
      const existingService = eventServiceId(event);
      if (!existingService) {
        return true;
      }
      return !canServicesOverlap(input.service, existingService);
    });

    return { available: blocking.length === 0 };
  }

  const events = await listEventsForWindow({
    trainerId: input.trainerId,
    startIso: input.startIso,
    endIso: input.endIso,
    ignoreEventId: input.ignoreEventId
  });

  const matching = events.filter(
    (event) =>
      isAppBookingEvent(event) &&
      event.extendedProperties?.private?.bigdawgzService === input.service
  );
  const blocking = events.filter(
    (event) => {
      const existingService = eventServiceId(event);
      if (!existingService) {
        return true;
      }

      if (existingService === input.service) {
        return false;
      }

      return !canServicesOverlap(input.service, existingService);
    }
  );

  const spotsLeft = Math.max((service.capacity ?? 0) - matching.length, 0);
  return {
    available: blocking.length === 0 && spotsLeft > 0,
    spotsLeft
  };
}

export async function listAvailableSlots(input: {
  trainerId: string;
  date: string;
  service: ServiceType;
  durationMinutes?: number;
  ignoreEventId?: string;
}) {
  const trainer = getTrainer(input.trainerId);
  const service = getServiceDefinition(input.service);

  if (
    !trainer.services.includes(input.service) ||
    !service.trainerIds.includes(trainer.id)
  ) {
    return [];
  }

  const windows =
    service.bookingMode === "group"
      ? service.fixedWindows?.[Number(format(parseISO(`${input.date}T00:00:00`), "i"))] ?? []
      : service.availabilityMode === "service-hours"
        ? serviceWindow(input.service, input.date)
      : trainerWindow(trainer, input.date);

  if (windows.length === 0) {
    return [];
  }

  const duration = input.durationMinutes ?? service.durationMinutes ?? config.slotDurationMinutes;
  const slotLength = service.slotStepMinutes ?? duration;
  const slots: Array<{ start: string; end: string; label: string; spotsLeft?: number }> = [];
  const now = new Date();

  for (const window of windows) {
    let current = zonedDateTime(input.date, window.start);
    const endBoundary = zonedDateTime(input.date, window.end);

    while (isBefore(addMinutes(current, duration), addMinutes(endBoundary, 1))) {
      const slotEnd = addMinutes(current, duration);

      if (current <= now) {
        if (service.bookingMode === "group") {
          break;
        }

        current = addMinutes(current, slotLength);
        continue;
      }

      const status = await getSlotStatus({
        service: input.service,
        trainerId: input.trainerId,
        startIso: current.toISOString(),
        endIso: slotEnd.toISOString(),
        ignoreEventId: input.ignoreEventId
      });

      if (status.available) {
        slots.push({
          start: current.toISOString(),
          end: slotEnd.toISOString(),
          label: formatInTimeZone(current, config.timezone, "h:mm a"),
          spotsLeft: status.spotsLeft
        });
      }

      if (service.bookingMode === "group") {
        break;
      }

      current = addMinutes(current, slotLength);
    }
  }

  return slots;
}

export async function createBooking(input: BookingInput) {
  const client = calendarClient();
  const trainer = getTrainer(input.trainerId);
  const service = getServiceDefinition(input.service);
  const end = addMinutes(new Date(input.start), input.durationMinutes);

  const event = await client.events.insert({
    calendarId: trainer.calendarId,
    requestBody: {
      summary: `${titleForService(input.service)} - ${input.customer.firstName} ${input.customer.lastName}`,
      description: bookingDescription(input, trainer),
      start: {
        dateTime: input.start,
        timeZone: config.timezone
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: config.timezone
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 120 }
        ]
      },
      extendedProperties: {
        private: {
          bigdawgzService: input.service,
          bigdawgzPlan: input.plan,
          customerPhone: input.customer.phone,
          customerEmail: input.customer.email,
          bookingMode: service.bookingMode
        }
      }
    }
  });

  return {
    id: event.data.id,
    htmlLink: event.data.htmlLink,
    calendarViewLink: calendarDayViewLink(input.start),
    end: end.toISOString()
  };
}

export async function listUpcomingBookings(daysAhead = 14): Promise<AdminBooking[]> {
  const client = calendarClient();
  const seen = new Set<string>();
  const bookings: AdminBooking[] = [];
  const calendarIds = Array.from(
    new Set([config.calendars.jharel, config.calendars.nateCollins])
  );
  const timeMin = new Date().toISOString();
  const timeMax = addMinutes(new Date(), daysAhead * 24 * 60).toISOString();

  for (const calendarId of calendarIds) {
    const response = await client.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 250,
      orderBy: "startTime"
    });

    for (const event of response.data.items ?? []) {
      const booking = toAdminBooking(event, calendarId);
      if (!booking || seen.has(booking.id)) {
        continue;
      }

      seen.add(booking.id);
      bookings.push(booking);
    }
  }

  return bookings.sort((a, b) => a.start.localeCompare(b.start));
}

export async function listBookingsInRange(startIso: string, endIso: string): Promise<AdminBooking[]> {
  const client = calendarClient();
  const seen = new Set<string>();
  const bookings: AdminBooking[] = [];
  const calendarIds = Array.from(
    new Set([config.calendars.jharel, config.calendars.nateCollins])
  );

  for (const calendarId of calendarIds) {
    const response = await client.events.list({
      calendarId,
      timeMin: startIso,
      timeMax: endIso,
      singleEvents: true,
      maxResults: 250,
      orderBy: "startTime"
    });

    for (const event of response.data.items ?? []) {
      const booking = toAdminBooking(event, calendarId);
      if (!booking || seen.has(booking.id)) {
        continue;
      }

      seen.add(booking.id);
      bookings.push(booking);
    }
  }

  return bookings.sort((a, b) => a.start.localeCompare(b.start));
}

export async function searchBookingHistory(
  query: string,
  daysBack = 365,
  daysForward = 30
): Promise<AdminBooking[]> {
  const client = calendarClient();
  const seen = new Set<string>();
  const results: AdminBooking[] = [];
  const calendarIds = Array.from(
    new Set([config.calendars.jharel, config.calendars.nateCollins])
  );
  const timeMin = addMinutes(new Date(), -daysBack * 24 * 60).toISOString();
  const timeMax = addMinutes(new Date(), daysForward * 24 * 60).toISOString();
  const needle = query.trim().toLowerCase();

  for (const calendarId of calendarIds) {
    const response = await client.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 1000,
      orderBy: "startTime"
    });

    for (const event of response.data.items ?? []) {
      const booking = toAdminBooking(event, calendarId);
      if (!booking || seen.has(booking.id)) {
        continue;
      }

      const haystack = [
        booking.title,
        booking.service,
        booking.trainer,
        booking.customerName,
        booking.phone,
        booking.email,
        booking.notes
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!needle || haystack.includes(needle)) {
        seen.add(booking.id);
        results.push(booking);
      }
    }
  }

  return results.sort((a, b) => b.start.localeCompare(a.start));
}

export async function getBookingEvent(eventId: string, calendarId: string): Promise<AdminBooking | null> {
  const client = calendarClient();
  const response = await client.events.get({
    calendarId,
    eventId
  });

  return toAdminBooking(response.data, calendarId);
}

export async function deleteBookingEvent(eventId: string, calendarId: string) {
  const client = calendarClient();
  await client.events.delete({
    calendarId,
    eventId
  });
}

export async function rescheduleBookingEvent(input: {
  eventId: string;
  calendarId: string;
  start: string;
  end: string;
}) {
  const client = calendarClient();
  await client.events.patch({
    calendarId: input.calendarId,
    eventId: input.eventId,
    requestBody: {
      start: {
        dateTime: input.start,
        timeZone: config.timezone
      },
      end: {
        dateTime: input.end,
        timeZone: config.timezone
      }
    }
  });
}

export async function updateBookingStatus(input: {
  eventId: string;
  calendarId: string;
  status: AttendanceStatus;
}) {
  const client = calendarClient();
  const existing = await client.events.get({
    calendarId: input.calendarId,
    eventId: input.eventId
  });

  await client.events.patch({
    calendarId: input.calendarId,
    eventId: input.eventId,
    requestBody: {
      extendedProperties: {
        private: {
          ...(existing.data.extendedProperties?.private ?? {}),
          attendanceStatus: input.status
        }
      }
    }
  });
}

export async function updateBookingNotes(input: {
  eventId: string;
  calendarId: string;
  notes: string;
}) {
  const client = calendarClient();
  const existing = await client.events.get({
    calendarId: input.calendarId,
    eventId: input.eventId
  });

  const description = existing.data.description ?? "";
  const lines = description.split("\n").filter(Boolean);
  const withoutNotes = lines.filter((line) => !line.startsWith("Notes: "));
  const nextLines = input.notes.trim()
    ? [...withoutNotes, `Notes: ${input.notes.trim()}`]
    : withoutNotes;

  await client.events.patch({
    calendarId: input.calendarId,
    eventId: input.eventId,
    requestBody: {
      description: nextLines.join("\n")
    }
  });
}

export async function updateBookingDetails(input: {
  eventId: string;
  calendarId: string;
  serviceId?: AdminServiceType | "";
  customerName: string;
  phone: string;
  email: string;
  notes: string;
}) {
  const client = calendarClient();
  const existing = await client.events.get({
    calendarId: input.calendarId,
    eventId: input.eventId
  });

  const existingEvent = existing.data;
  const existingServiceId = eventServiceId(existingEvent);
  const nextServiceId = (input.serviceId || existingServiceId || undefined) as
    | AdminServiceType
    | undefined;
  const trainerName =
    nextServiceId === "other"
      ? "Not linked yet"
      : nextServiceId
      ? getTrainer(getTrainerIdForService(nextServiceId)).name
      : existingEvent.description
        ?.split("\n")
        .find((line) => line.startsWith("Trainer: "))
        ?.replace("Trainer: ", "") ?? "Manual calendar entry";

  const lines = (existingEvent.description ?? "").split("\n").filter(Boolean);
  const preserved = lines.filter(
    (line) =>
      !line.startsWith("Trainer: ") &&
      !line.startsWith("Client: ") &&
      !line.startsWith("Phone: ") &&
      !line.startsWith("Email: ") &&
      !line.startsWith("Notes: ")
  );

  const nextDescriptionLines = [
    `Trainer: ${trainerName}`,
    `Client: ${input.customerName.trim() || "Not provided"}`,
    `Phone: ${input.phone.trim() || "-"}`,
    `Email: ${input.email.trim() || "-"}`,
    ...preserved
  ];

  if (input.notes.trim()) {
    nextDescriptionLines.push(`Notes: ${input.notes.trim()}`);
  }

  const summary = nextServiceId
    ? input.customerName.trim()
      ? `${titleForService(nextServiceId)} - ${input.customerName.trim()}`
      : titleForService(nextServiceId)
    : existingEvent.summary ?? "Booking";

  await client.events.patch({
    calendarId: input.calendarId,
    eventId: input.eventId,
    requestBody: {
      summary,
      description: nextDescriptionLines.join("\n"),
      extendedProperties: {
        private: {
          ...(existingEvent.extendedProperties?.private ?? {}),
          ...(nextServiceId ? { bigdawgzService: nextServiceId } : {})
        }
      }
    }
  });
}

function toAdminBooking(event: CalendarEventShape, calendarId: string): AdminBooking | null {
  if (!event.id) {
    return null;
  }

  const serviceId = eventServiceId(event);
  const trainerLine = event.description
    ?.split("\n")
    .find((line) => line.startsWith("Trainer: "));
  const clientLine = event.description
    ?.split("\n")
    .find((line) => line.startsWith("Client: "));
  const phoneLine = event.description
    ?.split("\n")
    .find((line) => line.startsWith("Phone: "));
  const emailLine = event.description
    ?.split("\n")
    .find((line) => line.startsWith("Email: "));
  const notesLine = event.description
    ?.split("\n")
    .find((line) => line.startsWith("Notes: "));

  return {
    id: event.id,
    calendarId,
    title: event.summary ?? "Booking",
    serviceId: serviceId ?? undefined,
    service: serviceId ? titleForService(serviceId) : event.summary ?? "Calendar Event",
    trainer: trainerLine?.replace("Trainer: ", "") ?? "Manual calendar entry",
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    customerName: clientLine?.replace("Client: ", "") ?? "Not provided",
    phone: phoneLine?.replace("Phone: ", "") || undefined,
    email: emailLine?.replace("Email: ", "") || undefined,
    notes: notesLine?.replace("Notes: ", "") || undefined,
    htmlLink: event.htmlLink ?? undefined,
    attendanceStatus: attendanceStatusFromEvent(event)
  };
}

export function getTrainerIdForService(serviceId: ServiceType) {
  const service = getServiceDefinition(serviceId);
  return service.trainerIds[0];
}

function titleForService(service: AdminServiceType) {
  switch (service) {
    case "personal-training":
      return "Personal Training";
    case "pitching":
      return "Pitching / Baseball Training";
    case "ladies-night":
      return "Ladies Night";
    case "speed-agility-14-plus":
      return "Speed & Agility 14+";
    case "speed-agility-8-13":
      return "Speed & Agility 8-13";
    case "other":
      return "Other";
  }
}

function bookingDescription(input: BookingInput, trainer: Trainer) {
  const lines = [
    `Trainer: ${trainer.name}`,
    `Plan: ${input.plan}`,
    `Client: ${input.customer.firstName} ${input.customer.lastName}`,
    `Phone: ${input.customer.phone}`,
    `Email: ${input.customer.email}`
  ];

  if (input.customer.athleteName) {
    lines.push(`Athlete: ${input.customer.athleteName}`);
  }

  if (input.customer.age) {
    lines.push(`Age: ${input.customer.age}`);
  }

  if (input.customer.notes) {
    lines.push(`Notes: ${input.customer.notes}`);
  }

  return lines.join("\n");
}
