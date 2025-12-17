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
  // ★追加
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
                // ★追加: 自分が相手を攻撃したときの表示
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
        {/* 背景の線 */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-200 -z-10"></div>

        {/* ターンステータス & ログ (上部配置でボタン回避) */}
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
          {/* ログトースト (ステータスのすぐ下) */}
          <div className="h-6 flex items-center justify-center w-full">
            {gameLogs.length > 0 && (
              <div className="bg-slate-800/90 backdrop-blur text-white text-[10px] px-3 py-1 rounded-lg shadow-lg animate-in fade-in zoom-in slide-in-from-top-1">
                {gameLogs[0].text}
              </div>
            )}
          </div>
        </div>

        {/* デッキとドローエリア */}
        <div className="flex items-center justify-center gap-12 w-full z-10">
          {/* デッキ山札 */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-14 bg-slate-800 rounded-lg border-2 border-slate-700 shadow-md flex items-center justify-center">
              <span className="font-mono font-bold text-slate-500 text-xs">
                {gameState.deckCount}
              </span>
            </div>
          </div>

          {/* ドローカード or Stay */}
          <div className="relative w-12 h-16 flex items-center justify-center">
            {gameState.drawnCard ? (
              <div className="absolute animate-in zoom-in duration-300 z-20">
                <CardView card={gameState.drawnCard} />
                {isMyTurn && (
                  // components/GameBoard.tsx の Stayボタン部分 (確認用)
                  <button
                    onClick={onStay}
                    // isProcessing: 通信中
                    // !isConnected: 切断中
                    // !hasMoved: ★まだ攻撃していない (今回の修正でターン開始時に必ずfalseになる)
                    disabled={isProcessing || !isConnected || !hasMoved}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-full shadow-lg hover:bg-black transition-transform active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed z-30"
                  >
                    {t.stay}
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-white/50">
                <span className="text-[10px] text-slate-300 font-bold">
                  FIELD
                </span>
              </div>
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
                // ★追加: 自分が攻撃されたときの表示
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
