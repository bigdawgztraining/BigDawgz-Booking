import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { config } from "./config.js";
import {
  findClientRecord,
  setClientWaiverStatus,
  upsertClientRecord
} from "./clientStore.js";
import {
  createBooking,
  deleteBookingEvent,
  getBookingEvent,
  getTrainerIdForService,
  isTrainerAvailable,
  listBookingsInRange,
  listAvailableSlots,
  listUpcomingBookings,
  rescheduleBookingEvent,
  searchBookingHistory,
  updateBookingDetails,
  updateBookingNotes,
  updateBookingStatus
} from "./googleCalendar.js";
import {
  sendBookingNotifications,
  sendPackageBookingNotifications,
  sendCancellationEmail,
  sendRescheduleEmail
} from "./notifications.js";
import { trainers } from "./trainers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../public")));

const ADMIN_COOKIE_NAME = "bigdawgz_admin_session";

function signAdminSession(value: string) {
  const signature = crypto
    .createHmac("sha256", config.admin.sessionSecret)
    .update(value)
    .digest("hex");
  return `${value}.${signature}`;
}

function isValidAdminSession(rawCookie?: string) {
  if (!rawCookie) {
    return false;
  }

  const [value, signature] = rawCookie.split(".");
  if (!value || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.admin.sessionSecret)
    .update(value)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return "";
  }

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const match = cookies.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const session = readCookie(req, ADMIN_COOKIE_NAME);
  if (!isValidAdminSession(session)) {
    return res.status(401).json({
      ok: false,
      message: "Admin login required."
    });
  }

  next();
}

function setAdminCookie(res: Response) {
  const token = signAdminSession("admin");
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
  );
}

function clearAdminCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

async function enrichBookingWithClient(booking: Awaited<ReturnType<typeof getBookingEvent>>) {
  if (!booking) {
    return null;
  }

  const client = await findClientRecord({
    email: booking.email,
    phone: booking.phone
  });

  return {
    ...booking,
    clientId: client?.id,
    waiverSigned: client?.waiverSigned ?? false,
    waiverSignedAt: client?.waiverSignedAt
  };
}

async function enrichBookingsWithClients(bookings: Awaited<ReturnType<typeof listUpcomingBookings>>) {
  return Promise.all(bookings.map((booking) => enrichBookingWithClient(booking)));
}

const availabilitySchema = z.object({
  trainerId: z.string(),
  startIso: z.string().datetime(),
  endIso: z.string().datetime()
});

const bookingSchema = z.object({
  service: z.enum([
    "personal-training",
    "pitching",
    "ladies-night",
    "speed-agility-14-plus",
    "speed-agility-8-13"
  ]),
  trainerId: z.string(),
  start: z.string().datetime(),
  durationMinutes: z.number().min(30).max(180),
  plan: z.string().min(1),
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(7),
    email: z.string().email(),
    athleteName: z.string().optional(),
    age: z.string().optional(),
    notes: z.string().optional()
  })
});

const batchBookingSchema = z.object({
  service: z.enum([
    "personal-training",
    "pitching",
    "ladies-night",
    "speed-agility-14-plus",
    "speed-agility-8-13"
  ]),
  trainerId: z.string(),
  starts: z.array(z.string().datetime()).min(1).max(20),
  durationMinutes: z.number().min(30).max(180),
  plan: z.string().min(1),
  customer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(7),
    email: z.string().email(),
    athleteName: z.string().optional(),
    age: z.string().optional(),
    notes: z.string().optional()
  })
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    timezone: config.timezone,
    waiverUrl: config.business.waiverUrl
  });
});

app.get("/api/calendar/invite.ics", (req, res) => {
  const title = String(req.query.title ?? "BigDawgz Booking");
  const description = String(req.query.description ?? "");
  const location = String(req.query.location ?? config.business.address);
  const start = String(req.query.start ?? "");
  const end = String(req.query.end ?? "");

  if (!start || !end) {
    return res.status(400).json({
      ok: false,
      message: "start and end are required"
    });
  }

  const ics = buildIcsEvent({
    title,
    description,
    location,
    start,
    end
  });

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="bigdawgz-booking.ics"');
  return res.send(ics);
});

app.get("/api/trainers", (_req, res) => {
  res.json({
    ok: true,
    trainers: trainers.map((trainer) => ({
      id: trainer.id,
      name: trainer.name,
      bio: trainer.bio,
      services: trainer.services
    }))
  });
});

app.get("/api/admin/session", (req, res) => {
  return res.json({
    ok: true,
    authenticated: isValidAdminSession(readCookie(req, ADMIN_COOKIE_NAME))
  });
});

app.post("/api/admin/session", (req, res) => {
  const input = z
    .object({
      password: z.string()
    })
    .parse(req.body);

  if (!config.admin.password || input.password !== config.admin.password) {
    return res.status(401).json({
      ok: false,
      message: "Incorrect password."
    });
  }

  setAdminCookie(res);
  return res.json({
    ok: true,
    authenticated: true
  });
});

app.delete("/api/admin/session", (_req, res) => {
  clearAdminCookie(res);
  return res.json({
    ok: true
  });
});

app.get("/api/availability/slots", async (req, res, next) => {
  try {
    const trainerId = String(req.query.trainer ?? "");
    const date = String(req.query.date ?? "");
    const service = String(req.query.service ?? "");
    const durationMinutes = req.query.durationMinutes
      ? Number(req.query.durationMinutes)
      : undefined;

    if (!trainerId || !date || !service) {
      return res.status(400).json({
        ok: false,
        message: "trainer, date, and service are required"
      });
    }

    const slots = await listAvailableSlots({
      trainerId,
      date,
      service: service as
        | "personal-training"
        | "pitching"
        | "ladies-night"
        | "speed-agility-14-plus"
        | "speed-agility-8-13",
      durationMinutes
    });

    return res.json({
      ok: true,
      slots
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/availability/check", async (req, res, next) => {
  try {
    const input = availabilitySchema.parse(req.body);
    const available = await isTrainerAvailable(input);
    return res.json({
      ok: true,
      available
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = bookingSchema.parse(req.body);
    const endIso = new Date(
      new Date(input.start).getTime() + input.durationMinutes * 60 * 1000
    ).toISOString();

    const slots = await listAvailableSlots({
      trainerId: input.trainerId,
      date: input.start.slice(0, 10),
      service: input.service,
      durationMinutes: input.durationMinutes
    });

    const matchingSlot = slots.find((slot) => slot.start === input.start);
    if (!matchingSlot) {
      return res.status(409).json({
        ok: false,
        message: "That slot is no longer available."
      });
    }

    const booking = await createBooking(input);
    const client = await upsertClientRecord({
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      customerName: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
      phone: input.customer.phone,
      email: input.customer.email,
      athleteName: input.customer.athleteName,
      age: input.customer.age,
      notes: input.customer.notes
    });
    const notifications = await sendBookingNotifications({
      ...input,
      end: booking.end,
      waiverRequired: !(client?.waiverSigned ?? false)
    });
    return res.status(201).json({
      ok: true,
      booking,
      notifications,
      client: client
        ? {
            id: client.id,
            waiverSigned: client.waiverSigned,
            waiverSignedAt: client.waiverSignedAt
          }
        : null
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings/batch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = batchBookingSchema.parse(req.body);
    const uniqueStarts = Array.from(new Set(input.starts)).sort();

    if (!uniqueStarts.length) {
      return res.status(400).json({
        ok: false,
        message: "At least one session is required."
      });
    }

    for (const start of uniqueStarts) {
      const slots = await listAvailableSlots({
        trainerId: input.trainerId,
        date: start.slice(0, 10),
        service: input.service,
        durationMinutes: input.durationMinutes
      });

      const matchingSlot = slots.find((slot) => slot.start === start);
      if (!matchingSlot) {
        return res.status(409).json({
          ok: false,
          message: `One of the selected slots is no longer available: ${start}`
        });
      }
    }

    const client = await upsertClientRecord({
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      customerName: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
      phone: input.customer.phone,
      email: input.customer.email,
      athleteName: input.customer.athleteName,
      age: input.customer.age,
      notes: input.customer.notes
    });

    const createdBookings: Array<{
      id?: string | null;
      htmlLink?: string | null;
      calendarViewLink?: string | null;
      start: string;
      end: string;
    }> = [];

    try {
      for (const start of uniqueStarts) {
        const booking = await createBooking({
          service: input.service,
          trainerId: input.trainerId,
          start,
          durationMinutes: input.durationMinutes,
          plan: input.plan,
          customer: input.customer
        });

        createdBookings.push({
          ...booking,
          start
        });
      }
    } catch (error) {
      await Promise.allSettled(
        createdBookings
          .filter((booking) => booking.id)
          .map((booking) => deleteBookingEvent(String(booking.id), trainers.find((trainer) => trainer.id === input.trainerId)?.calendarId ?? ""))
      );
      throw error;
    }

    const notifications = await sendPackageBookingNotifications({
      service: input.service,
      trainerId: input.trainerId,
      start: createdBookings[0].start,
      durationMinutes: input.durationMinutes,
      plan: input.plan,
      customer: input.customer,
      sessions: createdBookings.map((booking) => ({
        start: booking.start,
        end: booking.end
      })),
      waiverRequired: !(client?.waiverSigned ?? false)
    });

    return res.status(201).json({
      ok: true,
      bookings: createdBookings,
      notifications,
      client: client
        ? {
            id: client.id,
            waiverSigned: client.waiverSigned,
            waiverSignedAt: client.waiverSignedAt
          }
        : null
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/bookings", requireAdminAuth, async (req, res, next) => {
  try {
    const start = String(req.query.start ?? "");
    const end = String(req.query.end ?? "");
    const bookings =
      start && end
        ? await listBookingsInRange(
            fromZonedTime(`${start}T00:00:00`, config.timezone).toISOString(),
            fromZonedTime(`${end}T00:00:00`, config.timezone).toISOString()
          )
        : await listUpcomingBookings(req.query.days ? Number(req.query.days) : 14);

    const enriched = (await enrichBookingsWithClients(bookings)).filter(Boolean);
    return res.json({
      ok: true,
      bookings: enriched
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/search", requireAdminAuth, async (req, res, next) => {
  try {
    const query = String(req.query.query ?? "");
    const results = await searchBookingHistory(query);
    const summary = results.reduce(
      (acc, booking) => {
        acc.total += 1;
        if (booking.attendanceStatus === "completed") {
          acc.completed += 1;
        } else if (booking.attendanceStatus === "no-show") {
          acc.noShow += 1;
        } else {
          acc.scheduled += 1;
        }
        return acc;
      },
      { total: 0, scheduled: 0, completed: 0, noShow: 0 }
    );

    const enriched = (await enrichBookingsWithClients(results)).filter(Boolean);
    return res.json({
      ok: true,
      query,
      summary,
      results: enriched
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/bookings/:eventId", requireAdminAuth, async (req, res, next) => {
  try {
    const eventId = String(req.params.eventId ?? "");
    const calendarId = String(req.query.calendarId ?? "");

    if (!eventId || !calendarId) {
      return res.status(400).json({
        ok: false,
        message: "eventId and calendarId are required"
      });
    }

    const booking = await getBookingEvent(eventId, calendarId);
    await deleteBookingEvent(eventId, calendarId);

    const notifications = booking ? await sendCancellationEmail(booking) : { emailSent: false };
    return res.json({
      ok: true,
      notifications
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/bookings/:eventId", requireAdminAuth, async (req, res, next) => {
  try {
    const eventId = String(req.params.eventId ?? "");
    const input = z
      .union([
        z.object({
          calendarId: z.string().min(1),
          start: z.string().datetime(),
          end: z.string().datetime()
        }),
        z.object({
          calendarId: z.string().min(1),
          localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          localTime: z.string().regex(/^\d{2}:\d{2}$/),
          durationMinutes: z.number().min(1).max(480)
        })
      ])
      .parse(req.body);

    if (!eventId) {
      return res.status(400).json({
        ok: false,
        message: "eventId is required"
      });
    }

    const calendarId = input.calendarId;
    const nextStart =
      "start" in input
        ? input.start
        : fromZonedTime(`${input.localDate}T${input.localTime}:00`, config.timezone).toISOString();
    const nextEnd =
      "end" in input
        ? input.end
        : addMinutes(new Date(nextStart), input.durationMinutes).toISOString();

    const previousBooking = await getBookingEvent(eventId, calendarId);
    await rescheduleBookingEvent({
      eventId,
      calendarId,
      start: nextStart,
      end: nextEnd
    });

    const updatedBooking = await getBookingEvent(eventId, calendarId);
    const notifications =
      previousBooking && updatedBooking
        ? await sendRescheduleEmail(previousBooking, updatedBooking)
        : { emailSent: false };

    return res.json({
      ok: true,
      notifications
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/bookings/:eventId/status", requireAdminAuth, async (req, res, next) => {
  try {
    const eventId = String(req.params.eventId ?? "");
    const input = z
      .object({
        calendarId: z.string().min(1),
        status: z.enum(["scheduled", "completed", "no-show"])
      })
      .parse(req.body);

    if (!eventId) {
      return res.status(400).json({
        ok: false,
        message: "eventId is required"
      });
    }

    await updateBookingStatus({
      eventId,
      calendarId: input.calendarId,
      status: input.status
    });

    const booking = await enrichBookingWithClient(await getBookingEvent(eventId, input.calendarId));
    return res.json({
      ok: true,
      booking
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/bookings/:eventId/notes", requireAdminAuth, async (req, res, next) => {
  try {
    const eventId = String(req.params.eventId ?? "");
    const input = z
      .object({
        calendarId: z.string().min(1),
        notes: z.string()
      })
      .parse(req.body);

    if (!eventId) {
      return res.status(400).json({
        ok: false,
        message: "eventId is required"
      });
    }

    await updateBookingNotes({
      eventId,
      calendarId: input.calendarId,
      notes: input.notes
    });

    const booking = await getBookingEvent(eventId, input.calendarId);
    return res.json({
      ok: true,
      booking
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/bookings/:eventId/details", requireAdminAuth, async (req, res, next) => {
  try {
    const eventId = String(req.params.eventId ?? "");
    const input = z
      .object({
        calendarId: z.string().min(1),
        serviceId: z
          .enum([
            "personal-training",
            "pitching",
            "ladies-night",
            "speed-agility-14-plus",
            "speed-agility-8-13",
            "other"
          ])
          .or(z.literal(""))
          .optional(),
        customerName: z.string(),
        phone: z.string(),
        email: z.string(),
        notes: z.string()
      })
      .parse(req.body);

    if (!eventId) {
      return res.status(400).json({
        ok: false,
        message: "eventId is required"
      });
    }

    await updateBookingDetails({
      eventId,
      calendarId: input.calendarId,
      serviceId: input.serviceId,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email,
      notes: input.notes
    });

    await upsertClientRecord({
      customerName: input.customerName,
      phone: input.phone,
      email: input.email,
      notes: input.notes
    });

    const booking = await enrichBookingWithClient(await getBookingEvent(eventId, input.calendarId));
    return res.json({
      ok: true,
      booking
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/bookings/:eventId/waiver", requireAdminAuth, async (req, res, next) => {
  try {
    const eventId = String(req.params.eventId ?? "");
    const input = z
      .object({
        calendarId: z.string().min(1),
        waiverSigned: z.boolean()
      })
      .parse(req.body);

    if (!eventId) {
      return res.status(400).json({
        ok: false,
        message: "eventId is required"
      });
    }

    const booking = await getBookingEvent(eventId, input.calendarId);
    if (!booking) {
      return res.status(404).json({
        ok: false,
        message: "Booking not found."
      });
    }

    await upsertClientRecord({
      customerName: booking.customerName,
      phone: booking.phone,
      email: booking.email,
      notes: booking.notes
    });

    const client = await setClientWaiverStatus(
      {
        email: booking.email,
        phone: booking.phone
      },
      input.waiverSigned
    );

    const enrichedBooking = await enrichBookingWithClient(booking);
    return res.json({
      ok: true,
      booking: enrichedBooking,
      client
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/reschedule-slots", requireAdminAuth, async (req, res, next) => {
  try {
    const service = String(req.query.service ?? "");
    const date = String(req.query.date ?? "");
    const ignoreEventId = String(req.query.ignoreEventId ?? "");

    if (!service || !date) {
      return res.status(400).json({
        ok: false,
        message: "service and date are required"
      });
    }

    const trainerId = getTrainerIdForService(
      service as
        | "personal-training"
        | "pitching"
        | "ladies-night"
        | "speed-agility-14-plus"
        | "speed-agility-8-13"
    );

    const slots = await listAvailableSlots({
      trainerId,
      date,
      service: service as
        | "personal-training"
        | "pitching"
        | "ladies-night"
        | "speed-agility-14-plus"
        | "speed-agility-8-13",
      ignoreEventId: ignoreEventId || undefined
    });

    return res.json({
      ok: true,
      slots
    });
  } catch (error) {
    next(error);
  }
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/admin.html"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      ok: false,
      message: "Invalid request body.",
      issues: error.issues
    });
  }

  const message =
    error instanceof Error ? error.message : "An unexpected server error occurred.";

  return res.status(500).json({
    ok: false,
    message
  });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`BigDawgz booking server running at ${config.appBaseUrl}`);
});

function buildIcsEvent(input: {
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
}) {
  const uid = `${Date.now()}@bigdawgz-booking`;
  const now = toIcsDate(new Date().toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BigDawgz Performance//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(input.start)}`,
    `DTEND:${toIcsDate(input.end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    `LOCATION:${escapeIcsText(input.location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function toIcsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
