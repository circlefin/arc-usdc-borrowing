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

import { Fragment } from "react";

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Minimal JSON tokenizer — colors keys, strings, numbers and literals. No dependencies. */
export function JsonHighlight({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2) ?? "undefined";
  const nodes: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(TOKEN)) {
    const [match, str, colon, literal, num] = m;
    const start = m.index;
    if (start > last) nodes.push(text.slice(last, start));
    last = start + match.length;

    if (str && colon) {
      nodes.push(
        <Fragment key={start}>
          <span className="text-sky-600 dark:text-sky-400">{str}</span>
          {colon}
        </Fragment>,
      );
    } else if (str) {
      nodes.push(
        <span key={start} className="text-emerald-600 dark:text-emerald-400">
          {str}
        </span>,
      );
    } else if (literal) {
      nodes.push(
        <span key={start} className="text-violet-600 dark:text-violet-400">
          {literal}
        </span>,
      );
    } else {
      nodes.push(
        <span key={start} className="text-amber-600 dark:text-amber-400">
          {num}
        </span>,
      );
    }
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <>{nodes}</>;
}
