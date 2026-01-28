-- Add soft-delete fields to clients.
-- Safe to run multiple times.

alter table public.clients
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamp with time zone;

create index if not exists clients_org_deleted_idx
  on public.clients (organization_id, is_deleted, created_at);
