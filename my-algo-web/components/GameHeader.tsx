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
  HelpCircle, // Helpアイコン用に追加
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

  // 共通のボタンスタイル
  const iconBtnClass =
    "w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm";

  // メニュー内のリストアイテムスタイル
  const menuItemClass =
    "w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center gap-3 transition-colors";

  return (
    <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between bg-slate-50/90 backdrop-blur-sm sticky top-0 z-30 border-b border-slate-200/50 sm:border-transparent">
      {/* --- 左側: ロゴとルームID --- */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
        {/* ロゴ: モバイル調整済み */}
        <h1 className="flex-shrink-0">
          <img src="/logo3.svg" alt="Logo" className="h-6 w-auto sm:h-8" />
        </h1>

        {/* ルームID: モバイルでは少し小さく */}
        {joined && (
          <div
            className="flex items-center gap-1.5 bg-slate-900 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-black transition-colors max-w-[140px]"
            onClick={() => navigator.clipboard.writeText(roomId)}
            title="Click to copy"
          >
            <Hash className="text-slate-400 w-3 h-3 sm:w-auto sm:h-auto" />
            <span className="text-xs sm:text-sm font-bold font-mono tracking-wider truncate">
              {roomId}
            </span>
          </div>
        )}
      </div>

      {/* --- 右側: アクションボタン群 --- */}
      <div className="flex items-center gap-2">
        {/* PC表示: 設定・ヘルプ・ランキング (スマホでは隠す) */}
        <div className="hidden md:flex items-center gap-2">
          {!joined && (
            <button
              onClick={onShowRanking}
              className={`${iconBtnClass} text-yellow-500 hover:bg-yellow-50 hover:text-yellow-600`}
              title="Ranking"
            >
              <Trophy size={16} />
            </button>
          )}

          <button
            onClick={toggleLang}
            className={iconBtnClass}
            title="Change Language"
          >
            <Globe size={16} />
          </button>

          <button
            onClick={onShowHelp}
            className={`${iconBtnClass} font-bold`}
            title="Help"
          >
            ?
          </button>
        </div>

        {/* 履歴ボタン (参加中のみ・重要なのでスマホでも表示) */}
        {joined && (
          <button
            onClick={onShowHistory}
            className={`${iconBtnClass} relative`}
          >
            <History size={16} />
            {gameLogs.length > 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
        )}

        {/* PC表示: ログアウト (スマホではメニュー内へ) */}
        {joined && (
          <button
            onClick={() => window.location.reload()}
            className={`${iconBtnClass} hidden md:flex text-slate-400 hover:text-red-500 hover:border-red-200`}
            title="Quit Game"
          >
            <LogOut size={16} />
          </button>
        )}

        {/* --- メニューボタン (全デバイス共通の入り口、スマホではここが主役) --- */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            // PCかつ参加中の場合は、右端にメニューアイコンを出さずに隠しても良いが、
            // スマホ統一のため常に表示するか、あるいは `md:hidden` をつけてスマホ専用にするか選べます。
            // ここでは「スマホでは必須」「PC未参加時は必須」なので条件分岐します。
            className={`${iconBtnClass} ${joined ? "md:hidden" : ""}`}
          >
            {user ? (
              <div className="w-full h-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                {user.name.charAt(0)}
              </div>
            ) : (
              <Menu size={16} />
            )}
          </button>

          {/* ドロップダウンメニュー */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none"
                onClick={() => setShowMenu(false)}
              ></div>
              <div className="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* ユーザー情報 */}
                {user && (
                  <div className="px-4 py-3 border-b border-slate-100 mb-2">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Signed in as
                    </p>
                    <p className="font-bold text-slate-800 truncate">
                      {user.name}
                    </p>
                  </div>
                )}

                {/* --- モバイル用メニュー項目 (PCでは隠れていた機能を表示) --- */}
                <div className="md:hidden space-y-1 border-b border-slate-100 pb-2 mb-2">
                  {!joined && (
                    <button
                      onClick={() => {
                        onShowRanking();
                        setShowMenu(false);
                      }}
                      className={menuItemClass}
                    >
                      <Trophy size={16} className="text-yellow-500" /> Ranking
                    </button>
                  )}
                  <button
                    onClick={() => {
                      toggleLang();
                      setShowMenu(false);
                    }}
                    className={menuItemClass}
                  >
                    <Globe size={16} /> Language:{" "}
                    {lang === "ja" ? "日本語" : "English"}
                  </button>
                  <button
                    onClick={() => {
                      onShowHelp();
                      setShowMenu(false);
                    }}
                    className={menuItemClass}
                  >
                    <HelpCircle size={16} /> Help
                  </button>
                </div>

                {/* アクションボタン */}
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        onEditName();
                        setShowMenu(false);
                      }}
                      className={menuItemClass}
                    >
                      <Edit2 size={16} /> Edit Name
                    </button>
                    <button
                      onClick={() => {
                        onLogout();
                        setShowMenu(false);
                      }}
                      className={`${menuItemClass} text-red-600 hover:bg-red-50`}
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </>
                ) : (
                  <button onClick={handleLogin} className={menuItemClass}>
                    <LogIn size={16} /> Login with Google
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
