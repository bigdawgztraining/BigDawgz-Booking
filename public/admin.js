const adminAuthShell = document.getElementById("admin-auth-shell");
const adminShell = document.getElementById("admin-shell");
const adminPasswordInput = document.getElementById("admin-password");
const adminLoginButton = document.getElementById("admin-login-button");
const adminLoginStatusNode = document.getElementById("admin-login-status");
const adminLogoutButton = document.getElementById("admin-logout-button");
const bookingsNode = document.getElementById("admin-bookings");
const statusNode = document.getElementById("admin-status");
const weekLabelNode = document.getElementById("admin-week-label");
const refreshButton = document.getElementById("refresh-admin");
const previousWeekButton = document.getElementById("previous-week");
const currentWeekButton = document.getElementById("current-week");
const nextWeekButton = document.getElementById("next-week");
const previousWeekBottomButton = document.getElementById("previous-week-bottom");
const nextWeekBottomButton = document.getElementById("next-week-bottom");
const backToTopButton = document.getElementById("back-to-top");
const searchInput = document.getElementById("admin-search-input");
const searchButton = document.getElementById("admin-search-button");
const modalNode = document.getElementById("reschedule-modal");
const closeModalButton = document.getElementById("close-modal");
const saveRescheduleButton = document.getElementById("save-reschedule");
const modalStatusNode = document.getElementById("modal-status");
const rescheduleDateInput = document.getElementById("reschedule-date");
const rescheduleTimeInput = document.getElementById("reschedule-time");
const smartSlotPicker = document.getElementById("smart-slot-picker");
const historySummaryNode = document.getElementById("history-summary");
const historyResultsNode = document.getElementById("history-results");
const detailsModalNode = document.getElementById("details-modal");
const closeDetailsModalButton = document.getElementById("close-details-modal");
const detailsTitleNode = document.getElementById("details-title");
const detailsMetaNode = document.getElementById("details-meta");
const detailsServiceInput = document.getElementById("details-service");
const detailsClientNameInput = document.getElementById("details-client-name");
const detailsPhoneInput = document.getElementById("details-phone");
const detailsEmailInput = document.getElementById("details-email");
const detailsNotesInput = document.getElementById("details-notes");
const detailsRescheduleButton = document.getElementById("details-reschedule");
const detailsEmailAction = document.getElementById("details-email-action");
const detailsTextAction = document.getElementById("details-text-action");
const detailsWaiverToggle = document.getElementById("details-waiver-toggle");
const detailsCompletedButton = document.getElementById("details-completed");
const detailsNoShowButton = document.getElementById("details-no-show");
const detailsCancelButton = document.getElementById("details-cancel");
const detailsStatusNode = document.getElementById("details-status");
const saveDetailsNotesButton = document.getElementById("save-details-notes");
const detailsHistorySummaryNode = document.getElementById("details-history-summary");
const detailsHistoryResultsNode = document.getElementById("details-history-results");

let activeRescheduleBooking = null;
let activeDetailsBooking = null;
let allBookings = [];
let weekOffset = 0;
let searchMode = false;

adminLoginButton.addEventListener("click", loginAdmin);
adminPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginAdmin();
  }
});
adminLogoutButton.addEventListener("click", logoutAdmin);
refreshButton.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) {
    loadSearchResults(query);
    return;
  }

  loadBookings();
});
previousWeekButton.addEventListener("click", () => {
  if (searchMode) {
    return;
  }
  weekOffset -= 1;
  loadBookings();
});
currentWeekButton.addEventListener("click", () => {
  if (searchMode) {
    return;
  }
  weekOffset = 0;
  loadBookings();
});
nextWeekButton.addEventListener("click", () => {
  if (searchMode) {
    return;
  }
  weekOffset += 1;
  loadBookings();
});
previousWeekBottomButton.addEventListener("click", () => {
  if (searchMode) {
    return;
  }
  weekOffset -= 1;
  loadBookings();
});
nextWeekBottomButton.addEventListener("click", () => {
  if (searchMode) {
    return;
  }
  weekOffset += 1;
  loadBookings();
});
backToTopButton.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});
searchButton.addEventListener("click", () => {
  searchInput.value = "";
  searchMode = false;
  updateWeekControls();
  historySummaryNode.innerHTML =
    '<p class="admin-status">Click a booking to see that client history.</p>';
  historyResultsNode.innerHTML = "";
  loadBookings();
});
searchInput.addEventListener("input", async () => {
  const query = searchInput.value.trim();

  if (query) {
    await Promise.all([loadSearchResults(query), loadClientHistory(query)]);
    return;
  }

  searchMode = false;
  updateWeekControls();
  await loadBookings();
  historySummaryNode.innerHTML =
    '<p class="admin-status">Click a booking to see that client history.</p>';
  historyResultsNode.innerHTML = "";
});

closeModalButton.addEventListener("click", closeRescheduleModal);
saveRescheduleButton.addEventListener("click", saveReschedule);
closeDetailsModalButton.addEventListener("click", closeDetailsModal);
saveDetailsNotesButton.addEventListener("click", saveDetailsNotes);
detailsRescheduleButton.addEventListener("click", () => {
  if (!activeDetailsBooking) {
    return;
  }
  const booking = activeDetailsBooking;
  closeDetailsModal();
  openRescheduleModal(booking);
});
detailsWaiverToggle.addEventListener("change", async () => {
  if (!activeDetailsBooking) {
    return;
  }

  const nextWaiverSigned = detailsWaiverToggle.checked;
  detailsStatusNode.textContent = nextWaiverSigned
    ? "Marking waiver signed..."
    : "Marking waiver needed...";

  try {
    const response = await fetch(
      `/api/admin/bookings/${encodeURIComponent(activeDetailsBooking.id)}/waiver`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          calendarId: activeDetailsBooking.calendarId,
          waiverSigned: nextWaiverSigned
        })
      }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not update waiver status");
    }

    activeDetailsBooking = data.booking;
    updateDetailsPanel(data.booking);
    await loadBookings();
    detailsStatusNode.textContent = nextWaiverSigned
      ? "Waiver marked signed."
      : "Waiver marked needed.";
  } catch (error) {
    detailsStatusNode.textContent = error.message;
  }
});
detailsCompletedButton.addEventListener("click", () => {
  if (activeDetailsBooking) {
    setAttendanceStatus(activeDetailsBooking.id, activeDetailsBooking.calendarId, "completed");
  }
});
detailsNoShowButton.addEventListener("click", () => {
  if (activeDetailsBooking) {
    setAttendanceStatus(activeDetailsBooking.id, activeDetailsBooking.calendarId, "no-show");
  }
});
detailsCancelButton.addEventListener("click", () => {
  if (activeDetailsBooking) {
    const booking = activeDetailsBooking;
    closeDetailsModal();
    cancelBooking(booking.id, booking.calendarId);
  }
});
modalNode.addEventListener("click", (event) => {
  if (event.target === modalNode) {
    closeRescheduleModal();
  }
});
detailsModalNode.addEventListener("click", (event) => {
  if (event.target === detailsModalNode) {
    closeDetailsModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeRescheduleModal();
    closeDetailsModal();
  }
});

async function loadBookings() {
  searchMode = false;
  updateWeekControls();
  const range = currentWeekRange(weekOffset);
  weekLabelNode.textContent = formatWeekLabel(range.start, range.endExclusive);
  statusNode.textContent = "Loading bookings...";
  bookingsNode.innerHTML = "";

  try {
    const params = new URLSearchParams({
      start: range.start,
      end: range.endExclusive
    });
    const response = await fetch(`/api/admin/bookings?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not load bookings");
    }

    allBookings = data.bookings;

    if (!data.bookings.length) {
      statusNode.textContent = "No bookings found for this week.";
      bookingsNode.innerHTML = `<div class="message">No bookings were found for this week.</div>`;
      return;
    }

    statusNode.textContent = `${data.bookings.length} booking${data.bookings.length === 1 ? "" : "s"} loaded.`;
    renderBookings(filterBookings(data.bookings, searchInput.value.trim()));
  } catch (error) {
    statusNode.textContent = "There was a problem loading bookings.";
    bookingsNode.innerHTML = `<div class="message error">${error.message}</div>`;
  }
}

async function loadSearchResults(query) {
  searchMode = true;
  updateWeekControls();
  weekLabelNode.textContent = `Search Results for "${query}"`;
  statusNode.textContent = "Searching bookings...";
  bookingsNode.innerHTML = "";

  try {
    const response = await fetch(`/api/admin/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not search bookings");
    }

    allBookings = data.results ?? [];
    statusNode.textContent = `${allBookings.length} result${allBookings.length === 1 ? "" : "s"} found.`;
    renderBookings(allBookings);
  } catch (error) {
    statusNode.textContent = "There was a problem searching bookings.";
    bookingsNode.innerHTML = `<div class="message error">${error.message}</div>`;
  }
}

async function bootAdmin() {
  try {
    const response = await fetch("/api/admin/session", {
      credentials: "same-origin"
    });
    const data = await response.json();

    if (response.ok && data.authenticated) {
      showAdminShell();
      await loadBookings();
      return;
    }
  } catch {
    // fall through to login screen
  }

  showLoginShell();
}

function showAdminShell() {
  adminAuthShell.classList.add("hidden");
  adminShell.classList.remove("hidden");
}

function showLoginShell() {
  adminShell.classList.add("hidden");
  adminAuthShell.classList.remove("hidden");
  adminLoginStatusNode.textContent = "";
  adminPasswordInput.value = "";
}

async function loginAdmin() {
  const password = adminPasswordInput.value.trim();
  if (!password) {
    adminLoginStatusNode.textContent = "Enter your admin password.";
    return;
  }

  adminLoginStatusNode.textContent = "Logging in...";

  try {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({ password })
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not log in.");
    }

    showAdminShell();
    await loadBookings();
  } catch (error) {
    adminLoginStatusNode.textContent = error.message;
  }
}

async function logoutAdmin() {
  try {
    await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "same-origin"
    });
  } finally {
    showLoginShell();
  }
}

function renderBookings(bookings) {
  if (!bookings.length) {
    bookingsNode.innerHTML =
      '<div class="message">No bookings matched your current search.</div>';
    return;
  }

  const grouped = groupByDate(bookings);
  bookingsNode.innerHTML = Object.entries(grouped)
    .map(([date, items]) => {
      const pastDay = isPastDay(date);
      const earlierToday = isToday(date) ? items.filter((booking) => isPastBooking(booking)) : [];
      const visibleItems = isToday(date)
        ? items.filter((booking) => !isPastBooking(booking))
        : pastDay
          ? []
          : items;

      return `
        <section class="admin-day">
          <div class="admin-day-heading">
            <h3 class="admin-day-title">${formatDate(date)}</h3>
            ${
              pastDay
                ? `<span class="admin-day-badge">Past day</span>`
                : ""
            }
          </div>
          ${
            visibleItems.length
              ? `<div class="admin-day-list">${visibleItems.map((booking) => renderBookingCard(booking)).join("")}</div>`
              : isToday(date) && earlierToday.length
                ? `<div class="message">No more upcoming bookings for today.</div>`
                : ""
          }
          ${
            isToday(date) && earlierToday.length
              ? `
                <details class="admin-collapse">
                  <summary>Earlier Today (${earlierToday.length})</summary>
                  <div class="admin-day-list admin-day-list-collapsed">
                    ${earlierToday.map((booking) => renderBookingCard(booking)).join("")}
                  </div>
                </details>
              `
              : ""
          }
          ${
            pastDay
              ? `
                <details class="admin-collapse">
                  <summary>Show ${items.length} past booking${items.length === 1 ? "" : "s"}</summary>
                  <div class="admin-day-list admin-day-list-collapsed">
                    ${items.map((booking) => renderBookingCard(booking)).join("")}
                  </div>
                </details>
              `
              : ""
          }
        </section>
      `;
    })
    .join("");
}

function updateWeekControls() {
  previousWeekButton.disabled = searchMode;
  currentWeekButton.disabled = searchMode;
  nextWeekButton.disabled = searchMode;
  previousWeekBottomButton.disabled = searchMode;
  nextWeekBottomButton.disabled = searchMode;
}

function renderBookingCard(booking) {
  return `
    <article class="admin-booking-card ${eventClassName(booking.service)}" role="button" tabindex="0" onclick='openDetailsModal(${JSON.stringify(
      booking
    )})'>
      <div class="admin-card-hover-actions" onclick="event.stopPropagation()">
        ${
          booking.start && booking.end
            ? `<button class="admin-card-hover-button" type="button" onclick='openRescheduleModal(${JSON.stringify(
                booking
              )})'>Reschedule</button>`
            : ""
        }
        ${
          booking.email
            ? `<a class="admin-card-hover-button" href="${emailHref(booking)}">Email</a>`
            : ""
        }
        ${
          booking.phone
            ? `<a class="admin-card-hover-button" href="${textHref(booking)}">Text</a>`
            : ""
        }
        <button
          class="admin-card-hover-button"
          type="button"
          onclick="setAttendanceStatus('${booking.id}', '${booking.calendarId}', 'completed')"
        >
          Completed
        </button>
        <button
          class="admin-card-hover-button"
          type="button"
          onclick="setAttendanceStatus('${booking.id}', '${booking.calendarId}', 'no-show')"
        >
          No-Show
        </button>
        <button
          class="admin-card-hover-button danger"
          type="button"
          onclick="cancelBooking('${booking.id}', '${booking.calendarId}')"
        >
          Cancel
        </button>
      </div>
      <div class="admin-booking-top compact">
        <p class="admin-booking-time">${formatTimeRange(booking.start, booking.end)}</p>
        <span class="admin-status-pill status-${booking.attendanceStatus || "scheduled"}">${formatAttendanceStatus(booking.attendanceStatus)}</span>
      </div>
      <h4 class="admin-booking-service">${escapeHtml(booking.service)}</h4>
      <p class="admin-booking-client">${escapeHtml(booking.customerName)}</p>
      <p class="admin-booking-trainer">${escapeHtml(booking.trainer)}</p>
      <p class="admin-booking-waiver ${booking.waiverSigned ? "signed" : "needed"}">
        ${booking.waiverSigned ? "Waiver on file" : "Waiver needed"}
      </p>
      <p class="admin-booking-hint">Tap to view actions and details</p>
      <div class="admin-card-mobile-actions" onclick="event.stopPropagation()">
        ${
          booking.start && booking.end
            ? `<button class="admin-card-mobile-button" type="button" onclick='openRescheduleModal(${JSON.stringify(
                booking
              )})'>Reschedule</button>`
            : ""
        }
        <button
          class="admin-card-mobile-button danger"
          type="button"
          onclick="cancelBooking('${booking.id}', '${booking.calendarId}')"
        >
          Cancel
        </button>
      </div>
    </article>
  `;
}

function filterBookings(bookings, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return bookings;
  }

  return bookings.filter((booking) =>
    [
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
      .toLowerCase()
      .includes(needle)
  );
}

async function loadHistory(query) {
  historySummaryNode.innerHTML = '<p class="admin-status">Loading history...</p>';
  historyResultsNode.innerHTML = "";

  if (!query) {
    historySummaryNode.innerHTML =
      '<p class="admin-status">Search for a client or service to see history.</p>';
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/search?query=${encodeURIComponent(query)}`
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not load history");
    }

    historySummaryNode.innerHTML = `
      <div class="admin-history-grid">
        <div><dt>Matches</dt><dd>${data.summary.total}</dd></div>
        <div><dt>Scheduled</dt><dd>${data.summary.scheduled}</dd></div>
        <div><dt>Completed</dt><dd>${data.summary.completed}</dd></div>
        <div><dt>No-Show</dt><dd>${data.summary.noShow}</dd></div>
      </div>
    `;

    if (!data.results.length) {
      historyResultsNode.innerHTML = '<div class="message">No history matched that search.</div>';
      return;
    }

    historyResultsNode.innerHTML = data.results
      .slice(0, 20)
      .map(
        (booking) => `
          <article class="admin-history-card">
            <p class="admin-booking-time">${formatDate(booking.start.slice(0, 10))}</p>
            <h4>${escapeHtml(booking.customerName)}</h4>
            <p>${escapeHtml(booking.service)}</p>
            <p>${formatTimeRange(booking.start, booking.end)}</p>
            <p><span class="admin-status-pill status-${booking.attendanceStatus || "scheduled"}">${formatAttendanceStatus(booking.attendanceStatus)}</span></p>
          </article>
        `
      )
      .join("");
  } catch (error) {
    historySummaryNode.innerHTML = `<div class="message error">${error.message}</div>`;
  }
}

async function loadClientHistory(query, summaryNode = historySummaryNode, resultsNode = historyResultsNode) {
  summaryNode.innerHTML = '<p class="admin-status">Loading history...</p>';
  resultsNode.innerHTML = "";

  if (!query) {
    summaryNode.innerHTML = '<p class="admin-status">No client selected.</p>';
    return;
  }

  try {
    const response = await fetch(`/api/admin/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not load history");
    }

    summaryNode.innerHTML = `
      <div class="admin-history-grid">
        <div><dt>Matches</dt><dd>${data.summary.total}</dd></div>
        <div><dt>Scheduled</dt><dd>${data.summary.scheduled}</dd></div>
        <div><dt>Completed</dt><dd>${data.summary.completed}</dd></div>
        <div><dt>No-Show</dt><dd>${data.summary.noShow}</dd></div>
      </div>
    `;

    if (!data.results.length) {
      resultsNode.innerHTML = '<div class="message">No history matched that search.</div>';
      return;
    }

    resultsNode.innerHTML = data.results
      .slice(0, 10)
      .map(
        (booking) => `
          <article class="admin-history-card">
            <p class="admin-booking-time">${formatDate(booking.start.slice(0, 10))}</p>
            <h4>${escapeHtml(booking.customerName)}</h4>
            <p>${escapeHtml(booking.service)}</p>
            <p>${formatTimeRange(booking.start, booking.end)}</p>
            <p><span class="admin-status-pill status-${booking.attendanceStatus || "scheduled"}">${formatAttendanceStatus(booking.attendanceStatus)}</span></p>
          </article>
        `
      )
      .join("");
  } catch (error) {
    summaryNode.innerHTML = `<div class="message error">${error.message}</div>`;
  }
}

function groupByDate(bookings) {
  return bookings.reduce((groups, booking) => {
    const date = booking.start.slice(0, 10);
    groups[date] = groups[date] || [];
    groups[date].push(booking);
    return groups;
  }, {});
}

function isToday(value) {
  return value === toIsoDate(new Date());
}

function isPastDay(value) {
  const today = toIsoDate(new Date());
  return value < today;
}

function isPastBooking(booking) {
  if (!booking?.end) {
    return false;
  }

  return new Date(booking.end).getTime() < Date.now();
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function formatTimeRange(start, end) {
  const startValue = new Date(start).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
  const endValue = new Date(end).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  return `${startValue} - ${endValue}`;
}

function currentWeekRange(offset) {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOfWeek = base.getDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - daysFromMonday + offset * 7);

  const endExclusive = new Date(start);
  endExclusive.setDate(start.getDate() + 7);

  return {
    start: toIsoDate(start),
    endExclusive: toIsoDate(endExclusive)
  };
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekLabel(start, endExclusive) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${endExclusive}T00:00:00`);
  endDate.setDate(endDate.getDate() - 1);

  const startText = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  const endText = endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return `Week of ${startText} - ${endText}`;
}

function eventClassName(service) {
  const value = String(service).toLowerCase();

  if (value.includes("ladies night")) {
    return "event-ladies-night";
  }

  if (value.includes("personal training")) {
    return "event-personal-training";
  }

  if (value.includes("pitching")) {
    return "event-pitching";
  }

  if (value.includes("speed & agility")) {
    return "event-speed-agility";
  }

  return "event-manual";
}

function formatAttendanceStatus(value) {
  if (value === "completed") {
    return "Completed";
  }

  if (value === "no-show") {
    return "No-Show";
  }

  return "Scheduled";
}

function toDateInputValue(isoString) {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(isoString) {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return `${hour}:${minute}`;
}

function closeRescheduleModal() {
  modalNode.classList.add("hidden");
  activeRescheduleBooking = null;
  modalStatusNode.textContent = "";
  smartSlotPicker.innerHTML = "";
}

function closeDetailsModal() {
  detailsModalNode.classList.add("hidden");
  activeDetailsBooking = null;
  detailsStatusNode.textContent = "";
  detailsHistorySummaryNode.innerHTML = "";
  detailsHistoryResultsNode.innerHTML = "";
}

window.openDetailsModal = async (booking) => {
  activeDetailsBooking = booking;
  detailsTitleNode.textContent = booking.customerName || booking.title;
  detailsServiceInput.value = booking.serviceId || "";
  detailsClientNameInput.value = booking.customerName === "Not provided" ? "" : booking.customerName || "";
  detailsPhoneInput.value = booking.phone || "";
  detailsEmailInput.value = booking.email || "";
  detailsNotesInput.value = booking.notes || "";
  detailsStatusNode.textContent = "";
  updateDetailsPanel(booking);
  detailsModalNode.classList.remove("hidden");
  const historyQuery = booking.email || booking.phone || booking.customerName;
  await loadClientHistory(historyQuery, detailsHistorySummaryNode, detailsHistoryResultsNode);
  await loadClientHistory(historyQuery);
};

function updateDetailsPanel(booking) {
  detailsTitleNode.textContent = booking.customerName || booking.title;
  detailsMetaNode.innerHTML = `
    <div><dt>Status</dt><dd><span class="admin-status-pill status-${booking.attendanceStatus || "scheduled"}">${formatAttendanceStatus(booking.attendanceStatus)}</span></dd></div>
    <div><dt>Service</dt><dd>${escapeHtml(booking.service)}</dd></div>
    <div><dt>Time</dt><dd>${formatDate(booking.start.slice(0, 10))} • ${formatTimeRange(booking.start, booking.end)}</dd></div>
    <div><dt>Trainer</dt><dd>${escapeHtml(booking.trainer)}</dd></div>
    <div><dt>Phone</dt><dd>${escapeHtml(booking.phone || "-")}</dd></div>
    <div><dt>Email</dt><dd>${escapeHtml(booking.email || "-")}</dd></div>
    <div><dt>Waiver</dt><dd>${booking.waiverSigned ? `Signed${booking.waiverSignedAt ? ` • ${new Date(booking.waiverSignedAt).toLocaleDateString()}` : ""}` : "Needed"}</dd></div>
  `;
  detailsRescheduleButton.disabled = !(booking.start && booking.end);
  detailsWaiverToggle.checked = !!booking.waiverSigned;
  if (booking.email) {
    detailsEmailAction.href = emailHref(booking);
    detailsEmailAction.classList.remove("hidden");
  } else {
    detailsEmailAction.href = "#";
    detailsEmailAction.classList.add("hidden");
  }
  if (booking.phone) {
    detailsTextAction.href = textHref(booking);
    detailsTextAction.classList.remove("hidden");
  } else {
    detailsTextAction.href = "#";
    detailsTextAction.classList.add("hidden");
  }
}

window.openRescheduleModal = (booking) => {
  activeRescheduleBooking = booking;
  rescheduleDateInput.value = toDateInputValue(booking.start);
  rescheduleTimeInput.value = toTimeInputValue(booking.start);
  modalStatusNode.textContent = "";
  modalNode.classList.remove("hidden");
  loadSmartSlots();
};

async function saveReschedule() {
  if (!activeRescheduleBooking) {
    return;
  }

  const dateValue = rescheduleDateInput.value;
  const timeValue = rescheduleTimeInput.value;

  if (!dateValue || !timeValue) {
    modalStatusNode.textContent = "Choose both a date and time.";
    return;
  }

  const originalStart = new Date(activeRescheduleBooking.start);
  const originalEnd = new Date(activeRescheduleBooking.end);
  const durationMinutes = Math.round((originalEnd.getTime() - originalStart.getTime()) / 60000);

  modalStatusNode.textContent = "Saving changes...";

  try {
    const response = await fetch(
      `/api/admin/bookings/${encodeURIComponent(activeRescheduleBooking.id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          calendarId: activeRescheduleBooking.calendarId,
          localDate: dateValue,
          localTime: timeValue,
          durationMinutes
        })
      }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not reschedule booking");
    }

    closeRescheduleModal();
    await loadBookings();
  } catch (error) {
    modalStatusNode.textContent = error.message;
  }
}

rescheduleDateInput.addEventListener("change", () => {
  if (activeRescheduleBooking?.serviceId) {
    loadSmartSlots();
  }
});

async function loadSmartSlots() {
  if (!activeRescheduleBooking?.serviceId) {
    smartSlotPicker.innerHTML =
      '<div class="message">Manual calendar events can be rescheduled with the custom date and time fields above.</div>';
    return;
  }

  smartSlotPicker.innerHTML = '<div class="message">Loading valid time options...</div>';

  try {
    const params = new URLSearchParams({
      service: activeRescheduleBooking.serviceId,
      date: rescheduleDateInput.value,
      ignoreEventId: activeRescheduleBooking.id
    });
    const response = await fetch(`/api/admin/reschedule-slots?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not load valid slots");
    }

    if (!data.slots.length) {
      smartSlotPicker.innerHTML =
        '<div class="message">No valid slots are available for that date.</div>';
      return;
    }

    smartSlotPicker.innerHTML = `
      <div class="slot-grid">
        ${data.slots
          .map(
            (slot) => `
              <button
                type="button"
                class="choice ${slot.start === activeRescheduleBooking.start ? "selected" : ""}"
                onclick="selectRescheduleSlot('${slot.start}')"
              >
                <span class="choice-title">${slot.label}</span>
                <span class="choice-copy">${
                  slot.spotsLeft ? `${slot.spotsLeft} spots left` : "Valid booking time"
                }</span>
              </button>
            `
          )
          .join("")}
      </div>
    `;
  } catch (error) {
    smartSlotPicker.innerHTML = `<div class="message error">${error.message}</div>`;
  }
}

window.selectRescheduleSlot = (startIso) => {
  rescheduleDateInput.value = toDateInputValue(startIso);
  rescheduleTimeInput.value = toTimeInputValue(startIso);
  modalStatusNode.textContent = "Valid slot selected.";
  saveRescheduleButton.disabled = false;
};

async function saveDetailsNotes() {
  if (!activeDetailsBooking) {
    return;
  }

  detailsStatusNode.textContent = "Saving booking details...";

  try {
    const response = await fetch(
      `/api/admin/bookings/${encodeURIComponent(activeDetailsBooking.id)}/details`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          calendarId: activeDetailsBooking.calendarId,
          serviceId: detailsServiceInput.value,
          customerName: detailsClientNameInput.value,
          phone: detailsPhoneInput.value,
          email: detailsEmailInput.value,
          notes: detailsNotesInput.value
        })
      }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not save booking details");
    }

    activeDetailsBooking = data.booking;
    detailsEmailAction.href = data.booking.email ? emailHref(data.booking) : "#";
    detailsTextAction.href = data.booking.phone ? textHref(data.booking) : "#";
    detailsEmailAction.classList.toggle("hidden", !data.booking.email);
    detailsTextAction.classList.toggle("hidden", !data.booking.phone);
    updateDetailsPanel(data.booking);
    detailsStatusNode.textContent = "Booking details saved.";
    await loadBookings();
    const historyQuery =
      data.booking.email || data.booking.phone || data.booking.customerName;
    await loadClientHistory(historyQuery, detailsHistorySummaryNode, detailsHistoryResultsNode);
    await loadClientHistory(historyQuery);
  } catch (error) {
    detailsStatusNode.textContent = error.message;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailHref(booking) {
  const subject = encodeURIComponent(`BigDawgz Reminder: ${booking.service}`);
  const body = encodeURIComponent(
    `Hi ${booking.customerName},\n\nThis is a reminder for your ${booking.service} session on ${formatDate(
      booking.start.slice(0, 10)
    )} from ${formatTimeRange(booking.start, booking.end)}.\nLocation: 30990 Wixom Rd, Wixom, MI 48393\nWebsite: https://www.bigdawgztraining.com\n\nBigDawgz Performance`
  );
  return `mailto:${encodeURIComponent(booking.email)}?subject=${subject}&body=${body}`;
}

function textHref(booking) {
  const body = encodeURIComponent(
    `BigDawgz reminder: ${booking.service} on ${formatDate(
      booking.start.slice(0, 10)
    )} from ${formatTimeRange(booking.start, booking.end)}. 30990 Wixom Rd, Wixom, MI 48393. https://www.bigdawgztraining.com`
  );
  return `sms:${encodeURIComponent(booking.phone)}&body=${body}`;
}

window.cancelBooking = async (eventId, calendarId) => {
  const confirmed = window.confirm("Cancel this booking from the shared calendar?");
  if (!confirmed) {
    return;
  }

  statusNode.textContent = "Cancelling booking...";

  try {
    const response = await fetch(
      `/api/admin/bookings/${encodeURIComponent(eventId)}?calendarId=${encodeURIComponent(calendarId)}`,
      {
        method: "DELETE"
      }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not cancel booking");
    }

    await loadBookings();
  } catch (error) {
    statusNode.textContent = "Could not cancel booking.";
    bookingsNode.insertAdjacentHTML(
      "afterbegin",
      `<div class="message error">${error.message}</div>`
    );
  }
};

window.setAttendanceStatus = async (eventId, calendarId, status) => {
  statusNode.textContent = `Saving ${formatAttendanceStatus(status)} status...`;

  try {
    const response = await fetch(
      `/api/admin/bookings/${encodeURIComponent(eventId)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          calendarId,
          status
        })
      }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not update attendance status");
    }

    await loadBookings();
    if (activeDetailsBooking?.id === eventId) {
      const refreshed = allBookings.find((booking) => booking.id === eventId);
      if (refreshed) {
        await openDetailsModal(refreshed);
      }
    }
    if (searchInput.value.trim()) {
      await loadClientHistory(searchInput.value.trim());
    }
    statusNode.textContent = `${formatAttendanceStatus(status)} saved.`;
  } catch (error) {
    statusNode.textContent = error.message;
  }
};

bootAdmin();
