# Pulse Chat: real-time chat with React, Express and Supabase

A responsive, dark/light-aware chat app.

- **Frontend:** React 18 + TypeScript + Vite (plain CSS, no UI library)
- **Backend:** Node.js + Express + TypeScript (validation with zod, helmet, CORS, rate limiting)
- **Database + Auth + Realtime:** Supabase (Postgres, Row Level Security, Realtime)

Features: email/password auth, multiple rooms (created live, visible to everyone instantly),
real-time messages, "who's online" avatars, typing indicators, delete your own messages,
infinite "load older messages", day separators, grouped bubbles, mobile slide-over sidebar.

> **Status of this code:** all files were written and syntax-checked, but the build environment
> could not reach the npm registry, so `npm install`, the TypeScript type-check and a live run
> against Supabase have **not** been executed. Steps 5-6 below are your first full compile.
> If `npm run build` reports a type error, it should be small. Send it over and it can be fixed quickly.

---

## 1. Is this possible on Supabase's free plan?

Yes. Auth, Postgres, Row Level Security and Realtime (Postgres Changes, Broadcast, Presence) are all
available on the Free plan. Limits reported by a third-party 2026 pricing guide (always confirm on
<https://supabase.com/pricing>):

| Limit | Free plan |
|---|---|
| Active projects | 2 |
| Database size | 500 MB |
| Monthly active users | 50,000 |
| Realtime concurrent connections | ~200 |
| Realtime messages | ~2 M / month |
| Inactivity | **Project pauses after 7 days of no activity**, so restore it from the dashboard |

Fine for a hobby or small-team chat. Each open browser tab uses a few realtime connections.

---

## 2. Architecture

```
Browser (React)                         Express API                   Supabase
───────────────                         ───────────                   ────────
signUp / signIn  ───────────────────────────────────────────────────▶ Auth
                                  Authorization: Bearer <JWT>
REST calls  ───────────────────────────▶ verify JWT (auth.getUser)
 (rooms, history, send, delete)          user-scoped client ─────────▶ Postgres (RLS applies)
                                                                          │ logical replication
Realtime socket  ◀────────────────────────────────────────────────────────┘
 • postgres_changes: new messages / rooms
 • presence: who is online      • broadcast: typing
```

- The **browser authenticates directly with Supabase Auth** and gets a JWT.
- Every API call sends that JWT. **Express verifies it** and then queries Postgres *as that user*
  (anon key + the user's token), so Row Level Security is the real security boundary. The server
  never needs the `service_role` key.
- **Reads/writes go through Express** (validation, rate limiting, one place for business rules).
  **Live updates go straight from Supabase Realtime to the browser**, so the API stays stateless
  and cheap to host.

---

## 3. Project structure

```
chat-app/
├── supabase/
│   └── schema.sql              # tables, triggers, RLS policies, realtime publication, seed rooms
├── server/
│   ├── package.json · tsconfig.json · .env.example
│   └── src/
│       ├── index.ts            # Express app, middleware, routes
│       ├── config.ts           # env loading/validation
│       ├── middleware/
│       │   ├── auth.ts         # verifies Supabase JWT, attaches user-scoped client
│       │   └── error.ts        # asyncHandler, HttpError, zod error mapping
│       └── routes/
│           ├── me.ts           # GET  /api/me
│           ├── rooms.ts        # GET/POST /api/rooms
│           └── messages.ts     # GET/POST /api/rooms/:id/messages, DELETE /api/messages/:id
└── client/
    ├── package.json · tsconfig.json · vite.config.ts · index.html · .env.example
    └── src/
        ├── main.tsx · App.tsx · styles.css · types.ts
        ├── lib/        supabase.ts (client) · api.ts (typed fetch wrapper) · format.ts
        ├── context/    AuthContext.tsx
        ├── hooks/      useRooms.ts · useMessages.ts · usePresence.ts
        └── components/ AuthForm · Sidebar · ChatWindow · MessageList · MessageInput · Avatar
```

---

## 4. Setup: Supabase (about 5 minutes)

1. Create a free account at <https://supabase.com> and click **New project**. Choose a name, a strong
   database password and the region nearest your users.
2. Open **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**.
   This creates the tables, the signup trigger, security policies, enables Realtime on `messages`
   and `rooms`, and seeds `#general` and `#random`.
3. Open **Project Settings → API** (or the **Connect** button) and copy:
   - **Project URL**
   - the **anon** key (or the newer **publishable** key). Either works, and both are safe to expose.
4. *(Recommended for local development)* **Authentication → Sign In / Providers → Email**: turn **off**
   "Confirm email" so you can sign up and chat immediately. If you leave it on, the app will tell new
   users to confirm via the emailed link first. (The free plan's built-in email sender is heavily
   rate-limited. Use custom SMTP for real launches.)

## 5. Setup: backend

```bash
cd server
cp .env.example .env          # then edit .env
npm install
npm run typecheck             # optional sanity check
npm run dev                   # http://localhost:4000
```

`server/.env`:

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

Check it: <http://localhost:4000/api/health> → `{"status":"ok"}`.

## 6. Setup: frontend

```bash
cd client
cp .env.example .env          # then edit .env
npm install
npm run dev                   # http://localhost:5173
```

`client/.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_API_URL=http://localhost:4000
```

Open <http://localhost:5173> in **two different browsers (or one normal + one private window)**,
sign up as two users, join the same room, and watch messages, presence and typing appear live.

---

## 7. API reference

All routes except `/api/health` need `Authorization: Bearer <supabase access token>`.

| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/api/health` | | liveness |
| GET | `/api/me` | | current profile |
| GET | `/api/rooms` | | all rooms |
| POST | `/api/rooms` | `{ name }` | name is lower-cased and hyphenated, 409 if taken |
| GET | `/api/rooms/:roomId/messages` | `?before=<ISO>&limit=50` | oldest-first page + `hasMore` |
| POST | `/api/rooms/:roomId/messages` | `{ content }` (1-2000 chars) | 15 msgs / 10 s per user |
| DELETE | `/api/messages/:id` | | own messages only |

## 8. Security notes

- RLS is enabled on every table: users can only insert messages as themselves and only delete their own.
- The author's `username` on a message is stamped by a database trigger, so clients can't impersonate.
- The `service_role` key is never used. **Never put it in the client or commit it.**
- Rooms and messages are **public to any signed-in user**. For private rooms/DMs, add a
  `room_members` table and change the `select` policies to check membership.
- Typing and presence use public Broadcast/Presence channels. They carry only a user id and username.

## 9. Deploying (free-tier friendly)

- **Frontend:** Vercel / Netlify / Cloudflare Pages. Build `npm run build`, output `dist`, set the three `VITE_*` variables.
- **Backend:** Render / Railway / Fly.io. Build `npm install && npm run build`, start `npm start`,
  set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CLIENT_ORIGIN` (your deployed frontend URL).
  Free web-service tiers sleep when idle, so the first request after a pause is slow.
- Set `VITE_API_URL` to the deployed API URL, and in Supabase **Authentication → URL Configuration**
  set the Site URL to your frontend URL.

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| Messages only appear after refresh | Re-run the Realtime section of `schema.sql`, or check **Database → Publications → supabase_realtime** includes `messages` |
| `Failed to load profile` / 404 on `/api/me` | The user signed up before `schema.sql` ran. Delete them under **Authentication → Users** and sign up again |
| CORS error in the browser | `CLIENT_ORIGIN` in `server/.env` must exactly match the frontend origin (scheme + host + port) |
| 401 from the API | Wrong `SUPABASE_URL` / key on the server, or the token expired (sign out and in) |
| "Email not confirmed" | Disable "Confirm email" (step 4) or click the link in the email |
| App stopped working after a week | Free project paused after 7 days of inactivity, so click **Restore** in the dashboard |

## Ideas for next steps

Edit messages, reactions, image uploads (Supabase Storage is on the free tier), private rooms/DMs,
unread counters, push notifications, generated DB types (`supabase gen types typescript`).
