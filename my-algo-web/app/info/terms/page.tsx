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

export default function TermsPage() {
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
            Terms & Privacy
          </h1>
        </header>

        <div className="space-y-6">
          <Section title="利用規約">
            <p>
              当サービス（以下「本サービス」）を利用することによって、利用者は本規約に同意したものとみなします。
            </p>
            <h3 className="font-bold text-slate-700 mt-4 mb-2">禁止事項</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
                <li>公序良俗に反する行為</li>
                <li>不正アクセスやサーバーへの過度な負荷をかける行為</li>
                <li>他のユーザーへの迷惑行為</li>
                <li>その他、運営者が不適切と判断する行為</li>
            </ul>
            <h3 className="font-bold text-slate-700 mt-4 mb-2">免責事項</h3>
            <p>
                本サービスの利用により生じた損害について、運営者は一切の責任を負いません。
                本サービスは予告なく変更・停止・終了することがあります。
            </p>
          </Section>

          <Section title="プライバシーポリシー">
            <h3 className="font-bold text-slate-700 mt-4 mb-2">情報の収集</h3>
            <p>
              本サービスでは、Googleアカウントによる認証（Google Login）を利用する場合、Googleから提供される基本情報（名前、メールアドレス、プロフィール画像）を取得・保存します。
              また、サービスの利用状況を分析するためにCookieやアクセスログを利用する場合があります。
            </p>
            <h3 className="font-bold text-slate-700 mt-4 mb-2">情報の利用目的</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
                <li>本サービスの提供・運営のため</li>
                <li>ランキング機能の提供のため</li>
                <li>不正利用の防止のため</li>
            </ul>
            <h3 className="font-bold text-slate-700 mt-4 mb-2">第三者への提供</h3>
            <p>
                法令に基づく場合を除き、取得した個人情報を第三者に提供することはありません。
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
