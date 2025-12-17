import { GameState, Lang, LogItem } from "@/types";
import { TRANSLATIONS } from "@/utils/constant";
import CardView from "./CardView";
import SortIndicator from "./SortIndicator";

type Props = {
  lang: Lang;
  gameState: GameState;
  isMyTurn: boolean;
  isProcessing: boolean;
  isConnected: boolean;
  hasMoved: boolean;
  gameLogs: LogItem[];
  lastAttack: {
    targetIndex: number;
    guess: number;
    isYourCard: boolean;
  } | null;
  onCardClick: (index: number) => void;
  onStay: () => void;
};

export default function GameBoard({
  lang,
  gameState,
  isMyTurn,
  isProcessing,
  isConnected,
  hasMoved,
  gameLogs,
  lastAttack,
  onCardClick,
  onStay,
}: Props) {
  const t = TRANSLATIONS[lang];

  return (
    <main className="flex-1 flex flex-col justify-between py-4 relative overflow-hidden">
      {/* 1. 相手の手札エリア */}
      <div className="flex-1 flex flex-col justify-end items-center pb-2 relative">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          {t.opponentHand}
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
              <div className="bg-slate-800/90 backdrop-blur text-white text-[10px] px-3 py-1 rounded-lg shadow-lg animate-in fade-in zoom-in slide-in-from-top-1">
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

          {/* ★Stayボタン: 独立した場所に配置 */}
          <div className="w-16 h-16 flex items-center justify-center">
            {isMyTurn && (
              <button
                onClick={onStay}
                // 初手スキップ防止のdisabled
                disabled={isProcessing || !isConnected || !hasMoved}
                className={`
                      w-14 h-14 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg transition-all
                      ${
                        hasMoved
                          ? "bg-slate-900 text-white hover:bg-black active:scale-95"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }
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
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">
          {t.yourHand}
        </div>
      </div>
    </main>
  );
}
