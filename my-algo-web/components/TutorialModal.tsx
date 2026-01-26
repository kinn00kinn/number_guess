import { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Info,
  Swords,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { Card, Lang } from "@/types";
import CardView from "./CardView"; // 既存のCardViewを再利用
import { TRANSLATIONS } from "@/utils/constant";

// モック用のカードデータ
const MOCK_CARDS: { [key: string]: Card[] } = {
  sortExample: [
    { color: "black", number: 1, isOpen: true, id: "demo-1" },
    { color: "black", number: 4, isOpen: true, id: "demo-2" },
    { color: "white", number: 4, isOpen: true, id: "demo-3" },
    { color: "white", number: 9, isOpen: true, id: "demo-4" },
  ],
  hiddenExample: [
    { color: "black", number: 2, isOpen: false, id: "hide-1" },
    { color: "white", number: 5, isOpen: false, id: "hide-2" },
  ],
};

export default function TutorialModal({
  lang,
  onClose,
}: {
  lang: Lang;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const t = TRANSLATIONS[lang];

  // チュートリアルのステップ定義
  const steps = [
    {
      title: t.tutBasicRule,
      icon: <Info className="text-blue-500" size={32} />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {t.tutBasicRuleDesc}
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
              <span className="bg-slate-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">
                !
              </span>
              {t.tutGoldenRule}
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {t.tutGoldenRuleDesc}
            </p>
            {/* 実際のカードコンポーネントで可視化 */}
            <div className="flex justify-center gap-2 scale-90 origin-top">
              {MOCK_CARDS.sortExample.map((c, i) => (
                <CardView key={i} card={c} isOwned={true} />
              ))}
            </div>
            <div className="text-center mt-2 text-[10px] text-slate-400 font-mono">
              1 &lt; 4(Black) &lt; 4(White) &lt; 9
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t.yourTurn,
      icon: <Swords className="text-red-500" size={32} />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t.tutYourTurnDesc}
          </p>
          <ul className="space-y-2 text-sm text-slate-700 bg-red-50 p-4 rounded-xl">
            <li className="flex gap-2">
              <span className="font-bold text-red-500">1.</span>
              {t.tutStep1}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-red-500">2.</span>
              {t.tutStep2}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-red-500">3.</span>
              {t.tutStep3}
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: t.tutMissStay,
      icon: <ShieldAlert className="text-amber-500" size={32} />,
      content: (
        <div className="space-y-4">
          <div className="p-3 border-l-4 border-slate-400 bg-slate-50">
            <p className="text-xs text-slate-600 leading-relaxed">
              {t.tutMissStayDesc1}
            </p>
          </div>
          <div className="p-3 border-l-4 border-blue-400 bg-slate-50">
            <h5 className="font-bold text-slate-800 text-sm">
              {t.tutMissStayTitle2}
            </h5>
            <p className="text-xs text-slate-600 mt-1">
              {t.tutMissStayDesc2}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: t.tutVictory,
      icon: <Trophy className="text-yellow-500" size={32} />,
      content: (
        <div className="text-center py-6">
          <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
            <Trophy className="text-yellow-600 w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {t.tutVictoryTitle}
          </h3>
          <p className="text-slate-600 text-sm">
            {t.tutVictoryDesc}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 pb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3 relative z-10">
            {steps[step].icon}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Tutorial {step + 1}/{steps.length}
              </p>
              <h2 className="text-2xl font-black">{steps[step].title}</h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="animate-in slide-in-from-right-4 fade-in duration-300 key={step}">
            {steps[step].content}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="p-3 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? "bg-slate-900 w-6" : "bg-slate-300"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (step < steps.length - 1) setStep(step + 1);
              else onClose();
            }}
            className="p-3 rounded-xl bg-slate-900 text-white hover:bg-black transition-colors shadow-lg active:scale-95"
          >
            {step === steps.length - 1 ? (
              <X size={24} />
            ) : (
              <ChevronRight size={24} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
