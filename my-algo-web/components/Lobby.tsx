import { ArrowRight, Trophy, LogIn, Loader2, X } from "lucide-react";
import { TRANSLATIONS, API_URL } from "@/utils/constant";
import { Lang, User } from "@/types";

type Props = {
  lang: Lang;
  roomId: string;
  setRoomId: (id: string) => void;
  onJoin: (id: string) => void;
  onJoinRanked: () => void;
  user: User | null;
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
    <main className="flex-1 px-6 flex flex-col items-center justify-center gap-8 -mt-20 relative">
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

      <div className="space-y-3 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">
          {t.welcomeTitle}
        </h2>
        <p className="whitespace-pre-wrap text-slate-500 text-sm leading-relaxed">
          {t.welcomeDesc}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
        {/* ランクマッチ / ログイン */}
        {user ? (
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">
                  Player
                </p>
                <p className="font-bold text-xl tracking-tight">{user.name}</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">
                  Rate
                </p>
                <p className="font-black text-3xl tracking-tighter font-mono">
                  {user.rate}
                </p>
              </div>
            </div>
            <button
              onClick={onJoinRanked}
              disabled={isSearching}
              className="w-full bg-white text-indigo-600 font-bold py-4 rounded-2xl shadow-lg hover:bg-indigo-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative z-10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Trophy size={20} className={isSearching ? "animate-pulse" : ""} />
              {lang === "ja" ? "レート対戦" : "Ranked Match"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="w-full bg-white border-2 border-slate-200 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            {lang === "ja"
              ? "Googleでログインして対戦"
              : "Login to Play Ranked"}
          </button>
        )}

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest text-slate-400">
            <span className="px-4 bg-slate-50">Free Match</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-2 shadow-xl shadow-slate-200/50 border border-slate-100">
          <input
            className="w-full bg-transparent px-6 py-5 text-4xl font-mono font-bold text-center tracking-[0.3em] outline-none text-slate-800 placeholder:text-slate-200"
            placeholder="0000"
            maxLength={4}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            type="tel"
          />
          <button
            onClick={() => onJoin(roomId)}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
          >
            {t.join} <ArrowRight size={18} />
          </button>
        </div>

        <button
          onClick={handleCreateRoom}
          className="w-full bg-white border-2 border-slate-100 text-slate-900 font-bold py-4 rounded-2xl hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-[0.98]"
        >
          {t.createRoom}
        </button>
      </div>
    </main>
  );
}

