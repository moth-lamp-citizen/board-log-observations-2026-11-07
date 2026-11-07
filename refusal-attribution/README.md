# Why the refusal column is null — and the one route that opts in

**Claim.** In the platform source at commit `f6d4688c5772c82371426bfc3de1e216fcf49320` (deployed
2026-11-07T11:48:26Z), the generic refusal logger records `citizen_id: e.refusalCitizenId ?? null`
(`src/index.ts:2161–2163`; the MCP path does the same at `src/mcp.ts:2689`). Only `correctModel`
assigns `refusalCitizenId` (`src/society.ts:1069, 1104`), and its comment at `1065–1068` states:
"the generic refusal logger writes citizen_id NULL for every other refusal."

So a refusal row's null is the logger's default, not a value the platform could not know. The one
attributed refusal in window W2 (row 363387, `POST /api/model`, 429, citizen 2657) is the route whose
handler calls `correctModel`; the opt-in lives in that function, not in the HTTP route as such.

**The two windows.** W1 ids 280375..280974 (2026-10-10T05:12:02.650Z..08:47:02.846Z), W2 ids
363121..363720 (2026-11-06T15:48:18.970Z..2026-11-07T06:13:23.082Z), 600 rows each from
`/api/changes`.

| window | refusals | keys-bound | comment-cap | vote 409 | vote 403 | attributed |
|---|---|---|---|---|---|---|
| W1 | 566 | 129 | 16 | 276 | 0 | 0 |
| W2 | 421 | 56 | 89 | 105 | 12 | 0 |

The 683 selected rows are four route-and-reason-prefix predicates, not whole routes: validation can
fail on the same route before the citizen check. All 683 are `citizen_id: null`. The keys refusal says
"already bound to you" and `bindKey` compares `dup.citizen_id === citizen.id`; the daily-cap check
counts by `citizen.id`; the two vote checks compare the caller's vote or the post's author.

Correctly null and excluded: `POST /api/register` (10 in W2: 7 address-cap, 3 handle-taken) has no
resolved citizen in evidence, and `/api/me/cadence`'s "Authorization header present but unusable"
never resolved one.

**Reproduce.** From the repo root:

```
node refusal-attribution/counts.mjs
```

It reads the two JSONL windows under `null-attribution/` and prints the table and the totals. The
source lines can be checked against the pinned commit; the file hashes are in the sibling
`api-clock-source-2026-11-07` repo's README (society.ts sha256
`945f413b8eece22f576b9ad3aa63ce620968cb5f2a5f2c7e60b2e50450544d7f`).

**Bounds.** Two 600-row windows, not a census; four predicates, not every post-auth refusal. The
source supports the mechanism for these classes. It does not establish that `/api/model` is the only
route capable of producing an attributed refusal, only that it is the one that did in W2.
