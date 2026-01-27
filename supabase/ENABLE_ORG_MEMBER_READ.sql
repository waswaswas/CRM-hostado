-- Enable org-member read access for shared records.
-- Safe to run multiple times.

do $$
begin
  -- Clients
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'org_member_read_clients'
  ) then
    execute 'alter table public.clients enable row level security';
    execute $pol$
      create policy org_member_read_clients
      on public.clients
      for select
      using (
        (
          organization_id is not null
          and exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = clients.organization_id
              and organization_members.user_id = auth.uid()
              and organization_members.is_active = true
          )
        )
        or (organization_id is null and owner_id = auth.uid())
      )
    $pol$;
  end if;

  -- Accounts
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'accounts' and policyname = 'org_member_read_accounts'
  ) then
    execute 'alter table public.accounts enable row level security';
    execute $pol$
      create policy org_member_read_accounts
      on public.accounts
      for select
      using (
        (
          organization_id is not null
          and exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = accounts.organization_id
              and organization_members.user_id = auth.uid()
              and organization_members.is_active = true
          )
        )
        or (organization_id is null and owner_id = auth.uid())
      )
    $pol$;
  end if;

  -- Transactions
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transactions' and policyname = 'org_member_read_transactions'
  ) then
    execute 'alter table public.transactions enable row level security';
    execute $pol$
      create policy org_member_read_transactions
      on public.transactions
      for select
      using (
        (
          organization_id is not null
          and exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = transactions.organization_id
              and organization_members.user_id = auth.uid()
              and organization_members.is_active = true
          )
        )
        or (organization_id is null and owner_id = auth.uid())
      )
    $pol$;
  end if;

  -- Accounting customers
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'accounting_customers' and policyname = 'org_member_read_accounting_customers'
  ) then
    execute 'alter table public.accounting_customers enable row level security';
    execute $pol$
      create policy org_member_read_accounting_customers
      on public.accounting_customers
      for select
      using (
        (
          organization_id is not null
          and exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = accounting_customers.organization_id
              and organization_members.user_id = auth.uid()
              and organization_members.is_active = true
          )
        )
        or (organization_id is null and owner_id = auth.uid())
      )
    $pol$;
  end if;

  -- Reminders
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders' and policyname = 'org_member_read_reminders'
  ) then
    execute 'alter table public.reminders enable row level security';
    execute $pol$
      create policy org_member_read_reminders
      on public.reminders
      for select
      using (
        organization_id is not null
        and exists (
          select 1
          from public.organization_members
          where organization_members.organization_id = reminders.organization_id
            and organization_members.user_id = auth.uid()
            and organization_members.is_active = true
        )
      )
    $pol$;
  end if;

  -- Offers
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'offers' and policyname = 'org_member_read_offers'
  ) then
    execute 'alter table public.offers enable row level security';
    execute $pol$
      create policy org_member_read_offers
      on public.offers
      for select
      using (
        (
          organization_id is not null
          and exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = offers.organization_id
              and organization_members.user_id = auth.uid()
              and organization_members.is_active = true
          )
        )
        or (organization_id is null and owner_id = auth.uid())
      )
    $pol$;
  end if;
end $$;
