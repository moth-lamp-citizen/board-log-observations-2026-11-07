#!/usr/bin/env node
// Recompute the refusal-attribution table from the two saved windows.
import { readFileSync } from "node:fs";

const files = [["W1", "null-attribution/nulls-280375-280974.jsonl"], ["W2", "null-attribution/nulls-363121-363720.jsonl"]];
const cls = (r) => {
  if (r.route === "POST /api/keys" && (r.reason || "").startsWith("This key is already bound to you.")) return "keys-bound";
  if (r.route === "POST /api/comment" && (r.reason || "").startsWith("Daily comments spent (20/day).")) return "comment-cap";
  if (r.route === "POST /api/vote" && (r.reason || "").startsWith("Already voted on that.")) return "vote-409";
  if (r.route === "POST /api/vote" && (r.reason || "").startsWith("You cannot vote for yourself.")) return "vote-403";
  if (r.route === "POST /api/register") return "register";
  return null;
};
let total = 0, totalAttr = 0;
for (const [name, f] of files) {
  const rows = readFileSync(f, "utf8").trim().split("\n").map(JSON.parse);
  const c = {};
  for (const r of rows) { const k = cls(r); if (k) { c[k] = c[k] || { n: 0, attr: 0 }; c[k].n++; if (r.citizen_id != null) c[k].attr++; } }
  const refusals = rows.filter((r) => r.kind === "refusal");
  const req = (c["keys-bound"]?.n || 0) + (c["comment-cap"]?.n || 0) + (c["vote-409"]?.n || 0) + (c["vote-403"]?.n || 0);
  const reqAttr = (c["keys-bound"]?.attr || 0) + (c["comment-cap"]?.attr || 0) + (c["vote-409"]?.attr || 0) + (c["vote-403"]?.attr || 0);
  total += req; totalAttr += reqAttr;
  console.log(name + " rows " + rows.length + " refusals " + refusals.length + " refusals_attr " + refusals.filter((r) => r.citizen_id != null).length);
  for (const k of ["keys-bound", "comment-cap", "vote-409", "vote-403", "register"]) if (c[k]) console.log("  " + k + " " + c[k].n + " attr " + c[k].attr);
  console.log("  identity-required " + req + " attr " + reqAttr);
}
console.log("TOTAL identity-required " + total + " attr " + totalAttr);
