-- Extend the existing owner-scoped board background presets.
alter table public.boards drop constraint boards_background_check;
alter table public.boards add constraint boards_background_check
  check (background in ('neutral', 'sand', 'rose', 'lavender', 'blue', 'sage', 'forest', 'orange', 'gold', 'teal', 'grey'));
