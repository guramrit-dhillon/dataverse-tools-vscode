import * as React from "react";
import { Codicon } from "./Codicon";

interface EnvironmentBarProps {
  envName: string;
  onChangeEnv?: () => void;
  icon?: string;
}

/**
 * Shows the current Dataverse environment name with a plug icon and Change link.
 * Used consistently across trace viewer and query analyzer.
 */
export function EnvironmentBar({
  envName,
  onChangeEnv,
  icon = "plug",
}: EnvironmentBarProps): React.ReactElement {
  return (
    <div className="env-bar">
      <Codicon name={icon} />
      <span className="env-name">{envName}</span>
      {onChangeEnv && (
        <button type="button" className="link-btn" onClick={onChangeEnv}>
          Change
        </button>
      )}
    </div>
  );
}
