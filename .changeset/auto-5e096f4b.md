---
"dataverse-assemblies": patch
"dataverse-assembly-decompiler": patch
"dataverse-audit-viewer": patch
"dataverse-environments": patch
"dataverse-metadata": patch
"dataverse-plugin-trace-viewer": patch
"dataverse-query-analyzer": patch
"dataverse-web-resources": patch
"dataverse-workflows": patch
"fetchxml-builder": patch
---

- fix(fetchxml): log parse errors instead of swallowing silently
- fix(assemblies): clean up step config sessions on document close
- fix: add refresh generation counter to prevent stale in-flight cache results
- fix: snapshot this.env in async handlers to prevent mid-flight env swaps
- fix(metadata): scope panels by env, snapshot env in handlers, fix tree keys
- fix(decompiler): scope assembly caches by environment ID
- fix(auth): make token cache instance-level and clear on credential change
- docs: update feature-status for shared-views TreeView and metadata form/view features
