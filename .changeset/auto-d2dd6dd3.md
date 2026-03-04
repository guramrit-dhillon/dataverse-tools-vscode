---
"dataverse-assemblies": patch
"dataverse-assembly-decompiler": patch
"dataverse-environments": patch
"dataverse-metadata": patch
"dataverse-plugin-trace-viewer": patch
"dataverse-query-analyzer": patch
"dataverse-workflows": patch
"fetchxml-builder": patch
---

- fix: improve CI workflow reliability
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
