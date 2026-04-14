import { config } from "./config.js";

export type ServiceType =
  | "personal-training"
  | "pitching"
  | "ladies-night"
  | "speed-agility-14-plus"
  | "speed-agility-8-13";
export type TrainerId = "jharel" | "nate-collins";

export type ServiceDefinition = {
  id: ServiceType;
  title: string;
  shortCopy: string;
  durationMinutes: number;
  slotStepMinutes?: number;
  bookingMode: "one-on-one" | "group";
  trainerIds: TrainerId[];
  capacity?: number;
  fixedWindows?: Record<number, Array<{ start: string; end: string }>>;
  availabilityMode?: "trainer-hours" | "service-hours";
  serviceHours?: Record<number, Array<{ start: string; end: string }>>;
};

export type Trainer = {
  id: TrainerId;
  name: string;
  bio: string;
  calendarId: string;
  services: ServiceType[];
  weeklyHours: Record<number, Array<{ start: string; end: string }>>;
};

export const serviceDefinitions: ServiceDefinition[] = [
  {
    id: "personal-training",
    title: "Personal Training",
    shortCopy: "One-on-one training with Jharel Cotton",
    durationMinutes: 60,
    slotStepMinutes: 60,
    bookingMode: "one-on-one",
    trainerIds: ["jharel"],
    availabilityMode: "service-hours",
    serviceHours: {
      1: [{ start: "09:00", end: "12:00" }],
      2: [{ start: "09:00", end: "12:00" }],
      3: [{ start: "09:00", end: "12:00" }],
      4: [{ start: "09:00", end: "12:00" }],
      5: [{ start: "09:00", end: "12:00" }]
    }
  },
  {
    id: "pitching",
    title: "Pitching / Baseball",
    shortCopy: "Mechanics, velocity, and development",
    durationMinutes: 60,
    slotStepMinutes: 60,
    bookingMode: "one-on-one",
    trainerIds: ["jharel"],
    availabilityMode: "service-hours",
    serviceHours: {
      1: [{ start: "15:00", end: "22:00" }],
      2: [{ start: "15:00", end: "22:00" }],
      3: [{ start: "15:00", end: "22:00" }],
      4: [{ start: "15:00", end: "22:00" }],
      5: [{ start: "15:00", end: "22:00" }]
    }
  },
  {
    id: "ladies-night",
    title: "Ladies Night",
    shortCopy: "Tuesdays and Thursdays, 6:00 PM to 7:00 PM EST, 6 spots",
    durationMinutes: 60,
    slotStepMinutes: 60,
    bookingMode: "group",
    trainerIds: ["jharel"],
    capacity: 6,
    fixedWindows: {
      2: [{ start: "18:00", end: "19:00" }],
      4: [{ start: "18:00", end: "19:00" }]
    }
  },
  {
    id: "speed-agility-14-plus",
    title: "Speed & Agility 14+",
    shortCopy: "Mondays and Wednesdays, 4:00 PM to 5:00 PM EST, 12 spots",
    durationMinutes: 60,
    slotStepMinutes: 60,
    bookingMode: "group",
    trainerIds: ["nate-collins"],
    capacity: 12,
    fixedWindows: {
      1: [{ start: "16:00", end: "17:00" }],
      3: [{ start: "16:00", end: "17:00" }],
      5: [{ start: "16:00", end: "17:00" }]
    }
  },
  {
    id: "speed-agility-8-13",
    title: "Speed & Agility 8-13",
    shortCopy: "Mondays and Wednesdays, 5:00 PM to 6:00 PM EST, 12 spots",
    durationMinutes: 60,
    slotStepMinutes: 60,
    bookingMode: "group",
    trainerIds: ["nate-collins"],
    capacity: 12,
    fixedWindows: {
      1: [{ start: "17:00", end: "18:00" }],
      3: [{ start: "17:00", end: "18:00" }]
    }
  }
];

export const trainers: Trainer[] = [
  {
    id: "jharel",
    name: "Jharel Cotton",
    bio: "Former MLB pitcher and Fitness instructor",
    calendarId: config.calendars.jharel,
    services: ["pitching", "personal-training", "ladies-night"],
    weeklyHours: {
      1: [{ start: "09:00", end: "17:00" }],
      2: [{ start: "09:00", end: "17:00" }],
      3: [{ start: "09:00", end: "17:00" }],
      4: [{ start: "09:00", end: "17:00" }],
      5: [{ start: "09:00", end: "15:00" }]
    }
  },
  {
    id: "nate-collins",
    name: "Nate Collins",
    bio: "Strength, conditioning, and speed development",
    calendarId: config.calendars.nateCollins,
    services: ["speed-agility-14-plus", "speed-agility-8-13"],
    weeklyHours: {
      1: [{ start: "12:00", end: "19:00" }],
      2: [{ start: "12:00", end: "19:00" }],
      3: [{ start: "12:00", end: "19:00" }],
      4: [{ start: "12:00", end: "19:00" }],
      6: [{ start: "09:00", end: "13:00" }]
    }
  }
];

export function getTrainer(trainerId: string): Trainer {
  const trainer = trainers.find((entry) => entry.id === trainerId);
  if (!trainer) {
    throw new Error(`Unknown trainer: ${trainerId}`);
  }
  return trainer;
}

export function getServiceDefinition(serviceId: ServiceType): ServiceDefinition {
  const service = serviceDefinitions.find((entry) => entry.id === serviceId);
  if (!service) {
    throw new Error(`Unknown service: ${serviceId}`);
  }
  return service;
}
