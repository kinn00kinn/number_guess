"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  Copy,
  Layers,
  AlertCircle,
  Play,
  LogOut,
  RotateCcw,
} from "lucide-react";

// --- 設定 ---
// ローカルならlocalhost, 本番なら自分のドメインに書き換えてください
const API_URL = "http://localhost:8787";
const WS_URL = "ws://localhost:8787";

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
  // ★安全装置: タイムアウト用タイマー
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ★ロック解除の安全装置
  const startProcessing = () => {
    setIsProcessing(true);
    // 3秒経っても応答がなければ強制解除
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
    }, 3000);
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const createRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/game/new`);
      const id = await res.text();
      setRoomId(id);
      joinGame(id);
    } catch (e) {
      alert("サーバーに接続できません");
    }
  };

  const joinGame = (id: string) => {
    if (!id) return;
    if (wsRef.current) wsRef.current.close();
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    const ws = new WebSocket(`${WS_URL}/game/${id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "JOIN" }));
      setJoined(true);

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PING" }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "UPDATE_STATE") {
        setGameState(data);
        stopProcessing(); // ★受信したらロック解除

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
      }
    };

    ws.onerror = () => {
      stopProcessing();
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setJoined(false);
      setGameState(null);
      stopProcessing();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  };

  const handleAttack = (guess: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isProcessing) return;

    startProcessing(); // ★タイムアウト付きロック開始
    wsRef.current.send(
      JSON.stringify({
        type: "ATTACK",
        targetIndex: guessModal.targetIndex,
        guess: guess,
      })
    );
  };

  const handleStay = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isProcessing) return;

    startProcessing(); // ★タイムアウト付きロック開始
    wsRef.current.send(JSON.stringify({ type: "STAY" }));
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setShowCopyAlert(true);
    setTimeout(() => setShowCopyAlert(false), 2000);
  };

  const isMyTurn = gameState?.turnPlayerId === gameState?.me.id;
  const isWinner = gameState?.winner === gameState?.me.id;

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-10">
      {joined && !isConnected && (
        <div className="fixed top-0 left-0 w-full bg-red-500 text-white text-center py-2 z-[100] font-bold shadow-md flex items-center justify-center gap-2">
          <AlertCircle size={20} />
          サーバー接続切れ。リロードしてください。
        </div>
      )}

      <div className="w-full max-w-md mx-auto">
        {/* ヘッダー */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 to-blue-600">
            Algo Online
          </h1>
          {joined && (
            <button
              onClick={() => window.location.reload()}
              className="text-slate-400 hover:text-red-500"
            >
              <LogOut size={20} />
            </button>
          )}
        </header>

        {/* --- ロビー画面 --- */}
        {!joined ? (
          <main className="p-6 flex flex-col gap-6 mt-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Play size={20} className="text-cyan-500" />
                ゲームに参加
              </h2>

              <div className="flex gap-2 mb-6">
                <input
                  className="flex-1 bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl text-xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  placeholder="0000"
                  maxLength={4}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  type="tel"
                />
              </div>

              <button
                onClick={() => joinGame(roomId)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-200 transition active:scale-95 flex items-center justify-center gap-2"
              >
                入室する <ArrowRight size={20} />
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
              <p className="text-slate-500 text-sm mb-4">
                部屋番号をお持ちでない場合
              </p>
              <button
                onClick={createRoom}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-100 transition active:scale-95"
              >
                新しい部屋を作成
              </button>
            </div>
          </main>
        ) : (
          /* --- ゲーム画面 --- */
          <main className="p-4 flex flex-col gap-4 relative">
            {/* 結果モーダル */}
            {gameState?.phase === "finished" && gameState.winner && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
                  <h2
                    className={`text-4xl font-black mb-2 ${
                      isWinner ? "text-yellow-500" : "text-slate-400"
                    }`}
                  >
                    {isWinner ? "WIN!" : "LOSE..."}
                  </h2>
                  <p className="text-slate-500 mb-8">
                    {isWinner ? "おめでとうございます！" : "残念、次こそは..."}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:scale-105 transition flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={20} /> もう一度遊ぶ
                  </button>
                </div>
              </div>
            )}

            {/* ステータスカード */}
            <div
              className={`bg-white rounded-2xl p-4 shadow-sm border transition-all duration-300 ${
                isMyTurn
                  ? "border-cyan-400 ring-2 ring-cyan-100"
                  : "border-gray-100"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-xs text-slate-400 font-bold tracking-wider mb-1">
                    STATUS
                  </div>
                  <div className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    {isProcessing && (
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-cyan-500 rounded-full animate-spin"></div>
                    )}
                    {gameState?.phase === "waiting" && "待機中..."}
                    {gameState?.phase === "playing" &&
                      (isMyTurn ? "あなたの番" : "相手の番")}
                  </div>
                </div>
                <button
                  onClick={copyRoomId}
                  className="flex flex-col items-end group"
                >
                  <div className="text-xs text-slate-400 font-bold tracking-wider mb-1 flex items-center gap-1">
                    ROOM ID{" "}
                    {showCopyAlert && (
                      <span className="text-green-500 text-[10px] animate-pulse">
                        COPIED!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg group-active:bg-slate-200 transition">
                    <span className="font-mono font-bold text-slate-700">
                      {roomId}
                    </span>
                    <Copy size={14} className="text-slate-400" />
                  </div>
                </button>
              </div>
              <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-cyan-500 transition-all duration-1000 ${
                    isMyTurn ? "w-full" : "w-0"
                  }`}
                ></div>
              </div>
            </div>

            {/* 相手の手札 */}
            <div className="flex justify-center min-h-[90px] py-2">
              <div className="flex gap-2 flex-wrap justify-center">
                {gameState?.opponentHand.map((card, i) => (
                  <CardView
                    key={i}
                    card={card}
                    isOpponent
                    onClick={() => {
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

            {/* プレイエリア (デッキ & ドロー) */}
            <div className="bg-slate-900/5 rounded-2xl py-6 flex flex-col items-center justify-center gap-4 border border-dashed border-slate-200">
              <div className="flex items-center gap-8">
                {/* デッキ */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-20 bg-slate-200 rounded-lg border-2 border-white shadow-sm flex items-center justify-center">
                    <Layers size={20} className="text-slate-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {gameState?.deckCount}
                  </span>
                </div>

                {/* ドローカード */}
                {gameState?.drawnCard && (
                  <div className="flex flex-col items-center gap-1 animate-in zoom-in duration-300">
                    <CardView card={gameState.drawnCard} />
                    <span className="text-[10px] text-cyan-600 font-bold">
                      DRAW
                    </span>
                  </div>
                )}
              </div>

              {isMyTurn && gameState?.drawnCard && (
                <button
                  onClick={handleStay}
                  disabled={isProcessing || !isConnected}
                  className={`
                     px-6 py-2 rounded-full font-bold text-sm shadow-lg transition transform active:scale-95
                     ${
                       isProcessing
                         ? "bg-gray-300 text-white cursor-not-allowed"
                         : "bg-red-500 text-white hover:bg-red-600"
                     }
                   `}
                >
                  このまま終了 (Stay)
                </button>
              )}
            </div>

            {/* 自分の手札 */}
            <div className="flex flex-col items-center pb-8">
              <div className="flex gap-2 flex-wrap justify-center">
                {gameState?.me.hand.map((card, i) => (
                  <CardView key={i} card={card} />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 font-bold tracking-widest">
                YOUR HAND
              </p>
            </div>
          </main>
        )}
      </div>

      {/* 推理モーダル */}
      {guessModal.show && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-10 sm:pb-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <h3 className="text-lg font-bold mb-6 text-center text-slate-800">
              数字を推理してください
            </h3>

            <div className="grid grid-cols-4 gap-3 mb-6">
              {[...Array(12)].map((_, num) => (
                <button
                  key={num}
                  onClick={() => handleAttack(num)}
                  disabled={isProcessing || !isConnected}
                  className={`
                    py-4 rounded-xl text-xl font-bold transition active:scale-95 shadow-sm border
                    ${
                      isProcessing
                        ? "bg-gray-100 text-gray-300"
                        : "bg-white border-gray-200 text-slate-700 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50"
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
              className="w-full py-4 bg-gray-100 text-slate-500 font-bold rounded-xl hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
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
        relative w-14 h-20 md:w-16 md:h-24 rounded-lg flex items-center justify-center text-2xl font-black shadow-md border-[3px] select-none
        transition-all transform duration-300
        ${
          isBlack
            ? "bg-slate-800 text-white border-slate-600 shadow-slate-200"
            : "bg-white text-slate-800 border-gray-200 shadow-gray-100"
        }
        ${card.isOpen ? "opacity-100 ring-2 ring-offset-2 ring-green-400" : ""} 
        ${
          !card.isOpen && isOpponent
            ? "cursor-pointer hover:-translate-y-1 hover:border-cyan-400 hover:shadow-cyan-100"
            : ""
        }
      `}
    >
      {content}

      {isOpponent && !card.isOpen && (
        <div
          className={`w-3 h-3 rounded-full ${
            isBlack ? "bg-slate-700" : "bg-gray-200"
          }`}
        ></div>
      )}

      {card.isOpen && isOpponent && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 text-white flex items-center justify-center rounded-full text-[10px] shadow-sm animate-in zoom-in border-2 border-white">
          ✓
        </div>
      )}
    </div>
  );
}
