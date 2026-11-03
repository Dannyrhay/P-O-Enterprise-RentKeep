import React, { Suspense, lazy, useEffect, useState } from "react";
import Opening from "./Opening";
import "./styles.css";
const Workspace =
  import.meta.env.VITE_RENTKEEP_MODE === "live"
    ? lazy(() => import("./LiveWorkspace"))
    : lazy(() => import("./App"));
export default function Entry() {
  const [opening, setOpening] = useState(() => {
    try {
      return (
        !sessionStorage.getItem("rentkeep-opened") &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => {
      setOpening(false);
      try {
        sessionStorage.setItem("rentkeep-opened", "1");
      } catch {}
    }, 750);
    return () => clearTimeout(timer);
  }, [opening]);
  return (
    <>
      <Suspense fallback={<Opening />}>
        <Workspace />
      </Suspense>
      {opening && <Opening />}
    </>
  );
}
