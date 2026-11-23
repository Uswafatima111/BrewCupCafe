import { useEffect, useState } from "react";
import { lazy, Suspense } from "react";
import SceneErrorBoundary from "./components/SceneErrorBoundary";
const CafeScene = lazy(() => import("./components/CafeScene"));

function LoadingScreen({ done }) {
  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-[#03170e] text-[#d9a441] transition-opacity duration-700 ${done ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <div className="text-center">
        <img src="/images/logo.jpg" alt="Brew Cup Cafe" className="mx-auto mb-4 h-24 rounded-full" onError={(e) => (e.currentTarget.style.display = "none")} />
        <p className="tracking-[0.4em]">BREW CUP CAFE</p>
      </div>
    </div>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [overlay, setOverlay] = useState(null); // null | "chat" | "menu"

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Will be passed to <CafeScene onInteract={handleInteract} /> later
  const handleInteract = (name) => {
    if (name === "INTERACT_Telephone") setOverlay("chat");
    else setOverlay("menu"); // Register or MenuDisplay
  };

  return (
  <>
    <LoadingScreen done={loaded} />
    <SceneErrorBoundary>
      <Suspense fallback={null}>
        <CafeScene onInteract={handleInteract} />
      </Suspense>
    </SceneErrorBoundary>
    {overlay && (
      <div className="fixed inset-0 z-40 grid place-items-center bg-black/60" onClick={() => setOverlay(null)}>
        <div className="rounded-xl bg-[#03170e] p-6" onClick={(e) => e.stopPropagation()}>
          <p>{overlay} panel goes here</p>
          <button className="mt-4 underline" onClick={() => setOverlay(null)}>Close</button>
        </div>
      </div>
    )}
  </>
);
}