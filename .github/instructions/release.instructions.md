---
description: "Use when changing AADB versions, deployment scripts, GitHub workflows, Docker/azd infrastructure, release notes, or production configuration. Enforces separate merge/deploy approval, immutable provenance, rollback, and exact post-deploy verification."
applyTo:
  - ".github/workflows/**"
  - "scripts/production/**"
  - "infra/**"
  - "azure.yaml"
  - "Dockerfile"
  - "package.json"
  - "package-lock.json"
  - "DOCS/RELEASE-NOTES.md"
---
# Release Discipline

- Treat deployment and infrastructure changes as at least R3.
- Build only from a clean worktree at a committed source revision.
- Run `npm run verify:release` plus change-specific release checks.
- Record version, commit, immutable image digest, rollback target, and limitations.
- Merge only after explicit merge approval.
- Production deployment requires a second explicit approval naming the intended
  version after release evidence exists. Never infer it from merge approval.
- After deployment, verify the live version and the exact changed behavior. Health
  alone is insufficient. Roll back when the acceptance check fails.
- Never expose secrets in commands, logs, files, PR bodies, or durable evidence.
