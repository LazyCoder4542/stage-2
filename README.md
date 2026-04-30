# Insighta — Intelligence Query Engine

A NestJS REST API that enriches a name with predicted gender, age, and nationality by querying external prediction APIs, persists the result in PostgreSQL, and exposes a natural-language search interface and a CLI tool over the stored profiles.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│         Web Frontend          CLI (insighta)            │
└──────────────┬────────────────────────┬─────────────────┘
               │                        │
               ▼                        ▼
┌─────────────────────────────────────────────────────────┐
│                    NestJS API (REST)                     │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ AuthModule  │  │ ProfileModule│  │  UserModule   │  │
│  │             │  │              │  │               │  │
│  │ GitHub OAuth│  │ CRUD         │  │ /users/me     │  │
│  │ JWT (access)│  │ NL Search    │  │               │  │
│  │ JWT (refresh│  │ CSV Export   │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│  ┌──────▼────────────────▼───────────────────▼───────┐  │
│  │               Shared / Infrastructure              │  │
│  │  PrismaService   TransformInterceptor              │  │
│  │  AllExceptionsFilter  ValidationPipe               │  │
│  │  JwtStrategy  JwtAuthGuard  AdminGuard             │  │
│  │  ApiVersionGuard  PkceGuard                        │  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼─────────────────────────────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
    PostgreSQL         GitHub API        External APIs
    (Prisma ORM)       (OAuth)       Genderize / Agify
                                      Nationalize
                                      RestCountries
```

**Key design decisions:**
- All responses are wrapped by a global `TransformInterceptor` into `{ status, data, ... }`
- All profile endpoints require the `X-API-Version: 1` header enforced by `ApiVersionGuard`
- JWT access tokens are stateless (short-lived). Refresh tokens are stored as HMAC-SHA256 hashes in the DB
- Role is embedded in the JWT payload — no DB lookup needed for role checks

---

## Authentication Flow

### Web Flow

```
Browser                  API                        GitHub
   │                      │                            │
   │  GET /auth/github    │                            │
   │─────────────────────>│                            │
   │                      │── redirect ───────────────>│
   │                      │                            │
   │<─────────────────────────── redirect to /auth/github/callback?code=...
   │                      │                            │
   │  GET /auth/github/callback?code=...               │
   │─────────────────────>│                            │
   │                      │── redirect to FRONTEND_URL/callback?code=...
   │                      │                            │
   │  GET /auth/github/exchange?code=...               │
   │─────────────────────>│                            │
   │                      │── exchange code ──────────>│
   │                      │<── access_token ───────────│
   │                      │── GET /user ──────────────>│
   │                      │<── profile ────────────────│
   │                      │── upsert user in DB        │
   │<── { access_token, refresh_token } ───────────────│
```

### CLI Flow (PKCE)

```
CLI                      API                        GitHub
 │                        │                            │
 │  generate code_verifier + code_challenge            │
 │  generate state                                     │
 │                        │                            │
 │  open browser → https://github.com/login/oauth/authorize
 │                 ?code_challenge=...&state=...       │
 │                                                     │
 │  start local temp server on PORT                    │
 │                        │                            │
 │                        │<── redirect /auth/github/callback?code=...&state=...&is_cli=true
 │                        │                            │
 │                        │── redirect to http://localhost:PORT/callback?code=...&state=...
 │                        │                            │
 │<── code + state ────────────────────────────────────│
 │                        │                            │
 │  validate state (CSRF check)                        │
 │                        │                            │
 │  GET /auth/github/exchange?code=...&state=...&code_verifier=...&is_cli=true
 │───────────────────────>│                            │
 │                        │  PkceGuard: verify sha256(code_verifier) === code_challenge from state
 │                        │  GithubAuthGuard: exchange code with GitHub
 │<── { access_token, refresh_token } ────────────────│
```

### Token Refresh

```
POST /auth/refresh
Body: { refresh_token }

1. Verify JWT signature and expiry using JWT_REFRESH_SECRET
2. Load user from DB — check refresh_token_hash is not null
3. Compute HMAC-SHA256(TOKEN_SALT, token) and compare to stored hash
4. If valid → generate new token pair, store new hash, return tokens
5. If invalid → 401 "The refresh token is invalid, expired, or revoked"
```

---

## API Reference

Base URL: `https://<host>/api`

All profile endpoints require:
- `Authorization: Bearer <access_token>`
- `X-API-Version: 1`

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/auth/github` | Public | Initiate GitHub OAuth (web) |
| GET | `/auth/github/callback` | Public | GitHub redirect handler |
| GET | `/auth/github/exchange` | Public | Exchange code for JWT tokens |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | JWT | Revoke refresh token |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | JWT | Get authenticated user profile |

### Profiles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/profiles` | JWT + Admin | Create a profile |
| GET | `/profiles` | JWT | List profiles (paginated) |
| GET | `/profiles/search?q=` | JWT | Natural-language search |
| GET | `/profiles/export?format=csv` | JWT | Export profiles as CSV |
| GET | `/profiles/:id` | JWT | Get profile by ID |
| DELETE | `/profiles/:id` | JWT + Admin | Delete profile |

---

## CLI Usage

### Installation

```bash
npm install -g insighta
```

### Auth Commands

```bash
insighta login       # Opens browser for GitHub OAuth, stores credentials
insighta logout      # Revokes refresh token, clears credentials
insighta whoami      # Displays current authenticated user
```

### Profile Commands

```bash
# List profiles
insighta profiles list
insighta profiles list --gender male
insighta profiles list --country NG --age-group adult
insighta profiles list --min-age 25 --max-age 40
insighta profiles list --sort-by age --order desc
insighta profiles list --page 2 --limit 20

# Get a single profile
insighta profiles get <id>

# Natural-language search
insighta profiles search "young males from nigeria"

# Create a profile (Admin only)
insighta profiles create --name "Harriet Tubman"

# Export to CSV (saved to current directory)
insighta profiles export --format csv
insighta profiles export --format csv --gender male --country NG
```

---

## Token Handling Approach

Credentials are stored at `~/.insighta/credentials.json`:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

**Flow on every CLI request:**
1. Read credentials from `~/.insighta/credentials.json`
2. Attach `Authorization: Bearer <access_token>` to the request
3. If the response is `401`:
   - Attempt `POST /auth/refresh` with the stored `refresh_token`
   - If successful: save new tokens, retry the original request once
   - If refresh fails: clear credentials, prompt user to run `insighta login`
4. Access tokens are short-lived (`JWT_EXPIRES_IN`, default `15m`)
5. Refresh tokens are long-lived (`JWT_REFRESH_EXPIRES_IN`, default `7d`)
6. On `insighta logout`: calls `POST /auth/logout` to revoke the refresh token server-side, then deletes `~/.insighta/credentials.json`

---

## Role Enforcement Logic

Two roles exist: `admin` and `analyst` (default).

| Action | Required Role |
|--------|--------------|
| Create profile | admin |
| Delete profile | admin |
| All other endpoints | any authenticated user |

**How it works:**

1. Role is embedded in the JWT payload at login: `{ sub, username, role }`
2. `JwtStrategy.validate()` verifies the token, checks the user exists and `is_active === true`, and returns the payload
3. `AdminGuard` reads `req.user.role` (set by Passport from the JWT payload) and throws `403 Forbidden` if the role is not `admin`
4. No DB lookup is needed for role checks — the role is trusted from the signed JWT
5. `is_active` check happens in `JwtStrategy` on every request — inactive users receive `403` regardless of role

---

## Natural Language Parsing Approach

`GET /profiles/search?q=<query>` parses a free-text string into structured filters using regex pattern matching:

| Pattern | Regex | Example |
|---------|-------|---------|
| Country | `(?<=from \|in )\w+` | "from Nigeria" → `nigeria` |
| Age group | `(child\|teenager\|adult\|senior)` | "adult males" → `adult` |
| Min age | `(?<=above )\d+` | "above 25" → `25` |
| Max age | `(?<=below )\d+` | "below 40" → `40` |
| Gender | `(male\|female)` | "young females" → `female` |
| Young shorthand | `/young/` | "young males" → age 16–24 |

**Example:**
```
"young males from nigeria"
→ gender: male
→ age: 16–24 (isYoung shorthand)
→ country: nigeria → resolved to ISO code NG via RestCountries API
```

The country name is resolved to an ISO 3166-1 alpha-2 code via `GET https://restcountries.com/v3.1/name/{name}?fullText=true` before being used as a filter. If no patterns match, a `400 Bad Request` is returned.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | PostgreSQL connection string for tests |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_EXPIRES_IN` | Access token expiry (e.g. `15m`) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (e.g. `7d`) |
| `TOKEN_SALT` | HMAC salt for hashing refresh tokens |
| `GITHUB_OAUTH_CLIENTID` | GitHub OAuth App client ID |
| `GITHUB_OAUTH_SECRET` | GitHub OAuth App client secret |
| `FRONTEND_URL` | Frontend base URL for OAuth redirect |
| `CLI_PORT` | Local port the CLI temp server listens on |
| `API_BASE_URL` | Public API base URL (used for pagination links) |
| `PORT` | Server port (default: 3000) |
