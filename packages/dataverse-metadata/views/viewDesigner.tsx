import * as React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "shared-views";
import "shared-views/panel.css";
import "shared-views/fullpage.css";
import "./styles/viewDesigner.css";
import { ViewDesigner } from "./components/ViewDesigner";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<ErrorBoundary><ViewDesigner /></ErrorBoundary>);
}
