import { type DataverseAccountApi, type DataverseEnvironment } from "core-dataverse";
import type { SdkMessageProcessingStep } from "../types";
import { type IRegistrationService } from "../interfaces/IRegistrationService";
import { imageWizard } from "./imageQuickInput";

export async function registerImageCommand(
  _api: DataverseAccountApi,
  registrationSvc: IRegistrationService,
  onRefresh: () => void,
  step: SdkMessageProcessingStep,
  env: DataverseEnvironment | undefined,
): Promise<void> {
  if (!env || !step.sdkmessageprocessingstepid) { return; }
  const saved = await imageWizard(step, env, registrationSvc);
  if (saved) { onRefresh(); }
}
