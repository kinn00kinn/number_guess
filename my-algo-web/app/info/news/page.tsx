"use client";

import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";

type NewsItem = {
  id: string;
  date: string;
  title: string;
  content: string;
  tag: string;
  tagColor: "blue" | "green" | "amber" | "rose";
};

const NEWS_ITEMS: NewsItem[] = [
  {
    id: "2",
    date: "2026.01.26",
    title: "チュートリアル機能の追加",
    content:
      "はじめての方でも安心して遊べるよう、ゲームのルールを実際に操作しながら学べる「チュートリアル」を追加しました。ホーム画面からいつでもプレイできます。",
    tag: "UPDATE",
    tagColor: "blue",
  },
  {
    id: "1",
    date: "2026.01.01",
    title: "サービス正式リリース",
    content:
      "「Binarily」を正式リリースしました！ブラウザだけで誰とでも手軽に遊べる頭脳戦カードゲームです。ぜひお楽しみください。",
    tag: "NEW",
    tagColor: "green",
  },
];

const Tag = ({
  color,
  children,
}: {
  color: NewsItem["tagColor"];
  children: React.ReactNode;
}) => {
  const styles = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${styles[color]}`}
    >
      {children}
    </span>
  );
};

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans pb-safe">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <Link
            href="/info"
            className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-6 font-medium"
          >
            <ArrowLeft size={18} className="mr-1" />
            Back to Info
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Bell size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              News
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            アップデート情報や運営からのお知らせ
          </p>
        </header>

        <div className="space-y-4">
          {NEWS_ITEMS.map((item) => (
            <article
              key={item.id}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2"
            >
              <div className="flex items-center gap-3">
                <Tag color={item.tagColor}>{item.tag}</Tag>
                <time className="text-xs text-slate-400 font-mono">
                  {item.date}
                </time>
              </div>
              <h2 className="font-bold text-slate-800 text-lg leading-tight">
                {item.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {item.content}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
