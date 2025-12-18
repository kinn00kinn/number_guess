import { useEffect, useState } from "react";
import { Lang } from "@/types";

export default function TurnOverlay({
  isMyTurn,
  lang,
}: {
  isMyTurn: boolean;
  lang: Lang;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isMyTurn) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2000); // 2秒後に消える
      return () => clearTimeout(timer);
    }
  }, [isMyTurn]);

  if (!show) return null;

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
