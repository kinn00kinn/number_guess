"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Twitter } from "lucide-react";

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

export default function FaqPage() {
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
            FAQ & Contact
          </h1>
        </header>

        <div className="space-y-6">
          <Section title="よくある質問 (FAQ)">
            <div className="space-y-6">
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
                  A. 「ルーム作成」を行い、表示されるルームIDを友達に共有してください。
                  相手がそのIDを入力して入室すると対戦が始まります。
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-1">
                  Q. アカウント登録は必要ですか？
                </h3>
                <p>
                  A. ゲストとしてプレイすることも可能ですが、Googleアカウントでログインすると、戦績の保存やランキングへの参加が可能になります。
                </p>
              </div>
            </div>
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
        </div>
      </div>
    </div>
  );
}
