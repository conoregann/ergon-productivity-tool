-- Domain conflicts and unavailable entities are client errors, not PostgreSQL transaction failures.
-- Explicit PostgREST HTTP codes preserve actionable errors through the hosted API gateway.
create or replace function private.lock_board(p_board_id uuid, p_version bigint, p_allow_archived boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare b public.boards;
begin
  select * into b from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board unavailable' using errcode = 'PT404'; end if;
  if b.version is distinct from p_version then raise exception 'Board changed. Refresh and try again.' using errcode = 'PT409'; end if;
  if b.archived_at is not null and not p_allow_archived then raise exception 'Board is archived' using errcode = '23514'; end if;
end;
$$;

create or replace function public.save_column(p_board_id uuid, p_version bigint, p_column_id uuid, p_title text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.columns set title = trim(p_title) where id = p_column_id and board_id = p_board_id;
  if not found then raise exception 'Column unavailable' using errcode = 'PT404'; end if;
end;
$$;

create or replace function public.delete_column(p_board_id uuid, p_version bigint, p_column_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare old_position integer;
begin
  perform private.lock_board(p_board_id, p_version);
  select position into old_position from public.columns where id = p_column_id and board_id = p_board_id;
  if not found then raise exception 'Column unavailable' using errcode = 'PT404'; end if;
  if exists (select 1 from public.cards where column_id = p_column_id) then
    raise exception 'Move or delete all cards, including archived cards, before deleting this column' using errcode = '23514';
  end if;
  delete from public.columns where id = p_column_id;
  update public.columns set position = position - 1 where board_id = p_board_id and position > old_position;
end;
$$;

create or replace function public.move_column(p_board_id uuid, p_version bigint, p_column_id uuid, p_before_id uuid default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare old_position integer; target_position integer;
begin
  perform private.lock_board(p_board_id, p_version);
  select position into old_position from public.columns where id = p_column_id and board_id = p_board_id;
  if not found then raise exception 'Column unavailable' using errcode = 'PT404'; end if;
  if p_before_id = p_column_id then return; end if;
  update public.columns set position = position - 1 where board_id = p_board_id and position > old_position and id <> p_column_id;
  if p_before_id is null then
    select count(*) into target_position from public.columns where board_id = p_board_id and id <> p_column_id;
  else
    select position into target_position from public.columns where id = p_before_id and board_id = p_board_id;
    if not found then raise exception 'Destination column unavailable' using errcode = 'PT404'; end if;
  end if;
  update public.columns set position = position + 1 where board_id = p_board_id and position >= target_position and id <> p_column_id;
  update public.columns set position = target_position where id = p_column_id;
end;
$$;

create or replace function public.create_card(p_board_id uuid, p_version bigint, p_column_id uuid, p_title text, p_description text default '', p_due_date date default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare card_id uuid;
begin
  perform private.lock_board(p_board_id, p_version);
  if not exists (select 1 from public.columns where id = p_column_id and board_id = p_board_id) then raise exception 'Column unavailable' using errcode = 'PT404'; end if;
  insert into public.cards (board_id, column_id, title, description, due_date, position)
  select p_board_id, p_column_id, trim(p_title), p_description, p_due_date, coalesce(max(position) + 1, 0) from public.cards where column_id = p_column_id
  returning id into card_id;
  return card_id;
end;
$$;

create or replace function public.save_card(p_board_id uuid, p_version bigint, p_card_id uuid, p_title text, p_description text, p_due_date date, p_completed boolean, p_archived boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.cards set title = trim(p_title), description = p_description, due_date = p_due_date,
    completed_at = case when p_completed then coalesce(completed_at, now()) else null end,
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_card_id and board_id = p_board_id;
  if not found then raise exception 'Card unavailable' using errcode = 'PT404'; end if;
end;
$$;

create or replace function public.move_card(p_board_id uuid, p_version bigint, p_card_id uuid, p_column_id uuid, p_before_id uuid default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare task public.cards; target_position integer;
begin
  perform private.lock_board(p_board_id, p_version);
  select * into task from public.cards where id = p_card_id and board_id = p_board_id and archived_at is null;
  if not found then raise exception 'Active card unavailable' using errcode = 'PT404'; end if;
  if not exists (select 1 from public.columns where id = p_column_id and board_id = p_board_id) then raise exception 'Destination column unavailable' using errcode = 'PT404'; end if;
  if p_before_id = p_card_id then return; end if;
  update public.cards set position = position - 1 where column_id = task.column_id and position > task.position and id <> p_card_id;
  if p_before_id is null then
    select count(*) into target_position from public.cards where column_id = p_column_id and id <> p_card_id;
  else
    select position into target_position from public.cards where id = p_before_id and column_id = p_column_id and board_id = p_board_id and archived_at is null;
    if not found then raise exception 'Destination card unavailable' using errcode = 'PT404'; end if;
  end if;
  update public.cards set position = position + 1 where column_id = p_column_id and position >= target_position and id <> p_card_id;
  update public.cards set column_id = p_column_id, position = target_position where id = p_card_id;
end;
$$;

create or replace function public.delete_card(p_board_id uuid, p_version bigint, p_card_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare task public.cards;
begin
  perform private.lock_board(p_board_id, p_version);
  select * into task from public.cards where id = p_card_id and board_id = p_board_id;
  if not found then raise exception 'Card unavailable' using errcode = 'PT404'; end if;
  delete from public.cards where id = p_card_id;
  update public.cards set position = position - 1 where column_id = task.column_id and position > task.position;
end;
$$;

