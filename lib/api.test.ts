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

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, postJson } from "@/lib/api";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postJson", () => {
  it("returns the parsed body on success", async () => {
    mockFetchOnce(200, { hello: "world" });
    await expect(postJson("/api/whatever", {})).resolves.toEqual({ hello: "world" });
  });

  it("throws an ApiError carrying the KitError fields on failure", async () => {
    mockFetchOnce(500, {
      message: "the Circle user has not completed wallet setup yet",
      code: 1098,
      name: "InputValidationFailed",
      type: "INPUT",
      recoverability: "FATAL",
    });

    const err = (await postJson("/api/borrow/loans", {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    // The bug this guards against: ApiError.message must stay a real string,
    // never the object itself, or callers rendering `error.message` show
    // "[object Object]" instead of the actual reason.
    expect(err.message).toBe("the Circle user has not completed wallet setup yet");
    expect(err.code).toBe(1098);
  });

  it("carries the HTTP status on ApiError, so callers can distinguish e.g. a transient 401", async () => {
    mockFetchOnce(401, { message: "Not authenticated" });
    const err = (await postJson("/api/pin/setup", {}).catch((e) => e)) as ApiError;
    expect(err.status).toBe(401);
  });

  it("falls back to a generic message when the error response body is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 503,
        ok: false,
        text: () => Promise.resolve(""),
      }),
    );

    const err = (await postJson("/api/whatever", {}).catch((e) => e)) as Error;
    expect(err.message).toBe("Request failed (503)");
  });

  it("throws a plain Error (not ApiError) when the response body isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        text: () => Promise.resolve("<html>Internal Server Error</html>"),
      }),
    );

    const err = (await postJson("/api/whatever", {}).catch((e) => e)) as Error;
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err.message).toContain("Non-JSON from /api/whatever (500)");
  });
});
