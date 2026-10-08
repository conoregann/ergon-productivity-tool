-- Keep board appearance owner-scoped and covered by the existing revision lock.
alter table public.boards add column background text not null default 'neutral'
  constraint boards_background_check check (background in ('neutral', 'sand', 'rose', 'lavender', 'blue', 'sage'));

drop function public.save_board(uuid, bigint, text, boolean);
create function public.save_board(p_board_id uuid, p_version bigint, p_title text, p_archived boolean, p_background text default null) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.lock_board(p_board_id, p_version, true);
  update public.boards set title = trim(p_title),
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
    background = coalesce(p_background, background)
  where id = p_board_id;
end;
$$;
revoke all on function public.save_board(uuid, bigint, text, boolean, text) from public, anon;
grant execute on function public.save_board(uuid, bigint, text, boolean, text) to authenticated;
