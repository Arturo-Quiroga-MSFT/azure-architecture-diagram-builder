# AADB Engineering Instructions

Follow [the authoritative AADB SDLC](../HVE-ADOPTION/SDLC.md).

- Classify material work R0-R4 before implementation and identify protected
  surfaces, acceptance criteria, non-goals, blast radius, tests, and rollback.
- Keep Research, Plan, Implement, and Review distinct. Research and acceptance
  review are read-only. Do not implement before an R2+ plan is approved.
- Stop when a hypothesis is falsified, a test fails unexpectedly, scope changes,
  or evidence exercises a different path. Return to Research or Plan; do not
  improvise through the gate or retry until green.
- For every bug, add a regression fence and demonstrate old behavior fails and new
  behavior passes, unless the PR records why no executable fence exists.
- Test the user-visible output boundary as well as internal logic. Do not generalize
  from one model, format, browser, region, path, or revision.
- Label claims Tested, Measured, Documented, Inferred, or Proposed when the
  distinction matters. Include limitations and checks not run.
- Never mix unrelated workstreams. Preserve user changes and use an isolated
  branch/worktree for material or concurrent work.
- Never merge without explicit user approval. Merge approval never authorizes
  production deployment.
- Never deploy without a separate explicit user approval naming the intended
  version after release evidence is available.
- Do not commit secrets, internal identifiers, customer/partner data, raw
  telemetry, private reviewer information, or sensitive security/privacy records.
