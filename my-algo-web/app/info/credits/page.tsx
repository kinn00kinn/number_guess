"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
    <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
      {title}
    </h2>
    <div className="text-slate-600 space-y-3 leading-relaxed text-sm">
      {children}
    </div>
  </section>
);

export default function CreditsPage() {
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
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
            Credits
          </h1>
        </header>

        <div className="space-y-6">
          <Section title="Developer (開発者)">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-xl font-bold text-slate-400">
                H
              </div>
              <div>
                <div className="font-bold text-slate-800">kinnkinn</div>
                <div className="text-xs text-slate-500">
                  Full Stack Developer
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm">
              個人でWebサービスの開発をしています。<br />
              「シンプルで面白い」をモットーに作りました。<br />
              バグ報告や「こんな機能が欲しい！」などのご意見は、X (Twitter) までお気軽にどうぞ！
            </p>
            <p className="mt-3 text-xs">
              GitHub: <a href="https://github.com/kinn00kinn" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">@kinn00kinn</a>
            </p>
          </Section>

          <Section title="使用技術・ライセンス">
            <p>このゲームは、以下の素晴らしいオープンソース技術や素材のおかげで動いています。</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-slate-500 mt-2">
              <li>Next.js / React (Frontend Framework)</li>
              <li>Hono / Cloudflare Workers (Backend API)</li>
              <li>Lucide React (Beautiful Icons)</li>
              <li>Tailwind CSS (Styling)</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
