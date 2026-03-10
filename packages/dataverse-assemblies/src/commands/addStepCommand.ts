import { type DataverseAccountApi, type DataverseEnvironment, type PluginType } from "core-dataverse";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { stepWizard } from "./stepWizard";

export async function addStepCommand(
  _api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  pluginType: PluginType,
  env: DataverseEnvironment | undefined
): Promise<void> {
  if (!env || !pluginType.plugintypeid) { return; }
  const saved = await stepWizard(pluginType, env, registrationSvc);
  if (saved) { onRefresh(); }
}
