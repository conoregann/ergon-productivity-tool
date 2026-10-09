-- Labels and assignments participate in the same aggregate board revision.
create trigger guard_board_write before insert or update on public.labels for each row execute function public.guard_board_write();
create trigger guard_board_write before insert or update on public.card_labels for each row execute function public.guard_board_write();
create trigger touch_board after insert or update or delete on public.labels for each row execute function public.touch_board();
create trigger touch_board after insert or update or delete on public.card_labels for each row execute function public.touch_board();

create or replace function public.get_board_snapshot(p_board_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'board', to_jsonb(b),
    'columns', coalesce((select jsonb_agg(c order by c.position) from public.columns c where c.board_id = b.id), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(c order by c.position) from public.cards c where c.board_id = b.id), '[]'::jsonb),
    'labels', coalesce((select jsonb_agg(l order by l.name, l.id) from public.labels l where l.board_id = b.id), '[]'::jsonb),
    'cardLabels', coalesce((select jsonb_agg(l order by l.card_id, l.label_id) from public.card_labels l where l.board_id = b.id), '[]'::jsonb)
  ) from public.boards b where b.id = p_board_id;
$$;

create function public.create_label(p_board_id uuid, p_version bigint, p_name text, p_color text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare label_id uuid;
begin
  perform private.lock_board(p_board_id, p_version);
  insert into public.labels (board_id, name, color) values (p_board_id, trim(p_name), p_color) returning id into label_id;
  return label_id;
end;
$$;
create function public.save_label(p_board_id uuid, p_version bigint, p_label_id uuid, p_name text, p_color text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.labels set name = trim(p_name), color = p_color where id = p_label_id and board_id = p_board_id;
  if not found then raise exception 'Label unavailable' using errcode = 'PT404'; end if;
end;
$$;
create function public.delete_label(p_board_id uuid, p_version bigint, p_label_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  delete from public.labels where id = p_label_id and board_id = p_board_id;
  if not found then raise exception 'Label unavailable' using errcode = 'PT404'; end if;
end;
$$;

-- Called within a locked, revision-checked card transaction. Null preserves
-- assignments for older clients; an empty array explicitly clears them.
create function private.set_card_labels(p_board_id uuid, p_card_id uuid, p_label_ids jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_label_ids is null then return; end if;
  if jsonb_typeof(p_label_ids) <> 'array' then raise exception 'Labels must be an array' using errcode = '23514'; end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_label_ids) as requested(id)
    where not exists (select 1 from public.labels l where l.id = requested.id::uuid and l.board_id = p_board_id)
  ) then raise exception 'Label unavailable on this board' using errcode = 'PT404'; end if;
  delete from public.card_labels where card_id = p_card_id and board_id = p_board_id;
  insert into public.card_labels (board_id, card_id, label_id)
  select distinct p_board_id, p_card_id, id::uuid from jsonb_array_elements_text(p_label_ids) as requested(id);
end;
$$;
revoke all on function private.set_card_labels(uuid, uuid, jsonb) from public, anon;
grant execute on function private.set_card_labels(uuid, uuid, jsonb) to authenticated;

drop function public.create_card(uuid, bigint, uuid, text, text, date, text);
drop function public.save_card(uuid, bigint, uuid, text, text, date, boolean, boolean, text);

create or replace function public.create_card(p_board_id uuid, p_version bigint, p_column_id uuid, p_title text, p_description text default '', p_due_date date default null, p_priority text default 'none', p_label_ids jsonb default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare card_id uuid;
begin
  perform private.lock_board(p_board_id, p_version);
  if not exists (select 1 from public.columns where id = p_column_id and board_id = p_board_id) then raise exception 'Column unavailable' using errcode = 'PT404'; end if;
  insert into public.cards (board_id, column_id, title, description, due_date, priority, position)
  select p_board_id, p_column_id, trim(p_title), p_description, p_due_date, p_priority, coalesce(max(position) + 1, 0) from public.cards where column_id = p_column_id
  returning id into card_id;
  perform private.set_card_labels(p_board_id, card_id, p_label_ids);
  return card_id;
end;
$$;

create or replace function public.save_card(p_board_id uuid, p_version bigint, p_card_id uuid, p_title text, p_description text, p_due_date date, p_completed boolean, p_archived boolean, p_priority text default null, p_label_ids jsonb default null) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.cards set title = trim(p_title), description = p_description, due_date = p_due_date, priority = coalesce(p_priority, priority),
    completed_at = case when p_completed then coalesce(completed_at, now()) else null end,
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_card_id and board_id = p_board_id;
  if not found then raise exception 'Card unavailable' using errcode = 'PT404'; end if;
  perform private.set_card_labels(p_board_id, p_card_id, p_label_ids);
end;
$$;

revoke all on function public.create_label(uuid,bigint,text,text), public.save_label(uuid,bigint,uuid,text,text), public.delete_label(uuid,bigint,uuid),
  public.create_card(uuid,bigint,uuid,text,text,date,text,jsonb), public.save_card(uuid,bigint,uuid,text,text,date,boolean,boolean,text,jsonb) from public, anon;
grant execute on function public.create_label(uuid,bigint,text,text), public.save_label(uuid,bigint,uuid,text,text), public.delete_label(uuid,bigint,uuid),
  public.create_card(uuid,bigint,uuid,text,text,date,text,jsonb), public.save_card(uuid,bigint,uuid,text,text,date,boolean,boolean,text,jsonb) to authenticated;
