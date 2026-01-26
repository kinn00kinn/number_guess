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
              0〜11の数字が書かれた「黒」と「白」のカードを使います。<br />
              お互いの手札は伏せられていて見えませんが、自分だけは見ることができます。<br />
              相手の伏せカードの数字を推理し、全て当てて「Open（表向き）」にさせたプレイヤーの勝利です。
            </p>
          </Section>

          <Section title="絶対のルール：カードの並び順">
            <p>
              手札のカードは、以下のルールに従って自動的に並べられます。<br />
              これは推理をする上で最も重要なヒントになります。
            </p>
            <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 mt-2">
              <ul className="list-disc list-inside space-y-2 font-bold text-slate-800">
                <li>左から右へ、数字の小さい順に並ぶ</li>
                <li>同じ数字の場合、黒が左になる</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500 mt-2 ml-1">
                例: 「黒の1」→「黒の4」→「白の4」→「白の9」 のように並びます。
            </p>
          </Section>

          <Section title="ゲームの流れ">
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="font-bold text-slate-400 text-lg">1.</span>
                <div>
                  <h4 className="font-bold text-slate-800">カードを引く</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    自分のターンになったら、山札からカードを1枚引きます。
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <span className="font-bold text-slate-400 text-lg">2.</span>
                <div>
                  <h4 className="font-bold text-slate-800">攻撃（推理）する</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    引いたカードを手札に加える前に、そのカードを使って相手の伏せカードを1枚指定し、数字を宣言します。
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="font-bold text-slate-400 text-lg">3.</span>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800">結果の判定</h4>
                  <div className="mt-2 space-y-3">
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
                      <span className="font-bold text-emerald-700 block mb-1">🎯 当たった場合</span>
                      <p className="text-xs text-emerald-800">
                        指名した相手のカードが表向きになります。<br />
                        続けて別のカードを攻撃するか、「パス（Stay）」してターンを終了するか選べます。<br />
                        パスをした場合、引いたカードは伏せたまま手札の正しい位置に加えられます。
                      </p>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg">
                      <span className="font-bold text-rose-700 block mb-1">💥 外れた場合</span>
                      <p className="text-xs text-rose-800">
                        攻撃失敗です。<br />
                        ペナルティとして、さっき引いた自分のカードを表向きにして場（自分の手札の列）にさらさなければなりません。<br />
                        その後、ターン終了となります。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
