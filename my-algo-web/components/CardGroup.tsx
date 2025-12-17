import { Card } from "@/types";
import { Check } from "lucide-react";

/**
 * カードとサイズバーをまとめたコンポーネント
 */
export default function CardGroup({
  card,
  isOpponent,
  isOwned,
  onClick,
}: {
  card: Card;
  isOpponent?: boolean;
  isOwned?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 group">
      <CardView
        card={card}
        isOpponent={isOpponent}
        isOwned={isOwned}
        onClick={onClick}
      />
      {/* バーはカードの真下に配置 */}
      <SingleSizeBar card={card} />
    </div>
  );
}

function CardView({
  card,
  isOpponent,
  isOwned,
  onClick,
}: {
  card: Card;
  isOpponent?: boolean;
  isOwned?: boolean;
  onClick?: () => void;
}) {
  const isBlack = card.color === "black";
  const content = isOpponent && !card.isOpen ? "" : card.number;

  return (
    <div
      onClick={onClick}
      className={`
        relative w-12 h-16 sm:w-14 sm:h-20 rounded-xl flex items-center justify-center text-2xl font-black select-none
        transition-all duration-300 shadow-sm
        ${
          isBlack
            ? "bg-slate-800 text-white shadow-slate-300"
            : "bg-white text-slate-900 border border-slate-200"
        }
        ${
          !card.isOpen && isOpponent
            ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95"
            : ""
        }
        ${card.isOpen ? "ring-2 ring-slate-200 ring-offset-2" : ""}
      `}
    >
      <div>{content}</div>

      {/* 相手の伏せカードの柄 */}
      {isOpponent && !card.isOpen && (
        <div className="flex flex-col gap-1 opacity-50">
          <div
            className={`w-8 h-1 rounded-full ${
              isBlack ? "bg-slate-700" : "bg-slate-100"
            }`}
          ></div>
        </div>
      )}

      {/* オープン済みマーク */}
      {card.isOpen && (
        <div
          className={`absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full shadow-sm border-2 border-white ${
            isOwned ? "bg-red-500 text-white" : "bg-green-500 text-white"
          }`}
        >
          <Check size={10} strokeWidth={4} />
        </div>
      )}
    </div>
  );
}

function SingleSizeBar({ card }: { card: Card }) {
  const n = card.number;
  const baseClass =
    "w-10 h-1.5 sm:w-12 rounded-full bg-slate-200 overflow-hidden";

  if (n === null) {
    return <div className={baseClass} />;
  }

  // small (0-5) -> Blue
  if (n <= 5) {
    return (
      <div className={baseClass}>
        <div className="h-full bg-blue-500 w-1/2 rounded-full"></div>
      </div>
    );
  }

  // large (6-11) -> Red
  return (
    <div className={baseClass}>
      <div className="h-full bg-red-500 w-1/2 rounded-full ml-auto"></div>
    </div>
  );
}
