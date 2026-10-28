import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./components/Toasts";
import ScrollToTop from "./components/ScrollToTop";
// Fonts are served from this website, not from Google, so no visitor data goes to a third party.
// Latin and Latin Extended cover German (ä, ö, ü, ß) and most learners' names.
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-ext-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-ext-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-ext-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow/latin-ext-700.css";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "@fontsource/barlow-semi-condensed/latin-ext-600.css";
import "@fontsource/barlow-semi-condensed/latin-700.css";
import "@fontsource/barlow-semi-condensed/latin-ext-700.css";
import "@fontsource/playwrite-de-grund/latin-300.css";
import "@fontsource/playwrite-de-grund/latin-400.css";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <ScrollToTop />
          <App />
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Installable app: only over HTTPS (online). Caches design files, never private data.
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
