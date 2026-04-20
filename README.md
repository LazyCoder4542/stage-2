# HNG Stage 2 — Intelligence Query Engine

A NestJS REST API that enriches a name with predicted gender, age, and nationality by calling Genderize.io, Agify.io, and Nationalize.io, persists the result in PostgreSQL via Prisma, and exposes a natural-language search interface over the stored profiles.

---

## Tech Stack

- **Framework:** NestJS (Node.js)
- **Database:** PostgreSQL (Neon) + Prisma ORM
- **External APIs:** Genderize.io · Agify.io · Nationalize.io · REST Countries
- **Docs:** Swagger / Scalar UI at `/docs`

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- A PostgreSQL database (e.g. [Neon](https://neon.tech))

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=verify-full"
PORT=3000          # optional, defaults to 3000
```

### Database Setup

```bash
npx prisma migrate deploy
```

### Seed the Database

The repo ships with 2026 pre-built profiles in `prisma/seed_profiles.json`. Run the Prisma seed command to load them:

```bash
npx prisma db seed
```

The script uses `upsert` on `name`, so it is safe to re-run against a non-empty database.

### Run

```bash
# development
npm run start:dev

# production
npm run build
npm run start:prod
```

The server starts on `http://localhost:3000` (or `$PORT`).  
Interactive API docs: `http://localhost:3000/docs`

---

## API Reference

All routes are prefixed with `/api`.

---

### Create a Profile

```
POST /api/profiles
```

Calls Genderize, Agify, and Nationalize with the supplied name, stores the enriched profile, and returns it. If a profile for that name already exists it is returned immediately without re-calling the external APIs.

**Request body**

```json
{ "name": "Adeola" }
```

**Responses**

| Status | Meaning |
|--------|---------|
| 201 | Profile created |
| 200 | Profile already existed |
| 400 | No prediction available for the name |
| 502 | An upstream API returned an error |

---

### List Profiles

```
GET /api/profiles
```

Returns paginated profiles. All query parameters are optional.

**Query parameters**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `gender` | `male` \| `female` | Filter by predicted gender | `male` |
| `age_group` | `child` \| `teenager` \| `adult` \| `senior` | Filter by age group | `adult` |
| `country_id` | string (ISO 3166-1 alpha-2) | Filter by country code | `NG` |
| `min_age` | number | Minimum predicted age (inclusive) | `16` |
| `max_age` | number | Maximum predicted age (inclusive) | `30` |
| `min_gender_probability` | number (0–1) | Minimum gender confidence | `0.8` |
| `min_country_probability` | number (0–1) | Minimum country confidence | `0.7` |
| `sort_by` | `age` \| `created_at` \| `gender_probability` | Sort field | `age` |
| `order` | `asc` \| `desc` | Sort direction | `desc` |
| `page` | number | Page number (default: 1) | `1` |
| `limit` | number | Results per page, max 50 (default: 10) | `10` |

---

### Natural-Language Search

```
GET /api/profiles/search
```

Parses a plain-English query and returns matching profiles. Supports gender, age group, age range, and country filters.

**Query parameters**

| Param | Required | Description | Example |
|-------|----------|-------------|---------|
| `q` | yes | Search string | `young males from nigeria` |
| `page` | no | Page number | `1` |
| `limit` | no | Results per page (max 50) | `10` |

**Supported query patterns**

| Pattern | Example |
|---------|---------|
| Gender | `males`, `females` |
| Age group | `adult`, `teenager`, `child`, `senior` |
| Young shorthand (16–24) | `young` |
| Age floor | `above 30` |
| Age ceiling | `below 50` |
| Country | `from nigeria`, `in ghana` |

---

### Get a Profile

```
GET /api/profiles/:id
```

Returns a single profile by its UUID.

| Status | Meaning |
|--------|---------|
| 200 | Profile found |
| 400 | Profile does not exist |

---

### Delete a Profile

```
DELETE /api/profiles/:id
```

Deletes a profile by its UUID.

| Status | Meaning |
|--------|---------|
| 204 | Deleted |
| 400 | Profile does not exist |

---

## Response Envelope

All endpoints (except 204) return a consistent envelope:

```json
{
  "status": "success",
  "message": "Profile already exists",
  "count": 1,
  "data": { }
}
```

`message` is omitted when not applicable. `count` is included for list responses.

Errors follow the same shape with `status: "error"`:

```json
{
  "status": "error",
  "message": "Profile does not exist"
}
```

---

## Profile Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | string | Unique name used for prediction |
| `gender` | `male` \| `female` | Predicted gender |
| `gender_probability` | float (0–1) | Confidence of gender prediction |
| `sample_size` | int | Records used for gender prediction |
| `age` | int | Predicted age |
| `age_group` | `child` \| `teenager` \| `adult` \| `senior` | Derived from predicted age |
| `country_id` | string | Most likely country (ISO 3166-1 alpha-2) |
| `country_name` | string | Full country name |
| `country_probability` | float (0–1) | Confidence of country prediction |
| `created_at` | ISO 8601 | Record creation timestamp |
