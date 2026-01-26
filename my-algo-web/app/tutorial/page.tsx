"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  MousePointer2,
} from "lucide-react";

import GameBoard from "@/components/GameBoard";
import { GuessModal } from "@/components/Modals";
import { GameState, Card, Lang } from "@/types";
import { ToastItem } from "@/components/Toast";
import { TRANSLATIONS } from "@/utils/constant";

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

export default function TutorialPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [lang, setLang] = useState<Lang>("ja");
  
  const t = TRANSLATIONS[lang];

  const STEPS: Step[] = useMemo(() => [
    {
      id: "intro",
      title: t.tutIntroTitle,
      description: t.tutIntroDesc,
      expectedAction: "next",
      position: "bottom",
    },
    {
      id: "hand_sort",
      title: t.tutHandTitle,
      description: (
        <span className="whitespace-pre-line">
            {t.tutHandDesc}
        </span>
      ),
      highlight: "hand",
      expectedAction: "next",
      position: "top",
    },
    {
      id: "draw",
      title: t.tutDrawTitle,
      description: t.tutDrawDesc,
      highlight: "drawn",
      expectedAction: "next",
      position: "bottom",
    },
    {
      id: "attack_select",
      title: t.tutAttackTitle,
      description: (
        <span className="whitespace-pre-line">
            {t.tutAttackDesc}
        </span>
      ),
      highlight: "opponent",
      expectedAction: "click_card",
      targetCardIndex: 1,
      position: "bottom",
    },
    {
      id: "guess",
      title: t.tutGuessTitle,
      description: (
        <span className="whitespace-pre-line">
           {t.tutGuessDesc}
        </span>
      ),
      expectedAction: "guess",
      targetGuess: 4,
      position: "bottom",
    },
    {
      id: "result_success",
      title: t.tutResultTitle,
      description: (
        <span className="whitespace-pre-line">
            {t.tutResultDesc}
        </span>
      ),
      highlight: "opponent",
      expectedAction: "next",
      position: "bottom",
    },
    {
      id: "stay_info",
      title: t.tutStayTitle,
      description: (
        <span className="whitespace-pre-line">
            {t.tutStayDesc}
        </span>
      ),
      highlight: "stay",
      expectedAction: "stay",
      position: "top",
    },
    {
      id: "conclusion",
      title: t.tutEndTitle,
      description: t.tutEndDesc,
      expectedAction: "next",
      position: "bottom",
    },
  ], [t]);

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
        <div className="flex items-center gap-2">
            <button
                onClick={() => setLang(lang === "ja" ? "en" : "ja")}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            >
                {lang === "ja" ? "EN" : "JP"}
            </button>
            <button 
                onClick={() => router.push("/")}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
                {t.tutExit}
            </button>
        </div>
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
                                {t.tutNext} <ChevronRight size={16} />
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
