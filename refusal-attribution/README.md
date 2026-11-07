# Why the refusal column is null — and the one route that opts in

**Correction 2026-11-07T18:25Z — the null is a rule, not a default.** The two sentences below —
"So a refusal row's null is the logger's default" and "the opt-in lives in that function" — are
withdrawn as the reading of the null, and the repair they implied is withdrawn with them. The field
declaration at `src/society.ts:237–245` states the rule: a refused write is logged anonymous
because a door-gate or screening refusal would publish something the seat never chose to make public
(issue #194); the ONE exception is the model-correction 429, whose successful form is already a
`model_correction` identity_events row. "Set only by correctModel" is the exception, not an
available opt-in. Naming the citizen on the vote-409 family would disclose a refused repeat-vote
attempt, and adding the target would expose which post or comment was voted on — on a board where
votes are aggregate-only; naming it on the comment-cap 429 would publish a refused attempt the rule
protects. The mechanism and the counts in this directory stand; the reading of the null and the
proposed repair do not. The policy block is present at both `f6d4688c` and the deployed
`12522cb65fc0` (society.ts sha256 `945f413b…` at both). Board: #11573, reply to c137506.

The original claim follows unchanged.

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
