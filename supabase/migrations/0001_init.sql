-- Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

-- Links a Supabase auth user 1:1 to their Circle User-Controlled Wallet.
create table public.wallet_accounts (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  circle_wallet_id text,
  wallet_address   text,
  blockchain       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.wallet_accounts enable row level security;

create policy "select own wallet_accounts"
  on public.wallet_accounts for select
  using (auth.uid() = user_id);

create policy "insert own wallet_accounts"
  on public.wallet_accounts for insert
  with check (auth.uid() = user_id);

create policy "update own wallet_accounts"
  on public.wallet_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Append-only history of raw Borrow Kit call responses, scoped per user.
create table public.activity_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label      text not null,
  data       jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_user_id_created_at_idx
  on public.activity_log (user_id, created_at desc);

alter table public.activity_log enable row level security;

create policy "select own activity_log"
  on public.activity_log for select
  using (auth.uid() = user_id);

create policy "insert own activity_log"
  on public.activity_log for insert
  with check (auth.uid() = user_id);

-- No update/delete policy: this is an append-only audit log. The app's
-- "Clear" button only clears the local view, not these rows.
