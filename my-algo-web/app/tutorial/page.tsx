"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  MousePointer2,
} from "lucide-react";

import GameBoard from "@/components/GameBoard";
import { GuessModal } from "@/components/Modals"; // Assume these are exported from Modals
import { GameState, Card, Lang } from "@/types";
import { ToastItem } from "@/components/Toast";

// --- Mock Data Helpers ---

const createCard = (
  color: "black" | "white",
  number: number,
  isOpen: boolean,
  id: string
): Card => ({ color, number, isOpen, id });

const ME_ID = "me";
const CPU_ID = "cpu";

// --- Tutorial Scenario ---

type Step = {
  id: string;
  title: string;
  description: string | React.ReactNode;
  highlight?: "hand" | "opponent" | "deck" | "drawn" | "stay";
  expectedAction?: "click_card" | "guess" | "stay" | "next";
  targetCardIndex?: number; // for click_card
  targetGuess?: number; // for guess
  position?: "top" | "bottom"; // Message position
};

const STEPS: Step[] = [
  {
    id: "intro",
    title: "チュートリアルへようこそ",
    description: "実際にゲームをプレイしながら、アルゴの基本ルールと勝ち方を学びましょう。",
    expectedAction: "next",
    position: "bottom",
  },
  {
    id: "hand_sort",
    title: "手札のルール",
    description: (
      <span>
        あなたの手札を見てください。<br />
        カードは<strong>左から小さい順</strong>に並んでいます。<br />
        同じ数字なら<strong>黒が左</strong>です。これはアルゴの絶対のルールです。
      </span>
    ),
    highlight: "hand",
    expectedAction: "next",
    position: "top",
  },
  {
    id: "draw",
    title: "カードを引く",
    description: "あなたのターンです。まずは山札からカードを1枚引きます。今回は「白の4」を引きました。",
    highlight: "drawn",
    expectedAction: "next",
    position: "bottom",
  },
  {
    id: "attack_select",
    title: "攻撃するカードを選ぶ",
    description: (
      <span>
        相手のカードを1枚選んで数字を推理（攻撃）します。<br />
        今回は<strong>真ん中のカード</strong>をクリックしてみましょう。
      </span>
    ),
    highlight: "opponent",
    expectedAction: "click_card",
    targetCardIndex: 1,
    position: "bottom",
  },
  {
    id: "guess",
    title: "数字を推理する",
    description: (
      <span>
        数字を宣言します。相手の手札も左から順に並んでいます。<br />
        左が「2」、右が「9」なら、真ん中は...<br />
        <strong>「4」</strong> と予想してみましょう！
      </span>
    ),
    expectedAction: "guess",
    targetGuess: 4,
    position: "bottom",
  },
  {
    id: "result_success",
    title: "成功！",
    description: (
      <span>
        正解です！<br />
        予想が当たると、そのカードは<strong>Open（公開）</strong>されます。<br />
        成功すると、続けて他のカードを攻撃することもできます。
      </span>
    ),
    highlight: "opponent",
    expectedAction: "next",
    position: "bottom",
  },
  {
    id: "stay_info",
    title: "リスクとSTAY",
    description: (
      <span>
        しかし、もし続けて攻撃して失敗すると、さっき引いた自分のカードを公開しなければなりません。<br />
        リスクを避けるために、今回は<strong>STAY（終了）</strong>しましょう。
      </span>
    ),
    highlight: "stay",
    expectedAction: "stay",
    position: "top",
  },
  {
    id: "conclusion",
    title: "チュートリアル完了",
    description: "基本はこれだけです！相手のカードを全てOpenにすれば勝利です。実践でさらに腕を磨きましょう！",
    expectedAction: "next",
    position: "bottom",
  },
];

export default function TutorialPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [lang, setLang] = useState<Lang>("ja");
  
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    phase: "playing",
    turnPlayerId: ME_ID,
    me: {
      id: ME_ID,
      name: "You",
      hand: [
        createCard("black", 1, false, "h1"),
        createCard("black", 5, false, "h2"),
        createCard("white", 6, false, "h3"),
      ],
    },
    players: [
      { id: ME_ID, hand: [] }, // filled in 'me'
      { id: CPU_ID, name: "Sensei", hand: [] },
    ],
    opponentHand: [
      createCard("black", 2, false, "o1"),
      createCard("white", 4, false, "o2"), // Target
      createCard("white", 9, false, "o3"),
    ],
    drawnCard: null,
    winner: null,
    deckCount: 10,
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [guessModal, setGuessModal] = useState({ show: false, targetIndex: -1 });
  const [hasMoved, setHasMoved] = useState(false);

  const currentStep = STEPS[stepIndex];

  // Helper to update step
  const nextStep = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      router.push("/");
    }
  };

  const addToast = (message: string, type: "info" | "success" | "error" = "info") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Step Effects ---
  useEffect(() => {
    // Step specific state changes
    if (currentStep.id === "draw") {
      setGameState((prev) => ({
        ...prev,
        drawnCard: createCard("white", 4, false, "drawn"),
      }));
    }
  }, [currentStep.id]);

  // --- Handlers ---

  const handleCardClick = (index: number) => {
    if (currentStep.expectedAction !== "click_card") return;

    if (index === currentStep.targetCardIndex) {
      // Correct card clicked
      setGuessModal({ show: true, targetIndex: index });
      nextStep();
    } else {
      addToast("そのカードではありません。指示に従ってください。", "error");
    }
  };

  const handleAttack = (guess: number) => {
    if (currentStep.expectedAction !== "guess") return;

    if (guess === currentStep.targetGuess) {
      // Correct guess
      setGuessModal({ show: false, targetIndex: -1 });
      
      // Reveal card
      setGameState((prev) => {
        const newOpponentHand = [...prev.opponentHand];
        newOpponentHand[1].isOpen = true; // Hardcoded for tutorial
        return { ...prev, opponentHand: newOpponentHand };
      });

      addToast("正解！ (Correct!)", "success");
      setHasMoved(true);
      nextStep();
    } else {
      addToast(`ヒント: 答えは ${currentStep.targetGuess} です`, "error");
    }
  };

  const handleStay = () => {
    if (currentStep.expectedAction !== "stay" && currentStep.id !== "result_success") return;
    
    // Add drawn card to hand (visual only)
    setGameState((prev) => {
      if (!prev.drawnCard) return prev;
      return {
        ...prev,
        drawnCard: null,
        me: {
          ...prev.me,
          hand: [...prev.me.hand, prev.drawnCard].sort((a, b) => {
            if (a.number !== b.number) return a.number! - b.number!;
            return a.color === "black" ? -1 : 1;
          }),
        },
      };
    });
    
    addToast("ターン終了 (Turn End)", "success");
    if (currentStep.id === "result_success") {
      setStepIndex(STEPS.findIndex(s => s.id === "conclusion"));
    } else {
      nextStep();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-safe">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                <Lightbulb size={20} />
            </div>
            <div>
                <h1 className="font-bold text-slate-800 text-sm">Tutorial</h1>
                <p className="text-[10px] text-slate-500 font-mono">Step {stepIndex + 1}/{STEPS.length}</p>
            </div>
        </div>
        <button 
            onClick={() => router.push("/")}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
            Exit
        </button>
      </header>

      {/* Main Game Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <GameBoard
          lang={lang}
          gameState={gameState}
          isMyTurn={true} // Always my turn for tutorial
          isProcessing={false}
          isConnected={true}
          isReconnecting={false}
          hasMoved={hasMoved || currentStep.id === "stay_info" || currentStep.id === "result_success"}
          gameLogs={[]}
          lastAttack={null}
          onCardClick={handleCardClick}
          onStay={handleStay}
          toasts={toasts}
          removeToast={removeToast}
          highlightStay={currentStep.id === "stay_info"}
        />

        {/* Overlay Instruction */}
        <div 
            className={`absolute inset-x-0 p-4 z-40 pointer-events-none flex justify-center transition-all duration-300 ${
                currentStep.position === "top" ? "top-0 pt-6" : "bottom-0 pb-8"
            }`}
        >
            <div 
                key={currentStep.id}
                className="max-w-md w-full bg-slate-900/90 backdrop-blur text-white p-5 rounded-2xl shadow-2xl pointer-events-auto animate-in zoom-in-95 fade-in duration-300"
            >
                <div className="flex gap-4">
                    <div className="shrink-0 mt-1">
                         {currentStep.expectedAction === "click_card" ? (
                             <MousePointer2 className="text-orange-400 animate-bounce" />
                         ) : (
                             <CheckCircle2 className="text-emerald-400" />
                         )}
                    </div>
                    <div className="flex-1 space-y-3">
                        <h3 className="font-bold text-lg">{currentStep.title}</h3>
                        <div className="text-sm text-slate-300 leading-relaxed">
                            {currentStep.description}
                        </div>
                        
                        {currentStep.expectedAction === "next" && (
                            <button 
                                onClick={nextStep}
                                className="w-full bg-white text-slate-900 font-bold py-2.5 rounded-xl hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                            >
                                次へ (Next) <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Click Blockers / Highlighters (Optional visual aids) */}
        {/* Can add absolute divs to dim non-active areas if needed, but keeping it simple for now */}
      </div>

      {/* Modals */}
      {guessModal.show && (
        <GuessModal
          lang={lang}
          isProcessing={false}
          isConnected={true}
          onClose={() => {
            setGuessModal({ show: false, targetIndex: -1 });
            if (currentStep.id === "guess") setStepIndex((prev) => prev - 1);
          }}
          onAttack={handleAttack}
        />
      )}
    </div>
  );
}
