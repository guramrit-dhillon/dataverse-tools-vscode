# dataverse-audit-viewer

## 0.8.0

### Minor Changes

- [`42fad4d`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/42fad4d3317ae201b50ff29bedb237570aac047f) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - feat(trace-viewer): right-align environment bar for consistency
  - feat(audit-viewer): inline audit status indicators and toggles
  - feat(audit-viewer): add org and entity audit enablement management
  - fix(shared-views): handle ~spin modifier in Codicon component

## 0.7.2

### Patch Changes

- [`f8dcfd1`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/f8dcfd1ba380c99846a4bca9f90544417a2f7ea3) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - docs: replace relative links with absolute GitHub URLs for marketplace compatibility
  - docs: remove .csproj requirement from getting started steps
  - fix(activation): remove redundant activationEvents from non-assembly extensions

## 0.7.1

### Patch Changes

- [`33cac24`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/33cac2449fd2ce60c18dfc2d08633b63ba3dc6cc) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - docs: rewrite root README for broader Dataverse Tools scope
  - docs(metadata): revise README to match current implementation
  - docs: update acknowledgements in extension READMEs
  - fix(docs): correct links, badges, and architecture diagram in root README
  - docs: add feedback & community section to all READMEs
  - docs: add extension status roadmap
  - docs: add feature status tracking to all extensions

## 0.7.0

### Minor Changes

- [`e18402c`](https://github.com/guramrit-dhillon/dataverse-tools-vscode/commit/e18402c7b89d8422f181990d167d69ffb0438688) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - - fix(metadata): sort entities by display name instead of logical name
  - fix(trace-viewer): make badge text selectable
  - chore: update package-lock.json for audit-viewer workspace
  - refactor(core-dataverse): move extension-specific types and constants to owning extensions
  - docs: add audit viewer to root README
  - fix(tools-pack): include all extensions in extension pack and release workflow
  - docs: update extension READMEs with complete suite listing and new features
  - feat(audit-viewer): add audit history viewer extension

## 0.6.0

### Minor Changes

- Initial release
- View and analyze audit history for Dataverse records
- Field-level diff view showing old and new values
- Entity autocomplete filtered to auditable entities
- Open from entity explorer tree or environment context menu
- Multi-panel support for different environments
