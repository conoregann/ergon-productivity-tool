-- A deadline may include a local clock time, independently of scheduled sessions.
alter table public.cards add column due_time text
  constraint cards_due_time_check check (due_time is null or (due_date is not null and due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));

drop function public.create_card(uuid,bigint,uuid,text,text,date,text,jsonb);
drop function public.save_card(uuid,bigint,uuid,text,text,date,boolean,boolean,text,jsonb);

create or replace function public.create_card(p_board_id uuid, p_version bigint, p_column_id uuid, p_title text, p_description text default '', p_due_date date default null, p_priority text default 'none', p_label_ids jsonb default null, p_due_time text default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare card_id uuid;
begin
  perform private.lock_board(p_board_id, p_version);
  if not exists (select 1 from public.columns where id = p_column_id and board_id = p_board_id) then raise exception 'Column unavailable' using errcode = 'PT404'; end if;
  insert into public.cards (board_id, column_id, title, description, due_date, due_time, priority, position)
  select p_board_id, p_column_id, trim(p_title), p_description, p_due_date, p_due_time, p_priority, coalesce(max(position) + 1, 0) from public.cards where column_id = p_column_id
  returning id into card_id;
  perform private.set_card_labels(p_board_id, card_id, p_label_ids);
  return card_id;
end;
$$;

-- An omitted time preserves existing deadlines for older clients; null clears it.
create or replace function public.save_card(p_board_id uuid, p_version bigint, p_card_id uuid, p_title text, p_description text, p_due_date date, p_completed boolean, p_archived boolean, p_priority text default null, p_label_ids jsonb default null, p_due_time text default '') returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.cards set title = trim(p_title), description = p_description, due_date = p_due_date,
    due_time = case when p_due_date is null then null when p_due_time = '' then due_time else p_due_time end, priority = coalesce(p_priority, priority),
    completed_at = case when p_completed then coalesce(completed_at, now()) else null end,
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_card_id and board_id = p_board_id;
  if not found then raise exception 'Card unavailable' using errcode = 'PT404'; end if;
  perform private.set_card_labels(p_board_id, p_card_id, p_label_ids);
end;
$$;

revoke all on function public.create_card(uuid,bigint,uuid,text,text,date,text,jsonb,text), public.save_card(uuid,bigint,uuid,text,text,date,boolean,boolean,text,jsonb,text) from public, anon;
grant execute on function public.create_card(uuid,bigint,uuid,text,text,date,text,jsonb,text), public.save_card(uuid,bigint,uuid,text,text,date,boolean,boolean,text,jsonb,text) to authenticated;

create or replace function public.import_workspace(p_data jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  ids jsonb;
  collection text;
  id_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_data->>'format' is distinct from 'ergon' or p_data->'version' is distinct from '1'::jsonb then
    raise exception 'Unsupported Ergon JSON format';
  end if;
  foreach collection in array array['boards', 'columns', 'cards', 'labels', 'card_labels', 'scheduled_sessions'] loop
    if jsonb_typeof(p_data->collection) is distinct from 'array' then
      raise exception 'Invalid collection: %', collection;
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_data->'boards') item where
    jsonb_typeof(item->'id') is distinct from 'string' or
    jsonb_typeof(item->'title') is distinct from 'string' or
    (item->'archived_at' is distinct from 'null'::jsonb and (jsonb_typeof(item->'archived_at') is distinct from 'string')) or
    (jsonb_typeof(item->'archived_at') = 'string' and item->>'archived_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$') or
    jsonb_typeof(item->'background') is distinct from 'string') then raise exception 'Invalid fields in boards'; end if;
  if exists (select 1 from jsonb_array_elements(p_data->'columns') item where
    jsonb_typeof(item->'id') is distinct from 'string' or
    jsonb_typeof(item->'board_id') is distinct from 'string' or
    jsonb_typeof(item->'title') is distinct from 'string' or
    jsonb_typeof(item->'position') is distinct from 'number') then raise exception 'Invalid fields in columns'; end if;
  if exists (select 1 from jsonb_array_elements(p_data->'cards') item where
    jsonb_typeof(item->'id') is distinct from 'string' or
    jsonb_typeof(item->'board_id') is distinct from 'string' or
    jsonb_typeof(item->'column_id') is distinct from 'string' or
    jsonb_typeof(item->'title') is distinct from 'string' or
    jsonb_typeof(item->'description') is distinct from 'string' or
    jsonb_typeof(item->'position') is distinct from 'number' or
    (item->'due_date' is distinct from 'null'::jsonb and (jsonb_typeof(item->'due_date') is distinct from 'string')) or
    (jsonb_typeof(item->'due_date') = 'string' and item->>'due_date' !~ '^\d{4}-\d{2}-\d{2}$') or
    (item->'archived_at' is distinct from 'null'::jsonb and (jsonb_typeof(item->'archived_at') is distinct from 'string')) or
    (jsonb_typeof(item->'archived_at') = 'string' and item->>'archived_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$') or
    (item->'completed_at' is distinct from 'null'::jsonb and (jsonb_typeof(item->'completed_at') is distinct from 'string')) or
    (jsonb_typeof(item->'completed_at') = 'string' and item->>'completed_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$') or
    jsonb_typeof(item->'priority') is distinct from 'string') then raise exception 'Invalid fields in cards'; end if;
  if exists (select 1 from jsonb_array_elements(p_data->'labels') item where
    jsonb_typeof(item->'id') is distinct from 'string' or
    jsonb_typeof(item->'board_id') is distinct from 'string' or
    jsonb_typeof(item->'name') is distinct from 'string' or
    jsonb_typeof(item->'color') is distinct from 'string') then raise exception 'Invalid fields in labels'; end if;
  if exists (select 1 from jsonb_array_elements(p_data->'card_labels') item where
    jsonb_typeof(item->'board_id') is distinct from 'string' or
    jsonb_typeof(item->'card_id') is distinct from 'string' or
    jsonb_typeof(item->'label_id') is distinct from 'string') then raise exception 'Invalid fields in card_labels'; end if;
  if exists (select 1 from jsonb_array_elements(p_data->'scheduled_sessions') item where
    jsonb_typeof(item->'id') is distinct from 'string' or
    jsonb_typeof(item->'card_id') is distinct from 'string' or
    jsonb_typeof(item->'starts_at') is distinct from 'string' or
    (jsonb_typeof(item->'starts_at') = 'string' and item->>'starts_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$') or
    jsonb_typeof(item->'ends_at') is distinct from 'string' or
    (jsonb_typeof(item->'ends_at') = 'string' and item->>'ends_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$')) then raise exception 'Invalid fields in scheduled_sessions'; end if;
  select jsonb_object_agg(item->>'id', gen_random_uuid()), count(*) into ids, id_count
  from jsonb_array_elements((p_data->'boards') || (p_data->'columns') || (p_data->'cards') || (p_data->'labels') || (p_data->'scheduled_sessions')) item;
  if coalesce((select count(*) from jsonb_object_keys(ids)), 0) <> id_count then raise exception 'Duplicate IDs'; end if;
  insert into public.boards (id, title, archived_at, background)
    select (ids->>r.id::text)::uuid, r.title, null, r.background from jsonb_populate_recordset(null::public.boards, p_data->'boards') r;
  insert into public.columns (id, board_id, title, position)
    select (ids->>r.id::text)::uuid, (ids->>r.board_id::text)::uuid, r.title, r.position from jsonb_populate_recordset(null::public.columns, p_data->'columns') r;
  insert into public.cards (id, board_id, column_id, title, description, position, due_date, due_time, archived_at, completed_at, priority)
    select (ids->>r.id::text)::uuid, (ids->>r.board_id::text)::uuid, (ids->>r.column_id::text)::uuid, r.title, r.description, r.position, r.due_date, r.due_time, null, r.completed_at, r.priority from jsonb_populate_recordset(null::public.cards, p_data->'cards') r;
  insert into public.labels (id, board_id, name, color)
    select (ids->>r.id::text)::uuid, (ids->>r.board_id::text)::uuid, r.name, r.color from jsonb_populate_recordset(null::public.labels, p_data->'labels') r;
  insert into public.card_labels (board_id, card_id, label_id)
    select (ids->>r.board_id::text)::uuid, (ids->>r.card_id::text)::uuid, (ids->>r.label_id::text)::uuid from jsonb_populate_recordset(null::public.card_labels, p_data->'card_labels') r;
  insert into public.scheduled_sessions (id, card_id, starts_at, ends_at)
    select (ids->>r.id::text)::uuid, (ids->>r.card_id::text)::uuid, r.starts_at, r.ends_at from jsonb_populate_recordset(null::public.scheduled_sessions, p_data->'scheduled_sessions') r;
  -- Restore archived tasks after importing their scheduling history.
  update public.cards c set archived_at = r.archived_at
    from jsonb_populate_recordset(null::public.cards, p_data->'cards') r
    where c.id = (ids->>r.id::text)::uuid and r.archived_at is not null;
  -- Children require active boards during insertion; restore archive history last.
  update public.boards b set archived_at = r.archived_at
    from jsonb_populate_recordset(null::public.boards, p_data->'boards') r
    where b.id = (ids->>r.id::text)::uuid and r.archived_at is not null;
end;
$$;
