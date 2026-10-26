import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { App } from "./App";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/roboto-condensed/latin-900.css";
import "@fontsource/roboto-condensed/cyrillic-900.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/cyrillic-400.css";
import "@fontsource/ibm-plex-mono/cyrillic-500.css";
import "./style.css";
import "./styles/effects.css";
import "./styles/templates.css";
import "./styles/accounts.css";
import "./styles/raw-signal.css";
import "./styles/explore.css";
import "./styles/xerox-riot.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
