import * as React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "shared-views";
import "shared-views/panel.css";
import "shared-views/fullpage.css";
import "./styles/imageConfig.css";
import { ImageConfigApp } from "./components/ImageConfigApp";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<ErrorBoundary><ImageConfigApp /></ErrorBoundary>);
}
