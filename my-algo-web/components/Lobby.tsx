import {
  ArrowRight,
  Trophy,
  LogIn,
  Loader2,
  X,
  Plus,
  Users,
} from "lucide-react";
import Image from "next/image";
import { TRANSLATIONS, API_URL } from "@/utils/constant";
import { Lang, User } from "@/types";

type Props = {
  lang: Lang;
  roomId: string;
  setRoomId: (id: string) => void;
  onJoin: (id: string) => void;
  onJoinRanked: () => void;
  user: User | null;
  isUserLoading: boolean;
  isSearching: boolean;
  onCancelSearch: () => void;
};

export default function Lobby({
  lang,
  roomId,
  setRoomId,
  onJoin,
  onJoinRanked,
  user,
  isUserLoading,
  isSearching,
  onCancelSearch,
}: Props) {
  const t = TRANSLATIONS[lang];

  const handleCreateRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/game/new`);
      const id = await res.text();
      setRoomId(id);
      onJoin(id);
    } catch {
      alert("Error creating room");
    }
  };

  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <main className="flex-1 px-4 flex flex-col items-center justify-center gap-6 -mt-10 relative w-full max-w-md mx-auto">
      {/* マッチング待機オーバーレイ */}
      {isSearching && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-sm rounded-3xl animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-xs w-full border border-slate-100">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
              <div className="bg-indigo-50 p-4 rounded-full relative">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-bold text-xl text-slate-800">
                {lang === "ja" ? "対戦相手を探しています" : "Searching..."}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === "ja"
                  ? "レートの近い相手を探しています..."
                  : "Looking for a worthy opponent..."}
              </p>
            </div>
            <button
              onClick={onCancelSearch}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <X size={18} />
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 mb-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          
          <Image src="/logo.svg" alt="" width={160} height={40} priority />
        </h2>
        <p className="text-slate-500 text-sm">
          {lang === "ja"
            ? "オンラインで推理バトルを楽しもう"
            : "Enjoy online deduction battles"}
        </p>
      </div>

      <div className="w-full grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
        {/* 1. レート対戦 (メイン) */}
        {user ? (
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div>
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  Ranked Match
                </p>
                <h3 className="font-bold text-xl">
                  {lang === "ja" ? "レート対戦" : "Ranked Match"}
                </h3>
              </div>
              <div className="text-right bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm">
                <p className="text-indigo-100 text-[9px] font-bold uppercase tracking-widest">
                  Rate
                </p>
                <p className="font-mono font-black text-xl leading-none">
                  {user.rate}
                </p>
              </div>
            </div>

            <button
              onClick={onJoinRanked}
              disabled={isSearching || isUserLoading}
              className="w-full bg-white text-indigo-600 font-bold py-3.5 rounded-xl shadow-md hover:bg-indigo-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative z-10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isUserLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trophy
                  size={18}
                  className={isSearching ? "animate-pulse" : ""}
                />
              )}
              {isUserLoading
                ? t.nowLoading
                : lang === "ja"
                ? "対戦を開始"
                : "Find Match"}
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  Ranked Match
                </p>
                <h3 className="font-bold text-xl">
                  {lang === "ja" ? "レート対戦" : "Ranked Match"}
                </h3>
              </div>
              <Trophy className="text-slate-700" size={32} />
            </div>
            <button
              onClick={handleLogin}
              disabled={isUserLoading}
              className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-xl shadow-md hover:bg-slate-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isUserLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
              {isUserLoading
                ? t.nowLoading
                : lang === "ja"
                ? "ログインして参加"
                : "Login to Play"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* 2. 部屋を作る */}
          <button
            onClick={handleCreateRoom}
            disabled={isUserLoading}
            className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 transition-all group text-left flex flex-col justify-between h-32 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="bg-indigo-100 w-10 h-10 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Plus size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg leading-tight mb-1">
                {lang === "ja" ? "部屋を作る" : "Create"}
              </p>
              <p className="text-xs text-slate-500 font-medium">
                {lang === "ja" ? "友達と対戦" : "Play with friend"}
              </p>
            </div>
          </button>

          {/* 3. 部屋に入る */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col justify-between h-32">
            <div className="flex items-center justify-between">
              <div className="bg-emerald-100 w-10 h-10 rounded-full flex items-center justify-center text-emerald-600">
                <Users size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-800 text-sm leading-tight">
                {lang === "ja" ? "部屋に入る" : "Join Room"}
              </p>
              <div className="flex gap-1">
                <input
                  className="w-full bg-slate-100 px-2 py-1.5 text-sm font-mono font-bold text-center rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 placeholder:text-slate-400"
                  placeholder="ID"
                  maxLength={4}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  type="tel"
                  disabled={isUserLoading}
                />
                <button
                  onClick={() => onJoin(roomId)}
                  disabled={roomId.length !== 4 || isUserLoading}
                  className="bg-emerald-500 text-white px-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
