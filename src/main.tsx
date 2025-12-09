import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/consoleFilter"; // Import console filter to hide GoTrue logs

// SPA Redirect Handler: Handle redirects from 404.html
const spaRedirectPath = sessionStorage.getItem('spa-redirect');
if (spaRedirectPath && spaRedirectPath !== '/') {
    sessionStorage.removeItem('spa-redirect');
    // Use history.replaceState to restore the original URL without reload
    window.history.replaceState(null, '', spaRedirectPath);
}

createRoot(document.getElementById("root")!).render(<App />);
