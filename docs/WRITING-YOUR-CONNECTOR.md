# Writing your connector

The README marks the wearable and activity sources as **schema only**: the
tables and the dashboard that reads them are here, the code that fills them is
not. This file says what shape that code needs to be, so you are not
reverse-engineering `schema.sql` and `src/types/db.ts` to find out.

Nothing here is a library to install. It is the contract: which columns exist,
how an upsert is addressed, and the four things that will waste your afternoon
if nobody tells you about them.

Everything below is plain PostgREST over HTTP. Any language works; the
examples are Python because that is what the reference implementation happens
to be written in.

## Credentials

You need two values, server-side only:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service_role_key>
```

**The service-role key bypasses RLS.** It belongs in a connector that runs on
your own machine, in an environment file that is gitignored — never in the
dashboard, never in anything shipped to a browser, never committed. The
dashboard uses the *anon* key and authenticates as you; the connector uses the
service-role key and writes as you. Two different keys doing two different
jobs.

Every request carries both headers, plus the upsert preference:

```python
req.add_header("apikey", key)
req.add_header("Authorization", f"Bearer {key}")
req.add_header("Prefer", "return=representation,resolution=merge-duplicates")
```

## Resolving `user_id`

Every table is RLS-locked to a single user and defaults `user_id` to
`auth.uid()`. A service-role write has no session, so that default resolves to
null and the insert fails. **You must pass `user_id` explicitly** — the
`auth.users` id for your own email.

Look it up once via the auth admin API, then cache it. It never changes for a
single-user app, and the admin endpoint is the least reliable thing in the
stack: it can time out for hours while `/rest/v1` answers in under 100 ms.
Asking the network for a constant on every run turns a slow afternoon into a
silently skipped morning push.

Resolution order that survives that: `OWNER_ID` env var → local cache file →
admin API, which then writes the cache.

## `scores` — one row per day

Primary key is `(user_id, date)`, so the upsert is addressed on both:

```
POST /rest/v1/scores?on_conflict=user_id,date
```

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | Required. See above. |
| `date` | date | Required. `YYYY-MM-DD`. |
| `score` | numeric | Your own composite, if you compute one. Optional. |
| `hrv` | numeric | Overnight average, ms. |
| `rhr` | numeric | Resting heart rate, bpm. |
| `sleep_hours` | numeric | Hours, decimal. |
| `sleep_score` | int | Migration 0011. |
| `vo2max` | numeric | |
| `body_battery` | numeric | |
| `weight_kg` | numeric | |
| `mood` | int | |
| `body_fat_percent` | numeric(4,1) | Migration 0004, smart-scale only. |
| `muscle_mass_kg` | numeric(5,2) | Migration 0004. |
| `body_water_percent` | numeric(4,1) | Migration 0004. |
| `grip_kg` | numeric(4,1) | Migration 0008. Dominant hand. |
| `grip_r_kg`, `grip_l_kg` | numeric(4,1) | Migration 0010. |
| `cycle_day` | int | Only if you track it. |
| `cycle_phase` | text | Constrained: `menstrual` / `follicular` / `ovulation` / `luteal`. |
| `notes` | text | |

Write only the columns whose migrations you actually ran. Posting a key that
does not exist returns a 400 for the whole row, not a partial write.

```python
row = {
    "user_id": user_id,
    "date": "2026-09-10",
    "hrv": 98,
    "rhr": 43,
    "sleep_hours": 7.9,
    "vo2max": 56.0,
    "body_battery": 100,
}
row = {k: v for k, v in row.items() if v is not None or k in ("user_id", "date")}
post("/rest/v1/scores?on_conflict=user_id,date", row)
```

## `activities` — one row per activity

Primary key is the **provider's own activity id**, which is what makes the
whole thing idempotent:

```
POST /rest/v1/activities?on_conflict=id
```

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | Required. The provider's activity id, not one you generate. |
| `user_id` | uuid | Required. |
| `date` | date | Required. |
| `type` | text | `run`, `trailrun`, `virtualrun`, `strength`, … |
| `name` | text | |
| `distance_km` | numeric | **Kilometres.** Most APIs give metres. |
| `duration_s` | int | |
| `avg_pace_s_per_km` | int | Seconds per km. |
| `avg_hr`, `max_hr` | int | |
| `avg_power` | int | |
| `elevation_m` | int | |
| `perceived_effort` | int | Yours to fill; no API provides it. |
| `feel` | text | Constrained: `great`/`good`/`ok`/`flat`/`bad`, or null. |
| `notes` | text | |
| `raw` | jsonb | The untouched provider payload. Keep it. |

**Keep `raw`.** It costs nothing and it is the difference between adding a
column later and re-fetching a season of history you can no longer get.

## The four things that will bite you

1. **Unit mismatch.** `distance_km` is kilometres; most activity APIs return
   metres. Accept both and normalise on the way in.

2. **Type coercion.** `duration_s`, `avg_hr`, `max_hr`, `elevation_m` and
   `avg_pace_s_per_km` are `int` in the schema, and APIs return floats.
   Coerce, and return null rather than throwing on anything unparseable — one
   bad field should not lose the row.

3. **Strip nulls before posting**, except the key columns. A wearable API
   drops individual endpoints regularly, and a row of mostly-nulls will
   overwrite good data from an earlier run of the same day with nothing.

4. **Make it idempotent and then run it more than once a day.** Both upserts
   are addressed on a natural key, so re-running is free. Sync in the early
   morning, then again around midday — watches often have not finished
   uploading when a 05:30 job fires, and the early file will have gaps in it.

## Order of operations

The dashboard reads; it never writes. So the daily sequence is: pull from your
vendors to local files, then push those files here, then the dashboard has
something to show. If the push fails, the local files are still the source of
truth and the next run backfills — which is the right way round. Don't build
it so that a Supabase outage loses a day of data.
