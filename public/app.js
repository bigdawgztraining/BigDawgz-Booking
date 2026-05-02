const formState = {
  service: "",
  trainerId: "",
  plan: "",
  durationMinutes: 60,
  date: "",
  slot: null,
  selectedSlots: [],
  customer: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    athleteName: "",
    age: "",
    notes: ""
  }
};

function initialCustomerState() {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    athleteName: "",
    age: "",
    notes: ""
  };
}

const businessInfo = {
  name: "BigDawgz Performance",
  address: "30990 Wixom Rd, Wixom, MI 48393",
  website: "https://www.bigdawgztraining.com",
  waiverUrl: ""
};

const services = [
  {
    id: "personal-training",
    title: "Personal Training",
    copy: "One-on-one training built around your goals",
    durationMinutes: 60
  },
  {
    id: "pitching",
    title: "Pitching / Baseball",
    copy: "Mechanics, velocity, and development",
    durationMinutes: 60
  },
  {
    id: "ladies-night",
    title: "Ladies Night",
    copy: "Tuesdays and Thursdays, 6 PM to 7 PM EST, 6 spots",
    durationMinutes: 60
  },
  {
    id: "speed-agility-14-plus",
    title: "Speed & Agility 14+",
    copy: "Mondays and Wednesdays, 4 PM to 5 PM EST, 12 spots",
    durationMinutes: 60
  },
  {
    id: "speed-agility-8-13",
    title: "Speed & Agility 8-13",
    copy: "Mondays and Wednesdays, 5 PM to 6 PM EST, 12 spots",
    durationMinutes: 60
  }
];

const planMap = {
  "personal-training": [
    {
      id: "1x/week",
      title: "1x per week",
      copy: "Choose 1 session now",
      selectionMode: "manual-fixed",
      sessionCount: 1
    },
    {
      id: "2x/week",
      title: "2x per week",
      copy: "Choose 2 sessions now",
      selectionMode: "manual-fixed",
      sessionCount: 2
    },
    {
      id: "3x/week",
      title: "3x per week",
      copy: "Choose 3 sessions now",
      selectionMode: "manual-fixed",
      sessionCount: 3
    }
  ],
  pitching: [
    {
      id: "single-lesson",
      title: "Single Lesson",
      copy: "Book one pitching lesson",
      selectionMode: "manual-fixed",
      sessionCount: 1
    },
    {
      id: "multiple-lessons",
      title: "Schedule Multiple Lessons",
      copy: "Choose 2 or more lessons now",
      selectionMode: "manual-flex",
      minSessions: 2
    }
  ],
  "ladies-night": [
    {
      id: "drop-in",
      title: "Drop-In",
      copy: "Reserve one class spot",
      selectionMode: "manual-fixed",
      sessionCount: 1
    },
    {
      id: "monthly",
      title: "Monthly Sessions",
      copy: "Reserve the next 4 weeks of classes",
      selectionMode: "auto-monthly"
    }
  ],
  "speed-agility-14-plus": [
    {
      id: "drop-in",
      title: "Drop-In",
      copy: "Reserve one class spot",
      selectionMode: "manual-fixed",
      sessionCount: 1
    },
    {
      id: "monthly",
      title: "Monthly Sessions",
      copy: "Reserve the next 4 weeks of classes",
      selectionMode: "auto-monthly"
    }
  ],
  "speed-agility-8-13": [
    {
      id: "drop-in",
      title: "Drop-In",
      copy: "Reserve one class spot",
      selectionMode: "manual-fixed",
      sessionCount: 1
    },
    {
      id: "monthly",
      title: "Monthly Sessions",
      copy: "Reserve the next 4 weeks of classes",
      selectionMode: "auto-monthly"
    }
  ]
};

let trainers = [];
let step = 0;

const stepTitle = document.getElementById("step-title");
const stepNumber = document.getElementById("step-number");
const stepContent = document.getElementById("step-content");
const summary = document.getElementById("summary");
const summaryCard = document.getElementById("summary-card");
const nextButton = document.getElementById("next-button");
const backButton = document.getElementById("back-button");

const steps = [
  {
    title: "Choose your service",
    render: renderServiceStep,
    valid: () => Boolean(formState.service)
  },
  {
    title: "Choose your trainer",
    render: renderTrainerStep,
    valid: () => Boolean(formState.trainerId)
  },
  {
    title: "Choose your plan",
    render: renderPlanStep,
    valid: () => Boolean(formState.plan)
  },
  {
    title: "Pick your slot",
    render: renderSlotStep,
    valid: slotStepValid
  },
  {
    title: "Tell us about you",
    render: renderInfoStep,
    valid: infoStepValid
  }
];

backButton.addEventListener("click", () => {
  if (step === 0) {
    return;
  }
  step -= 1;
  render();
});

nextButton.addEventListener("click", async () => {
  if (step === steps.length - 1) {
    await submitBooking();
    return;
  }

  if (!steps[step].valid()) {
    return;
  }

  step += 1;
  render();
});

async function boot() {
  await Promise.all([loadHealth(), loadTrainers()]);
  render();
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (data.ok && data.waiverUrl) {
      businessInfo.waiverUrl = data.waiverUrl;
    }
  } catch {
    businessInfo.waiverUrl = "";
  }
}

async function loadTrainers() {
  const response = await fetch("/api/trainers");
  const data = await response.json();
  trainers = data.trainers ?? [];
}

function render() {
  const current = steps[step];
  stepNumber.textContent = String(step + 1);
  stepTitle.textContent = current.title;
  current.render();
  backButton.disabled = step === 0;
  nextButton.textContent = step === steps.length - 1 ? "Confirm Booking" : "Continue";
  nextButton.disabled = !current.valid();
  renderSummary();
}

function renderServiceStep() {
  stepContent.innerHTML = choiceGrid(
    services.map((service) =>
      choiceMarkup({
        title: service.title,
        copy: service.copy,
        selected: formState.service === service.id,
        onClick: `selectService('${service.id}', ${service.durationMinutes})`
      })
    ),
    2
  );
}

function renderTrainerStep() {
  const filtered = trainers.filter((trainer) => trainer.services.includes(formState.service));
  stepContent.innerHTML = choiceGrid(
    filtered.map((trainer) =>
      choiceMarkup({
        title: trainer.name,
        copy: trainer.bio,
        selected: formState.trainerId === trainer.id,
        onClick: `selectTrainer('${trainer.id}')`
      })
    ),
    2
  );
}

function renderPlanStep() {
  const plans = planMap[formState.service] ?? [];
  stepContent.innerHTML = choiceGrid(
    plans.map((plan) =>
      choiceMarkup({
        title: plan.title,
        copy: plan.copy,
        selected: formState.plan === plan.id,
        onClick: `selectPlan('${plan.id}')`
      })
    ),
    3
  );
}

function renderSlotStep() {
  const defaultDate = formState.date || todayLocal();
  const plan = currentPlanDefinition();
  const helperCopy = slotStepHelperText(plan);

  stepContent.innerHTML = `
    <div class="field full">
      <label for="booking-date">Date</label>
      <input id="booking-date" type="date" value="${defaultDate}" min="${todayLocal()}" />
    </div>
    <div class="message" id="slot-message">${helperCopy}</div>
    <div class="slot-grid" id="slot-grid"></div>
    <div class="selected-sessions card" id="selected-sessions"></div>
  `;

  const dateInput = document.getElementById("booking-date");
  dateInput.addEventListener("change", async (event) => {
    formState.date = event.target.value;
    if (plan?.selectionMode === "auto-monthly") {
      clearSelectedSlots();
    }
    renderSummary();
    await loadSlots();
  });

  formState.date = defaultDate;
  loadSlots();
  renderSelectedSessions();
}

function renderInfoStep() {
  const showAthleteName =
    formState.service === "pitching" ||
    formState.service === "speed-agility-14-plus" ||
    formState.service === "speed-agility-8-13";

  stepContent.innerHTML = `
    <div class="input-grid">
      <div class="field">
        <label for="firstName">First Name</label>
        <input id="firstName" required value="${escapeHtml(formState.customer.firstName)}" />
      </div>
      <div class="field">
        <label for="lastName">Last Name</label>
        <input id="lastName" required value="${escapeHtml(formState.customer.lastName)}" />
      </div>
      <div class="field">
        <label for="phone">Phone</label>
        <input id="phone" required value="${escapeHtml(formState.customer.phone)}" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" required type="email" value="${escapeHtml(formState.customer.email)}" />
      </div>
      ${
        showAthleteName
          ? `
      <div class="field">
        <label for="athleteName">Athlete Name</label>
        <input id="athleteName" value="${escapeHtml(formState.customer.athleteName)}" />
      </div>
      `
          : ""
      }
      <div class="field">
        <label for="age">Age</label>
        <input id="age" value="${escapeHtml(formState.customer.age)}" />
      </div>
      <div class="field full">
        <label for="notes">Tell us your goals</label>
        <textarea id="notes" placeholder="Tell us what you want to work on, any background we should know, or anything specific for this session.">${escapeHtml(formState.customer.notes)}</textarea>
      </div>
    </div>
  `;

  ["firstName", "lastName", "phone", "email", "age", "notes"].forEach((id) => {
    document.getElementById(id).addEventListener("input", syncCustomerState);
  });

  if (showAthleteName) {
    document.getElementById("athleteName").addEventListener("input", syncCustomerState);
  }
}

async function loadSlots() {
  const slotGrid = document.getElementById("slot-grid");
  const slotMessage = document.getElementById("slot-message");
  const dateInput = document.getElementById("booking-date");
  const plan = currentPlanDefinition();

  slotGrid.innerHTML = "";
  slotMessage.textContent = plan?.selectionMode === "auto-monthly"
    ? "Loading available starting dates..."
    : "Loading available times...";
  slotMessage.className = "message";

  try {
    const initialResult = await fetchSlotsForDate(formState.date);
    let activeDate = formState.date;
    let slots = initialResult.slots;

    if (!initialResult.ok) {
      throw new Error(initialResult.message || "Could not load slots.");
    }

    if (!slots.length) {
      const nextAvailable = await findNextAvailableDate(formState.date, 21);

      if (!nextAvailable) {
        slotMessage.textContent = "No open slots are available in the next few weeks. Bookings require at least 24 hours notice.";
        return;
      }

      activeDate = nextAvailable.date;
      slots = nextAvailable.slots;
      formState.date = activeDate;
      dateInput.value = activeDate;
      slotMessage.textContent = `No slots on the selected date. Bookings require at least 24 hours notice, so we are showing the next available date: ${formatFriendlyDate(activeDate)}.`;
    } else {
      slotMessage.textContent = slotStepHelperText(plan);
    }

    if (!slots.length) {
      slotMessage.textContent = "No open slots for this date. Try another day.";
      return;
    }

    slotGrid.innerHTML = slots
      .map(
        (slot) => `
          <button
            type="button"
            class="choice ${isSlotSelected(slot.start) ? "selected" : ""}"
            data-slot-start="${slot.start}"
            onclick="selectSlot('${slot.start}', '${slot.end}', '${slot.label}')"
          >
            <span class="choice-title">${slot.label}</span>
            <span class="choice-copy">${
              slot.spotsLeft
                ? `${slot.spotsLeft} spots left`
                : `${formState.durationMinutes} minute session`
            }</span>
          </button>
        `
      )
      .join("");
  } catch {
    slotMessage.textContent = "Could not load slots. Check your server configuration.";
    slotMessage.className = "message error";
  }
}

async function fetchSlotsForDate(date) {
  const params = new URLSearchParams({
    trainer: formState.trainerId,
    date,
    service: formState.service,
    durationMinutes: String(formState.durationMinutes)
  });

  const response = await fetch(`/api/availability/slots?${params.toString()}`);
  return response.json();
}

async function findNextAvailableDate(startDate, lookaheadDays) {
  for (let offset = 1; offset <= lookaheadDays; offset += 1) {
    const candidate = addDaysToDate(startDate, offset);
    const result = await fetchSlotsForDate(candidate);

    if (result.ok && result.slots?.length) {
      return {
        date: candidate,
        slots: result.slots
      };
    }
  }

  return null;
}

function addDaysToDate(dateString, days) {
  const value = new Date(`${dateString}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatFriendlyDate(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function currentPlanDefinition() {
  return (planMap[formState.service] ?? []).find((plan) => plan.id === formState.plan) ?? null;
}

function clearSelectedSlots() {
  formState.selectedSlots = [];
  formState.slot = null;
}

function syncPrimarySlot() {
  formState.slot = formState.selectedSlots[0] ?? null;
}

function isSlotSelected(start) {
  return formState.selectedSlots.some((slot) => slot.start === start);
}

function selectedSessionsSummary() {
  if (!formState.selectedSlots.length) {
    return "Not selected";
  }

  if (formState.selectedSlots.length === 1) {
    const slot = formState.selectedSlots[0];
    return `${formatFriendlyDate(slot.start.slice(0, 10))} at ${formatSlotLabel(slot.start)}`;
  }

  return `${formState.selectedSlots.length} sessions selected`;
}

function slotStepHelperText(plan) {
  if (!plan) {
    return "Select a date to load live slots.";
  }

  if (plan.selectionMode === "manual-fixed") {
    return `Choose ${plan.sessionCount} session${plan.sessionCount === 1 ? "" : "s"}.`;
  }

  if (plan.selectionMode === "manual-flex") {
    return `Choose ${plan.minSessions ?? 2} or more sessions.`;
  }

  if (plan.selectionMode === "auto-monthly") {
    return "Choose your first class date and we will reserve the next 4 weeks of classes.";
  }

  return "Select a date to load live slots.";
}

function renderSelectedSessions() {
  const selectedSessionsNode = document.getElementById("selected-sessions");
  const plan = currentPlanDefinition();

  if (!selectedSessionsNode || !plan) {
    return;
  }

  const heading =
    plan.selectionMode === "auto-monthly" ? "Sessions included" : "Selected sessions";
  const helper =
    plan.selectionMode === "manual-fixed"
      ? `${formState.selectedSlots.length} of ${plan.sessionCount} selected`
      : plan.selectionMode === "manual-flex"
        ? `${formState.selectedSlots.length} selected`
        : `${formState.selectedSlots.length} class date${formState.selectedSlots.length === 1 ? "" : "s"} reserved`;

  selectedSessionsNode.innerHTML = `
    <div class="selected-sessions-header">
      <div>
        <p class="step-label">${heading}</p>
        <p class="selected-sessions-helper">${helper}</p>
      </div>
      ${
        formState.selectedSlots.length
          ? `<button type="button" class="button secondary selected-sessions-clear" onclick="clearAllSelectedSlots()">Clear</button>`
          : ""
      }
    </div>
    ${
      formState.selectedSlots.length
        ? `<div class="selected-session-list">
            ${formState.selectedSlots
              .map(
                (slot) => `
                  <div class="selected-session-item">
                    <div>
                      <p class="selected-session-date">${formatFriendlyDate(slot.start.slice(0, 10))}</p>
                      <p class="selected-session-time">${formatSlotLabel(slot.start)}</p>
                    </div>
                    <button type="button" class="selected-session-remove" onclick="removeSelectedSlot('${slot.start}')">Remove</button>
                  </div>
                `
              )
              .join("")}
          </div>`
        : `<p class="selected-sessions-empty">No sessions selected yet.</p>`
    }
  `;
}

function toggleManualSlot(slot, plan) {
  if (isSlotSelected(slot.start)) {
    formState.selectedSlots = formState.selectedSlots.filter((entry) => entry.start !== slot.start);
    return;
  }

  if (
    plan.selectionMode === "manual-fixed" &&
    formState.selectedSlots.length >= plan.sessionCount
  ) {
    const slotMessage = document.getElementById("slot-message");
    if (slotMessage) {
      slotMessage.textContent = `You already selected ${plan.sessionCount} session${plan.sessionCount === 1 ? "" : "s"}. Remove one to choose another.`;
      slotMessage.className = "message";
    }
    return;
  }

  formState.selectedSlots = [...formState.selectedSlots, slot].sort((a, b) =>
    a.start.localeCompare(b.start)
  );
}

async function autoSelectMonthlySessions(anchorSlot) {
  const slotMessage = document.getElementById("slot-message");
  if (slotMessage) {
    slotMessage.textContent = "Building your next 4 weeks of sessions...";
    slotMessage.className = "message";
  }

  const anchorDate = anchorSlot.start.slice(0, 10);
  const nextSlots = [];

  for (let offset = 0; offset < 28; offset += 1) {
    const candidateDate = addDaysToDate(anchorDate, offset);
    const result = await fetchSlotsForDate(candidateDate);

    if (!result.ok || !result.slots?.length) {
      continue;
    }

    const matching = result.slots.find((slot) => slot.label === anchorSlot.label);
    if (matching) {
      nextSlots.push(matching);
    }
  }

  formState.selectedSlots = nextSlots;
  syncPrimarySlot();
  renderSelectedSessions();
  renderSummary();
  nextButton.disabled = !slotStepValid();

  if (slotMessage) {
    slotMessage.textContent = nextSlots.length
      ? `Reserved ${nextSlots.length} class date${nextSlots.length === 1 ? "" : "s"} over the next 4 weeks.`
      : "No monthly class dates were available from that starting point.";
    slotMessage.className = nextSlots.length ? "message success" : "message error";
  }

  document.querySelectorAll("#slot-grid .choice").forEach((node) => {
    node.classList.toggle("selected", isSlotSelected(node.dataset.slotStart));
  });
}

function formatSlotLabel(start) {
  return new Date(start).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTimeRangeFriendly(start, end) {
  return `${formatSlotLabel(start)} - ${new Date(end).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

function renderSummary() {
  const hasSelection = Boolean(
    formState.service ||
      formState.trainerId ||
      formState.plan ||
      formState.date ||
      formState.slot ||
      formState.customer.firstName ||
      formState.customer.lastName
  );

  summaryCard.classList.toggle("hidden", !hasSelection);
  const trainer = trainers.find((entry) => entry.id === formState.trainerId);
  const service = services.find((entry) => entry.id === formState.service);
  const plan = currentPlanDefinition();
  summary.innerHTML = [
    summaryRow("Service", service?.title ?? "Not selected"),
    summaryRow("Trainer", trainer?.name ?? "Not selected"),
    summaryRow("Plan", plan?.title ?? formState.plan ?? "Not selected"),
    summaryRow("Dates", selectedSessionsSummary()),
    summaryRow(
      "Client",
      [formState.customer.firstName, formState.customer.lastName].filter(Boolean).join(" ") ||
        "Not entered"
    )
  ].join("");
}

function summaryRow(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function buildInviteLink(slot) {
  const service = services.find((entry) => entry.id === formState.service);
  const trainer = trainers.find((entry) => entry.id === formState.trainerId);
  const title = `${service?.title || "BigDawgz Booking"} - ${formState.customer.firstName} ${formState.customer.lastName}`.trim();
  const description = [
    `Trainer: ${trainer?.name || ""}`,
    `Service: ${service?.title || ""}`,
    `Client: ${formState.customer.firstName} ${formState.customer.lastName}`.trim(),
    `Phone: ${formState.customer.phone}`,
    `Email: ${formState.customer.email}`,
    formState.customer.athleteName ? `Athlete: ${formState.customer.athleteName}` : "",
    formState.customer.age ? `Age: ${formState.customer.age}` : "",
    formState.customer.notes ? `Notes: ${formState.customer.notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    title,
    description,
    location: businessInfo.address,
    start: slot.start,
    end: slot.end
  });

  return `/api/calendar/invite.ics?${params.toString()}`;
}

function buildGoogleCalendarLink(slot) {
  const service = services.find((entry) => entry.id === formState.service);
  const trainer = trainers.find((entry) => entry.id === formState.trainerId);
  const title = `${service?.title || "BigDawgz Booking"} - ${formState.customer.firstName} ${formState.customer.lastName}`.trim();
  const details = [
    `Trainer: ${trainer?.name || ""}`,
    `Service: ${service?.title || ""}`,
    `Client: ${formState.customer.firstName} ${formState.customer.lastName}`.trim(),
    formState.customer.phone ? `Phone: ${formState.customer.phone}` : "",
    formState.customer.email ? `Email: ${formState.customer.email}` : "",
    formState.customer.athleteName ? `Athlete: ${formState.customer.athleteName}` : "",
    formState.customer.age ? `Age: ${formState.customer.age}` : "",
    formState.customer.notes ? `Notes: ${formState.customer.notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const start = toGoogleCalendarDate(slot.start);
  const end = toGoogleCalendarDate(slot.end);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details,
    location: businessInfo.address,
    dates: `${start}/${end}`,
    ctz: "America/Detroit"
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function toGoogleCalendarDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function choiceGrid(items, columns) {
  return `<div class="choice-grid columns-${columns}">${items.join("")}</div>`;
}

function choiceMarkup({ title, copy, selected, onClick }) {
  return `
    <button type="button" class="choice ${selected ? "selected" : ""}" onclick="${onClick}">
      <span class="choice-title">${title}</span>
      <span class="choice-copy">${copy}</span>
    </button>
  `;
}

function infoStepValid() {
  const { firstName, lastName, phone, email } = formState.customer;
  return Boolean(firstName && lastName && phone && email);
}

function slotStepValid() {
  const plan = currentPlanDefinition();
  if (!plan) {
    return false;
  }

  if (plan.selectionMode === "manual-fixed") {
    return formState.selectedSlots.length === plan.sessionCount;
  }

  if (plan.selectionMode === "manual-flex") {
    return formState.selectedSlots.length >= (plan.minSessions ?? 2);
  }

  if (plan.selectionMode === "auto-monthly") {
    return formState.selectedSlots.length > 0;
  }

  return Boolean(formState.slot);
}

function syncCustomerState() {
  formState.customer.firstName = document.getElementById("firstName").value.trim();
  formState.customer.lastName = document.getElementById("lastName").value.trim();
  formState.customer.phone = document.getElementById("phone").value.trim();
  formState.customer.email = document.getElementById("email").value.trim();
  formState.customer.athleteName = document.getElementById("athleteName")?.value.trim() ?? "";
  formState.customer.age = document.getElementById("age").value.trim();
  formState.customer.notes = document.getElementById("notes").value.trim();
  nextButton.disabled = !steps[step].valid();
  renderSummary();
}

async function submitBooking() {
  if (!infoStepValid() || !slotStepValid()) {
    return;
  }

  nextButton.disabled = true;
  nextButton.textContent = "Booking...";

  try {
    const response = await fetch(
      formState.selectedSlots.length > 1 ? "/api/bookings/batch" : "/api/bookings",
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        service: formState.service,
        trainerId: formState.trainerId,
        start: formState.selectedSlots[0].start,
        starts: formState.selectedSlots.map((slot) => slot.start),
        durationMinutes: formState.durationMinutes,
        plan: formState.plan,
        customer: formState.customer
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Booking failed");
    }

    const confirmedSlots = (data.bookings ?? formState.selectedSlots).map((booking, index) => ({
      start: booking.start ?? formState.selectedSlots[index]?.start,
      end: booking.end ?? formState.selectedSlots[index]?.end,
      label:
        booking.start && booking.end
          ? formatTimeRangeFriendly(booking.start, booking.end)
          : formState.selectedSlots[index]?.label
    }));

    stepContent.innerHTML = `
      <div class="message success">
        Booking confirmed. ${confirmedSlots.length === 1 ? "The event was created on the trainer calendar." : `${confirmedSlots.length} events were created on the trainer calendar.`}
      </div>
      <div class="card" style="margin-top: 18px;">
        <h3>Confirmation</h3>
        <p>${confirmedSlots.length === 1 ? "Your session is booked." : "Your sessions are booked."}</p>
        <div class="confirmation-list">
          ${confirmedSlots
            .map(
              (slot, index) => `
                <div class="confirmation-session">
                  <p><strong>${formatFriendlyDate(slot.start.slice(0, 10))}</strong> at <strong>${formatSlotLabel(slot.start)}</strong></p>
                  <p><a href="${buildGoogleCalendarLink(slot)}" target="_blank" rel="noreferrer">Add this session to Google Calendar</a></p>
                  <p><a href="${buildInviteLink(slot)}" rel="noreferrer">Download .ics invite</a></p>
                </div>
              `
            )
            .join("")}
        </div>
        <p><strong>Location:</strong> ${businessInfo.address}</p>
        ${
          businessInfo.waiverUrl
            ? `<p><strong>Waiver:</strong> First time training with us? <a href="${businessInfo.waiverUrl}" target="_blank" rel="noreferrer">Complete your waiver before your session</a>.</p>`
            : ""
        }
        <div class="actions" style="margin-top: 18px; padding-top: 16px;">
          <button type="button" class="button primary" onclick="bookAnotherSession()">Book Another Session</button>
        </div>
      </div>
    `;
    nextButton.style.display = "none";
    backButton.style.display = "none";
  } catch (error) {
    stepContent.insertAdjacentHTML(
      "beforeend",
      `<div class="message error" style="margin-top: 18px;">${error.message}</div>`
    );
    nextButton.disabled = false;
    nextButton.textContent = "Confirm Booking";
  }
}

function todayLocal() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

window.selectService = (serviceId, durationMinutes) => {
  formState.service = serviceId;
  formState.durationMinutes = durationMinutes;
  formState.trainerId = "";
  formState.plan = "";
  clearSelectedSlots();
  render();
};

window.selectTrainer = (trainerId) => {
  formState.trainerId = trainerId;
  clearSelectedSlots();
  render();
};

window.selectPlan = (planId) => {
  formState.plan = planId;
  clearSelectedSlots();
  render();
};

window.selectSlot = (start, end, label) => {
  const slot = { start, end, label };
  const plan = currentPlanDefinition();

  if (!plan) {
    return;
  }

  if (plan.selectionMode === "auto-monthly") {
    autoSelectMonthlySessions(slot);
    return;
  }

  toggleManualSlot(slot, plan);
  syncPrimarySlot();
  renderSelectedSessions();
  document.querySelectorAll("#slot-grid .choice").forEach((node) => {
    node.classList.toggle("selected", isSlotSelected(node.dataset.slotStart));
  });
  renderSummary();
  nextButton.disabled = !slotStepValid();
};

window.bookAnotherSession = () => {
  formState.service = "";
  formState.trainerId = "";
  formState.plan = "";
  formState.durationMinutes = 60;
  formState.date = "";
  clearSelectedSlots();
  formState.customer = initialCustomerState();
  step = 0;
  nextButton.style.display = "";
  backButton.style.display = "";
  render();
};

window.removeSelectedSlot = (start) => {
  formState.selectedSlots = formState.selectedSlots.filter((slot) => slot.start !== start);
  syncPrimarySlot();
  renderSelectedSessions();
  document.querySelectorAll("#slot-grid .choice").forEach((node) => {
    node.classList.toggle("selected", isSlotSelected(node.dataset.slotStart));
  });
  renderSummary();
  nextButton.disabled = !steps[step].valid();
};

window.clearAllSelectedSlots = () => {
  clearSelectedSlots();
  renderSelectedSessions();
  document.querySelectorAll("#slot-grid .choice").forEach((node) => {
    node.classList.remove("selected");
  });
  renderSummary();
  nextButton.disabled = !steps[step].valid();
};

boot();
