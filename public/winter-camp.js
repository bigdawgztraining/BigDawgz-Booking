const form = document.querySelector("#camp-form");
const group = form.elements.group;
const submit = form.querySelector('button[type="submit"]');
const datesField = document.querySelector("#camp-dates");
const datesList = document.querySelector("#camp-date-options");
const status = document.querySelector("#camp-status");
const confirmation = document.querySelector("#camp-confirmation");
const paymentOptions = document.querySelector("#camp-payment");
const venmoLink = document.querySelector("#camp-venmo");
const paymentResult = document.querySelector("#camp-payment-result");
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long", month: "long", day: "numeric", timeZone: "UTC"
});
let schedule;
let remaining;
let booking;
let lastSubmission;

const back = document.querySelector("#camp-back");
const details = document.querySelector("#camp-details");
const stepTitle = document.querySelector("#camp-step-title");
const stepTitles = ["Choose your age group", "Choose one or both dates", "Enter booking details"];
const price = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0
});
let step = 0;

function selectedDates() {
  return Array.from(datesList.querySelectorAll("input:checked"), input => input.value);
}

function totalLabel(count) {
  return price.format(115 * count) + " total · " + count +
    (count === 1 ? " session" : " sessions") + " at $115 each";
}

function updateTotal() {
  const count = selectedDates().length;
  document.querySelector("#camp-total").textContent = count ? totalLabel(count) : "$115 per session";
}

function showStep(index) {
  step = index;
  document.querySelector("#camp-step-number").textContent = index + 1;
  stepTitle.textContent = stepTitles[index];
  document.querySelector("#camp-group").hidden = index !== 0;
  datesField.hidden = index !== 1;
  details.hidden = index !== 2;
  for (const input of details.querySelectorAll("input")) input.disabled = index !== 2;
  back.disabled = index === 0;
  submit.textContent = index === 2 ? "Book now" : "Continue";
  status.textContent = "";
  if (schedule) stepTitle.focus();
}

showStep(0);
back.addEventListener("click", () => showStep(step - 1));
datesList.addEventListener("change", updateTotal);

function dateLabel(date) {
  return dateFormat.format(new Date(date));
}

async function request(path, method = "GET", body) {
  const response = await fetch("/api/winter-camp" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.message || "Please try again."), { remaining: result.remaining });
  }
  return result;
}

Promise.all([request("/schedule"), request("/availability")]).then(([dates, spots]) => {
  schedule = dates;
  remaining = spots;
  for (const name of Object.keys(schedule)) group.add(new Option(name, name));
  group.disabled = false;
  submit.disabled = false;
}).catch(() => {
  status.textContent = "Couldn’t load camp dates. Reload the page to try again.";
});

function renderDates(selection = []) {
  const dates = schedule[group.value] || [];
  datesList.replaceChildren(...dates.map(date => {
    const label = document.createElement("label");
    label.className = "choice camp-date";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "dates";
    input.value = date;
    const spots = remaining[date];
    input.disabled = spots === 0;
    input.checked = !input.disabled && selection.includes(date);
    const availability = spots === 0 ? "Full" : spots + (spots === 1 ? " spot left" : " spots left");
    label.append(input, dateLabel(date) + " · " + availability);
    return label;
  }));
  updateTotal();
}

group.addEventListener("change", () => {
  renderDates();
  status.textContent = "";
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (step === 0) {
    if (!datesList.childElementCount) renderDates();
    showStep(1);
    return;
  }
  const dates = selectedDates();
  if (!dates.length) {
    status.textContent = "Select at least one camp date.";
    datesList.querySelector("input")?.focus();
    return;
  }
  if (step === 1) {
    showStep(2);
    return;
  }
  const data = new FormData(form);
  const input = {
    group: data.get("group"),
    dates,
    athlete: data.get("athlete").trim(),
    guardian: data.get("guardian").trim(),
    phone: data.get("phone").trim(),
    email: data.get("email").trim()
  };
  const signature = JSON.stringify(input);
  if (lastSubmission?.signature !== signature) {
    lastSubmission = { signature, id: crypto.randomUUID() };
  }

  const controls = [...form.elements].filter(control => !control.disabled);
  controls.forEach(control => { control.disabled = true; });
  status.textContent = "Saving your booking…";
  try {
    booking = await request("/bookings", "POST", { ...input, id: lastSubmission.id });
    document.querySelector("#camp-booked-dates").textContent =
      input.group + " · " + dates.map(dateLabel).join(" and ");
    document.querySelector("#camp-booked-total").textContent = totalLabel(dates.length);
    status.textContent = "";
    form.hidden = true;
    confirmation.hidden = false;
    document.querySelector("#camp-confirmation-title").focus();
  } catch (error) {
    if (error.remaining) {
      remaining = error.remaining;
      renderDates(dates);
      showStep(1);
    }
    status.textContent = error.message;
  } finally {
    controls.forEach(control => {
      if (control.isConnected && (!details.contains(control) || step === 2)) {
        control.disabled = false;
      }
    });
  }
});

paymentOptions.addEventListener("click", async event => {
  const choice = event.target.closest("button")?.value;
  if (!booking || !choice) return;
  const buttons = [...paymentOptions.querySelectorAll("button")];
  buttons.forEach(button => { button.disabled = true; });
  paymentResult.textContent = "Saving your payment choice…";
  venmoLink.hidden = true;
  try {
    await request("/bookings/" + booking.id + "/payment", "PUT", { payment: choice });
    if (choice === "venmo") {
      paymentResult.textContent = "Complete your payment in Venmo.";
      venmoLink.hidden = false;
      window.location.assign(venmoLink.href);
    } else {
      paymentResult.textContent = "Cash selected. Bring $115 per booked session on camp day.";
    }
  } catch (error) {
    paymentResult.textContent = error.message;
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
});
