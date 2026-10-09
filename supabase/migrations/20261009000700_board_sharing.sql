-- Link tokens are separate from board snapshots and never exposed to visitors.
create table public.board_shares (
  board_id uuid primary key references public.boards(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  access text not null check (access in ('viewer', 'editor'))
);
alter table public.board_shares enable row level security;
revoke all on public.board_shares from public, anon, authenticated;
grant select on public.board_shares to authenticated;
create policy owner_read on public.board_shares for select to authenticated
using (exists (select 1 from public.boards b where b.id = board_id and b.owner_id = auth.uid()));

create function private.link_access(p_board_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.access from public.board_shares s
  where s.board_id = p_board_id
    and s.token::text = (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-board-share');
$$;
revoke all on function private.link_access(uuid) from public, anon;
grant execute on function private.link_access(uuid) to authenticated;

create function public.get_shared_board() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.get_board_snapshot(s.board_id) || jsonb_build_object('access', s.access)
  from public.board_shares s
  where s.token::text = (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-board-share');
$$;
revoke all on function public.get_shared_board() from public;
grant execute on function public.get_shared_board() to anon, authenticated;

create function public.set_board_sharing(p_board_id uuid, p_version bigint, p_access text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.boards; result jsonb;
begin
  select * into b from public.boards where id = p_board_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Board unavailable' using errcode = 'PT404'; end if;
  if b.version is distinct from p_version then raise exception 'Board changed. Refresh and try again.' using errcode = 'PT409'; end if;
  if p_access is null then
    delete from public.board_shares where board_id = p_board_id;
  else
    insert into public.board_shares (board_id, access) values (p_board_id, p_access)
    on conflict (board_id) do update set access = excluded.access;
    select to_jsonb(s) into result from public.board_shares s where board_id = p_board_id;
  end if;
  update public.boards set title = title where id = p_board_id;
  return result;
end;
$$;
revoke all on function public.set_board_sharing(uuid,bigint,text) from public, anon;
grant execute on function public.set_board_sharing(uuid,bigint,text) to authenticated;

create policy link_read on public.boards for select to authenticated using (private.link_access(id) is not null);
create policy link_read on public.columns for select to authenticated using (private.link_access(board_id) is not null);
create policy link_read on public.cards for select to authenticated using (private.link_access(board_id) is not null);
create policy link_read on public.labels for select to authenticated using (private.link_access(board_id) is not null);
create policy link_read on public.card_labels for select to authenticated using (private.link_access(board_id) is not null);

-- Preserve the owner's composite relationships when an editor creates children.
-- The board lock also serializes edits against link revocation.
create or replace function public.guard_board_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.boards;
begin
  if TG_OP = 'UPDATE' and new.board_id <> old.board_id then
    raise exception 'Cannot transfer entities between boards' using errcode = '23514';
  end if;
  select * into b from public.boards where id = new.board_id for update;
  if not found or b.archived_at is not null or
    (b.owner_id is distinct from auth.uid() and (auth.uid() is null or private.link_access(b.id) is distinct from 'editor')) then
    raise exception 'Active board unavailable' using errcode = '23514';
  end if;
  if TG_OP = 'INSERT' and b.owner_id is distinct from auth.uid() then new.owner_id := b.owner_id; end if;
  return new;
end;
$$;

create or replace function private.lock_board(p_board_id uuid, p_version bigint, p_allow_archived boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.boards;
begin
  select * into b from public.boards where id = p_board_id for update;
  if not found or auth.uid() is null or
    (b.owner_id is distinct from auth.uid() and (p_allow_archived or private.link_access(b.id) is distinct from 'editor')) then
    raise exception 'Board unavailable' using errcode = 'PT404';
  end if;
  if b.version is distinct from p_version then raise exception 'Board changed. Refresh and try again.' using errcode = 'PT409'; end if;
  if b.archived_at is not null and not p_allow_archived then raise exception 'Board is archived' using errcode = '23514'; end if;
end;
$$;

-- SELECT remains separate: a viewer must never gain a write policy.
create policy link_insert on public.columns for insert to authenticated with check (auth.uid() is not null and private.link_access(board_id) = 'editor' and owner_id = (select b.owner_id from public.boards b where b.id = board_id));
create policy link_update on public.columns for update to authenticated using (private.link_access(board_id) = 'editor') with check (private.link_access(board_id) = 'editor');
create policy link_delete on public.columns for delete to authenticated using (private.link_access(board_id) = 'editor');
create policy link_insert on public.cards for insert to authenticated with check (auth.uid() is not null and private.link_access(board_id) = 'editor' and owner_id = (select b.owner_id from public.boards b where b.id = board_id));
create policy link_update on public.cards for update to authenticated using (private.link_access(board_id) = 'editor') with check (private.link_access(board_id) = 'editor');
create policy link_delete on public.cards for delete to authenticated using (private.link_access(board_id) = 'editor');
create policy link_insert on public.labels for insert to authenticated with check (auth.uid() is not null and private.link_access(board_id) = 'editor' and owner_id = (select b.owner_id from public.boards b where b.id = board_id));
create policy link_update on public.labels for update to authenticated using (private.link_access(board_id) = 'editor') with check (private.link_access(board_id) = 'editor');
create policy link_delete on public.labels for delete to authenticated using (private.link_access(board_id) = 'editor');
create policy link_insert on public.card_labels for insert to authenticated with check (auth.uid() is not null and private.link_access(board_id) = 'editor' and owner_id = (select b.owner_id from public.boards b where b.id = board_id));
create policy link_update on public.card_labels for update to authenticated using (private.link_access(board_id) = 'editor') with check (private.link_access(board_id) = 'editor');
create policy link_delete on public.card_labels for delete to authenticated using (private.link_access(board_id) = 'editor');
