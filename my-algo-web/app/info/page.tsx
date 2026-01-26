"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Info,
  ShieldCheck,
  HelpCircle,
  Users,
  ChevronRight,
} from "lucide-react";

const InfoMenuLink = ({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <Link
    href={href}
    className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all flex items-center gap-4"
  >
    <div className="p-3 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-colors">
      {icon}
    </div>
    <div className="flex-1">
      <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">
        {title}
      </h3>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
    <ChevronRight className="text-slate-300 group-hover:text-slate-800 transition-colors" />
  </Link>
);

export default function InfoIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans pb-safe">
      <div className="max-w-md mx-auto space-y-8">
        {/* Header */}
        <header>
          <Link
            href="/"
            className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-6 font-medium"
          >
            <ArrowLeft size={18} className="mr-1" />
            Back to Game
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Information
            </h1>
            <p className="text-slate-500">
              Algo Online (PanDo) の情報ポータル
            </p>
          </div>
        </header>

        {/* Menu Grid */}
        <div className="grid gap-3">
          <InfoMenuLink
            href="/info/about"
            icon={<Info size={24} />}
            title="About"
            desc="このゲームについて・お知らせ"
          />
          <InfoMenuLink
            href="/info/rules"
            icon={<BookOpen size={24} />}
            title="Rules"
            desc="基本ルールと遊び方"
          />
          <InfoMenuLink
            href="/info/faq"
            icon={<HelpCircle size={24} />}
            title="FAQ"
            desc="よくある質問・お問い合わせ"
          />
          <InfoMenuLink
            href="/info/terms"
            icon={<ShieldCheck size={24} />}
            title="Terms & Privacy"
            desc="利用規約とプライバシーポリシー"
          />
          <InfoMenuLink
            href="/info/credits"
            icon={<Users size={24} />}
            title="Credits"
            desc="開発者・素材提供"
          />
        </div>

        <div className="text-center text-xs text-slate-400 pt-8">
          &copy; 2026 Algo Online (PanDo). All rights reserved.
        </div>
      </div>
    </div>
  );
}