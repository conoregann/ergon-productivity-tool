-- Board versions are aggregate revisions: every column/card write advances them.
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.lock_board(p_board_id uuid, p_version bigint, p_allow_archived boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare b public.boards;
begin
  select * into b from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board unavailable' using errcode = 'P0002'; end if;
  if b.version is distinct from p_version then raise exception 'Board changed. Refresh and try again.' using errcode = '40001'; end if;
  if b.archived_at is not null and not p_allow_archived then raise exception 'Board is archived' using errcode = '23514'; end if;
end;
$$;
revoke all on function private.lock_board(uuid, bigint, boolean) from public, anon;
grant execute on function private.lock_board(uuid, bigint, boolean) to authenticated;

create function public.guard_board_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare b public.boards;
begin
  if TG_OP = 'UPDATE' and new.board_id <> old.board_id then
    raise exception 'Cannot transfer entities between boards' using errcode = '23514';
  end if;
  select * into b from public.boards where id = new.board_id for update;
  if not found or b.archived_at is not null then
    raise exception 'Active board unavailable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create function public.touch_board() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    update public.boards set title = title where id = old.board_id;
    return old;
  end if;
  update public.boards set title = title where id = new.board_id;
  return new;
end;
$$;
revoke all on function public.guard_board_write(), public.touch_board() from public, anon, authenticated;
create trigger guard_board_write before insert or update on public.columns for each row execute function public.guard_board_write();
create trigger guard_board_write before insert or update on public.cards for each row execute function public.guard_board_write();
create trigger touch_board after insert or update or delete on public.columns for each row execute function public.touch_board();
create trigger touch_board after insert or update or delete on public.cards for each row execute function public.touch_board();

create function public.get_board_snapshot(p_board_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'board', to_jsonb(b),
    'columns', coalesce((select jsonb_agg(c order by c.position) from public.columns c where c.board_id = b.id), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(c order by c.position) from public.cards c where c.board_id = b.id), '[]'::jsonb)
  ) from public.boards b where b.id = p_board_id;
$$;

create function public.create_board(p_title text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare board_id uuid;
begin
  insert into public.boards (title) values (trim(p_title)) returning id into board_id;
  insert into public.columns (board_id, title, position) values
    (board_id, 'To do', 0), (board_id, 'In progress', 1), (board_id, 'Done', 2);
  return board_id;
end;
$$;

create function public.save_board(p_board_id uuid, p_version bigint, p_title text, p_archived boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version, true);
  update public.boards set title = trim(p_title), archived_at = case when p_archived then coalesce(archived_at, now()) else null end where id = p_board_id;
end;
$$;

create function public.delete_board(p_board_id uuid, p_version bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version, true);
  delete from public.boards where id = p_board_id;
end;
$$;

create function public.create_column(p_board_id uuid, p_version bigint, p_title text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare column_id uuid;
begin
  perform private.lock_board(p_board_id, p_version);
  insert into public.columns (board_id, title, position)
  select p_board_id, trim(p_title), coalesce(max(position) + 1, 0) from public.columns where board_id = p_board_id
  returning id into column_id;
  return column_id;
end;
$$;

create function public.save_column(p_board_id uuid, p_version bigint, p_column_id uuid, p_title text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.columns set title = trim(p_title) where id = p_column_id and board_id = p_board_id;
  if not found then raise exception 'Column unavailable' using errcode = 'P0002'; end if;
end;
$$;

create function public.delete_column(p_board_id uuid, p_version bigint, p_column_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare old_position integer;
begin
  perform private.lock_board(p_board_id, p_version);
  select position into old_position from public.columns where id = p_column_id and board_id = p_board_id;
  if not found then raise exception 'Column unavailable' using errcode = 'P0002'; end if;
  if exists (select 1 from public.cards where column_id = p_column_id) then
    raise exception 'Move or delete all cards, including archived cards, before deleting this column' using errcode = '23514';
  end if;
  delete from public.columns where id = p_column_id;
  update public.columns set position = position - 1 where board_id = p_board_id and position > old_position;
end;
$$;

create function public.move_column(p_board_id uuid, p_version bigint, p_column_id uuid, p_before_id uuid default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare old_position integer; target_position integer;
begin
  perform private.lock_board(p_board_id, p_version);
  select position into old_position from public.columns where id = p_column_id and board_id = p_board_id;
  if not found then raise exception 'Column unavailable' using errcode = 'P0002'; end if;
  if p_before_id = p_column_id then return; end if;
  update public.columns set position = position - 1 where board_id = p_board_id and position > old_position and id <> p_column_id;
  if p_before_id is null then
    select count(*) into target_position from public.columns where board_id = p_board_id and id <> p_column_id;
  else
    select position into target_position from public.columns where id = p_before_id and board_id = p_board_id;
    if not found then raise exception 'Destination column unavailable' using errcode = 'P0002'; end if;
  end if;
  update public.columns set position = position + 1 where board_id = p_board_id and position >= target_position and id <> p_column_id;
  update public.columns set position = target_position where id = p_column_id;
end;
$$;

create function public.create_card(p_board_id uuid, p_version bigint, p_column_id uuid, p_title text, p_description text default '', p_due_date date default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare card_id uuid;
begin
  perform private.lock_board(p_board_id, p_version);
  if not exists (select 1 from public.columns where id = p_column_id and board_id = p_board_id) then raise exception 'Column unavailable' using errcode = 'P0002'; end if;
  insert into public.cards (board_id, column_id, title, description, due_date, position)
  select p_board_id, p_column_id, trim(p_title), p_description, p_due_date, coalesce(max(position) + 1, 0) from public.cards where column_id = p_column_id
  returning id into card_id;
  return card_id;
end;
$$;

create function public.save_card(p_board_id uuid, p_version bigint, p_card_id uuid, p_title text, p_description text, p_due_date date, p_completed boolean, p_archived boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.cards set title = trim(p_title), description = p_description, due_date = p_due_date,
    completed_at = case when p_completed then coalesce(completed_at, now()) else null end,
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_card_id and board_id = p_board_id;
  if not found then raise exception 'Card unavailable' using errcode = 'P0002'; end if;
end;
$$;

create function public.move_card(p_board_id uuid, p_version bigint, p_card_id uuid, p_column_id uuid, p_before_id uuid default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare task public.cards; target_position integer;
begin
  perform private.lock_board(p_board_id, p_version);
  select * into task from public.cards where id = p_card_id and board_id = p_board_id and archived_at is null;
  if not found then raise exception 'Active card unavailable' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.columns where id = p_column_id and board_id = p_board_id) then raise exception 'Destination column unavailable' using errcode = 'P0002'; end if;
  if p_before_id = p_card_id then return; end if;
  update public.cards set position = position - 1 where column_id = task.column_id and position > task.position and id <> p_card_id;
  if p_before_id is null then
    select count(*) into target_position from public.cards where column_id = p_column_id and id <> p_card_id;
  else
    select position into target_position from public.cards where id = p_before_id and column_id = p_column_id and board_id = p_board_id and archived_at is null;
    if not found then raise exception 'Destination card unavailable' using errcode = 'P0002'; end if;
  end if;
  update public.cards set position = position + 1 where column_id = p_column_id and position >= target_position and id <> p_card_id;
  update public.cards set column_id = p_column_id, position = target_position where id = p_card_id;
end;
$$;

create function public.delete_card(p_board_id uuid, p_version bigint, p_card_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare task public.cards;
begin
  perform private.lock_board(p_board_id, p_version);
  select * into task from public.cards where id = p_card_id and board_id = p_board_id;
  if not found then raise exception 'Card unavailable' using errcode = 'P0002'; end if;
  delete from public.cards where id = p_card_id;
  update public.cards set position = position - 1 where column_id = task.column_id and position > task.position;
end;
$$;

-- Supabase may grant execute through default privileges; revoke those explicitly.
revoke all on function public.get_board_snapshot(uuid), public.create_board(text), public.save_board(uuid,bigint,text,boolean), public.delete_board(uuid,bigint),
 public.create_column(uuid,bigint,text), public.save_column(uuid,bigint,uuid,text), public.delete_column(uuid,bigint,uuid), public.move_column(uuid,bigint,uuid,uuid),
 public.create_card(uuid,bigint,uuid,text,text,date), public.save_card(uuid,bigint,uuid,text,text,date,boolean,boolean), public.move_card(uuid,bigint,uuid,uuid,uuid), public.delete_card(uuid,bigint,uuid)
 from public, anon;
grant execute on function public.get_board_snapshot(uuid), public.create_board(text), public.save_board(uuid,bigint,text,boolean), public.delete_board(uuid,bigint),
 public.create_column(uuid,bigint,text), public.save_column(uuid,bigint,uuid,text), public.delete_column(uuid,bigint,uuid), public.move_column(uuid,bigint,uuid,uuid),
 public.create_card(uuid,bigint,uuid,text,text,date), public.save_card(uuid,bigint,uuid,text,text,date,boolean,boolean), public.move_card(uuid,bigint,uuid,uuid,uuid), public.delete_card(uuid,bigint,uuid)
 to authenticated;
