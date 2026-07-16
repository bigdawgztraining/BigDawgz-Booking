import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServiceType } from "./trainers.js";

export type BlackoutService = ServiceType | "all";

export type BlackoutRecord = {
  id: string;
  startDate: string;
  endDate: string;
  services: BlackoutService[];
  note?: string;
  createdAt: string;
  updatedAt: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const blackoutStorePath = path.join(dataDir, "blackouts.json");

const defaultBlackouts: BlackoutRecord[] = [
  {
    id: "seed-july-3-5-2026",
    startDate: "2026-07-03",
    endDate: "2026-07-05",
    services: ["personal-training", "pitching"],
    note: "Holiday closure",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z"
  }
];

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function writeBlackouts(blackouts: BlackoutRecord[]) {
  await ensureDataDir();
  await writeFile(blackoutStorePath, JSON.stringify(blackouts, null, 2), "utf8");
}

async function readBlackouts(): Promise<BlackoutRecord[]> {
  await ensureDataDir();

  try {
    const raw = await readFile(blackoutStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await writeBlackouts(defaultBlackouts);
    return [...defaultBlackouts];
  }
}

function sortBlackouts(blackouts: BlackoutRecord[]) {
  return [...blackouts].sort((a, b) => {
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate);
    }

    return a.endDate.localeCompare(b.endDate);
  });
}

export async function listBlackouts() {
  return sortBlackouts(await readBlackouts());
}

export async function createBlackout(input: {
  startDate: string;
  endDate: string;
  services: BlackoutService[];
  note?: string;
}) {
  const blackouts = await readBlackouts();
  const now = new Date().toISOString();

  const record: BlackoutRecord = {
    id: `blackout_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    startDate: input.startDate,
    endDate: input.endDate,
    services: input.services,
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now
  };

  blackouts.push(record);
  await writeBlackouts(sortBlackouts(blackouts));
  return record;
}

export async function deleteBlackout(blackoutId: string) {
  const blackouts = await readBlackouts();
  const next = blackouts.filter((entry) => entry.id !== blackoutId);
  const removed = next.length !== blackouts.length;

  if (removed) {
    await writeBlackouts(sortBlackouts(next));
  }

  return removed;
}

export async function isServiceBlackoutDate(service: ServiceType, date: string) {
  const blackouts = await readBlackouts();

  return blackouts.some((entry) => {
    const matchesService =
      entry.services.includes("all") || entry.services.includes(service);

    return matchesService && entry.startDate <= date && entry.endDate >= date;
  });
}
