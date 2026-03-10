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

- ci(release): add assemblies and decompiler to extension detection matrix
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
