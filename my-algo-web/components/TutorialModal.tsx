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

  // チュートリアルのステップ定義
  const steps = [
    {
      title: lang === "ja" ? "基本ルール" : "Basic Rules",
      icon: <Info className="text-blue-500" size={32} />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {lang === "ja"
              ? "0〜11の数字が書かれた「黒」と「白」のカードを使います。相手の伏せられたカードの数字をすべて当てた方が勝ちです。"
              : "Use Black and White cards numbered 0-11. The winner is the one who guesses all of the opponent's hidden cards."}
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
              <span className="bg-slate-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">
                !
              </span>
              {lang === "ja"
                ? "絶対のルール：並び順"
                : "The Golden Rule: Sorting"}
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {lang === "ja"
                ? "カードは必ず「左から小さい順」に並びます。同じ数字なら「黒」が左です。"
                : "Cards are always sorted from smallest to largest (left to right). If numbers are equal, Black is on the left."}
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
      title: lang === "ja" ? "自分のターン" : "Your Turn",
      icon: <Swords className="text-red-500" size={32} />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {lang === "ja"
              ? "山札からカードを1枚引きます。そのカードを使って相手のカードを攻撃（推理）します。"
              : "Draw a card from the deck. Use that card to attack (guess) the opponent's card."}
          </p>
          <ul className="space-y-2 text-sm text-slate-700 bg-red-50 p-4 rounded-xl">
            <li className="flex gap-2">
              <span className="font-bold text-red-500">1.</span>
              {lang === "ja"
                ? "相手の伏せカードを選ぶ"
                : "Select an opponent's hidden card"}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-red-500">2.</span>
              {lang === "ja"
                ? "数字を宣言する (0-11)"
                : "Guess the number (0-11)"}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-red-500">3.</span>
              {lang === "ja"
                ? "当たれば続けて攻撃可能！"
                : "If correct, you can attack again!"}
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: lang === "ja" ? "失敗とパス" : "Miss & Stay",
      icon: <ShieldAlert className="text-amber-500" size={32} />,
      content: (
        <div className="space-y-4">
          <div className="p-3 border-l-4 border-red-400 bg-slate-50">
            <h5 className="font-bold text-slate-800 text-sm">
              {lang === "ja" ? "予想が外れたら..." : "If you miss..."}
            </h5>
            <p className="text-xs text-slate-600 mt-1">
              {lang === "ja"
                ? "引いてきた自分のカードを公開（Open）しなければなりません。これが弱点になります。"
                : "You must reveal (Open) the card you drew. This exposes your hand."}
            </p>
          </div>
          <div className="p-3 border-l-4 border-blue-400 bg-slate-50">
            <h5 className="font-bold text-slate-800 text-sm">
              {lang === "ja" ? "攻撃をやめる (STAY)" : "Stop Attack (STAY)"}
            </h5>
            <p className="text-xs text-slate-600 mt-1">
              {lang === "ja"
                ? "攻撃が成功したとき、リスクを避けてターンを終了できます。引いたカードを伏せたまま手札に加えられます。"
                : "If you guess correctly, you can end your turn to avoid risk. The drawn card remains hidden."}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: lang === "ja" ? "勝利条件" : "Victory",
      icon: <Trophy className="text-yellow-500" size={32} />,
      content: (
        <div className="text-center py-6">
          <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
            <Trophy className="text-yellow-600 w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {lang === "ja" ? "全て暴く" : "Reveal All"}
          </h3>
          <p className="text-slate-600 text-sm">
            {lang === "ja"
              ? "相手の手札をすべて「Open」状態にすればあなたの勝ちです！"
              : "You win if you make all of your opponent's cards 'Open'!"}
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
