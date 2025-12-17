import { Globe, History, LogOut } from "lucide-react";
import { Lang, LogItem } from "@/types";

type Props = {
  lang: Lang;
  toggleLang: () => void;
  joined: boolean;
  roomId: string;
  gameLogs: LogItem[];
  onShowHistory: () => void;
  onShowHelp: () => void;
};

export default function GameHeader({
  lang,
  toggleLang,
  joined,
  roomId,
  gameLogs,
  onShowHistory,
  onShowHelp,
}: Props) {
  return (
    <header className="px-6 py-4 flex items-center justify-between bg-slate-50/90 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-black tracking-tighter text-slate-900">
          Algo<span className="text-slate-400">.Online</span>
        </h1>
        {joined && (
          <div className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-[10px] font-bold text-slate-500 tracking-wider">
            {roomId}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm"
          title="Change Language"
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
