-- Priority is independent of workflow, completion, and deadlines.
alter table public.cards add column priority text not null default 'none'
  constraint cards_priority_check check (priority in ('none', 'low', 'medium', 'high', 'urgent'));

drop function public.create_card(uuid, bigint, uuid, text, text, date);
drop function public.save_card(uuid, bigint, uuid, text, text, date, boolean, boolean);

create or replace function public.create_card(p_board_id uuid, p_version bigint, p_column_id uuid, p_title text, p_description text default '', p_due_date date default null, p_priority text default 'none') returns uuid
language plpgsql security invoker set search_path = '' as $$
declare card_id uuid;
begin
  perform private.lock_board(p_board_id, p_version);
  if not exists (select 1 from public.columns where id = p_column_id and board_id = p_board_id) then raise exception 'Column unavailable' using errcode = 'PT404'; end if;
  insert into public.cards (board_id, column_id, title, description, due_date, priority, position)
  select p_board_id, p_column_id, trim(p_title), p_description, p_due_date, p_priority, coalesce(max(position) + 1, 0) from public.cards where column_id = p_column_id
  returning id into card_id;
  return card_id;
end;
$$;

create or replace function public.save_card(p_board_id uuid, p_version bigint, p_card_id uuid, p_title text, p_description text, p_due_date date, p_completed boolean, p_archived boolean, p_priority text default null) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version);
  update public.cards set title = trim(p_title), description = p_description, due_date = p_due_date, priority = coalesce(p_priority, priority),
    completed_at = case when p_completed then coalesce(completed_at, now()) else null end,
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_card_id and board_id = p_board_id;
  if not found then raise exception 'Card unavailable' using errcode = 'PT404'; end if;
end;
$$;


revoke all on function public.create_card(uuid, bigint, uuid, text, text, date, text) from public, anon;
revoke all on function public.save_card(uuid, bigint, uuid, text, text, date, boolean, boolean, text) from public, anon;
grant execute on function public.create_card(uuid, bigint, uuid, text, text, date, text) to authenticated;
grant execute on function public.save_card(uuid, bigint, uuid, text, text, date, boolean, boolean, text) to authenticated;
