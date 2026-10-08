-- Ownership is enforced both by RLS and composite foreign keys.
create function public.bump_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;
revoke all on function public.bump_version() from public;

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  title text not null check (length(trim(title)) between 1 and 200),
  archived_at timestamptz,
  unique (id, owner_id)
);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  board_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  position integer not null check (position >= 0),
  unique (id, board_id, owner_id),
  unique (board_id, position) deferrable initially deferred,
  foreign key (board_id, owner_id) references public.boards(id, owner_id) on delete cascade
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  board_id uuid not null,
  column_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 500),
  description text not null default '',
  position integer not null check (position >= 0),
  due_date date,
  archived_at timestamptz,
  completed_at timestamptz,
  unique (id, owner_id),
  unique (id, board_id, owner_id),
  unique (column_id, position) deferrable initially deferred,
  foreign key (column_id, board_id, owner_id) references public.columns(id, board_id, owner_id) on delete cascade
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  board_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  color text not null default '#244e3c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  unique (id, board_id, owner_id),
  unique (board_id, name),
  foreign key (board_id, owner_id) references public.boards(id, owner_id) on delete cascade
);

create table public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  card_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at),
  foreign key (card_id, owner_id) references public.cards(id, owner_id) on delete cascade
);

create table public.card_labels (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id uuid not null,
  card_id uuid not null,
  label_id uuid not null,
  primary key (card_id, label_id),
  foreign key (card_id, board_id, owner_id) references public.cards(id, board_id, owner_id) on delete cascade,
  foreign key (label_id, board_id, owner_id) references public.labels(id, board_id, owner_id) on delete cascade
);

create table public.user_preferences (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  week_starts_on integer not null default 1 check (week_starts_on between 0 and 6),
  calendar_view text not null default 'week' check (calendar_view in ('day', 'week', 'agenda')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (id = owner_id)
);

create function public.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_timezone() from public;
create trigger validate_timezone before insert or update on public.user_preferences
for each row execute function public.validate_timezone();

alter table public.boards enable row level security;
revoke all on public.boards from anon, authenticated;
grant select, insert, update, delete on public.boards to authenticated;
create policy owner_access on public.boards for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create index boards_owner_idx on public.boards(owner_id);
create trigger bump_version before update on public.boards
for each row execute function public.bump_version();

alter table public.columns enable row level security;
revoke all on public.columns from anon, authenticated;
grant select, insert, update, delete on public.columns to authenticated;
create policy owner_access on public.columns for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create index columns_owner_idx on public.columns(owner_id);
create trigger bump_version before update on public.columns
for each row execute function public.bump_version();

alter table public.cards enable row level security;
revoke all on public.cards from anon, authenticated;
grant select, insert, update, delete on public.cards to authenticated;
create policy owner_access on public.cards for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create index cards_owner_idx on public.cards(owner_id);
create trigger bump_version before update on public.cards
for each row execute function public.bump_version();

alter table public.labels enable row level security;
revoke all on public.labels from anon, authenticated;
grant select, insert, update, delete on public.labels to authenticated;
create policy owner_access on public.labels for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create index labels_owner_idx on public.labels(owner_id);
create trigger bump_version before update on public.labels
for each row execute function public.bump_version();

alter table public.scheduled_sessions enable row level security;
revoke all on public.scheduled_sessions from anon, authenticated;
grant select, insert, update, delete on public.scheduled_sessions to authenticated;
create policy owner_access on public.scheduled_sessions for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create index scheduled_sessions_owner_idx on public.scheduled_sessions(owner_id);
create trigger bump_version before update on public.scheduled_sessions
for each row execute function public.bump_version();

alter table public.card_labels enable row level security;
revoke all on public.card_labels from anon, authenticated;
grant select, insert, update, delete on public.card_labels to authenticated;
create policy owner_access on public.card_labels for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create index card_labels_owner_idx on public.card_labels(owner_id);

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon, authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
create policy owner_access on public.user_preferences for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create index user_preferences_owner_idx on public.user_preferences(owner_id);
create trigger bump_version before update on public.user_preferences
for each row execute function public.bump_version();

create index cards_board_idx on public.cards(board_id);
create index labels_board_idx on public.labels(board_id);
create index card_labels_label_idx on public.card_labels(label_id);
create index scheduled_sessions_card_idx on public.scheduled_sessions(card_id);
create index scheduled_sessions_owner_start_idx on public.scheduled_sessions(owner_id, starts_at);
