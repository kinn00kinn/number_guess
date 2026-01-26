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
          <Section title="Binarily について">
            <p>
              「Algo
              Online（通称：PanDo）」は、互いの伏せられたカードの数字を当て合う、シンプルかつ奥深い対戦型ロジックゲームです。
            </p>
            <p>
              使うのは0から11までの「黒」と「白」のカード。
              自分の手札は見えますが、相手の手札は見えません。
              場に出ているカードや相手の行動、確率をヒントに、論理的思考を駆使して相手の手札を全て暴きましょう。
            </p>
            <p>
              面倒な登録なしで、ブラウザからすぐに誰とでも無料で対戦できます。
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
