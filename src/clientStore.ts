import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ClientRecord = {
  id: string;
  firstName: string;
  lastName: string;
  customerName: string;
  phone?: string;
  normalizedPhone?: string;
  email?: string;
  normalizedEmail?: string;
  athleteName?: string;
  age?: string;
  notes?: string;
  waiverSigned: boolean;
  waiverSignedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type UpsertClientInput = {
  firstName?: string;
  lastName?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  athleteName?: string;
  age?: string;
  notes?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const clientStorePath = path.join(dataDir, "clients.json");

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readClients(): Promise<ClientRecord[]> {
  await ensureDataDir();

  try {
    const raw = await readFile(clientStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeClients(clients: ClientRecord[]) {
  await ensureDataDir();
  await writeFile(clientStorePath, JSON.stringify(clients, null, 2), "utf8");
}

function normalizeEmail(value?: string) {
  const next = value?.trim().toLowerCase();
  return next || "";
}

function normalizePhone(value?: string) {
  const next = (value ?? "").replace(/\D/g, "");
  return next || "";
}

function splitName(customerName?: string) {
  const value = (customerName ?? "").trim();
  if (!value) {
    return { firstName: "", lastName: "" };
  }

  const parts = value.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ")
  };
}

function matchClient(clients: ClientRecord[], input: { email?: string; phone?: string }) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  return (
    clients.find((client) => email && client.normalizedEmail === email) ??
    clients.find((client) => phone && client.normalizedPhone === phone) ??
    null
  );
}

export async function findClientRecord(input: { email?: string; phone?: string }) {
  const clients = await readClients();
  return matchClient(clients, input);
}

export async function upsertClientRecord(input: UpsertClientInput): Promise<ClientRecord | null> {
  if (!input.email?.trim() && !input.phone?.trim()) {
    return null;
  }

  const clients = await readClients();
  const existing = matchClient(clients, input);
  const now = new Date().toISOString();

  const derivedNames = splitName(input.customerName);
  const firstName = input.firstName?.trim() || derivedNames.firstName;
  const lastName = input.lastName?.trim() || derivedNames.lastName;
  const customerName =
    input.customerName?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);

  if (existing) {
    existing.firstName = firstName || existing.firstName;
    existing.lastName = lastName || existing.lastName;
    existing.customerName = customerName || existing.customerName;
    existing.email = input.email?.trim() || existing.email;
    existing.normalizedEmail = normalizedEmail || existing.normalizedEmail;
    existing.phone = input.phone?.trim() || existing.phone;
    existing.normalizedPhone = normalizedPhone || existing.normalizedPhone;
    existing.athleteName = input.athleteName?.trim() || existing.athleteName;
    existing.age = input.age?.trim() || existing.age;
    existing.notes = input.notes?.trim() || existing.notes;
    existing.updatedAt = now;
    await writeClients(clients);
    return existing;
  }

  const client: ClientRecord = {
    id: `client_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    firstName,
    lastName,
    customerName: customerName || "Not provided",
    email: input.email?.trim() || undefined,
    normalizedEmail: normalizedEmail || undefined,
    phone: input.phone?.trim() || undefined,
    normalizedPhone: normalizedPhone || undefined,
    athleteName: input.athleteName?.trim() || undefined,
    age: input.age?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    waiverSigned: false,
    createdAt: now,
    updatedAt: now
  };

  clients.push(client);
  await writeClients(clients);
  return client;
}

export async function setClientWaiverStatus(
  input: { clientId?: string; email?: string; phone?: string },
  waiverSigned: boolean
): Promise<ClientRecord | null> {
  const clients = await readClients();
  const client =
    clients.find((entry) => input.clientId && entry.id === input.clientId) ??
    matchClient(clients, input);

  if (!client) {
    return null;
  }

  client.waiverSigned = waiverSigned;
  client.waiverSignedAt = waiverSigned ? new Date().toISOString() : undefined;
  client.updatedAt = new Date().toISOString();
  await writeClients(clients);
  return client;
}
