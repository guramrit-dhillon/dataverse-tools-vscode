import * as React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "shared-views";
import "shared-views/panel.css";
import "./styles/details.css";
import { DetailsApp } from "./components/DetailsApp";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<ErrorBoundary><DetailsApp /></ErrorBoundary>);
}
