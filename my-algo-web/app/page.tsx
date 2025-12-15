"use client";

import { useState, useRef, useEffect } from "react";

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
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const [guessModal, setGuessModal] = useState<{
    show: boolean;
    targetIndex: number;
  }>({
    show: false,
    targetIndex: -1,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs((prev) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 8)
    );
  };

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const createRoom = async () => {
    try {
      addLog("部屋を作成中...");
      // ★本番デプロイ時はここを自分のドメイン(https)に変えてください
      const res = await fetch("http://localhost:8787/game/new");
      const id = await res.text();
      addLog(`部屋ID取得: ${id}`);
      setRoomId(id);
      joinGame(id);
    } catch (e) {
      addLog("【エラー】バックエンドに接続できません");
    }
  };

  const joinGame = (id: string) => {
    if (!id) return;
    if (wsRef.current) wsRef.current.close();
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    // ★本番デプロイ時はここを wss:// に変えてください
    const wsUrl = `ws://localhost:8787/game/${id}`;
    addLog(`接続試行: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog("✅ 接続成功");
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
        setIsProcessing(false);
        if (data.phase === "playing") {
          if (data.turnPlayerId !== data.me.id) {
            setGuessModal({ show: false, targetIndex: -1 });
          }
        }
      }
      if (data.type === "ERROR") {
        addLog(`❌ エラー: ${data.message}`);
        setIsProcessing(false);
        setJoined(false);
      }
    };

    ws.onerror = (e) => {
      addLog("❌ WebSocketエラー");
      setIsProcessing(false);
      setIsConnected(false);
    };

    ws.onclose = () => {
      addLog("⚠️ 切断されました");
      setIsConnected(false);
      setJoined(false);
      setGameState(null);
      setIsProcessing(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  };

  const handleAttack = (guess: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("接続されていません");
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
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
    setIsProcessing(true);
    wsRef.current.send(JSON.stringify({ type: "STAY" }));
  };

  const isMyTurn = gameState?.turnPlayerId === gameState?.me.id;
  const isWinner = gameState?.winner === gameState?.me.id;

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 select-none font-sans">
      {joined && !isConnected && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-[100] font-bold animate-pulse">
          ⚠️ サーバーとの接続が切れました。リロードしてください。
        </div>
      )}

      <h1 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-wider">
        ALGO ONLINE
      </h1>

      {!joined ? (
        <div className="flex flex-col gap-6 w-full max-w-sm mt-10">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
            <label className="block text-slate-400 text-sm mb-2">Room ID</label>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-900 border border-slate-600 px-4 py-3 rounded text-xl text-center tracking-widest focus:outline-none focus:border-cyan-400 transition"
                placeholder="0000"
                maxLength={4}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
              <button
                onClick={() => joinGame(roomId)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 rounded transition shadow-lg shadow-cyan-900/50"
              >
                入室
              </button>
            </div>
            <div className="mt-6 border-t border-slate-700 pt-6 text-center">
              <button
                onClick={createRoom}
                className="text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
              >
                新しい部屋を作成する
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg flex flex-col gap-6 relative">
          {/* 結果画面 */}
          {gameState?.phase === "finished" && gameState.winner && (
            <div className="absolute inset-0 z-50 bg-slate-900/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm animate-in fade-in">
              <h2
                className={`text-6xl font-black mb-4 ${
                  isWinner
                    ? "text-yellow-400 drop-shadow-glow"
                    : "text-blue-500"
                }`}
              >
                {isWinner ? "YOU WIN!" : "YOU LOSE"}
              </h2>
              <button
                onClick={() => window.location.reload()}
                className="bg-white text-slate-900 font-bold py-3 px-8 rounded-full hover:scale-105 transition"
              >
                もう一度遊ぶ
              </button>
            </div>
          )}

          {/* ★修正: ヘッダー (Room IDを表示) */}
          <div
            className={`text-center p-4 rounded-xl border transition-colors duration-500 shadow-lg ${
              isMyTurn
                ? "border-cyan-500 bg-cyan-950/40"
                : "border-slate-700 bg-slate-800/40"
            }`}
          >
            {/* ステータス */}
            <div className="text-xl font-bold flex justify-center items-center gap-3 mb-3">
              {isProcessing && (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {gameState?.phase === "waiting" && "対戦相手を待っています..."}
              {gameState?.phase === "playing" &&
                (isMyTurn ? "👉 あなたのターン" : "⏳ 相手の考え中...")}
            </div>

            {/* Room ID エリア */}
            <div className="flex flex-col items-center justify-center bg-black/20 rounded p-2 border border-white/5">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                Room ID
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  alert(`ID: ${roomId} をコピーしました！`);
                }}
                className="text-4xl font-mono font-bold tracking-[0.2em] text-cyan-300 hover:text-white hover:scale-110 transition active:scale-95 cursor-pointer"
                title="クリックしてコピー"
              >
                {roomId}
              </button>
              <div className="text-xs text-slate-500 mt-2">
                残り山札: {gameState?.deckCount}
              </div>
            </div>
          </div>

          {/* 相手の手札 */}
          <div className="flex flex-col items-center min-h-[100px]">
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

          {/* プレイエリア */}
          <div className="h-40 flex flex-col items-center justify-center gap-4 border-y border-slate-800 bg-slate-900/30 py-4">
            {gameState?.drawnCard ? (
              <div className="flex flex-col items-center animate-bounce-short">
                <span className="text-xs text-cyan-400 mb-1 font-bold">
                  DRAW
                </span>
                <CardView card={gameState.drawnCard} />
              </div>
            ) : (
              <div className="w-14 h-20 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center opacity-50">
                <span className="text-slate-500 text-xs">Deck</span>
              </div>
            )}

            {isMyTurn && gameState?.drawnCard && (
              <button
                onClick={handleStay}
                disabled={isProcessing || !isConnected}
                className={`
                   text-white text-sm font-bold py-2 px-8 rounded-full shadow-lg transition
                   ${
                     isProcessing || !isConnected
                       ? "bg-slate-600 cursor-not-allowed"
                       : "bg-red-600 hover:bg-red-500 hover:scale-105"
                   }
                 `}
              >
                このまま終了 (Stay)
              </button>
            )}
          </div>

          {/* 自分の手札 */}
          <div className="flex flex-col items-center">
            <div className="flex gap-2 flex-wrap justify-center">
              {gameState?.me.hand.map((card, i) => (
                <CardView key={i} card={card} />
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2 tracking-widest">
              YOUR HAND
            </p>
          </div>
        </div>
      )}

      {/* ログウィンドウ */}
      <div className="fixed bottom-0 left-0 w-full md:w-80 bg-black/80 text-green-400 text-xs p-2 font-mono max-h-32 overflow-auto border-t border-slate-700 pointer-events-none z-40 opacity-70">
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>

      {/* 推理モーダル */}
      {guessModal.show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-600 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-6 text-center text-white">
              このカードの数字は？
            </h3>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[...Array(12)].map((_, num) => (
                <button
                  key={num}
                  onClick={() => handleAttack(num)}
                  disabled={isProcessing || !isConnected}
                  className={`
                    py-3 rounded-lg text-xl font-bold transition duration-150 active:scale-95
                    ${
                      isProcessing || !isConnected
                        ? "bg-slate-700 text-slate-500 cursor-wait"
                        : "bg-slate-700 hover:bg-cyan-600 hover:text-white text-cyan-100"
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
              className="w-full py-3 bg-transparent border border-slate-600 text-slate-400 rounded-lg hover:bg-slate-700 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-bounce-short {
          animation: bounce 0.5s infinite alternate;
        }
        @keyframes bounce {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </main>
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
  const content = isOpponent && !card.isOpen ? "?" : card.number;

  return (
    <div
      onClick={onClick}
      className={`
        relative w-14 h-20 md:w-16 md:h-24 rounded-lg flex items-center justify-center text-2xl font-black shadow-lg border-2 select-none
        transition-all transform duration-300
        ${
          isBlack
            ? "bg-slate-900 text-white border-slate-700 shadow-black/50"
            : "bg-gray-100 text-slate-900 border-gray-300 shadow-white/10"
        }
        ${card.isOpen ? "opacity-100" : ""} 
        ${
          !card.isOpen && isOpponent
            ? "cursor-pointer hover:-translate-y-2 hover:border-cyan-400 hover:shadow-cyan-500/20"
            : ""
        }
      `}
    >
      {content}
      {card.isOpen && isOpponent && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 shadow-sm animate-in zoom-in"></div>
      )}
    </div>
  );
}
