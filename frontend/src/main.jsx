import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./components/Toasts";
import ScrollToTop from "./components/ScrollToTop";
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
