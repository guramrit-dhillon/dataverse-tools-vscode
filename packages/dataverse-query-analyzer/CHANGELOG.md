# dataverse-query-analyzer

## 0.8.1

### Patch Changes

- [`33cac24`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/33cac2449fd2ce60c18dfc2d08633b63ba3dc6cc) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - docs: rewrite root README for broader Dataverse Tools scope
  - docs(metadata): revise README to match current implementation
  - docs: update acknowledgements in extension READMEs
  - fix(docs): correct links, badges, and architecture diagram in root README
  - docs: add feedback & community section to all READMEs
  - docs: add extension status roadmap
  - docs: add feature status tracking to all extensions

## 0.8.0

### Minor Changes

- [`e18402c`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/e18402c7b89d8422f181990d167d69ffb0438688) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix(metadata): sort entities by display name instead of logical name
  - fix(trace-viewer): make badge text selectable
  - chore: update package-lock.json for audit-viewer workspace
  - refactor(core-dataverse): move extension-specific types and constants to owning extensions
  - docs: add audit viewer to root README
  - fix(tools-pack): include all extensions in extension pack and release workflow
  - docs: update extension READMEs with complete suite listing and new features
  - feat(audit-viewer): add audit history viewer extension

## 0.7.0

### Minor Changes

- [`42522a1`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/42522a1755206ec2d359924fa5757bae7d190aff) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix(workflows): register new commands, reorder context menu, rename Properties
  - feat(workflows): add entity contributions and lift category labels to module scope
  - feat(workflows): wire Properties and XAML commands into extension
  - feat(workflows): add Properties wizard and XAML viewer commands
  - feat(workflows): expand service layer with XAML, update, and entity queries
  - feat(core-dataverse): add workflow and designer command IDs

## 0.6.0

### Minor Changes

- [`31e9114`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/31e911493e70773adc5274c46b1f303c42caca20) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - ci(release): add assemblies and decompiler to extension detection matrix
  - docs: update extension pack and root README
  - docs(management-tools): rewrite metadata, workflows, and web resources READMEs
  - docs(query-tools): rewrite FetchXML builder and query analyzer READMEs
  - docs(plugin-tools): rewrite decompiler and trace viewer READMEs
  - docs(dataverse-environments): rewrite README from user perspective
  - docs(dataverse-assemblies): update README for quick-input wizard workflow
  - feat(dataverse-assemblies): wire new commands in extension and package manifest
  - feat(dataverse-assemblies): show step images as lazy-loaded children in the tree
  - feat(dataverse-assemblies): add virtual file system provider for step config editing
  - feat(dataverse-assemblies): replace image webview panel with quick-input commands
  - feat(dataverse-assemblies): replace step webview panel with quick-input wizard
  - fix(dataverse-assemblies): use OData bind notation in upsertStep and upsertStepImage
  - feat(shared-views): add filterMode prop to Autocomplete for client-side filtering
  - feat(core-dataverse): add onReady hook to Panel and new command constants
  - feat(core-dataverse): add textarea wizard page type and multi-select QuickPick support
  - chore(changeset): set updateInternalDependencies to none

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
