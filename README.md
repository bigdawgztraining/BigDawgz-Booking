# BigDawgz Booking

A lean full-stack starter for a branded BigDawgz booking system. This version includes:

- A mobile-first booking flow for service, trainer, time, and client details
- Availability endpoints that check Google Calendar conflicts
- Slot generation based on trainer hours
- Booking creation in Google Calendar with reminders and metadata

## Stack

- Frontend: static HTML, CSS, and browser JavaScript
- Backend: Express + TypeScript
- Calendar: Google Calendar API via service account

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Fill in trainer calendar IDs and Google service account credentials.
4. Install dependencies:

```bash
npm install
```

5. Start the app:

```bash
npm run dev
```

6. Open [http://localhost:8080](http://localhost:8080)

## Automatic notifications

If you want bookings to automatically send confirmation emails and texts:

- Fill in the SMTP values in `.env` for email sending
- Fill in the Twilio values in `.env` for text messages

Bookings will still work if those values are missing. The app will simply skip the notification step.

## Google Calendar notes

- Share each trainer calendar with the service account email.
- If a calendar is not shared, availability checks and event creation will fail.
- Skylight can stay synced to the same Google Calendar separately.

## API routes

- `GET /api/health`
- `GET /api/trainers`
- `GET /api/availability/slots?trainer=jharel&date=2026-04-15&service=pitching`
- `POST /api/availability/check`
- `POST /api/bookings`
- `GET /api/admin/bookings`

## Admin view

Open [http://localhost:8080/admin](http://localhost:8080/admin) to see the next 14 days of upcoming events from the shared calendar, including bookings created in the app and manual calendar entries.

The admin page supports:
- `Reschedule` inside the admin page with valid slot suggestions for booking-based events
- `Cancel` by deleting the event from the shared calendar
- `Email` and `Text` reminder shortcuts when contact info is available

## Next steps

- Add Twilio or email confirmations
- Add admin reschedule/cancel endpoints
- Store client history in a database
- Add deposits or package logic if the business needs it
