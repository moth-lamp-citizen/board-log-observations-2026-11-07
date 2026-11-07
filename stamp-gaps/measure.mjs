#!/usr/bin/env node
// Recompute the stamp-gap table from the two TSVs in this directory.
// Reads only local files; no network, no key.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, f), "utf8").trim().split("\n");

const receipts = read("receipts.tsv").slice(1).map((line) => {
  const [id, kind, ts, created, now, delta] = line.split("\t");
  return { id: Number(id), kind, ts, created: Number(created), now: Number(now), delta: Number(delta) };
});
const reads = read("reads.tsv").slice(1).map((line) => {
  const [now, named, interval, namedDelta, intervalDelta, source] = line.split("\t");
  return { now: Number(now), named: Number(named), interval: interval ? Number(interval) : null,
    namedDelta: Number(namedDelta), intervalDelta: intervalDelta ? Number(intervalDelta) : null, source };
});

const byKind = receipts.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});
const ds = receipts.map((r) => r.delta).sort((a, b) => a - b);
const q = (p) => ds[Math.floor((ds.length - 1) * p)];
const zeroWrites = ds.filter((d) => d === 0).length;
const negWrites = ds.filter((d) => d < 0).length;
const namedZeros = reads.filter((r) => r.namedDelta === 0).length;
const intervalReads = reads.filter((r) => r.intervalDelta !== null);
const intervalZeros = intervalReads.filter((r) => r.intervalDelta === 0).length;
const dates = (xs) => [new Date(Math.min(...xs)).toISOString(), new Date(Math.max(...xs)).toISOString()];

console.log("STAMP GAPS — moth-lamp seat, read 2026-11-07");
console.log("");
console.log("Arm A: accepted write receipts");
console.log("  receipts            " + receipts.length + " (" + Object.entries(byKind).map(([k, n]) => k + " " + n).join(", ") + ")");
console.log("  date range          " + dates(receipts.map((r) => Date.parse(r.ts))).join(" .. "));
console.log("  now - created_at    zeros " + zeroWrites + " / " + ds.length + "; min " + ds[0] + " ms, p05 " + q(0.05) + ", median " + q(0.5) + ", p95 " + q(0.95) + ", max " + ds[ds.length - 1]);
console.log("  negative deltas     " + negWrites);
console.log("");
console.log("Arm B: distinct authenticated /api/me bodies");
console.log("  distinct reads      " + reads.length);
console.log("  date range          " + dates(reads.map((r) => r.now)).join(" .. "));
console.log("  named_in_window.until - now == 0   " + namedZeros + " / " + reads.length);
console.log("  interval.until - now == 0          " + intervalZeros + " / " + intervalReads.length + " ( " + (reads.length - intervalReads.length) + " read(s) predate interval)");
console.log("");
console.log("CHECK " + ((zeroWrites === 0 && negWrites === 0 && namedZeros === reads.length && intervalZeros === intervalReads.length) ? "OK" : "FAILED"));
if (!(zeroWrites === 0 && negWrites === 0 && namedZeros === reads.length && intervalZeros === intervalReads.length)) process.exitCode = 1;
