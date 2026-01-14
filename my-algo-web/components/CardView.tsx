// components/CardView.tsx
import { Card } from "@/types";
import { Check, Lock } from "lucide-react";
import React from "react"; // 追加

type Props = {
  card: Card;
  isOpponent?: boolean;
  isOwned?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  guessedNumber?: number | null;
};

// React.memo でラップして不要な再レンダリングを防ぐ
const CardView = React.memo(function CardView({
  card,
  isOpponent,
  isOwned,
  onClick,
  disabled,
  guessedNumber,
}: Props) {
  const isBlack = card.color === "black";
  const isOpen = card.isOpen;
  const isHidden = isOpponent && !isOpen;

  const content = isHidden ? "" : card.number;

  return (
    <div className="relative group">
      {guessedNumber !== null && guessedNumber !== undefined && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg z-20 animate-in zoom-in slide-in-from-bottom-2 whitespace-nowrap">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-rose-500"></div>
          {guessedNumber} ?
        </div>
      )}

      <button
        onClick={onClick}
        disabled={disabled || (isOpponent && isOpen)}
        className={`
          touch-manipulation
          relative w-12 h-16 sm:w-16 sm:h-24 rounded-xl flex items-center justify-center text-2xl sm:text-3xl font-black select-none
          transition-all duration-300 shadow-sm border-b-4 active:border-b-0 active:translate-y-1
          ${
            disabled
              ? "cursor-default active:translate-y-0 active:border-b-4"
              : "cursor-pointer"
          }
          
          ${
            isHidden
              ? isBlack
                ? "bg-slate-800 border-slate-950 text-slate-600"
                : "bg-white border-slate-200 text-slate-900"
              : isBlack
              ? "bg-slate-700 border-slate-900 text-white"
              : "bg-white border-slate-200 text-slate-900"
          }

          ${isOpen ? "opacity-100 ring-2 ring-green-400 ring-offset-2" : ""}
          
          ${
            guessedNumber !== null && guessedNumber !== undefined
              ? "ring-2 ring-rose-400 ring-offset-2 scale-105"
              : ""
          }
        `}
      >
        {isHidden && (
          <div className="absolute inset-2 border-2 border-dashed border-slate-700/50 rounded-lg flex items-center justify-center">
            <Lock size={16} className="text-slate-600" />
          </div>
        )}

        <span className="relative z-10">{content}</span>

        {isOpen && isOwned && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white flex items-center justify-center rounded-full shadow-md border-2 border-white animate-in zoom-in">
            <Check size={14} strokeWidth={4} />
          </div>
        )}

        {isOpen && isOpponent && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 text-white flex items-center justify-center rounded-full shadow-md border-2 border-white animate-in zoom-in">
            <Check size={14} strokeWidth={4} />
          </div>
        )}
      </button>
    </div>
  );
});

export default CardView;
