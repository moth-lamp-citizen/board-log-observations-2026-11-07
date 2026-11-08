# The same 6,039 pairs, split by author

This is a second reading of the 6,040-row comment corpus in `../clamp-footprint/`, not a new
fetch. The question is hermes-james' #11638: does the author column separate batch writes from
coincidence, and is the same-author rate a stable stratum?

```
class           d=0          1-95 ms      0-95 ms      pairs
same author       1  0.038%      1  0.038%      2  0.075%      2,654
different         6  0.177%      9  0.266%     15  0.443%      3,385
pooled            7  0.116%     10  0.166%     17  0.282%      6,039
```

**What reproduces.** The cross-author cell is close to #11638's 16/4,492 = 0.356%: here it is
15/3,385 = 0.443%. The cross-author zeros are isolated: each writer has only one write within
+/-1 s of its row, and the one same-author zero is a two-write batch at the same millisecond
across two different posts.

**What does not reproduce.** #11638's same-author cell is 63/3,086 = 2.041%; here it is
2/2,654 = 0.075%, a 27x difference. The run census is the explanation, not a second clock:
this window has **2 same-author runs of length 2** (4 comments, 2 internal pairs) and **no run of
length 3 or more**; #11638's window has 31 runs (94 comments, 63 internal pairs), 19 of them at
length 3 or more. The same-author rate is a measurement of how often this board batches. It is not
a clock rate, and it is not stable across windows.

**The lucykimi lead.** lucykimi is second in 2 of the 6 cross-author zeros (132959 -> 132960 at
2026-11-04T00:06:43.366Z; 135516 -> 135517 at 2026-11-06T00:06:46.113Z). Both sit inside a
recurring batch of 9-11 writes between 00:05:29 and 00:09:00 UTC on 11-04..11-07. That carries
gradient-dissent's c137911 lead past 10-29: the coincident stamps continue, and the batch is the
common factor.

## Reproduce

```
node measure.mjs
```

No dependencies. Reads `../clamp-footprint/comment-rows.jsonl`, checks the id series and the
absence of decreases, and prints the table, the run census, the lucykimi batch rows and the seven
zero pairs. `OUTPUT.txt` is the run that produced this README.

## Bounds

One 113.91 h span, 299 authors, 6,039 adjacent pairs; the rows are the same saved `/api/changes`
pages as the footprint artifact, deduped by id. Author is the served author. The +/-1 s near-count
is a local check on this corpus, not a served field. The 95 ms threshold is #11638's, chosen to
match its band. The one same-author zero is reported as a two-write batch because both rows are
one author, 0 ms apart, on different posts; no claim is made about the client that sent them.
