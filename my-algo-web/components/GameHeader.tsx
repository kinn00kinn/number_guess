import { Globe, History, LogOut, Hash, User as UserIcon, LogIn } from "lucide-react";
import { Lang, LogItem, User } from "@/types";
import { API_URL } from "@/utils/constant";

type Props = {
  lang: Lang;
  toggleLang: () => void;
  joined: boolean;
  roomId: string;
  gameLogs: LogItem[];
  onShowHistory: () => void;
  onShowHelp: () => void;
  user: User | null;
};

export default function GameHeader({
  lang,
  toggleLang,
  joined,
  roomId,
  gameLogs,
  onShowHistory,
  onShowHelp,
  user,
}: Props) {
  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <header className="px-6 py-4 flex items-center justify-between bg-slate-50/90 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-black tracking-tighter text-slate-900 hidden sm:block">
          Algo<span className="text-slate-400">.Online</span>
        </h1>
        {/* ★ルームIDを強調 */}
        {joined && (
          <div
            className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-black transition-colors"
            onClick={() => navigator.clipboard.writeText(roomId)}
            title="Click to copy"
          >
            <Hash size={12} className="text-slate-400" />
            <span className="text-sm font-bold font-mono tracking-wider">
              {roomId}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* ユーザー情報 / ログインボタン (未参加時のみ表示) */}
        {!joined && (
          user ? (
            <div className="flex items-center gap-2 mr-2 bg-white pl-3 pr-1 py-1 rounded-full border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate">
                {user.name}
              </span>
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                <UserIcon size={14} />
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="mr-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-full hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <LogIn size={12} />
              Login
            </button>
          )
        )}

        <button
          onClick={toggleLang}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm"
        >
          <Globe size={16} />
        </button>
        <button
          onClick={onShowHelp}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm font-bold"
        >
          ?
        </button>
        {joined && (
          <>
            <button
              onClick={onShowHistory}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm relative"
            >
              <History size={16} />
              {gameLogs.length > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
            >
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
