import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

const schedule = {
  "13U": ["2026-12-21", "2026-12-28"],
  "11–12U": ["2026-12-22", "2026-12-29"],
  "9–10U": ["2026-12-23", "2026-12-30"]
};
const bookingInput = z.object({
  id: z.string().uuid(),
  group: z.enum(["13U", "11–12U", "9–10U"]),
  dates: z.array(z.string()).min(1).max(2),
  athlete: z.string().trim().min(1).max(120),
  guardian: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(40).refine(value => /[0-9]{7,}/.test(value.replace(/\D/g, ""))),
  email: z.string().trim().email().max(254)
}).refine(({ group, dates }) =>
  new Set(dates).size === dates.length && dates.every(date => schedule[group].includes(date))
);

const paymentInput = z.enum(["venmo", "cash"]);
type Booking = z.infer<typeof bookingInput> & {
  payment: z.infer<typeof paymentInput> | null;
  createdAt: string;
};
const directory = process.env.WINTER_CAMP_DATA_DIR ??
  fileURLToPath(new URL("../data/winter-camp/", import.meta.url));

function bookingPath(id: string) {
  return path.join(directory, id + ".json");
}

async function readBooking(id: string): Promise<Booking> {
  return JSON.parse(await readFile(bookingPath(id), "utf8"));
}

async function saveBooking(booking: Booking, create: boolean) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, randomUUID() + ".tmp");
  await writeFile(temporary, JSON.stringify(booking), { mode: 0o600, flag: "wx" });
  try {
    if (create) await link(temporary, bookingPath(booking.id));
    else await rename(temporary, bookingPath(booking.id));
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

const capacity = 22;
let bookingQueue = Promise.resolve();

function remainingSpots(bookings: Booking[]) {
  const remaining = Object.fromEntries(Object.values(schedule).flat().map(date => [date, capacity]));
  for (const booking of bookings) {
    for (const date of booking.dates) {
      if (date in remaining) remaining[date] = Math.max(0, remaining[date] - 1);
    }
  }
  return remaining;
}

export const winterCampRouter = Router();
winterCampRouter.get("/schedule", (_req, res) => res.json(schedule));

winterCampRouter.get("/availability", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json(remainingSpots(await listCampBookings()));
  } catch (error) {
    next(error);
  }
});

winterCampRouter.post("/bookings", async (req, res, next) => {
  const input = bookingInput.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ message: "Check your contact details and select dates for your age group." });
    return;
  }

  const booking = { ...input.data, payment: null, createdAt: new Date().toISOString() };
  // Keep the capacity check and save together on this server instance.
  const registration = bookingQueue.then(async () => {
    const bookings = await listCampBookings();
    const existing = bookings.find(entry => entry.id === booking.id);
    if (existing) {
      if (Object.entries(input.data).every(([key, value]) =>
        JSON.stringify(existing[key as keyof Booking]) === JSON.stringify(value)
      )) {
        res.json({ id: booking.id });
      } else {
        res.status(409).json({ message: "This booking reference has already been used." });
      }
      return;
    }

    const remaining = remainingSpots(bookings);
    if (booking.dates.some(date => remaining[date] === 0)) {
      res.status(409).json({
        message: "A selected date is full. Choose an available date to continue.",
        remaining
      });
      return;
    }

    await saveBooking(booking, true);
    res.status(201).json({ id: booking.id });
  });
  bookingQueue = registration.catch(() => {});
  await registration.catch(next);
});

winterCampRouter.put("/bookings/:id/payment", async (req, res, next) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const payment = paymentInput.safeParse(req.body?.payment);
  if (!id.success || !payment.success) {
    res.status(400).json({ message: "Choose a payment option." });
    return;
  }
  try {
    const booking = await readBooking(id.data);
    await saveBooking({ ...booking, payment: payment.data }, false);
    res.json({ payment: payment.data });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.status(404).json({ message: "Booking could not be found." });
      return;
    }
    next(error);
  }
});

export async function listCampBookings() {
  const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const bookings = await Promise.all(files.filter(file => file.endsWith(".json"))
    .map(file => readBooking(file.slice(0, -5))));
  return bookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
