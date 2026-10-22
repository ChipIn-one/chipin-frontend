# Dependabot security update route

Baseline verified: 2026-09-27 UTC. Updated for canonical `master`
([#497](https://github.com/ChipIn-one/chipin-frontend/issues/497)).

## Current behavior

`master` is the repository default branch and the only long-lived branch. The npm and GitHub
Actions version-update entries in `.github/dependabot.yml` explicitly target `master`. The separate
npm security-update entry intentionally has no `target-branch`.

GitHub documents that Dependabot security-update pull requests always target the default branch:

- https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/customizing-dependabot-prs#targeting-pull-requests-against-a-non-default-branch
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch

Because the default branch is `master`, security updates and version updates now open against the
same branch.

## Publication route

A Dependabot security PR into `master` follows the normal PR route; there is no separate
integration branch to route it through.

1. Review the Dependabot PR and record the exact reviewed head SHA and dependency changes.
2. Required `frontend-ci` must pass on the current head. Trusted Dependabot PRs into `master` are
   exempt from canonical Issue admission, exactly like version updates; every other check runs.
3. If the update needs manual changes, apply only the reviewed dependency fix on a normal Issue-backed
   task branch from current `master`, run `npm ci` and `npm run verify:full`, and publish it as a
   task PR into `master`; close the Dependabot PR as superseded with a link to that PR.
4. A human merges into `master`. The fix reaches production when the owner promotes a `master`
   deployment that contains it in Vercel.

## Dependabot permissions

GitHub treats workflows triggered by Dependabot pull requests similarly to fork-originated workflows:
the default `GITHUB_TOKEN` is read-only and normal Actions secrets are unavailable. This repository
therefore does not add a write relay for Dependabot PRs; doing so would require separate
credential/settings authority and would expand the trust surface.

Reference:
https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-on-actions

## History

Until #497 the default branch was `main` and integration ran through `dev`, so security PRs opened
against `main` and had to be re-integrated through `dev`; a release-source policy blocked direct
`main` PRs. That route and its policy script were removed with the move to `master`.
