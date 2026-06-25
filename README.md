# Task Tracker API — Dockerized Node.js + PostgreSQL

A small REST API for tracking tasks, built specifically to practice core DevOps
skills: containerization, multi-stage Docker builds, and service orchestration
with Docker Compose. This is a series — later projects in
this series add CI/CD (GitHub Actions, Jenkins), Infrastructure as Code
(Terraform), configuration management (Ansible), and Kubernetes deployment,
all building on this same app.

## Why this project exists

Most "beginner DevOps" portfolios stop at certifications. This project (and
the ones that follow it) is meant to prove the certifications translate into
something that actually runs — a containerized app with a real database, a
non-root runtime user, health checks, and layer-cached builds, not just a
`docker run hello-world`.

## Tech stack

- **Node.js 20 + Express** — REST API
- **PostgreSQL 16** — persistent storage
- **Docker** — multi-stage build, non-root user, `HEALTHCHECK`
- **Docker Compose** — local orchestration of API + DB with health-checked startup ordering

## Architecture

```
┌─────────────┐       ┌──────────────┐
│   Client    │──────▶│  api service │
└─────────────┘       │ (Node/Express)│
                       └──────┬───────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  db service  │
                       │ (PostgreSQL) │
                       └──────────────┘
```

Both services run in isolated containers on a shared Docker network created
automatically by Compose. The API only starts once Postgres reports healthy
(`depends_on: condition: service_healthy`), avoiding the classic "app crashes
because DB wasn't ready yet" race condition.

## API Endpoints

| Method | Endpoint     | Description                              |
| ------ | ------------ | ---------------------------------------- |
| GET    | `/health`    | Health check (used by Docker/K8s probes) |
| GET    | `/tasks`     | List all tasks                           |
| POST   | `/tasks`     | Create a task (`{ "title": "..." }`)     |
| PATCH  | `/tasks/:id` | Update a task's `done` status            |
| DELETE | `/tasks/:id` | Delete a task                            |

## Running it locally

### Option A — Docker Compose (recommended, matches production setup)

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`. Postgres data persists
in a named volume (`pgdata`) between restarts.

Try it:

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn Docker multi-stage builds"}'

curl http://localhost:3000/tasks
```

To stop and remove containers (keeping data):

```bash
docker compose down
```

To stop and wipe the database too:

```bash
docker compose down -v
```

### Option B — Run without Docker (for local development only)

```bash
npm install
cp .env.example .env
# point DB_HOST at a Postgres instance you have running locally
npm run dev
```

## Running tests

```bash
npm test
```

## Docker design decisions worth noting

- **Multi-stage build** — dependencies are installed in a `builder` stage and
  only the resulting `node_modules` is copied into the final image. Keeps the
  shipped image free of build tools and caches.
- **Non-root user** — the container runs as `appuser`, not `root`. Running
  containers as root is a common, avoidable security mistake.
- **`.dockerignore`** — excludes `node_modules`, `.git`, and `.env` from the
  build context so the image stays small and secrets never get baked in.
- **`HEALTHCHECK`** — Docker can report container health natively; this same
  endpoint (`/health`) is reused later for Kubernetes liveness/readiness probes.
- **Config via environment variables** — no hardcoded credentials in code,
  following the [12-factor app](https://12factor.net/config) methodology.

## CI/CD Pipeline (GitHub Actions)

Every push and pull request to `main` triggers `.github/workflows/ci-cd.yml`:

1. **Test job** — spins up a real PostgreSQL service container (mirroring
   `docker-compose.yml`), installs dependencies, and runs `npm test`.
2. **Build & push job** — runs only on pushes to `main` (not on PRs, and never
   on forked PRs, which lack registry credentials). Builds the Docker image
   using Buildx with GitHub Actions layer caching, then pushes it to
   [GitHub Container Registry](https://ghcr.io) tagged both `:latest` and
   with the commit SHA, so any image can be traced back to the exact commit
   that produced it.

No secrets need to be configured manually — `GITHUB_TOKEN` is generated
automatically per workflow run and scoped with `packages: write` permission
in the workflow file itself.

Once it runs at least once, the built image is pulled with:

```bash
docker pull ghcr.io/<your-github-username>/<repo-name>:latest
```

(Note: the package may need to be set to "Public" the first time, under your
GitHub repo → Packages → package settings, otherwise `docker pull` requires
authentication.)

## CI/CD Pipeline (Jenkins on AWS EC2)

The same test → build → push workflow as the GitHub Actions pipeline above,
rebuilt in Jenkins to practice self-hosted CI/CD infrastructure rather than a
fully managed one. The `Jenkinsfile` in this repo defines four stages:

1. **Checkout** — pulls this repo via Git
2. **Install Dependencies** — `npm install`, run directly on the Jenkins host
3. **Test** — starts a throwaway PostgreSQL container, runs `npm test` against
   it, then tears the container down in a `post { always { ... } }` block
   regardless of pass/fail
4. **Build Image** — multi-stage Docker build, tagged with both the Jenkins
   build number and `latest`
5. **Push Image** — authenticates to ghcr.io using a Jenkins credential
   (`ghcr-credentials`, a GitHub Personal Access Token) and pushes both tags

Both this Jenkins pipeline and the GitHub Actions workflow push to the same
`ghcr.io/<username>/task-tracker-api` image — they coexist independently in
this repo, each running on its own trigger.

### Infrastructure notes

Jenkins runs on a `t2.micro` AWS EC2 instance (Ubuntu), set up manually to
practice real infrastructure operations rather than a one-click installer.
A few non-obvious things came up running Jenkins on a free-tier instance,
worth noting for anyone repeating this:

- **`t2.micro` has very little RAM (~900MB) and no swap by default.**
  Running Jenkins, Docker, and Node together can exhaust memory quickly.
  Adding a 1GB swap file (`/swapfile`, persisted via `/etc/fstab`) gives the
  instance breathing room.
- **`/tmp` on Ubuntu is `tmpfs` (RAM-backed), sized at 50% of total RAM by
  default** — on this instance, that's ~455MB. Jenkins monitors free `/tmp`
  space and will take its built-in node offline if it drops below a
  configurable threshold (default 1GiB, which a small instance will never
  clear). Lowering **Manage Jenkins → System → Free Temp Space Threshold**
  to a realistic value (e.g. 100MB) fixes this without needing to grow
  `/tmp` itself, which would eat further into limited RAM.
- **AWS security group rules using "My IP" capture the IP address at the
  time the rule is created** — they don't auto-update. If SSH access
  suddenly times out, refreshing the "My IP" source in the security group's
  inbound rules is the first thing to check.
- **ghcr.io requires lowercase image paths.** A GitHub username/repo with
  capital letters will fail the push step until the image name is
  lowercased.

## What's next in this series

1. ✅ **Dockerize a multi-tier app** (this repo)
2. ✅ **CI/CD pipeline with GitHub Actions** (test → build → push image to ghcr.io)
3. ✅ **Same pipeline rebuilt in Jenkins** (self-hosted on AWS EC2)
4. 🔜 Provision AWS infrastructure with Terraform
5. 🔜 Configure provisioned servers with Ansible
6. 🔜 Deploy to Kubernetes (Minikube/Kind)
7. 🔜 Capstone: full GitHub Actions → Kubernetes deployment pipeline

## License

MIT
