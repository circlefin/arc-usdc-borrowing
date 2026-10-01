/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export type ActivityStatus = "success" | "warn" | "pending" | "error";

export interface ActivityChip {
  label: string;
  value: string;
  tone?: ActivityStatus;
}

export interface ActivitySummary {
  status: ActivityStatus;
  headline?: string;
  chips: ActivityChip[];
}

interface AssetAmount {
  token: string;
  amount: string;
}

interface Fee {
  type: string;
  token: string;
  amount: AssetAmount;
}

const BAND_TONE: Record<string, ActivityStatus> = {
  SAFE: "success",
  WARN: "warn",
  URGENT: "warn",
  IMMINENT: "error",
  LIQUIDATABLE: "error",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAssetAmount(v: unknown): v is AssetAmount {
  return (
    isRecord(v) &&
    typeof v.token === "string" &&
    typeof v.amount === "string" &&
    typeof v.decimals === "number"
  );
}

function isFee(v: unknown): v is Fee {
  return isRecord(v) && typeof v.type === "string" && isAssetAmount(v.amount);
}

function isAsyncActionError(v: unknown): v is { title: string; detail?: string; retryable: boolean } {
  return isRecord(v) && typeof v.title === "string" && typeof v.retryable === "boolean";
}

function isMarketAsset(v: unknown): v is { symbol: string } {
  return isRecord(v) && typeof v.symbol === "string";
}

/** camelCase -> "Camel case" */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Walk an object/array looking for BorrowKit's recurring shapes (asset amounts, fees) and turn them into chips. */
function collectChips(value: unknown, path: string[], depth: number, out: ActivityChip[]) {
  if (out.length >= 6 || depth > 3 || value == null) return;

  if (isFee(value)) {
    out.push({ label: `Fee (${value.type})`, value: `${value.amount.amount} ${value.amount.token}` });
    return;
  }
  if (isAssetAmount(value)) {
    const key = path[path.length - 1] ?? "amount";
    out.push({ label: humanizeKey(key), value: `${value.amount} ${value.token}` });
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, i) => collectChips(item, [...path, String(i)], depth + 1, out));
    return;
  }
  if (isRecord(value)) {
    for (const [key, v] of Object.entries(value)) {
      if (key === "resultingBand" || key === "healthFactorBand") {
        if (typeof v === "string") {
          out.push({ label: "Health", value: v, tone: BAND_TONE[v] });
        }
        continue;
      }
      collectChips(v, [...path, key], depth + 1, out);
      if (out.length >= 6) return;
    }
  }
}

/** Turns a raw Borrow Kit response (or a parsed error) into a short, human summary for the activity log. */
export function summarizeEntry(label: string, data: unknown): ActivitySummary {
  if (isAsyncActionError(data)) {
    return {
      status: "error",
      headline: data.title,
      chips: data.detail ? [{ label: "Detail", value: data.detail }] : [],
    };
  }

  if (!isRecord(data)) {
    return { status: label.endsWith("— error") ? "error" : "success", chips: [] };
  }

  if (Array.isArray(data.markets)) {
    const markets = data.markets as Record<string, unknown>[];
    const first = markets[0];
    const pair =
      first && isMarketAsset(first.collateralAsset) && isMarketAsset(first.loanAsset)
        ? `${first.collateralAsset.symbol}/${first.loanAsset.symbol}` +
          (typeof first.lltv === "number" ? ` — ${Math.round(first.lltv * 100)}% LLTV` : "")
        : undefined;
    return {
      status: "success",
      headline: `${markets.length} market${markets.length === 1 ? "" : "s"}${pair ? ` (${pair})` : ""}`,
      chips: [],
    };
  }

  if (Array.isArray(data.loans)) {
    const loans = data.loans as unknown[];
    return {
      status: "success",
      headline: `${loans.length} loan${loans.length === 1 ? "" : "s"}`,
      chips: [],
    };
  }

  let status: ActivityStatus = "success";
  if (data.status === "confirmed") status = "success";
  else if (data.status === "confirmed-details-unavailable") status = "warn";
  else if (data.status === "submitted") status = "pending";

  const chips: ActivityChip[] = [];
  collectChips(data, [], 0, chips);

  if (typeof data.loanId === "string") {
    chips.push({ label: "Loan", value: `${data.loanId.slice(0, 8)}…` });
  }
  if (typeof data.txHash === "string") {
    chips.push({ label: "Tx", value: `${data.txHash.slice(0, 10)}…` });
  }

  return { status, chips: chips.slice(0, 6) };
}
