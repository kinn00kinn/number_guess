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
                <div className="font-bold text-slate-800">Haruki</div>
                <div className="text-xs text-slate-500">
                  Full Stack Developer
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs">
              GitHub: <a href="https://github.com/haruki1009kk" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">@haruki1009kk</a>
            </p>
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
        </div>
      </div>
    </div>
  );
}
