/** Command IDs owned by the Assemblies extension. */
export const Commands = {
  DeployAssembly: "dataverse-tools.deployAssembly",
  AddStep: "dataverse-tools.addStep",
  EditStep: "dataverse-tools.editStep",
  EditStepConfig: "dataverse-tools.editStepConfig",
  EditStepSecureConfig: "dataverse-tools.editStepSecureConfig",
  EditStepDescription: "dataverse-tools.editStepDescription",
  EnableStep: "dataverse-tools.enableStep",
  DisableStep: "dataverse-tools.disableStep",
  DeleteNode: "dataverse-tools.deleteNode",
  DownloadAssembly: "dataverse-tools.downloadAssembly",
  RegisterImage: "dataverse-tools.registerImage",
  EditImage: "dataverse-tools.editImage",
  UnregisterImage: "dataverse-tools.unregisterImage",
  RenameNode: "dataverse-tools.renameNode",
  ChangeActivityGroup: "dataverse-tools.changeActivityGroup",
  ShowManaged: "dataverse-tools.assemblies.showManaged",
  HideManaged: "dataverse-tools.assemblies.hideManaged",
  /** Registered by dataverse-assemblies; delegates to TraceLog if plugin-trace-viewer is installed. */
  OpenTraceViewer: "dataverse-tools.openTraceViewer",
} as const;
