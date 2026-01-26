"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Lightbulb } from "lucide-react";

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

export default function RulesPage() {
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
            Game Rules
          </h1>
        </header>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0">
                <Lightbulb size={24} />
            </div>
            <div>
                <h3 className="font-bold text-blue-900">チュートリアルで学ぶ</h3>
                <p className="text-sm text-blue-800 mt-1">
                    実際にゲームを操作しながらルールを学べるチュートリアルを用意しています。
                </p>
                <Link href="/tutorial" className="inline-block mt-3 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    チュートリアルを開始
                </Link>
            </div>
          </div>

          <Section title="基本ルール">
            <p>
              0〜11の数字が書かれた「黒」と「白」のカードを使います。
              それぞれの手札は伏せられていますが、自分だけが見ることができます。
              相手のカードの数字を全て当てて、表向き（Open）にさせたプレイヤーの勝利です。
            </p>
          </Section>

          <Section title="カードの並び順">
            <p>
              カードは以下のルールで自動的に並び替えられます。
            </p>
            <ul className="list-disc list-inside bg-slate-50 p-4 rounded-lg font-medium text-slate-700">
              <li>左から右へ、数字の小さい順</li>
              <li>同じ数字の場合、黒が左</li>
            </ul>
            <p className="text-xs text-slate-500">
                例: [黒1] [黒4] [白4] [白9]
            </p>
          </Section>

          <Section title="ゲームの流れ">
            <ol className="list-decimal list-inside space-y-2 ml-1">
                <li>自分のターンになったら山札からカードを1枚引きます。</li>
                <li>引いたカードを使って、相手の伏せカードを1枚指定し、数字を宣言（攻撃）します。</li>
                <li>
                    <strong>当たった場合：</strong>
                    相手のカードが表向きになります。続けて攻撃するか、パス（Stay）してターンを終了できます。
                </li>
                <li>
                    <strong>外れた場合：</strong>
                    自分が引いたカードを表向きにして場に出し、ターン終了となります。
                </li>
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
