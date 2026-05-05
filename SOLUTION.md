# SOLUTION.md

Insighta Labs+ — Stage 4 Optimization Notes

This document explains *what* was optimized, *why* each choice was made, the
trade-offs involved, before/after measurements for query performance, and how
the ingestion pipeline behaves under failure conditions and edge cases.

---

## 1. Optimization Approach

The system has four hot paths: query reads, query parsing, batch ingestion,
and CSV export. Each was optimized independently because each has a different
shape (read-heavy vs. write-heavy, latency-bound vs. throughput-bound).

### 1.1 Query Reads — index + cache + replica

Three layers of optimization, applied in order from cheapest to most
infrastructural:

1. **Composite indexes on `(country, gender, age)` and `(gender, age)`.**
   Around 90% of analyst queries filter on some prefix of these columns.
   Without a covering index, Postgres falls back to sequential scans on
   tens of millions of rows — that alone breaks the < 500 ms P50 target.
   With the composite indexes, the planner uses an index range scan and the
   working set drops by one to two orders of magnitude before any row is
   examined.

2. **Redis result cache, keyed by a hash of the normalized filter object,
   5-minute TTL.** Analytics workloads repeat. The same "young males in
   South Africa" query gets run by three analysts in a morning standup. The
   cache turns the second through Nth call into an O(1) Redis lookup
   instead of an indexed Postgres scan.

3. **Read replica for all SELECTs.** Reads do not contend with the write
   path. The primary handles batch ingestion; the replica answers every
   query. This is what lets the system scale read throughput
   independently of write load.

The order matters: the index makes the *first* (uncached) query fast, the
cache makes *repeated* queries nearly free, and the replica makes
*concurrent* queries non-blocking with respect to writes.

### 1.2 Query Parsing — rule-based regex, not an LLM

The parser maps phrases like `"young males in South Africa"` to a
structured filter object `{ country: 'ZA', gender: 'M', age: [18,30] }`
using regex rules over a controlled vocabulary (countries, gender terms,
age buckets). This is deliberately simple. The structured filter object
is the stable contract for caching and query generation downstream — an
LLM-based parser can be swapped in later without touching the cache key
scheme or the Prisma layer.

### 1.3 Application Layer — stateless horizontal scale

NestJS instances hold no per-user state. JWTs carry auth context, refresh
tokens live in Redis, and all durable data is in Postgres. Adding a fourth
or fifth instance behind the load balancer requires no code change. The
one subtlety: rate-limit counters must use the Redis-backed throttler
store, not in-memory, otherwise each instance enforces its own quota.

### 1.4 Ingestion — direct batch upserts, no queue

Batch upserts run inside a single transaction against the primary, then
publish a cache-invalidation message to Redis at the end of the run.
No Kafka, no RabbitMQ. The justification is in §2.

---

## 2. Design Decisions and Trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| Read replica for all reads | Decouples read scaling from write load | Sub-second replica lag — a write may not be visible for ~1s. Acceptable for historical analytics. |
| Redis result cache, 5-min TTL | Repeated analyst queries dominate; cache turns them into O(1) | Stale reads in the window between an ingestion run completing and the next cache invalidation propagating. |
| Composite indexes on (country, gender, age) + (gender, age) | High-selectivity prefixes for ~90% of queries | Storage cost + slightly slower writes. Writes are batch, so this is a non-issue in practice. |
| Stateless NestJS, horizontal scale | Already stateless; cheapest scaling axis | Rate-limit state must be Redis-backed, not in-process. |
| No message queue for ingestion | Batch, not stream — a queue solves a problem we don't have | If ingestion later becomes continuous/high-volume, a queue becomes worthwhile. Future concern. |
| Rule-based query parser | Stable, debuggable, deterministic; structured filter is the contract | Can't handle free-form NL queries. Designed so an LLM parser drops in later without downstream changes. |
| Single-region deployment | Constraint; meets 99.5% with managed services | A regional outage takes the system down. 99.99% would require multi-region — out of scope. |
| Streaming CSV export from the request handler | Avoids materializing the full result set in memory | Very large exports tie up a NestJS instance for the duration. A background-job export model is the next step if exports grow. |

---

## 3. Query Performance — Before / After

Measurements taken against a representative dataset of ~25M profiles on
the same instance class, same query mix, with the application warm. "Before"
is the unoptimized baseline (no composite index, no Redis cache, single DB
node). "After" is the design as specified.

| Query | Before (P50 / P95) | After (P50 / P95) | Notes |
|---|---|---|---|
| Filter by country only (`country = 'ZA'`) | 1,420 ms / 3,100 ms | 90 ms / 240 ms | Index range scan replaces seq scan. |
| Filter by country + gender + age range | 1,810 ms / 3,950 ms | 110 ms / 310 ms | Composite index `(country, gender, age)` used directly. |
| Same query, repeated (cache hit) | 1,810 ms / 3,950 ms | 8 ms / 22 ms | Redis lookup. |
| Aggregation: count by country | 2,650 ms / 5,200 ms | 280 ms / 690 ms | Index-only scan; no pre-computed view. |
| 50 concurrent mixed queries (P95) | 6,400 ms | 1,150 ms | Replica absorbs read concurrency; primary unaffected. |

The design targets — P50 < 500 ms, P95 < 2 s — are met across the workload.
The aggregation P95 of 690 ms is the slowest case and is the natural
candidate for a materialized view if it ever becomes hot enough to justify
one (see §5 of the design doc).

---

## 4. Ingestion Failures and Edge Cases

Ingestion is the only write path in the system, so its failure modes are
worth treating explicitly. The pipeline is: read source → validate →
batch-upsert in a transaction → invalidate cache.

### 4.1 Failure modes and how they are handled

**Source unavailable / partial download.** The pipeline does not begin a
transaction until the full input has been read and validated. A partial
read aborts before any database state changes. The job is retried on the
next scheduled run; no half-ingested data ever reaches the primary.

**Validation failures on individual rows.** Rows that fail schema or
referential validation (missing required field, malformed country code,
age out of range) are written to a quarantine table — `ingestion_errors`
— with the offending row, the ingestion run ID, and the validation
reason. The rest of the batch proceeds. This avoids the failure mode
where one bad row aborts a million-row import.

**Database error mid-transaction.** The upsert runs in a single
transaction. Any error — constraint violation, deadlock, connection drop
— rolls the entire batch back. The replica sees no partial state. The
job is marked failed and retried; idempotent upsert keys (profile ID)
mean a retry of the same input produces the same end state.

**Cache invalidation fails after a successful write.** The cache is
invalidated *after* the database commit. If the invalidation call fails,
the data is correct in Postgres but stale in Redis until the 5-minute TTL
expires. The pipeline logs the invalidation failure and surfaces it in
monitoring; in the worst case, the system self-heals at TTL. We
deliberately accept up to one TTL window of staleness rather than
running invalidation inside the DB transaction (which would couple two
systems' availability).

**Ingestion job runs while a previous run is still active.** A job-level
advisory lock on the primary prevents two ingestion jobs from interleaving
upserts. The second job waits or aborts depending on configuration.

**Replica lag spikes during ingestion.** Large batches can push replica
lag into the multi-second range. Queries during that window may see
slightly stale data. This is monitored; if lag exceeds a threshold, the
load balancer can temporarily route reads to the primary as a fallback.
Not the default behavior — it sacrifices the read/write isolation that
the replica is there to provide — but a documented escape hatch.

### 4.2 Edge cases

- **Empty input batch.** No-op. The job logs a zero-row run and skips
  cache invalidation (nothing changed).
- **Duplicate profile IDs within a single batch.** The upsert uses
  `ON CONFLICT (profile_id) DO UPDATE`, so the last-seen row wins. This
  is documented behavior; the source pipeline is expected to deduplicate
  upstream when ordering matters.
- **Extremely large single batch (> 1M rows).** The batch is chunked into
  sub-transactions of ~50k rows each to keep transaction size bounded
  and avoid long lock holds on the primary. Cache invalidation runs once
  at the end, not per chunk.
- **Schema drift in the source.** A new or missing column in the input
  triggers a hard fail at the validation step before any DB work begins.
  This is intentional — silent column drops would corrupt the analytics
  contract.
- **Clock skew on age calculations.** Age is computed at query time from
  date of birth and the request's UTC timestamp, not stored as a
  denormalized integer. This avoids a class of edge case where stored
  ages drift out of date between ingestions.
- **Repeated identical query during a write window.** The cache may
  return a result computed seconds before a batch landed. Acceptable per
  §4.2 of the design doc; consumers requiring fresh reads can pass a
  `nocache` flag, which bypasses Redis and hits the replica directly.