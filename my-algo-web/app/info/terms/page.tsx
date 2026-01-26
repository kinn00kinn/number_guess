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
              本サービス「Binarily」をご利用いただくにあたり、以下のルール（利用規約）への同意をお願いしています。
            </p>
            <h3 className="font-bold text-slate-700 mt-4 mb-2">🚫 禁止事項</h3>
            <p className="text-xs mb-2 text-slate-500">
              みんなで楽しく遊ぶために、以下の行為はやめましょう。
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-700">
              <li>公序良俗に反する行為、他人を不快にさせる行為</li>
              <li>不正アクセスや、サーバーに無理な負荷をかける行為</li>
              <li>バグを意図的に利用して有利に進める行為</li>
              <li>その他、運営者が「これはダメだ」と判断する行為</li>
            </ul>
            <h3 className="font-bold text-slate-700 mt-4 mb-2">⚠️ 免責事項</h3>
            <p>
              本サービスの利用によって何らかのトラブルや損害が生じた場合でも、運営者は責任を負いかねます。
              <br />
              また、個人開発のため、予告なくサービスの内容が変わったり、終了したりすることがあります。あらかじめご了承ください。
            </p>
          </Section>

          <Section title="プライバシーポリシー">
            <h3 className="font-bold text-slate-700 mt-4 mb-2">
              情報の扱いについて
            </h3>
            <p>
              Googleアカウントでログインする場合、Googleから「お名前」「メールアドレス」「アイコン画像」の情報をお預かりします。
              <br />
              これらの情報は、ゲーム内での表示や、ランキング機能、ご本人確認のためにのみ使用します。
            </p>
            <p className="mt-2">
              また、サービスの改善のために、匿名のアクセス解析（Cookieなど）を利用する場合があります。
            </p>
            <h3 className="font-bold text-slate-700 mt-4 mb-2">
              第三者への提供
            </h3>
            <p>
              法律で求められた場合を除き、お預かりした個人情報を勝手に他の人や会社に渡すことはありません。ご安心ください。
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
