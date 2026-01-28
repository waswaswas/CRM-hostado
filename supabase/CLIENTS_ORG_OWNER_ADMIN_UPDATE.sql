-- Allow org owners and admins to update (including soft-delete) clients in their org.
-- Keeps existing "Users can update their own clients" (owner_id = auth.uid()); this adds
-- (org member role in owner/admin AND client.organization_id = org).
-- Safe to run multiple times.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'org_owner_admin_update_clients'
  ) then
    execute 'alter table public.clients enable row level security';
    execute $pol$
      create policy org_owner_admin_update_clients
      on public.clients
      for update
      using (
        organization_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.organization_id = clients.organization_id
            and om.user_id = auth.uid()
            and om.is_active = true
            and om.role in ('owner', 'admin')
        )
      )
    $pol$;
  end if;
end
$$;
