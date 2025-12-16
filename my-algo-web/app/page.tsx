"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Copy,
  LogOut,
  RotateCcw,
  RefreshCw,
  Zap,
  Check,
} from "lucide-react";

// --- 設定 ---
// 本番環境用URL
const API_URL = "https://my-algo-backend.haruki1009kk.workers.dev";
const WS_URL = "wss://my-algo-backend.haruki1009kk.workers.dev";
// const API_URL = "https:localhost:8787";
// const WS_URL = "wss://localhost:8787";

// --- 型定義 ---
type Card = {
  color: "black" | "white";
  number: number | null;
  isOpen: boolean;
  id: string;
};

type Player = {
  id: string;
  hand: Card[];
};

type GameState = {
  phase: string;
  turnPlayerId: string | null;
  me: Player;
  opponentHand: Card[];
  drawnCard: Card | null;
  winner: string | null;
  deckCount: number;
};

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [lang, setLang] = useState<"ja" | "en">("ja");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showCopyAlert, setShowCopyAlert] = useState(false);

  const [guessModal, setGuessModal] = useState<{
    show: boolean;
    targetIndex: number;
  }>({
    show: false,
    targetIndex: -1,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  // Ref to temporarily block reopening the guess modal while closing
  const guessModalClosingRef = useRef(false);
  // Ref to keep latest guessModal state available inside WebSocket callbacks
  const guessModalRef = useRef(guessModal);

  useEffect(() => {
    guessModalRef.current = guessModal;
  }, [guessModal]);

  // --- translations ---
  const translations: Record<string, Record<string, string>> = {
    ja: {
      reconnecting: "再接続しています...",
      welcomeTitle: "おかえりなさい。",
      welcomeDesc: "番号を入力してゲームに参加、\nまたは新しい部屋を作成してください。",
      roomLabel: "ルーム番号",
      join: "参加する",
      or: "または",
      createRoom: "新しい部屋を作成",
      statusLabel: "状態",
      waiting: "待機中...",
      yourTurn: "あなたのターン",
      opponentTurn: "相手のターン",
      online: "オンライン",
      offline: "オフライン",
      field: "フィールド",
      stay: "パス",
      yourHand: "あなたの手札",
      guessTitle: "数字を予想",
      guessDesc: "相手のカードの数字を推測してください",
      cancel: "キャンセル",
      win: "勝利！",
      lose: "敗北",
      winMsg: "おめでとう！",
      loseMsg: "惜しい！もう一度挑戦しよう。",
      replay: "リプレイ",
      roomIdLabel: "ルームID",
    },
    en: {
      reconnecting: "Reconnecting...",
      welcomeTitle: "Welcome back.",
      welcomeDesc: "Enter a room number to join, or create a new room.",
      roomLabel: "Room Number",
      join: "Join Game",
      or: "or",
      createRoom: "Create New Room",
      statusLabel: "Status",
      waiting: "Waiting...",
      yourTurn: "Your Turn",
      opponentTurn: "Opponent's Turn",
      online: "Online",
      offline: "Offline",
      field: "Field",
      stay: "Stay (Pass)",
      yourHand: "YOUR HAND",
      guessTitle: "Guess Number",
      guessDesc: "Guess the opponent's card number",
      cancel: "Cancel",
      win: "WIN!",
      lose: "LOSE",
      winMsg: "Congratulations!",
      loseMsg: "Don't give up, try again.",
      replay: "Replay",
      roomIdLabel: "Room ID",
    },
  };

  const t = translations[lang];

  // ★追加: コールバック内で最新のstateを参照するためのRef
  const joinedRef = useRef(false);

  // 定義順序の問題を避けるため、useEffectより前に定義
  const cleanupConnection = () => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  useEffect(() => {
    // stateとrefを同期
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      cleanupConnection();
    };
  }, []);

  const startProcessing = () => {
    setIsProcessing(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      console.warn("Operation timed out. Unlocking UI.");
      setIsProcessing(false);
    }, 3000);
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const sendMessage = useCallback((msg: object) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not open. Cannot send message.");
      return false;
    }
    try {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      console.error("Failed to send message:", e);
      return false;
    }
  }, []);

  // ★修正: constではなくfunctionで定義することで巻き上げ（Hoisting）を有効化し、
  // 宣言前の呼び出しエラーを回避。再帰呼び出しも可能にする。
  function joinGame(id: string) {
    if (!id) return;
    shouldReconnectRef.current = true;
    cleanupConnection();

    console.log(`Connecting to room: ${id}`);
    const ws = new WebSocket(`${WS_URL}/game/${id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);

      sendMessage({ type: "JOIN" });
      setJoined(true);

      pingIntervalRef.current = setInterval(() => {
        sendMessage({ type: "PING" });
      }, 5000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "PONG") return;

        if (data.type === "UPDATE_STATE") {
          setGameState(data);
          stopProcessing();

          // If the server opened the targeted opponent card (correct guess),
          // close the guess modal even if the turn remains with the player.
          const gm = guessModalRef.current;
          if (gm && gm.show && typeof gm.targetIndex === "number" && gm.targetIndex >= 0) {
            const idx = gm.targetIndex;
            if (
              data.opponentHand &&
              data.opponentHand[idx] &&
              data.opponentHand[idx].isOpen
            ) {
              setGuessModal({ show: false, targetIndex: -1 });
            }
          }

          // Also close the modal when the turn passes to opponent.
          if (data.phase === "playing") {
            if (data.turnPlayerId !== data.me.id) {
              setGuessModal({ show: false, targetIndex: -1 });
            }
          }
        }
        if (data.type === "ERROR") {
          alert(data.message);
          stopProcessing();
          setJoined(false);
          shouldReconnectRef.current = false;
        }
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    };

    ws.onerror = (e) => {
      console.error("WebSocket error:", e);
      stopProcessing();
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setIsConnected(false);
      stopProcessing();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      // ★修正: joinedRef.current を使うことで、古いクロージャの値を参照するバグを防ぐ
      if (shouldReconnectRef.current && joinedRef.current) {
        console.log("Attempting to reconnect in 3s...");
        setTimeout(() => {
          if (shouldReconnectRef.current) {
            joinGame(id);
          }
        }, 3000);
      } else {
        setJoined(false);
        setGameState(null);
      }
    };
  }

  const createRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/game/new`);
      const id = await res.text();
      setRoomId(id);
      joinGame(id);
    } catch (e) {
      console.error(e);
      alert("サーバーに接続できません");
    }
  };

  const handleAttack = (guess: number) => {
    if (isProcessing) return;

    // 保存してからモーダルを閉じる（モーダルは数字を押したら必ず閉じる）
    const targetIndex = guessModal.targetIndex;
    // ブロックフラグを立てて、直後のカードクリックで再表示されるのを防ぐ
    guessModalClosingRef.current = true;
    setGuessModal({ show: false, targetIndex: -1 });
    setTimeout(() => (guessModalClosingRef.current = false), 500);

    startProcessing();
    const success = sendMessage({
      type: "ATTACK",
      targetIndex: targetIndex,
      guess: guess,
    });

    if (!success) stopProcessing();
  };

  const handleStay = () => {
    if (isProcessing) return;

    startProcessing();
    const success = sendMessage({ type: "STAY" });

    if (!success) stopProcessing();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setShowCopyAlert(true);
    setTimeout(() => setShowCopyAlert(false), 2000);
  };

  const isMyTurn = gameState?.turnPlayerId === gameState?.me.id;
  const isWinner = gameState?.winner === gameState?.me.id;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-800 font-sans pb-10 selection:bg-slate-200">
      {/* 接続切れアラート */}
      {joined && !isConnected && (
        <div className="fixed top-0 left-0 w-full bg-slate-800 text-white text-center py-3 z-[100] font-bold shadow-lg flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">{t.reconnecting}</span>
        </div>
      )}

      <div className="w-full max-w-md mx-auto">
        {/* ヘッダー */}
        <header className="sticky top-0 z-50 bg-[#F9FAFB]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tighter text-slate-900">
            NumberGuess.<span className="text-slate-400">Online</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang("ja")}
                className={`px-3 py-2 rounded-full text-xs font-bold transition ${
                  lang === "ja"
                    ? "bg-slate-900 text-white border border-slate-900"
                    : "bg-slate-50 text-slate-700 border border-slate-100"
                }`}
                aria-label="Switch to Japanese"
              >
                JA
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-2 rounded-full text-xs font-bold transition ${
                  lang === "en"
                    ? "bg-slate-900 text-white border border-slate-900"
                    : "bg-slate-50 text-slate-700 border border-slate-100"
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
            </div>

            {joined && (
              <button
                onClick={() => {
                  shouldReconnectRef.current = false;
                  window.location.reload();
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all shadow-sm"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>

        {/* --- ロビー画面 --- */}
        {!joined ? (
          <main className="px-6 flex flex-col gap-8 mt-10">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {t.welcomeTitle}
              </h2>
              <p className="whitespace-pre-wrap text-slate-500 text-sm">
                {t.welcomeDesc}
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 space-y-6">
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                  {t.roomLabel}
                </label>
                <input
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white px-4 py-4 rounded-2xl text-3xl font-mono font-bold text-center tracking-[0.2em] outline-none transition-all placeholder:text-slate-200"
                  placeholder="0000"
                  maxLength={4}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  type="tel"
                />
              </div>

              <button
                onClick={() => joinGame(roomId)}
                className="group w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg shadow-slate-200 hover:shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {t.join}
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#F9FAFB] text-slate-400">{t.or}</span>
              </div>
            </div>

            <button
              onClick={createRoom}
              className="w-full bg-white border border-slate-200 text-slate-900 font-bold py-4 rounded-2xl hover:border-slate-400 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              {t.createRoom}
            </button>
          </main>
        ) : (
          /* --- ゲーム画面 --- */
          <main className="p-4 flex flex-col gap-6 relative">
            {/* 結果モーダル */}
            {gameState?.phase === "finished" && gameState.winner && (
              <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="bg-white rounded-[2rem] p-10 w-full max-w-sm text-center shadow-2xl space-y-6 animate-in slide-in-from-bottom-10 zoom-in-95 duration-500">
                  <div className="space-y-2">
                    <h2 className="text-5xl font-black tracking-tighter text-slate-900">
                      {isWinner ? t.win : t.lose}
                    </h2>
                    <p className="text-slate-500 font-medium">
                      {isWinner ? t.winMsg : t.loseMsg}
                    </p>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black hover:scale-105 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18} />
                    {t.replay}
                  </button>
                </div>
              </div>
            )}

            {/* ステータスバー */}
            <div className="bg-white rounded-[2rem] p-1 shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden">
              <div
                className={`absolute top-0 left-0 h-1 bg-slate-900 transition-all duration-500 ease-out ${
                  isMyTurn ? "w-full" : "w-0"
                }`}
              ></div>

              <div className="flex items-center gap-4 px-4 py-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isMyTurn
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isProcessing ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Zap size={18} fill={isMyTurn ? "currentColor" : "none"} />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                    {t.statusLabel}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {gameState?.phase === "waiting"
                      ? t.waiting
                      : isMyTurn
                      ? t.yourTurn
                      : t.opponentTurn}
                  </span>
                </div>
              </div>

              {/* Connection indicator (separate from turn status) */}
              <div className="flex items-center gap-3 px-2">
                <div
                  className={`w-3 h-3 rounded-full shadow-sm ${
                    isConnected ? "bg-green-500" : "bg-red-400"
                  }`}
                  title={isConnected ? t.online : t.offline}
                  aria-label="connection-status"
                />
                <span className="hidden sm:block text-xs font-bold text-slate-400">
                  {isConnected ? t.online : t.offline}
                </span>
              </div>

              <button
                onClick={copyRoomId}
                className="mr-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl flex flex-col items-end transition-colors active:scale-95 group"
              >
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1">
                    {t.roomIdLabel}
                  {showCopyAlert && (
                    <Check size={10} className="text-green-500" />
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 tracking-widest">
                    {roomId}
                  </span>
                  <Copy
                    size={12}
                    className="text-slate-300 group-hover:text-slate-500"
                  />
                </div>
              </button>
            </div>

            {/* 相手の手札 */}
            <div className="flex justify-center min-h-[100px] py-4">
              <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
                {gameState?.opponentHand.map((card, i) => (
                  <CardView
                    key={i}
                    card={card}
                    isOpponent
                    onClick={() => {
                      if (guessModalClosingRef.current) return;
                      if (
                        isMyTurn &&
                        !card.isOpen &&
                        !isProcessing &&
                        isConnected
                      ) {
                        setGuessModal({ show: true, targetIndex: i });
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            {/* プレイエリア */}
            <div className="relative py-8 flex items-center justify-center">
              <div className="absolute inset-x-8 h-[1px] bg-slate-200"></div>

              <div className="relative z-10 flex items-center gap-8 bg-[#F9FAFB] px-6">
                {/* デッキ数表示 (Layersアイコン廃止) */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-20 bg-slate-200 rounded-xl border-2 border-white shadow-inner flex items-center justify-center">
                    <span className="font-mono font-bold text-slate-400">
                      {gameState?.deckCount}
                    </span>
                  </div>
                </div>

                {/* ドローカード or Stayボタン */}
                <div className="h-24 flex items-center justify-center min-w-[80px]">
                  {gameState?.drawnCard ? (
                    <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-300">
                      <CardView card={gameState.drawnCard} />
                      {isMyTurn && (
                        <button
                          onClick={handleStay}
                          disabled={isProcessing || !isConnected}
                          className="absolute -bottom-12 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg hover:bg-black transition-transform active:scale-95 whitespace-nowrap"
                        >
                          {t.stay}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-300 tracking-widest uppercase">
                      {t.field}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 自分の手札 */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
                {gameState?.me.hand.map((card, i) => (
                  <CardView key={i} card={card} />
                ))}
              </div>
              <span className="text-[10px] font-bold text-slate-300 tracking-[0.2em]">
                {t.yourHand}
              </span>
            </div>
          </main>
        )}
      </div>

      {/* 推理モーダル */}
      {guessModal.show && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] animate-in fade-in"
            onClick={() => setGuessModal({ show: false, targetIndex: -1 })}
          ></div>
          <div className="fixed inset-x-0 bottom-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 pb-8 w-full max-w-md mx-auto space-y-6">
              <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto"></div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900">
                  {t.guessTitle}
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  {t.guessDesc}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[...Array(12)].map((_, num) => (
                  <button
                    key={num}
                    onClick={() => handleAttack(num)}
                    disabled={isProcessing || !isConnected}
                    className={`
                      aspect-square rounded-2xl text-xl font-bold transition-all active:scale-90 flex items-center justify-center
                      ${
                        isProcessing
                          ? "bg-slate-50 text-slate-300"
                          : "bg-slate-50 text-slate-900 border border-slate-100 hover:bg-slate-900 hover:text-white hover:shadow-lg"
                      }
                    `}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setGuessModal({ show: false, targetIndex: -1 })}
                disabled={isProcessing}
                className="w-full py-4 bg-transparent text-slate-400 font-bold hover:text-slate-600 transition"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CardView({
  card,
  isOpponent,
  onClick,
}: {
  card: Card;
  isOpponent?: boolean;
  onClick?: () => void;
}) {
  const isBlack = card.color === "black";
  const content = isOpponent && !card.isOpen ? "" : card.number;

  return (
    <div
      onClick={onClick}
      className={`
        relative w-14 h-20 md:w-16 md:h-24 rounded-2xl flex items-center justify-center text-2xl font-black select-none
        transition-all duration-300
        ${
          isBlack
            ? "bg-slate-800 text-white shadow-lg shadow-slate-200"
            : "bg-white text-slate-900 border-2 border-slate-100 shadow-sm"
        }
        ${
          !card.isOpen && isOpponent
            ? "cursor-pointer hover:-translate-y-2 hover:shadow-xl active:scale-95"
            : ""
        }
        ${card.isOpen ? "ring-2 ring-slate-200 ring-offset-2" : ""}
      `}
    >
      {/* 数字 */}
      {content}

      {/* 相手の伏せカードの柄 */}
      {isOpponent && !card.isOpen && (
        <div className="flex gap-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isBlack ? "bg-slate-700" : "bg-slate-100"
            }`}
          ></div>
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isBlack ? "bg-slate-700" : "bg-slate-100"
            }`}
          ></div>
        </div>
      )}

      {/* オープン済みマーカー */}
      {card.isOpen && isOpponent && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 text-white flex items-center justify-center rounded-full shadow-md animate-in zoom-in border-2 border-white">
          <Check size={12} strokeWidth={4} />
        </div>
      )}
    </div>
  );
}
