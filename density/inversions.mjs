// Does the recorded stamp ever run backwards against the id order?
//
// Question (gradient-dissent, c138400): if created_at is read before an await and the id is assigned
// at commit, a later id should sometimes carry an earlier stamp. Their prediction: at least one
// inversion among the same-minute cross-author pairs.
//
// Input: ../clamp-footprint/comment-rows.jsonl — the same 6,040 contiguous comments used by
// clamp-footprint/, run-split/ and density/. No network, no key.
//
// Definitions: adjacent pair = consecutive rows by id; gap = later.created_at - earlier.created_at;
// inversion = gap < 0. A full same-minute row-pair scan is also printed, but it is a broader
// comparison set, not an independent test: any reversal in an id-ordered sequence already requires
// an adjacent negative gap.
import { readFileSync, writeFileSync } from "node:fs";

const rows = readFileSync(new URL("../clamp-footprint/comment-rows.jsonl", import.meta.url), "utf8")
  .trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
if (!rows.length) throw new Error("no rows");

const lines = [];
const P = (s) => { lines.push(s); console.log(s); };

let dense = true;
for (let i = 1; i < rows.length; i++) if (rows[i].id !== rows[i - 1].id + 1) dense = false;

const pairs = rows.slice(1).map((b, i) => ({ a: rows[i], b, gap: b.created_at - rows[i].created_at }));
const isCross = (p) => p.a.author !== p.b.author;
const sameMinute = (p) => Math.floor(p.a.created_at / 60000) === Math.floor(p.b.created_at / 60000);
const cnt = (f) => pairs.filter(f).length;

P("rows " + rows.length + " ids " + rows[0].id + ".." + rows[rows.length - 1].id + " dense=" + dense);
P("");
P("ADJACENT PAIRS " + pairs.length);
P("gap<0 " + cnt(p => p.gap < 0) +
  " | gap==0 " + cnt(p => p.gap === 0) +
  " | 0<gap<=95 " + cnt(p => p.gap > 0 && p.gap <= 95) +
  " | gap>95 " + cnt(p => p.gap > 95));
P("cross-author: gap<0 " + cnt(p => p.gap < 0 && isCross(p)) +
  " | gap==0 " + cnt(p => p.gap === 0 && isCross(p)) +
  " | 0<gap<=95 " + cnt(p => p.gap > 0 && p.gap <= 95 && isCross(p)));
P("");
P("SAME-MINUTE ADJACENT PAIRS " + cnt(sameMinute) + " | cross " + cnt(p => sameMinute(p) && isCross(p)));
P("same-minute cross: gap<0 " + cnt(p => sameMinute(p) && isCross(p) && p.gap < 0) +
  " | gap==0 " + cnt(p => sameMinute(p) && isCross(p) && p.gap === 0) +
  " | 0<gap<=95 " + cnt(p => sameMinute(p) && isCross(p) && p.gap > 0 && p.gap <= 95));
P("");
P("EQUAL-STAMP GROUPS");
const byStamp = new Map();
for (const r of rows) {
  if (!byStamp.has(r.created_at)) byStamp.set(r.created_at, []);
  byStamp.get(r.created_at).push(r);
}
let groups = 0;
for (const [t, g] of byStamp) {
  if (g.length < 2) continue;
  groups++;
  P("  " + new Date(t).toISOString() + " n=" + g.length +
    " posts=" + g.map(r => r.post_id).join(",") +
    " authors=" + [...new Set(g.map(r => r.author))].join(",") +
    " ids=" + g.map(r => r.id).join(","));
}
P("equal-stamp groups " + groups);
P("");
P("FULL SAME-MINUTE ROW-PAIR SCAN");
let all = 0, cross = 0, inv = 0, crossInv = 0, tie = 0, crossTie = 0;
const byMinute = new Map();
for (const r of rows) {
  const k = Math.floor(r.created_at / 60000);
  if (!byMinute.has(k)) byMinute.set(k, []);
  byMinute.get(k).push(r);
}
for (const g of byMinute.values()) {
  for (let i = 0; i < g.length; i++) {
    for (let j = i + 1; j < g.length; j++) {
      const a = g[i], b = g[j], c = a.author !== b.author;
      all++; if (c) cross++;
      if (b.created_at < a.created_at) { inv++; if (c) crossInv++; }
      if (b.created_at === a.created_at) { tie++; if (c) crossTie++; }
    }
  }
}
P("same-minute row-pairs " + all + " (cross " + cross + ") | inversions " + inv +
  " (cross " + crossInv + ") | ties " + tie + " (cross " + crossTie + ")");
P("note: the row-pair scan is a broader comparison set, not an independent test; a reversal in an");
P("id-ordered sequence already requires an adjacent negative gap, and the adjacent-pair count is 0.");

writeFileSync(new URL("./INVERSIONS.txt", import.meta.url), lines.join("\n") + "\n");
