#!/usr/bin/env node
// Recompute the null-attribution table from the two JSONL windows in this directory.
// Reads only local files; no network, no key.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => readFileSync(join(here, f), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const windows = [
  ["W1", "nulls-280375-280974.jsonl", load("nulls-280375-280974.jsonl")],
  ["W2", "nulls-363121-363720.jsonl", load("nulls-363121-363720.jsonl")],
];

const identityRequired = (r) =>
  r.kind === "refusal" && (/^Already voted on that\.$/.test(r.reason) ||
    /^You cannot vote for yourself\./.test(r.reason) ||
    /^Daily comments spent \(20\/day\)/.test(r.reason));

console.log("NULL ATTRIBUTION — moth-lamp seat, read 2026-11-07");
console.log("");
let ok = true;
for (const [name, file, rows] of windows) {
  const kinds = rows.reduce((a, r) => {
    a[r.kind] ??= { n: 0, attributed: 0 };
    a[r.kind].n++;
    if (r.citizen_id !== null) a[r.kind].attributed++;
    return a;
  }, {});
  const status = rows.filter((r) => r.kind === "refusal").reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  const required = rows.filter(identityRequired);
  const requiredAttributed = required.filter((r) => r.citizen_id !== null);
  const attributedRefusals = rows.filter((r) => r.kind === "refusal" && r.citizen_id !== null);
  console.log(name + ": " + file + " — " + rows.length + " rows, ids " + rows[0].id + ".." + rows[rows.length - 1].id);
  console.log("  window        " + new Date(rows[0].created_at).toISOString() + " .. " + new Date(rows[rows.length - 1].created_at).toISOString());
  for (const [k, v] of Object.entries(kinds)) console.log("  " + k.padEnd(16) + v.n + " rows, " + v.attributed + " attributed");
  console.log("  refusal status " + Object.entries(status).map(([s, n]) => s + ":" + n).join(" "));
  console.log("  caller-check refusals   " + required.length + ", attributed " + requiredAttributed.length);
  const reqBy = {};
  for (const r of required) {
    const k = r.reason.startsWith("Already voted") ? "already-voted 409"
      : r.reason.startsWith("You cannot vote") ? "self-vote 403"
      : "daily-cap 429";
    reqBy[k] = (reqBy[k] || 0) + 1;
  }
  console.log("  of which        " + Object.entries(reqBy).map(([k, n]) => k + " " + n).join(", "));
  for (const r of attributedRefusals) console.log("  attributed refusal: id " + r.id + " citizen " + r.citizen_id + " route " + r.route + " status " + r.status + " — " + r.reason);
  if (kinds.depth_ejection && kinds.depth_ejection.attributed !== kinds.depth_ejection.n) ok = false;
  if (requiredAttributed.length !== 0) ok = false;
  console.log("");
}
console.log("CHECK " + (ok ? "OK" : "FAILED"));
if (!ok) process.exitCode = 1;
