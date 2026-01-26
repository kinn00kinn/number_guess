import { GameState, Lang, LogItem } from "@/types";
import { TRANSLATIONS } from "@/utils/constant";
import CardView from "./CardView";
import SortIndicator from "./SortIndicator";
import { User as UserIcon, Cpu, Loader2, WifiOff } from "lucide-react";
import { ToastContainer, ToastItem } from "./Toast";

type Props = {
  lang: Lang;
  gameState: GameState;
  isMyTurn: boolean;
  isProcessing: boolean;
  isConnected: boolean;
  isReconnecting: boolean; // ★追加
  hasMoved: boolean;
  gameLogs: LogItem[];
  lastAttack: {
    targetIndex: number;
    guess: number;
    isYourCard: boolean;
  } | null;
  onCardClick: (index: number) => void;
  onStay: () => void;
  toasts: ToastItem[]; // ★追加
  removeToast: (id: string) => void; // ★追加
  highlightStay?: boolean; // ★追加
};

export default function GameBoard({
  lang,
  gameState,
  isMyTurn,
  isProcessing,
  isConnected,
  isReconnecting, // ★追加
  hasMoved,
  gameLogs,
  lastAttack,
  onCardClick,
  onStay,
  toasts, // ★追加
  removeToast, // ★追加
  highlightStay, // ★追加
}: Props) {
  const t = TRANSLATIONS[lang];

  // 相手プレイヤーの特定
  const opponent = gameState.players?.find((p) => p.id !== gameState.me.id);
  const opponentName = opponent?.name || "Opponent";
  const isCpu = opponentName === "CPU";

  return (
    <main className="flex-1 flex flex-col justify-between py-4 relative overflow-hidden">
      {/* ★追加: Toast Container (最前面に表示) */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ★追加: 再接続オーバーレイ */}
      {isReconnecting && (
        <div className="absolute inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-20"></div>
              <div className="bg-amber-50 p-3 rounded-full">
                <WifiOff className="text-amber-500" size={24} />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-800">Connection Lost</h3>
              <p className="text-xs text-slate-500 font-bold flex items-center gap-1 mt-1">
                <Loader2 size={12} className="animate-spin" />
                Reconnecting...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 1. 相手の手札エリア */}
      <div className="flex-1 flex flex-col justify-end items-center pb-2 relative">
        <div className="flex items-center gap-2 mb-3 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-100 shadow-sm">
          {isCpu ? (
            <Cpu size={14} className="text-slate-500" />
          ) : (
            <UserIcon size={14} className="text-slate-500" />
          )}
          <span className="text-xs font-bold text-slate-700 max-w-[120px] truncate">
            {opponentName}
          </span>
        </div>

        <div className="w-full px-4">
          <div className="flex gap-2 sm:gap-4 flex-wrap justify-center">
            {gameState.opponentHand.map((card, i) => (
              <CardView
                key={i}
                card={card}
                isOpponent
                onClick={() => onCardClick(i)}
                disabled={!isMyTurn && !card.isOpen}
                guessedNumber={
                  lastAttack &&
                  !lastAttack.isYourCard &&
                  lastAttack.targetIndex === i
                    ? lastAttack.guess
                    : undefined
                }
              />
            ))}
          </div>
          <SortIndicator lang={lang} />
        </div>
      </div>

      {/* 2. フィールド情報 (中央) */}
      <div className="py-2 relative shrink-0 flex flex-col items-center gap-4">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-200 -z-10"></div>

        {/* ターンステータス & ログ */}
        <div className="flex flex-col items-center gap-2 z-10 w-full">
          <div className="bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isMyTurn ? "bg-blue-500 animate-pulse" : "bg-slate-300"
              }`}
            />
            <span className="text-xs font-bold text-slate-600">
              {gameState.phase === "waiting"
                ? t.waiting
                : isMyTurn
                ? t.yourTurn
                : t.opponentTurn}
            </span>
          </div>
          <div className="h-6 flex items-center justify-center w-full">
            {gameLogs.length > 0 && (
              <div className="bg-slate-800/90 backdrop-blur text-white text-xs px-3 py-1 rounded-lg shadow-lg animate-in fade-in zoom-in slide-in-from-top-1">
                {gameLogs[0].text}
              </div>
            )}
          </div>
        </div>

        {/* デッキ・ドロー・ボタンエリア */}
        <div className="flex items-center justify-center gap-4 md:gap-8 w-full z-10">
          {/* デッキ */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-16 bg-slate-800 rounded-lg border-2 border-slate-700 shadow-md flex items-center justify-center">
              <span className="font-mono font-bold text-slate-500 text-xs">
                {gameState.deckCount}
              </span>
            </div>
          </div>

          {/* ドローカード */}
          <div className="w-14 h-20 flex items-center justify-center relative">
            {gameState.drawnCard ? (
              <div className="animate-in zoom-in duration-300">
                <CardView card={gameState.drawnCard} />
              </div>
            ) : (
              <div className="w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-white/50">
                <span className="text-[10px] text-slate-300 font-bold">
                  FIELD
                </span>
              </div>
            )}
          </div>

          {/* Stayボタン */}
          <div className="w-16 h-16 flex items-center justify-center">
            {isMyTurn && (
              <button
                onClick={onStay}
                // 初手スキップ防止のdisabled
                disabled={isProcessing || !isConnected || !hasMoved}
                className={`
                      w-16 h-16 rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-all
                      ${
                        hasMoved
                          ? "bg-slate-900 text-white hover:bg-black active:scale-95 ring-4 ring-slate-200"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }
                      ${highlightStay ? "ring-4 ring-orange-500 animate-pulse scale-110 z-50" : ""}
                    `}
              >
                {t.stay}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. 自分の手札エリア */}
      <div className="flex-1 flex flex-col justify-start items-center pt-2 relative">
        <div className="w-full px-4">
          <SortIndicator lang={lang} />
          <div className="flex gap-2 sm:gap-4 flex-wrap justify-center mt-2">
            {gameState.me.hand.map((card, i) => (
              <CardView
                key={i}
                card={card}
                isOwned
                guessedNumber={
                  lastAttack &&
                  lastAttack.isYourCard &&
                  lastAttack.targetIndex === i
                    ? lastAttack.guess
                    : undefined
                }
              />
            ))}
          </div>
        </div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3">
          {t.yourHand}
        </div>
      </div>
    </main>
  );
}
