-- =====================================================================
-- Chat app schema for Supabase
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query
-- It is safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS).
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (char_length(username) between 3 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 1 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  username   text not null,            -- denormalised so realtime payloads are self-contained
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

-- ---------- Triggers --------------------------------------------------

-- 1) Create a profile automatically whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  final_name text;
begin
  base_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );
  -- keep only safe characters and enforce length limits
  base_name := coalesce(regexp_replace(base_name, '[^a-zA-Z0-9_.-]', '', 'g'), '');
  base_name := left(base_name, 24);
  if char_length(base_name) < 3 then
    base_name := 'user_' || left(new.id::text, 6);
  end if;

  final_name := base_name;
  if exists (select 1 from public.profiles where username = final_name) then
    final_name := left(base_name, 19) || '_' || left(new.id::text, 4);
  end if;

  insert into public.profiles (id, username) values (new.id, final_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Always stamp the author's username on a new message (clients cannot spoof it).
create or replace function public.set_message_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.username into new.username from public.profiles p where p.id = new.user_id;
  return new;
end;
$$;

drop trigger if exists messages_set_username on public.messages;
create trigger messages_set_username
  before insert on public.messages
  for each row execute function public.set_message_username();

-- ---------- Row Level Security ---------------------------------------

alter table public.profiles enable row level security;
alter table public.rooms    enable row level security;
alter table public.messages enable row level security;

-- profiles: everyone signed in can read; users can only edit their own row
drop policy if exists "profiles are readable by authenticated" on public.profiles;
create policy "profiles are readable by authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- rooms: public to signed-in users; anyone can create one as themselves
drop policy if exists "rooms are readable by authenticated" on public.rooms;
create policy "rooms are readable by authenticated"
  on public.rooms for select to authenticated using (true);

drop policy if exists "authenticated can create rooms" on public.rooms;
create policy "authenticated can create rooms"
  on public.rooms for insert to authenticated
  with check (created_by = auth.uid());

-- messages: readable by signed-in users; you can only post/delete your own
drop policy if exists "messages are readable by authenticated" on public.messages;
create policy "messages are readable by authenticated"
  on public.messages for select to authenticated using (true);

drop policy if exists "users insert own messages" on public.messages;
create policy "users insert own messages"
  on public.messages for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users delete own messages" on public.messages;
create policy "users delete own messages"
  on public.messages for delete to authenticated
  using (user_id = auth.uid());

-- ---------- Realtime --------------------------------------------------
-- Broadcast row changes on these tables to subscribed clients.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- ---------- Seed data -------------------------------------------------
insert into public.rooms (name) values ('general'), ('random')
on conflict (name) do nothing;
