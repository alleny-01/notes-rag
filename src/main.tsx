import "core-js/actual/iterator";
import "core-js/actual/promise/with-resolvers";
import "./lib/pdfCompatibility";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import { App } from "./app/App";

createRoot(document.getElementById("app")!).render(
  <StrictMode><App /></StrictMode>,
);
