/**
 * core-dataverse — shared library
 *
 * Exports only what is genuinely shared across multiple extensions:
 *   - All Dataverse types
 *   - DataverseWebApiClient (generic HTTP client for OData)
 *   - DataverseAccountApi (the auth/env contract owned by dataverse-environments)
 *   - Utility functions and Logger
 *   - Command ID constants
 *   - Panel base class for editor tab webviews
 *   - View base class for sidebar webviews
 *
 * Authentication, EnvironmentManager, tree providers, commands, and
 * extension-specific webviews live in their respective extension packages.
 */
export * from "./constants";
export * from "./types";
export * from "./interfaces";
export * from "./services";
export * from "./utils";
export * from "./webviews/Panel";
export * from "./webviews/View";
