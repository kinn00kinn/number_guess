import { useState } from "react";
import {
  Globe,
  History,
  LogOut,
  Hash,
  User as UserIcon,
  LogIn,
  Menu,
  X,
  Trophy,
  Edit2,
} from "lucide-react";
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
  onShowRanking: () => void;
  onEditName: () => void;
  onLogout: () => void;
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
  onShowRanking,
  onEditName,
  onLogout,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);

  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <header className="px-6 py-4 flex items-center justify-between bg-slate-50/90 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-black tracking-tighter text-slate-900 hidden sm:block">
          Algo<span className="text-slate-400">.Online</span>
        </h1>
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
        {/* ランキングボタン (独立) */}
        {!joined && (
          <button
            onClick={onShowRanking}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-yellow-500 hover:bg-yellow-50 hover:text-yellow-600 transition-colors shadow-sm"
          >
            <Trophy size={16} />
          </button>
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
        {/* フローティングメニュー (未参加時) */}
        {!joined && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm"
            >
              {user ? (
                <div className="w-full h-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
              ) : (
                <Menu size={16} />
              )}
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                ></div>
                <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-slate-100 mb-2">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          Signed in as
                        </p>
                        <p className="font-bold text-slate-800 truncate">
                          {user.name}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          onEditName();
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center gap-2"
                      >
                        <Edit2 size={16} /> Edit Name
                      </button>
                      <button
                        onClick={() => {
                          onLogout();
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-red-50 text-sm font-medium text-red-600 flex items-center gap-2"
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleLogin}
                      className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center gap-2"
                    >
                      <LogIn size={16} /> Login with Google
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
