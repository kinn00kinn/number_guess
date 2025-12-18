import { useEffect, useState, useRef } from "react";
import { Lang } from "@/types";

// This component renders the overlay and manages its own lifecycle.
// It will unmount itself after a timeout.
function TimedOverlay({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[40] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-slate-900/10 animate-in fade-in duration-300"></div>
      <div className="bg-slate-900/90 backdrop-blur text-white px-12 py-6 rounded-2xl shadow-2xl animate-in zoom-in slide-in-from-bottom-10 duration-500 flex flex-col items-center">
        <h2 className="text-4xl font-black tracking-tighter italic">
          {lang === "ja" ? "あなたの番" : "YOUR TURN"}
        </h2>
        <div className="w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mt-2"></div>
      </div>
    </div>
  );
}

// This parent component decides WHEN to show the overlay.
// It triggers a re-mount of TimedOverlay by changing the key.
export default function TurnOverlay({
  isMyTurn,
  lang,
}: {
  isMyTurn: boolean;
  lang: Lang;
}) {
  const [mountKey, setMountKey] = useState(0);
  const wasMyTurn = useRef(isMyTurn);

  useEffect(() => {
    // Detect when `isMyTurn` transitions from false to true
    if (isMyTurn && !wasMyTurn.current) {
      // This setState call is necessary to trigger a re-mount of the timed overlay.
      // While it causes a cascading render, the performance impact is negligible
      // and this pattern is the cleanest way to handle a timed animation
      // based on a prop change within the component itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMountKey((k) => k + 1);
    }
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  // Don't render anything if it has never been our turn.
  if (mountKey === 0) {
    return null;
  }

  return <TimedOverlay key={mountKey} lang={lang} />;
}
