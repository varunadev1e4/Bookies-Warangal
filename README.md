# 📚 Warangal Bookies — React PWA

Full-stack Progressive Web App for Warangal's community book club.  
**Stack:** React 18 + Vite · Supabase (Auth + DB) · React Router · Deployed on Vercel

---

## ✅ Features

| Feature              | Member | Admin |
|----------------------|--------|-------|
| Browse & search books | ✅    | ✅    |
| Borrow / Return books | ✅    | ✅    |
| View meetups          | ✅    | ✅    |
| RSVP to meetups       | ✅    | ✅    |
| Leaderboard           | ✅    | ✅    |
| Reading challenges    | ✅    | ✅    |
| Write book reviews    | ✅    | ✅    |
| Profile + badges      | ✅    | ✅    |
| Activity feed         | ✅    | ✅    |
| Add/remove books      | ❌    | ✅    |
| Schedule meetups      | ❌    | ✅    |
| Post announcements    | ❌    | ✅    |
| Set Book of the Month | ❌    | ✅    |
| Create challenges     | ❌    | ✅    |
| View all members      | ❌    | ✅    |
| Manage overdue books  | ❌    | ✅    |
| Change admin code     | ❌    | ✅    |

---

## 🚀 Quick Setup (15 minutes)

### Step 1 — Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `warangal-bookies`, set a strong password, choose **Asia South (Mumbai)**
3. Wait ~2 minutes for it to start
4. Go to **SQL Editor** → **New Query**
5. Paste the entire contents of `supabase/schema.sql` and click **Run**
6. Go to **Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public** key → `VITE_SUPABASE_ANON_KEY`

### Step 2 — Local Development

```bash
# Clone / download this folder
cd warangal-bookies-react

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Start dev server
npm run dev
# Open http://localhost:3000
```

### Step 3 — Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from project folder)
vercel

# Or connect GitHub repo at vercel.com
# Add environment variables in Vercel Dashboard:
#   VITE_SUPABASE_URL = https://xxx.supabase.co
#   VITE_SUPABASE_ANON_KEY = eyJ...
```

---

## 🔑 Admin Code System

The **admin code** protects who can create admin accounts:

- Default code: **`WBADMIN2024`** (set in schema.sql seed)
- During sign-up, click **"I have an Admin Code"**
- Enter the correct code → Admin account created
- Wrong/empty code → Regular member account
- Admins can **change the code** anytime from Admin → Change Admin Code
- The code is stored encrypted in Supabase `settings` table, only accessible via a `security definer` function — **never exposed to the frontend**

---

## 📁 Project Structure

```
src/
├── lib/
│   └── supabase.js          ← Supabase client
├── contexts/
│   ├── AuthContext.jsx      ← Auth state + signUp/signIn/signOut
│   └── ToastContext.jsx     ← Toast notifications
├── components/
│   ├── Layout.jsx           ← Topbar + bottom navigation
│   └── Modal.jsx            ← Reusable bottom-sheet modal
└── pages/
    ├── AuthPage.jsx         ← Sign in / Sign up with admin code
    ├── HomePage.jsx         ← Dashboard, BOTM, challenges, feed
    ├── LibraryPage.jsx      ← Browse, search, borrow, return
    ├── MeetupsPage.jsx      ← View, RSVP, create meetups
    ├── LeaderboardPage.jsx  ← Podium + ranked member list
    ├── ProfilePage.jsx      ← Profile, badges, history, reviews
    └── AdminPage.jsx        ← Full admin dashboard

supabase/
└── schema.sql               ← Full DB schema + RLS + functions + seed data

public/
├── manifest.json            ← PWA manifest
└── sw.js                    ← Service Worker (offline)
```

---

## 🗄️ Database Tables

| Table               | Purpose                              |
|---------------------|--------------------------------------|
| `profiles`          | User profiles (extends auth.users)   |
| `books`             | Book catalog                         |
| `borrows`           | Borrow/return records                |
| `meetups`           | Meetup events                        |
| `meetup_rsvps`      | RSVP records                         |
| `reviews`           | Book reviews (1 per user per book)   |
| `announcements`     | Club-wide announcements              |
| `challenges`        | Reading challenges                   |
| `challenge_progress`| User progress on challenges          |
| `activity_feed`     | Club activity stream                 |
| `book_of_month`     | Monthly featured book                |
| `settings`          | Admin code + app config (protected)  |

### Key Supabase Functions (security definer)
- `verify_admin_code(code)` → checks admin code safely
- `borrow_book(book_id, user_id)` → atomic borrow + points
- `return_book(borrow_id, user_id)` → atomic return + points
- `handle_new_user()` → trigger to auto-create profile on signup

---

## 🏆 Points System

| Action              | Points |
|---------------------|--------|
| Borrow a book       | +10    |
| Return a book       | +15    |
| Write a review      | +20    |
| RSVP a meetup       | +5     |

### Badge Tiers
- 📖 Reader — 0+ pts
- 🥉 Bronze — 400+ pts
- 🥈 Silver — 700+ pts
- 🥇 Gold — 1000+ pts
- 🌟 Champion — 1500+ pts
- 👑 Legend — 2000+ pts

---

## 📱 PWA Install

On mobile (Chrome/Android): tap the browser menu → **"Add to Home Screen"**  
On iOS Safari: tap Share → **"Add to Home Screen"**

The app works offline once installed (cached via Service Worker).

---

Built with ❤️ for **Warangal Bookies** — 750+ readers strong 📚
