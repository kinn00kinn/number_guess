"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail, Twitter } from "lucide-react";

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

export default function InfoPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans pb-safe">
      <div className="max-w-2xl mx-auto space-y-6">
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
              Algo Online (PanDo) についての情報
            </p>
          </div>
        </header>

        {/* Content */}
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

          <Section title="よくある質問 (FAQ)">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-1">
                  Q. 無料で遊べますか？
                </h3>
                <p>A. はい、すべての機能を無料で利用できます。</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-1">
                  Q. 友達と対戦するには？
                </h3>
                <p>
                  A.
                  「ルーム作成」を行い、表示されるルームIDを友達に共有してください。
                </p>
              </div>
            </div>
          </Section>

          <Section title="素材・ライセンス">
            <p>このサービスは以下の技術・素材を使用しています。</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
              <li>Next.js / React</li>
              <li>Hono / Cloudflare Workers</li>
              <li>Lucide React (Icons)</li>
              <li>Tailwind CSS</li>
            </ul>
          </Section>

          <Section title="Developer (開発者)">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-xl font-bold text-slate-400">
                H
              </div>
              <div>
                <div className="font-bold text-slate-800">Haruki</div>
                <div className="text-xs text-slate-500">
                  Full Stack Developer
                </div>
              </div>
            </div>
            <p className="mt-3">
              個人開発でWebサービスを作っています。バグ報告や機能要望は下記のお問い合わせまでお願いします。
            </p>
          </Section>

          <Section title="Creator (クリエイター)">
             <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-xl font-bold text-indigo-400">
                P
              </div>
              <div>
                <div className="font-bold text-slate-800">Pixel Artist</div>
                <div className="text-xs text-slate-500">
                  Design / Assets
                </div>
              </div>
            </div>
            <p className="mt-3">
              （素敵なドット絵やデザインを提供してくれた方がいればここに記載）
            </p>
          </Section>

          <Section title="利用規約">
            <p>
              当サービスを利用することによって、本規約に同意したものとみなします。
              公序良俗に反する行為、不正アクセス、サーバーへの過度な負荷をかける行為を禁止します。
            </p>
          </Section>

          <Section title="プライバシーポリシー">
            <p>
              当サービスでは、Googleアカウントによる認証および利用状況の分析のためにCookieを使用する場合があります。
              収集した情報はサービスの提供・改善のみに利用し、第三者への提供は行いません。
            </p>
          </Section>

          <Section title="広告掲載について">
            <p>
              現在、当サービスでは広告を掲載しておりません。
              将来的にサーバー維持費のために広告を導入する可能性があります。
            </p>
          </Section>

          <Section title="お問い合わせ">
            <p>
              バグ報告、ご意見、ご感想は以下の連絡先までお願いします。
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <a
                href="https://twitter.com/haruki1009kk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                <Twitter size={16} />
                Twitter (X)
              </a>
              <a
                href="mailto:contact@example.com"
                className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Mail size={16} />
                Email
              </a>
            </div>
          </Section>

          <div className="pt-8 text-center text-xs text-slate-400">
            &copy; 2026 Algo Online. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
