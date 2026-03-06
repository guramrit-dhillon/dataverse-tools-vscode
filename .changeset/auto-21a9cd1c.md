---
"dataverse-assembly-decompiler": minor
"dataverse-environments": minor
"dataverse-metadata": minor
"dataverse-plugin-trace-viewer": minor
"dataverse-query-analyzer": minor
"dataverse-tools-pack": minor
"dataverse-workflows": minor
"fetchxml-builder": minor
---

- fix(dataverse-tools-pack): remove unnecessary dependency and add --no-dependencies flag
- ci: include dataverse-tools-pack in release workflow
- feat: add dataverse-tools-pack extension bundle package
- fix(dataverse-environments): pre-warm auth token and fix getChildren loading state
- refactor(core-dataverse): replace axios with native fetch
