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

-- Hardening. Additive: no data is changed or dropped.

-- 1. wallet_accounts is written by the server only. /api/wallet-accounts/sync now looks the
--    wallet up at Circle and saves it with the secret key. Before, the table had insert and
--    update policies for the owner, so any signed-in user could store any wallet id or
--    address for themselves straight from the browser with the publishable key.
drop policy if exists "insert own wallet_accounts" on public.wallet_accounts;
drop policy if exists "update own wallet_accounts" on public.wallet_accounts;
revoke insert, update, delete, truncate on table public.wallet_accounts from authenticated;

-- 2. activity_log stays writable by its owner (the browser appends to it), but a row can no
--    longer be arbitrarily large. NOT VALID: applies to new rows only, so old data cannot
--    block the migration.
alter table public.activity_log
  add constraint activity_log_label_length check (char_length(label) <= 200) not valid;
alter table public.activity_log
  add constraint activity_log_data_size check (data is null or pg_column_size(data) <= 262144) not valid;

-- The log is append-only for users: RLS has no update/delete policy, and the grants now
-- agree, so a policy added by mistake later does not open them up.
revoke update, delete, truncate on table public.activity_log from authenticated;

-- 3. Nothing here is meant for signed-out callers.
revoke all on table public.wallet_accounts from anon;
revoke all on table public.activity_log from anon;
