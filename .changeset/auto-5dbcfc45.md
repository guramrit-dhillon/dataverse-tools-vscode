---
"dataverse-assemblies": minor
"dataverse-assembly-decompiler": minor
"dataverse-environments": minor
"dataverse-metadata": minor
"dataverse-plugin-trace-viewer": minor
"dataverse-query-analyzer": minor
"dataverse-tools-pack": minor
"dataverse-web-resources": minor
"dataverse-workflows": minor
"fetchxml-builder": minor
---

- fix(release): skip already-published extensions instead of failing pipeline
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
