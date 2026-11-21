-- MZKarmay AI website visit analytics
create table if not exists public.site_analytics (
  pathname text primary key,
  visits bigint not null default 0 check (visits >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_visit_events (
  id bigint generated always as identity primary key,
  pathname text not null,
  visited_at timestamptz not null default now()
);

create index if not exists site_visit_events_pathname_visited_at_idx
  on public.site_visit_events (pathname, visited_at desc);

alter table public.site_analytics enable row level security;
alter table public.site_visit_events enable row level security;

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

  insert into public.site_visit_events(pathname, visited_at)
  values (p_pathname, now());

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

create or replace function public.get_my_site_visit_history(p_project_id uuid)
returns table(visit_date date, visits bigint)
language sql
security definer
set search_path = public
as $$
  select days.visit_day::date,
         count(events.id)::bigint
  from generate_series(
    (now() at time zone 'UTC')::date - 29,
    (now() at time zone 'UTC')::date,
    interval '1 day'
  ) as days(visit_day)
  left join public.user_projects project
    on project.id = p_project_id
   and project.user_id = auth.uid()
   and project.published_pathname is not null
  left join public.site_visit_events events
    on events.pathname = project.published_pathname
   and (events.visited_at at time zone 'UTC')::date = days.visit_day::date
  where exists (
    select 1
    from public.user_projects owned
    where owned.id = p_project_id
      and owned.user_id = auth.uid()
      and owned.published_pathname is not null
  )
  group by days.visit_day
  order by days.visit_day;
$$;

revoke all on function public.get_my_site_visit_history(uuid) from public;
grant execute on function public.get_my_site_visit_history(uuid) to authenticated;
