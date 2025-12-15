import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export", // ★ これを追加！

  // 画像最適化を使っている場合は無効化が必要ですが、今回は使っていないのでそのままでOK
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
