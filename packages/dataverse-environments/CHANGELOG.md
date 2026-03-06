# dataverse-environments

## 0.5.0

### Minor Changes

- [`9ffca4d`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/9ffca4d3d71b24c71c6669312800f0ea020fc9fe) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix(release): skip already-published extensions instead of failing pipeline
  - docs(dataverse-tools-pack): add web resources to README included extensions table
  - chore(dataverse-web-resources): prepare for marketplace publish
  - chore: add dataverse-web-resources to release workflow and extension pack
  - feat(dataverse-web-resources): new extension for browsing and editing Dataverse web resources
  - refactor(dataverse-assemblies): push managed filter to API and add entity metadata methods
  - chore: auto-generate changeset
  - fix(dataverse-tools-pack): remove unnecessary dependency and add --no-dependencies flag
  - ci: include dataverse-tools-pack in release workflow
  - feat: add dataverse-tools-pack extension bundle package
  - fix(dataverse-environments): pre-warm auth token and fix getChildren loading state
  - refactor(core-dataverse): replace axios with native fetch

## 0.4.0

### Minor Changes

- [`3b615b2`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/3b615b2448787c6fa76287c1e42bb69c717ffa1d) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix(dataverse-tools-pack): remove unnecessary dependency and add --no-dependencies flag
  - ci: include dataverse-tools-pack in release workflow
  - feat: add dataverse-tools-pack extension bundle package
  - fix(dataverse-environments): pre-warm auth token and fix getChildren loading state
  - refactor(core-dataverse): replace axios with native fetch

## 0.3.0

### Minor Changes

- [`c378dfc`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/c378dfcb2d2720b63058ac8c4ff5b72d4c150e35) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix: use tag name for pre-release detection in CI workflows
  - fix: handle existing tag on workflow re-run
  - fix: remove -preview suffix from package versions
  - chore: add auto-generated changeset for recent changes
  - feat: add version & release workflow for one-click releases
  - fix: pin workspace dependency versions for changesets compatibility
  - fix: improve CI workflow reliability
  - chore: add changesets tooling and replace bump-version script
  - fix: dynamic release matrix with version-based change detection
  - fix: add explicit workspace dependencies to extension packages
  - fix: refactor workflow service to use getSolutionComponents
  - fix: refactor metadata providers to use unified SolutionComponent type
  - fix: refactor editEnvironmentCommand to use declarative wizard framework
  - fix: add customization tracking and RemoveActiveCustomizations to explorer
  - fix: correct SolutionComponentType values and add unified SolutionComponent type

## 0.2.2

### Patch Changes

- [`77e328f`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/77e328f6766f3d408aacf36370cbf5fcfab9b1d6) Thanks [@guramrit-dhillon](https://github.com/guramrit-dhillon)! - - fix: improve CI workflow reliability
  - chore: add changesets tooling and replace bump-version script
  - fix: dynamic release matrix with version-based change detection
  - fix: add explicit workspace dependencies to extension packages
  - fix: refactor workflow service to use getSolutionComponents
  - fix: refactor metadata providers to use unified SolutionComponent type
  - fix: refactor editEnvironmentCommand to use declarative wizard framework
  - fix: add customization tracking and RemoveActiveCustomizations to explorer
  - fix: correct SolutionComponentType values and add unified SolutionComponent type
  - chore: bump all packages to v0.2.1-preview
  - feat: add packaging scripts, improve wizard UX, and fix decompiler language version
  - feat: add declarative wizard framework and refactor addEnvironmentCommand
  - chore: bump all packages to v0.2.0-preview
  - fix: show progress feedback when adding environment
  - feat: add dataverse-workflows extension for managing Dataverse processes
  - chore: bump all packages to v0.1.1-preview
  - chore: prepare packages for marketplace publishing
  - rename plugin-trace-viewer directory to match package name
  - fix: respect DOTNET_RID env var in .NET build scripts
  - ci: add CI and release GitHub Actions workflows
  - feat: support <value> children for in/not-in operators in FetchXML Builder
  - fix: preserve unsupported FetchXML attributes and text content through round-trips
  - feat: add complete Dataverse Tools extension suite
  - Setting up framework
