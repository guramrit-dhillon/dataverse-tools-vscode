import { type DataverseAccountApi, type DataverseEnvironment, type PluginType } from "core-dataverse";
import type { SdkMessageProcessingStep } from "../types";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { stepWizard } from "./stepWizard";

export async function editStepCommand(
  _api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  step: SdkMessageProcessingStep,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env || !step.sdkmessageprocessingstepid) { return; }

  const pluginType: PluginType = {
    plugintypeid: step.eventhandler_plugintype?.plugintypeid ?? "",
    typename:     step.eventhandler_plugintype?.name ?? "",
    friendlyname: step.eventhandler_plugintype?.name ?? "",
    name:         step.eventhandler_plugintype?.name ?? "",
    assemblyname: "",
  };
  const saved = await stepWizard(pluginType, env, registrationSvc, step);
  if (saved) { onRefresh(); }
}
