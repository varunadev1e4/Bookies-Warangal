-- ============================================================
-- WARANGAL BOOKIES — SUPABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── PROFILES ─────────────────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  name        text not null,
  email       text,
  role        text not null default 'member' check (role in ('member', 'admin')),
  points      integer not null default 0,
  books_read  integer not null default 0,
  city        text default 'Warangal',
  bio         text,
  joined_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are public"        on public.profiles for select using (true);
create policy "Users update own profile"   on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile"   on public.profiles for insert with check (auth.uid() = id);

-- ── BOOKS ─────────────────────────────────────────────────────
create table public.books (
  id               uuid default gen_random_uuid() primary key,
  title            text not null,
  author           text not null,
  genre            text not null,
  emoji            text default '📖',
  description      text,
  total_copies     integer not null default 1,
  available_copies integer not null default 1,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now()
);
alter table public.books enable row level security;
create policy "Books are public"          on public.books for select using (true);
create policy "Members can add books"     on public.books for insert
  with check (auth.uid() is not null);
create policy "Admins can update books"   on public.books for update
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Admins can delete books"   on public.books for delete
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── BORROWS ───────────────────────────────────────────────────
create table public.borrows (
  id           uuid default gen_random_uuid() primary key,
  book_id      uuid not null references public.books(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  borrowed_at  timestamptz default now(),
  due_date     timestamptz default (now() + interval '14 days'),
  returned_at  timestamptz,
  status       text default 'active' check (status in ('active', 'returned', 'overdue'))
);
alter table public.borrows enable row level security;
create policy "Users see own borrows"     on public.borrows for select using (auth.uid() = user_id);
create policy "Admins see all borrows"    on public.borrows for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Users create own borrows"  on public.borrows for insert with check (auth.uid() = user_id);
create policy "Users update own borrows"  on public.borrows for update using (auth.uid() = user_id);
create policy "Admins update any borrow"  on public.borrows for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── MEETUPS ───────────────────────────────────────────────────
create table public.meetups (
  id             uuid default gen_random_uuid() primary key,
  title          text not null,
  date           date not null,
  time           text,
  location       text,
  book_discussed text,
  description    text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz default now()
);
alter table public.meetups enable row level security;
create policy "Meetups are public"    on public.meetups for select using (true);
create policy "Admins manage meetups" on public.meetups for all
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── MEETUP RSVPS ──────────────────────────────────────────────
create table public.meetup_rsvps (
  id         uuid default gen_random_uuid() primary key,
  meetup_id  uuid not null references public.meetups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (meetup_id, user_id)
);
alter table public.meetup_rsvps enable row level security;
create policy "RSVPs are public"        on public.meetup_rsvps for select using (true);
create policy "Users manage own rsvps"  on public.meetup_rsvps for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── REVIEWS ───────────────────────────────────────────────────
create table public.reviews (
  id         uuid default gen_random_uuid() primary key,
  book_id    uuid not null references public.books(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rating     integer check (rating between 1 and 5),
  body       text,
  created_at timestamptz default now(),
  unique (book_id, user_id)
);
alter table public.reviews enable row level security;
create policy "Reviews are public"         on public.reviews for select using (true);
create policy "Users manage own reviews"   on public.reviews for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────
create table public.announcements (
  id         uuid default gen_random_uuid() primary key,
  title      text not null,
  body       text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
alter table public.announcements enable row level security;
create policy "Announcements are public"    on public.announcements for select using (true);
create policy "Admins manage announcements" on public.announcements for all
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── READING CHALLENGES ────────────────────────────────────────
create table public.challenges (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  target        integer not null,
  start_date    date,
  end_date      date,
  points_reward integer default 100,
  created_at    timestamptz default now()
);
alter table public.challenges enable row level security;
create policy "Challenges are public"    on public.challenges for select using (true);
create policy "Admins manage challenges" on public.challenges for all
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── CHALLENGE PROGRESS ────────────────────────────────────────
create table public.challenge_progress (
  id               uuid default gen_random_uuid() primary key,
  challenge_id     uuid references public.challenges(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete cascade,
  books_completed  integer default 0,
  unique (challenge_id, user_id)
);
alter table public.challenge_progress enable row level security;
create policy "Progress is public"           on public.challenge_progress for select using (true);
create policy "Users manage own progress"    on public.challenge_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── ACTIVITY FEED ─────────────────────────────────────────────
create table public.activity_feed (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  action      text not null,
  target      text,
  created_at  timestamptz default now()
);
alter table public.activity_feed enable row level security;
create policy "Activity is public"        on public.activity_feed for select using (true);
create policy "Users insert own activity" on public.activity_feed for insert with check (auth.uid() = user_id);

-- ── BOOK OF THE MONTH ─────────────────────────────────────────
create table public.book_of_month (
  id               uuid default gen_random_uuid() primary key,
  book_id          uuid references public.books(id),
  month            integer not null,
  year             integer not null,
  progress_percent integer default 0,
  unique (month, year)
);
alter table public.book_of_month enable row level security;
create policy "BOTM is public"        on public.book_of_month for select using (true);
create policy "Admins manage BOTM"    on public.book_of_month for all
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── SETTINGS (stores admin code etc.) ────────────────────────
create table public.settings (
  key   text primary key,
  value text not null
);
alter table public.settings enable row level security;
-- Settings NOT readable by clients — only via security definer function
-- (no select policy = no public access)

-- ── FUNCTION: auto-create profile on signup ───────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'member')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── FUNCTION: verify admin code (security definer) ────────────
create or replace function public.verify_admin_code(code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  return exists (
    select 1 from public.settings
    where key = 'admin_code' and value = code
  );
end;
$$;

-- ── FUNCTION: borrow a book (atomic) ──────────────────────────
create or replace function public.borrow_book(p_book_id uuid, p_user_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_available integer;
  v_borrow_id uuid;
begin
  select available_copies into v_available from public.books where id = p_book_id for update;
  if v_available is null then
    return json_build_object('success', false, 'error', 'Book not found');
  end if;
  if v_available < 1 then
    return json_build_object('success', false, 'error', 'No copies available');
  end if;

  -- Check if user already has this book
  if exists (select 1 from public.borrows where book_id = p_book_id and user_id = p_user_id and status = 'active') then
    return json_build_object('success', false, 'error', 'You already have this book borrowed');
  end if;

  -- Decrement available copies
  update public.books set available_copies = available_copies - 1 where id = p_book_id;

  -- Create borrow record
  insert into public.borrows (book_id, user_id, due_date)
  values (p_book_id, p_user_id, now() + interval '14 days')
  returning id into v_borrow_id;

  -- Update user points
  update public.profiles set points = points + 10 where id = p_user_id;

  -- Log activity
  insert into public.activity_feed (user_id, action, target)
  select p_user_id, 'borrowed', title from public.books where id = p_book_id;

  return json_build_object('success', true, 'borrow_id', v_borrow_id);
end;
$$;

-- ── FUNCTION: return a book (atomic) ──────────────────────────
create or replace function public.return_book(p_borrow_id uuid, p_user_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_book_id uuid;
begin
  select book_id into v_book_id from public.borrows
  where id = p_borrow_id and user_id = p_user_id and status = 'active';

  if v_book_id is null then
    return json_build_object('success', false, 'error', 'Borrow record not found');
  end if;

  update public.borrows set status = 'returned', returned_at = now() where id = p_borrow_id;
  update public.books set available_copies = available_copies + 1 where id = v_book_id;
  update public.profiles set books_read = books_read + 1, points = points + 15 where id = p_user_id;

  insert into public.activity_feed (user_id, action, target)
  select p_user_id, 'returned', title from public.books where id = v_book_id;

  return json_build_object('success', true);
end;
$$;

-- ── SEED: Admin code ──────────────────────────────────────────
insert into public.settings (key, value) values ('admin_code', 'WBADMIN2024');

-- ── SEED: Sample books ────────────────────────────────────────
insert into public.books (title, author, genre, emoji, description, total_copies, available_copies) values
  ('Wings of Fire', 'A.P.J. Abdul Kalam', 'Non-Fiction', '🚀', 'Autobiography of India''s Missile Man and former President — a story of grit, science, and dreams.', 3, 3),
  ('The God of Small Things', 'Arundhati Roy', 'Fiction', '🌿', 'Booker Prize winner. A story of forbidden love and caste in Kerala. Lyrical and devastating.', 2, 2),
  ('Sapiens', 'Yuval Noah Harari', 'Non-Fiction', '🧬', 'A bold, sweeping history of humankind from Stone Age to Silicon Age.', 2, 2),
  ('The Alchemist', 'Paulo Coelho', 'Fiction', '⚗️', 'A timeless philosophical novel about following your Personal Legend.', 3, 3),
  ('Maha Prasthanam', 'Sri Sri', 'Telugu', '📜', 'Landmark revolutionary Telugu poetry collection that changed modern Telugu literature.', 2, 2),
  ('Kalidasu', 'Viswanatha Satyanarayana', 'Telugu', '🎭', 'Jnanpith Award-winning Telugu novel — a fictional life of poet Kalidasa.', 1, 1),
  ('Atomic Habits', 'James Clear', 'Self-Help', '⚡', 'The definitive guide to building good habits and breaking bad ones.', 3, 3),
  ('A Brief History of Time', 'Stephen Hawking', 'Science', '🌌', 'Hawking''s landmark exploration of the universe — black holes, time, and the big bang.', 2, 2),
  ('Warangal Fort: A Chronicle', 'K. Ramaiah', 'History', '🏰', 'A scholarly account of the Kakatiya dynasty, the fort, and Warangal''s glorious heritage.', 2, 2),
  ('Midnight''s Children', 'Salman Rushdie', 'Fiction', '🌙', 'Booker of Bookers. Magical realism about children born at India''s independence.', 1, 1),
  ('Gitanjali', 'Rabindranath Tagore', 'Poetry', '🎵', 'Nobel Prize-winning devotional poetry — deeply spiritual, hauntingly beautiful.', 2, 2),
  ('The Art of War', 'Sun Tzu', 'Non-Fiction', '⚔️', 'Ancient Chinese treatise on strategy, leadership, and conflict — timeless wisdom.', 2, 2),
  ('Ponniyin Selvan', 'Kalki Krishnamurthy', 'Fiction', '🏺', 'Epic historical novel set in the Chola dynasty — one of the greatest Indian novels.', 2, 2),
  ('Ramayana', 'Valmiki (C. Rajagopalachari)', 'History', '🪔', 'The timeless epic retold in accessible modern English by Rajaji.', 3, 3),
  ('Think and Grow Rich', 'Napoleon Hill', 'Self-Help', '💡', 'Classic success philosophy and mindset principles that shaped a century of readers.', 2, 2);

-- ── SEED: Meetups ─────────────────────────────────────────────
insert into public.meetups (title, date, time, location, book_discussed, description) values
  ('Monthly Discussion: The God of Small Things', (current_date + interval '4 days')::date, '6:00 PM', 'Warangal Fort Grounds', 'The God of Small Things', 'Deep dive into Arundhati Roy''s Booker Prize winner. Bring your thoughts and a cup of chai!'),
  ('Telugu Literature Night', (current_date + interval '11 days')::date, '5:30 PM', 'Kakatiya University Library', 'Maha Prasthanam', 'Celebrating the best of Telugu literature — Sri Sri''s revolutionary poetry and more.'),
  ('Science & Discovery Meetup', (current_date + interval '25 days')::date, '6:30 PM', 'TITA Center, Hanamkonda', 'A Brief History of Time', 'Exploring the universe through science books. Casual, curious, and fun!'),
  ('Kalam Birthday Special', (current_date + interval '40 days')::date, '5:00 PM', 'NIT Warangal Auditorium', 'Wings of Fire', 'Celebrating Dr. Kalam''s birth anniversary with readings and inspiration.');

-- ── SEED: Announcements ───────────────────────────────────────
insert into public.announcements (title, body) values
  ('Welcome to Warangal Bookies!', 'We have crossed 750 members! Thank you for being part of this incredible community of readers. More events, more books, more stories coming your way.'),
  ('New Books Added', 'We just added 5 new books to the library including Ponniyin Selvan and Warangal Fort Chronicle. Head to the library and borrow yours!'),
  ('Reading Challenge: Telangana Authors', 'This month''s challenge — read 3 books by Telangana authors and earn 200 bonus points. Challenge ends March 31st.');

-- ── SEED: Challenges ──────────────────────────────────────────
insert into public.challenges (title, target, start_date, end_date, points_reward) values
  ('2024 Reading Challenge', 20, '2024-01-01', '2024-12-31', 500),
  ('Telangana Authors Month', 3, current_date::date, (current_date + interval '30 days')::date, 200),
  ('Weekend Reader', 4, current_date::date, (current_date + interval '14 days')::date, 100);
