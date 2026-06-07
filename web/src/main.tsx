import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { W0Demo } from "./_w0demo/W0Demo.tsx";

// THROWAWAY (W0): `/?w0demo` mounts the design-system verification screen
// instead of the real app, so the shared primitives + tokens can be
// eyeballed without auth. Remove this branch and ./_w0demo after sign-off.
const isW0Demo =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("w0demo");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isW0Demo ? <W0Demo /> : <App />}</StrictMode>,
);
