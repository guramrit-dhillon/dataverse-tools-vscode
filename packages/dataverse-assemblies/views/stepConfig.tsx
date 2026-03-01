import * as React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "shared-views";
import "shared-views/panel.css";
import "shared-views/fullpage.css";
import "./styles/stepConfig.css";
import { StepForm } from "./components/StepForm";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<ErrorBoundary><StepForm /></ErrorBoundary>);
}
