import * as React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "shared-views";
import "shared-views/panel.css";
import "shared-views/fullpage.css";
import "./styles/traceLog.css";
import { TraceLogApp } from "./components/TraceLogApp";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<ErrorBoundary><TraceLogApp /></ErrorBoundary>);
}
