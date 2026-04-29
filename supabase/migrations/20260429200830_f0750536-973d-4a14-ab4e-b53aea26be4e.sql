create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_cookie_id text not null,
  fingerprint text,
  ip text,
  user_agent text,
  label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists trusted_devices_user_cookie_uidx
  on public.trusted_devices (user_id, device_cookie_id);

create index if not exists trusted_devices_user_fp_idx
  on public.trusted_devices (user_id, fingerprint);

alter table public.trusted_devices enable row level security;

create policy "Trusted devices owner select"
  on public.trusted_devices for select
  using (auth.uid() = user_id);

create policy "Trusted devices owner insert"
  on public.trusted_devices for insert
  with check (auth.uid() = user_id);

create policy "Trusted devices owner delete"
  on public.trusted_devices for delete
  using (auth.uid() = user_id);

create policy "Trusted devices admin select"
  on public.trusted_devices for select
  using (has_role(auth.uid(), 'admin'::app_role));