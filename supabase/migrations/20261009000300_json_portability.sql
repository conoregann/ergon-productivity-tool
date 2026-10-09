-- A single statement exports a consistent owner-scoped snapshot. Imports add
-- copies atomically; source IDs never target existing records or other owners.
create function public.export_workspace() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('format', 'ergon', 'version', 1,
    'boards', coalesce((select jsonb_agg(to_jsonb(r) - array['owner_id', 'created_at', 'updated_at', 'version'] order by r.id) from public.boards r where owner_id = auth.uid()), '[]'::jsonb),
    'columns', coalesce((select jsonb_agg(to_jsonb(r) - array['owner_id', 'created_at', 'updated_at', 'version'] order by r.id) from public.columns r where owner_id = auth.uid()), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(to_jsonb(r) - array['owner_id', 'created_at', 'updated_at', 'version'] order by r.id) from public.cards r where owner_id = auth.uid()), '[]'::jsonb),
    'labels', coalesce((select jsonb_agg(to_jsonb(r) - array['owner_id', 'created_at', 'updated_at', 'version'] order by r.id) from public.labels r where owner_id = auth.uid()), '[]'::jsonb),
    'card_labels', coalesce((select jsonb_agg(to_jsonb(r) - array['owner_id', 'created_at', 'updated_at', 'version'] order by r.card_id, r.label_id) from public.card_labels r where owner_id = auth.uid()), '[]'::jsonb),
    'scheduled_sessions', coalesce((select jsonb_agg(to_jsonb(r) - array['owner_id', 'created_at', 'updated_at', 'version'] order by r.id) from public.scheduled_sessions r where owner_id = auth.uid()), '[]'::jsonb)
  );
$$;

create function public.import_workspace(p_data jsonb) returns void
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
  insert into public.cards (id, board_id, column_id, title, description, position, due_date, archived_at, completed_at, priority)
    select (ids->>r.id::text)::uuid, (ids->>r.board_id::text)::uuid, (ids->>r.column_id::text)::uuid, r.title, r.description, r.position, r.due_date, null, r.completed_at, r.priority from jsonb_populate_recordset(null::public.cards, p_data->'cards') r;
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
revoke all on function public.export_workspace() from public, anon;
revoke all on function public.import_workspace(jsonb) from public, anon;
grant execute on function public.export_workspace(), public.import_workspace(jsonb) to authenticated;
