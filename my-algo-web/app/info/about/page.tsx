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

export default function AboutPage() {
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
            About Algo Online
          </h1>
        </header>

        <div className="space-y-6">
          <Section title="Algo Online (PanDo) について">
            <p>
              Algo Onlineは、論理的思考と推測を楽しむ対戦型カードゲームです。
              0から11までの数字が書かれた「黒」と「白」のカードを使い、相手の伏せられたカードの数字をすべて当てたプレイヤーが勝利となります。
            </p>
            <p>
              シンプルながらも奥深い心理戦をお楽しみください。
              ブラウザだけで、誰とでも無料で遊ぶことができます。
            </p>
          </Section>

          <Section title="公式からのお知らせ">
            <ul className="space-y-4">
              <li className="flex gap-3 items-start">
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded shrink-0 mt-0.5">
                  UPDATE
                </span>
                <div>
                  <div className="text-slate-800 font-bold text-sm">
                    チュートリアル機能の追加
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    2026.01.26 -
                    より分かりやすくルールを学べる実践型チュートリアルを追加しました。
                  </div>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded shrink-0 mt-0.5">
                  NEW
                </span>
                <div>
                  <div className="text-slate-800 font-bold text-sm">
                    サービス正式リリース
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    2026.01.01 -
                    Algo Online (PanDo) をリリースしました。
                  </div>
                </div>
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
