import { ArrowRight, Trophy, LogIn } from "lucide-react";
import { TRANSLATIONS, API_URL } from "@/utils/constant";
import { Lang, User } from "@/types";

type Props = {
  lang: Lang;
  roomId: string;
  setRoomId: (id: string) => void;
  onJoin: (id: string) => void;
  onJoinRanked: () => void;
  user: User | null;
};

export default function Lobby({ lang, roomId, setRoomId, onJoin, onJoinRanked, user }: Props) {
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
    <main className="flex-1 px-6 flex flex-col items-center justify-center gap-8 -mt-20">
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
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Player</p>
                <p className="font-bold text-lg">{user.name}</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Rate</p>
                <p className="font-bold text-2xl">{user.rate}</p>
              </div>
            </div>
            <button
              onClick={onJoinRanked}
              className="w-full bg-white text-indigo-600 font-bold py-4 rounded-2xl shadow-lg hover:bg-indigo-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Trophy size={20} />
              {lang === "ja" ? "レート対戦" : "Ranked Match"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="w-full bg-white border-2 border-slate-200 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            {lang === "ja" ? "Googleでログインして対戦" : "Login to Play Ranked"}
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

