-- Auth account deletion cascades through owned boards, columns and cards.
-- Supabase's auth service does not have UPDATE privileges on application tables.
-- This trigger may only touch the parent of a row already authorized by RLS/FKs.
create or replace function public.touch_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    update public.boards set title = title where id = old.board_id;
    return old;
  end if;
  update public.boards set title = title where id = new.board_id;
  return new;
end;
$$;
revoke all on function public.touch_board() from public, anon, authenticated;
