import { ArrowRight } from "lucide-react";
import { TRANSLATIONS } from "@/utils/constant";
import { Lang } from "@/types";

export default function SortIndicator({ lang }: { lang: Lang }) {
  const t = TRANSLATIONS[lang];
  return (
    <div className="w-full max-w-xs mx-auto flex items-center justify-between gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 px-4 opacity-60">
      <span>{t.small}</span>
      <div className="flex-1 h-px bg-slate-300 relative flex items-center">
        <div className="absolute left-0 w-1 h-1 bg-slate-300 rounded-full"></div>
        <ArrowRight
          size={12}
          className="absolute right-0 text-slate-300 translate-x-1/3"
        />
      </div>
      <span>{t.large}</span>
    </div>
  );
}
