import {
  RotateCcw,
  X,
  Target,
  Shield,
  Eye,
  Zap,
  History,
  Trophy,
  Edit2,
} from "lucide-react";
import { TRANSLATIONS } from "@/utils/constant";
import { Lang, GameState, LogItem, RankingItem } from "@/types";
import { useState } from "react";

// ... ResultModal は変更なし ...
export function ResultModal({
  gameState,
  lang,
}: {
  gameState: GameState;
  lang: Lang;
}) {
  const t = TRANSLATIONS[lang];
  const isWinner = gameState.winner === gameState.me.id;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
      {/* 勝利時の背景エフェクト */}
      {isWinner && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)] animate-pulse"></div>
          {/* 簡易的な紙吹雪（ドット）をCSSで散らす */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-bounce opacity-60"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10%`,
                backgroundColor: ["#ff0", "#f0f", "#0ff", "#0f0"][
                  Math.floor(Math.random() * 4)
                ],
                animationDuration: `${2 + Math.random() * 3}s`,
                animationDelay: `${Math.random()}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-2xl space-y-8 animate-in zoom-in duration-500 relative overflow-hidden">
        {/* 勝敗バナー */}
        <div
          className={`absolute top-0 inset-x-0 h-2 ${
            isWinner
              ? "bg-gradient-to-r from-yellow-400 to-orange-500"
              : "bg-slate-200"
          }`}
        ></div>

        <div className="space-y-4">
          <div className="flex justify-center">
            {isWinner ? (
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-5xl shadow-inner animate-bounce">
                🏆
              </div>
            ) : (
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-5xl shadow-inner grayscale opacity-50">
                💀
              </div>
            )}
          </div>

          <div>
            <h2
              className={`text-6xl font-black tracking-tighter mb-2 ${
                isWinner
                  ? "bg-clip-text text-transparent bg-gradient-to-br from-yellow-500 to-orange-600 drop-shadow-sm"
                  : "text-slate-300"
              }`}
            >
              {isWinner ? "WIN" : "LOSE"}
            </h2>
            <p className="text-slate-500 font-medium">
              {isWinner ? t.winMsg : t.loseMsg}
            </p>
          </div>
        </div>

        {/* リザルト情報（簡易表示） */}
        <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center text-sm border border-slate-100">
          <span className="text-slate-500 font-bold">Turns</span>
          <span className="font-mono font-bold text-lg text-slate-800">
            {/* 簡易的にデッキ枚数から推測、あるいは別途サーバーから送る必要あり。ここでは仮置き */}
            -
          </span>
        </div>

        <button
          onClick={() => window.location.reload()}
          className={`w-full font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-lg
            ${
              isWinner
                ? "bg-slate-900 text-white hover:bg-black hover:shadow-xl ring-4 ring-slate-100"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }
          `}
        >
          <RotateCcw size={20} />
          {t.replay}
        </button>
      </div>
    </div>
  );
}

// ★修正: 推理モーダル
export function GuessModal({
  lang,
  onClose,
  onAttack,
  isProcessing,
  isConnected,
}: {
  lang: Lang;
  onClose: () => void;
  onAttack: (n: number) => void;
  isProcessing: boolean;
  isConnected: boolean;
}) {
  const t = TRANSLATIONS[lang];

  // 入力が無効化される条件
  const isDisabled = isProcessing || !isConnected;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 背景クリックで閉じる */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* モーダル本体 */}
      <div className="relative w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:m-4">
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>

        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-slate-900">{t.guessTitle}</h3>
          <p className="text-slate-500 text-sm mt-1">{t.guessDesc}</p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[...Array(12)].map((_, num) => (
            <button
              key={num}
              onClick={() => onAttack(num)}
              disabled={isDisabled}
              className={`
                aspect-square rounded-xl text-xl font-black transition-all flex items-center justify-center border-b-4 active:border-b-0 active:translate-y-1
                ${
                  isDisabled
                    ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-sm"
                }
              `}
            >
              {num}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ... HistoryModal, HelpModal はそのまま ...
export function HistoryModal({
  lang,
  logs,
  onClose,
}: {
  lang: Lang;
  logs: LogItem[];
  onClose: () => void;
}) {
  const t = TRANSLATIONS[lang];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <History size={18} />
            {t.logs}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {logs.length === 0 ? (
            <div className="text-center text-slate-300 text-xs py-10">
              No logs yet.
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="mt-1">
                  {log.type === "attack" && (
                    <Target size={14} className="text-red-500" />
                  )}
                  {log.type === "defense" && (
                    <Shield size={14} className="text-blue-500" />
                  )}
                  {log.type === "reveal" && (
                    <Eye size={14} className="text-amber-500" />
                  )}
                  {log.type === "system" && (
                    <Zap size={14} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-slate-700">{log.text}</p>
                  <span className="text-[10px] text-slate-300">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function HelpModal({
  lang,
  onClose,
}: {
  lang: Lang;
  onClose: () => void;
}) {
  const t = TRANSLATIONS[lang];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold mb-4">{t.helpTitle}</h3>
        <p className="whitespace-pre-wrap text-sm text-slate-600 leading-relaxed mb-6">
          {t.helpContent}
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function RankingModal({
  ranking,
  onClose,
}: {
  ranking: RankingItem[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500" />
            Top 100 Ranking
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3 text-right">Rate</th>
                <th className="px-6 py-3 text-right">Wins</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((item, index) => (
                <tr
                  key={index}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-6 py-4 font-bold text-slate-400">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">
                    {item.rate}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500">
                    {item.wins}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function NameEditModal({
  currentName,
  onSave,
  onClose,
}: {
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Edit2 size={18} /> Edit Name
        </h3>
        <input
          className="w-full bg-slate-100 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 font-bold mb-4"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={10}
          placeholder="Enter your name"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name)}
            className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
