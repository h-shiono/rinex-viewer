# Releasing rinex-viewer

These notes are for the maintainer. Releases are published to the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=hato-gnss.rinex-viewer)
by the [Publish workflow](.github/workflows/publish.yml), which uses Trusted Publishing (OIDC). No token is stored
anywhere.

## Releasing a new version

1. On a branch from `main`, update the version without creating a tag:
   ```sh
   npm version 1.2.0 --no-git-tag-version
   ```
2. In `CHANGELOG.md`, move the notes under `## [Unreleased]` to a new `## [1.2.0] - YYYY-MM-DD` section.
3. Open a pull request and merge it once CI passes.
4. Tag the merged commit and push the tag:
   ```sh
   git checkout main && git pull
   git tag v1.2.0 && git push origin v1.2.0
   ```

The tag starts the Publish workflow. It runs the following steps in the `marketplace` environment:

1. Check that the tag matches the version in `package.json`.
2. Run lint, the unit tests and the integration tests.
3. Package the `.vsix` and publish it with `vsce publish --oidc`.
4. Create a GitHub release with the `.vsix` attached and generated release notes.

The new version usually appears on the Marketplace within a few minutes.

## One-time setup

The repository is already set up. Check the settings below only if you move the repository, rename the workflow,
or recreate the environment.

### Marketplace Trusted Publishing policy

At <https://marketplace.visualstudio.com/manage>, open the `hato-gnss` publisher and select
**Trusted Publishing** → **Create**:

| Field | Value |
| --- | --- |
| Repository owner | `h-shiono` |
| Repository | `rinex-viewer` |
| Workflow | `publish.yml` |
| Environment | `marketplace` |

These values must match exactly. Renaming the repository, the workflow file or the environment breaks publishing
until the policy is updated.

### GitHub environment

Open **Settings → Environments → `marketplace` → Deployment branches and tags**, choose
*Selected branches and tags*, and add a rule for `v*` with **Ref type: Tag**.

The Marketplace policy cannot restrict branches or tags, so this rule is what limits publishing to release tags.
Optionally, add yourself as a required reviewer to approve each publish manually.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Tag "vX.Y.Z" is not allowed to deploy to marketplace due to environment protection rules.` | The `v*` rule was added with Ref type **Branch**. Recreate it as a **Tag** rule, then re-run the workflow. |
| `Tag vX.Y.Z does not match package.json version …` | The tag was pushed on the wrong commit or before the version bump was merged. Delete the tag (`git push origin :refs/tags/vX.Y.Z` and `git tag -d vX.Y.Z`), then tag the right commit again. |
| The OIDC token exchange fails | Check that the Marketplace policy matches the repository, the workflow file name and the environment exactly. vsce does not fall back to a token, so nothing was published. |
| A step failed after it was fixed (for example, settings) | Re-run the failed run from the Actions page (**Re-run all jobs**) or with `gh run rerun <run-id>`. |
| A broken version was published | The Marketplace does not accept the same version twice. Fix the problem and release a new patch version. |

To try a package locally before releasing, run `npx vsce package` and install the `.vsix` with
`code --install-extension rinex-viewer-<version>.vsix`.
