-- Scheduling writes never touch cards or advance workflow/board revisions.
create function public.validate_session_card() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare task public.cards;
begin
  select * into task from public.cards where id = new.card_id for share;
  if not found or task.archived_at is not null then
    raise exception 'Active task unavailable' using errcode = 'PT404';
  end if;
  perform 1 from public.boards where id = task.board_id and archived_at is null for share;
  if not found then raise exception 'Active board unavailable' using errcode = 'PT404'; end if;
  return new;
end;
$$;
revoke all on function public.validate_session_card() from public, anon;
grant execute on function public.validate_session_card() to authenticated;
create trigger validate_session_card before insert or update on public.scheduled_sessions
for each row execute function public.validate_session_card();

create function public.get_scheduling_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(s order by s.starts_at, s.id) from public.scheduled_sessions s), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(c order by c.title, c.id) from public.cards c), '[]'::jsonb),
    'boards', coalesce((select jsonb_agg(b order by b.title, b.id) from public.boards b), '[]'::jsonb),
    'labels', coalesce((select jsonb_agg(l order by l.name, l.id) from public.labels l), '[]'::jsonb),
    'card_labels', coalesce((select jsonb_agg(cl) from public.card_labels cl), '[]'::jsonb),
    'preferences', (select to_jsonb(p) from public.user_preferences p where p.id = auth.uid())
  );
$$;

-- A client-generated ID makes retrying a create after a lost response safe.
create function public.create_session(p_id uuid, p_card_id uuid, p_starts_at timestamptz, p_ends_at timestamptz) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare existing public.scheduled_sessions;
begin
  insert into public.scheduled_sessions (id, card_id, starts_at, ends_at)
  values (p_id, p_card_id, p_starts_at, p_ends_at) on conflict (id) do nothing;
  select * into existing from public.scheduled_sessions where id = p_id;
  if not found or existing.card_id is distinct from p_card_id or existing.starts_at is distinct from p_starts_at or existing.ends_at is distinct from p_ends_at then
    raise exception 'Session changed. Review the latest schedule.' using errcode = 'PT409';
  end if;
  return existing.id;
end;
$$;

create function public.save_session(p_id uuid, p_version bigint, p_starts_at timestamptz, p_ends_at timestamptz) returns void
language plpgsql security invoker set search_path = '' as $$
declare existing public.scheduled_sessions;
begin
  select * into existing from public.scheduled_sessions where id = p_id for update;
  if not found then raise exception 'Session unavailable' using errcode = 'PT404'; end if;
  if existing.version is distinct from p_version then raise exception 'Session changed. Review the latest schedule.' using errcode = 'PT409'; end if;
  update public.scheduled_sessions set starts_at = p_starts_at, ends_at = p_ends_at where id = p_id;
end;
$$;

create function public.delete_session(p_id uuid, p_version bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare existing public.scheduled_sessions;
begin
  select * into existing from public.scheduled_sessions where id = p_id for update;
  if not found then raise exception 'Session unavailable' using errcode = 'PT404'; end if;
  if existing.version is distinct from p_version then raise exception 'Session changed. Review the latest schedule.' using errcode = 'PT409'; end if;
  delete from public.scheduled_sessions where id = p_id;
end;
$$;

create function public.save_calendar_preferences(p_version bigint, p_timezone text, p_week_starts_on integer, p_calendar_view text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_version = 0 then
    insert into public.user_preferences (timezone, week_starts_on, calendar_view)
    values (p_timezone, p_week_starts_on, p_calendar_view) on conflict (id) do nothing;
    if not found then raise exception 'Preferences changed. Review the latest settings.' using errcode = 'PT409'; end if;
  else
    update public.user_preferences set timezone = p_timezone, week_starts_on = p_week_starts_on, calendar_view = p_calendar_view
    where id = auth.uid() and version = p_version;
    if not found then raise exception 'Preferences changed. Review the latest settings.' using errcode = 'PT409'; end if;
  end if;
end;
$$;

revoke all on function public.get_scheduling_snapshot(), public.create_session(uuid, uuid, timestamptz, timestamptz), public.save_session(uuid, bigint, timestamptz, timestamptz), public.delete_session(uuid, bigint), public.save_calendar_preferences(bigint, text, integer, text) from public, anon;
grant execute on function public.get_scheduling_snapshot(), public.create_session(uuid, uuid, timestamptz, timestamptz), public.save_session(uuid, bigint, timestamptz, timestamptz), public.delete_session(uuid, bigint), public.save_calendar_preferences(bigint, text, integer, text) to authenticated;
