# Dependabot security update route

Baseline verified: 2026-09-27 UTC.

## Current behavior

The repository default branch is `main`, while normal development integrates through `dev`.
The npm and GitHub Actions version-update entries in `.github/dependabot.yml` explicitly target
`dev`. The separate npm security-update entry intentionally has no `target-branch`.

GitHub documents that Dependabot security-update pull requests always target the default branch.
When `target-branch` is set to a non-default branch, that configuration applies to version updates
instead of security updates:

- https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/customizing-dependabot-prs#targeting-pull-requests-against-a-non-default-branch
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch

Therefore a Dependabot security PR is expected to appear against `main`, while ordinary Dependabot
version updates continue to target `dev`.

## Publication route

A main-target Dependabot security PR is a source proposal, not a production publication exception.
Do not merge it directly and do not weaken the `dev -> main` source invariant.

1. Review the Dependabot PR and record the exact reviewed head SHA and dependency changes.
2. Refresh `dev`, then create a normal repository task branch from current `dev`.
3. Apply only the reviewed dependency fix to that branch. Do not blindly merge the bot branch from
   `main`; if the patch conflicts with current `dev`, resolve the dependency update on `dev` and
   re-review the resulting diff.
4. Run `npm ci` and `npm run verify:full`.
5. Publish the task branch to a PR targeting `dev`. Required `frontend-ci` must pass on the current
   head; follow the repository review lifecycle before human merge.
6. After the fix is merged into `dev`, publish it through the normal human-controlled
   `dev -> main` release PR. Both main-target CI workflows use the same release-source policy and
   accept only the same-repository `dev` branch.
7. Verify the fixed dependency is present on `main`. The original Dependabot PR can then close
   automatically when GitHub recognizes the vulnerability as resolved, or be closed manually as
   superseded with a link to the integrated fix.

This route preserves integration-back by construction: the security change reaches `dev` before it
can reach `main`.

## Dependabot permissions

GitHub treats workflows triggered by Dependabot pull requests similarly to fork-originated workflows:
the default `GITHUB_TOKEN` is read-only and normal Actions secrets are unavailable. This repository
therefore does not add an automatic write relay from a Dependabot main PR into `dev`; doing so would
require separate credential/settings authority and would expand the trust surface.

Reference:
https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-on-actions

## Live observation versus regression simulation

Observed on 2026-09-27 UTC:

- `dev` integration head: `89e07129784a0831766651d3a45dcabc4fbcf596`;
- `main` production head: `e113ac41022701de193ce7435de6a48b9c8c9d0c`;
- `dev` requires `frontend-ci`;
- `main` requires `main-ci`;
- the active Dependabot configuration routes version updates to `dev` and leaves security updates on
  the default branch;
- no open Dependabot PR was available to exercise a live security-update PR during this change.

Because there was no live security PR, the acceptance cases are deterministic simulations in
`scripts/release-source-policy.test.mjs`: normal `dev -> main` passes, arbitrary same-repository
branches fail, a fork branch named `dev` fails, a simulated Dependabot main PR remains blocked, and a
security integration task branch targeting `dev` is accepted.

No repository settings change, auto-merge, CI bypass, secret activation, or production cutover is
required by this route.
