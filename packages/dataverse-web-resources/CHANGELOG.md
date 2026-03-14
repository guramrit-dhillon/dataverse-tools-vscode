# dataverse-web-resources

## 0.5.0

### Minor Changes

- [`e18402c`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/e18402c7b89d8422f181990d167d69ffb0438688) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix(metadata): sort entities by display name instead of logical name
  - fix(trace-viewer): make badge text selectable
  - chore: update package-lock.json for audit-viewer workspace
  - refactor(core-dataverse): move extension-specific types and constants to owning extensions
  - docs: add audit viewer to root README
  - fix(tools-pack): include all extensions in extension pack and release workflow
  - docs: update extension READMEs with complete suite listing and new features
  - feat(audit-viewer): add audit history viewer extension

## 0.4.0

### Minor Changes

- [`42522a1`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/42522a1755206ec2d359924fa5757bae7d190aff) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix(workflows): register new commands, reorder context menu, rename Properties
  - feat(workflows): add entity contributions and lift category labels to module scope
  - feat(workflows): wire Properties and XAML commands into extension
  - feat(workflows): add Properties wizard and XAML viewer commands
  - feat(workflows): expand service layer with XAML, update, and entity queries
  - feat(core-dataverse): add workflow and designer command IDs

## 0.3.0

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

## 0.2.0

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
