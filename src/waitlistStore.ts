import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServiceType, TrainerId } from "./trainers.js";

export type WaitlistEntry = {
  id: string;
  service: ServiceType;
  trainerId: TrainerId;
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
  createdAt: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const waitlistStorePath = path.join(dataDir, "waitlist.json");

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readWaitlist(): Promise<WaitlistEntry[]> {
  await ensureDataDir();

  try {
    const raw = await readFile(waitlistStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeWaitlist(entries: WaitlistEntry[]) {
  await ensureDataDir();
  await writeFile(waitlistStorePath, JSON.stringify(entries, null, 2), "utf8");
}

export async function createWaitlistEntry(input: Omit<WaitlistEntry, "id" | "createdAt">) {
  const entries = await readWaitlist();
  const entry: WaitlistEntry = {
    ...input,
    id: `waitlist_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString()
  };

  entries.push(entry);
  await writeWaitlist(entries);
  return entry;
}
