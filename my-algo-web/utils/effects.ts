// utils/effects.ts

export const playSe = (
  type: "attack" | "defense" | "win" | "lose" | "select"
) => {
  if (typeof window === "undefined") return;

  // 簡易的な実装: public/sounds/ フォルダにファイルがある想定
  // ファイルがない場合は音が鳴らないだけ（エラーにはならない）
  const audio = new Audio(`/sounds/${type}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {
    // 自動再生ポリシーなどで再生できなかった場合は無視
  });
};

export const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};
