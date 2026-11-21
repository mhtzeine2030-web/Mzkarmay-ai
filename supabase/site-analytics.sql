-- MZKarmay AI website visit analytics
create table if not exists public.site_analytics (
  pathname text primary key,
  visits bigint not null default 0 check (visits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.site_analytics enable row level security;

create or replace function public.increment_site_visit(p_pathname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pathname is null or p_pathname !~ '^sites/[0-9a-f-]+\.html$' then
    return;
  end if;

  if not exists (
    select 1 from public.user_projects
    where published_pathname = p_pathname
  ) then
    return;
  end if;

  insert into public.site_analytics(pathname, visits, updated_at)
  values (p_pathname, 1, now())
  on conflict (pathname)
  do update set visits = public.site_analytics.visits + 1,
                updated_at = now();
end;
$$;

revoke all on function public.increment_site_visit(text) from public;
grant execute on function public.increment_site_visit(text) to anon, authenticated;

create or replace function public.get_my_site_analytics()
returns table(project_id uuid, title text, pathname text, visits bigint)
language sql
security definer
set search_path = public
as $$
  select p.id, p.title, p.published_pathname,
         coalesce(a.visits, 0)::bigint
  from public.user_projects p
  left join public.site_analytics a
    on a.pathname = p.published_pathname
  where p.user_id = auth.uid()
    and p.published_pathname is not null
  order by p.title;
$$;

revoke all on function public.get_my_site_analytics() from public;
grant execute on function public.get_my_site_analytics() to authenticated;
