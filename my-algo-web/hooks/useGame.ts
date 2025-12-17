import { useState, useRef, useEffect, useCallback } from "react";
import { GameState, Card, LogItem, Lang } from "@/types";
import { WS_URL, TRANSLATIONS } from "@/utils/constant"; // TRANSLATIONSをインポート

export function useGame(lang: Lang) {
  const t = TRANSLATIONS[lang]; // 翻訳を使用

  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [gameLogs, setGameLogs] = useState<LogItem[]>([]);

  // ★追加: 直近の攻撃イベントを保持（UI表示用）
  const [lastAttack, setLastAttack] = useState<{
    targetIndex: number;
    guess: number;
    isYourCard: boolean; // 自分が攻撃されたかどうか
  } | null>(null);

  const [guessModal, setGuessModal] = useState<{
    show: boolean;
    targetIndex: number;
  }>({ show: false, targetIndex: -1 });

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const joinGameRef = useRef<(id: string) => void>(() => {});
  const guessModalClosingRef = useRef(false);
  const guessModalRef = useRef(guessModal);
  const prevGameStateRef = useRef<GameState | null>(null);
  const joinedRef = useRef(joined);

  useEffect(() => {
    guessModalRef.current = guessModal;
  }, [guessModal]);
  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  const addLog = useCallback(
    (text: string, type: LogItem["type"] = "system") => {
      setGameLogs((prev) => [{ text, type, timestamp: Date.now() }, ...prev]);
    },
    []
  );

  const cleanupConnection = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      cleanupConnection();
    };
  }, [cleanupConnection]);

  const startProcessing = () => {
    setIsProcessing(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsProcessing(false), 3000);
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const sendMessage = useCallback((msg: object) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      return false;
    try {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const joinGame = useCallback(
    (id: string) => {
      if (!id) return;
      shouldReconnectRef.current = true;
      cleanupConnection();

      const ws = new WebSocket(`${WS_URL}/game/${id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        sendMessage({ type: "JOIN" });
        setJoined(true);
        setHasMoved(false);
        pingIntervalRef.current = setInterval(
          () => sendMessage({ type: "PING" }),
          5000
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "PONG") return;

          if (data.type === "UPDATE_STATE") {
            const prev = prevGameStateRef.current;

            // ログ生成ロジック & 攻撃情報の抽出
            if (prev) {
              // 自分の手札が開いた＝相手に当てられた
              if (prev.me && data.me) {
                data.me.hand.forEach((c: Card, idx: number) => {
                  const prevCard = prev.me.hand[idx];
                  if (prevCard && !prevCard.isOpen && c.isOpen) {
                    addLog(t.logRevealed, "defense");
                  }
                });
              }
              // 相手の手札が開いた＝自分が当てた
              if (prev.opponentHand && data.opponentHand) {
                data.opponentHand.forEach((c: Card, idx: number) => {
                  const prevCard = prev.opponentHand[idx];
                  if (prevCard && !prevCard.isOpen && c.isOpen) {
                    addLog(t.logRevealed, "attack");
                  }
                });
              }
            }

            // ★追加: サーバーからのイベント通知（もしあれば）または状態変化から推測
            // ここでは簡易的に、直前の攻撃情報をリセットするかどうかの判定などを入れる
            // ※ 本来はサーバーから "EVENT: { type: 'ATTACKED', index: 1, guess: 5 }" のようなメッセージが来るのが理想ですが、
            //    既存のバックエンド仕様に合わせてクライアント側で状態管理します。
            //    自分が攻撃した時は handleAttack でセットし、相手のターン変更時にリセットします。

            if (prev && prev.phase !== data.phase && data.phase === "playing") {
              setHasMoved(false);
              // ターンが変わったら攻撃表示をリセット
              setLastAttack(null);
            }

            prevGameStateRef.current = data;
            setGameState(data);
            stopProcessing();

            const gm = guessModalRef.current;
            if (gm.show && gm.targetIndex >= 0) {
              if (data.opponentHand?.[gm.targetIndex]?.isOpen) {
                setGuessModal({ show: false, targetIndex: -1 });
              }
            }
            if (data.phase === "playing" && data.turnPlayerId !== data.me.id) {
              setGuessModal({ show: false, targetIndex: -1 });
            }
          }

          // ★追加: 攻撃情報の受信 (バックエンドが通知してくる想定、または自前で拡張)
          // 今回は「相手の攻撃」を検知するために、UPDATE_STATE とは別に
          // 自分が攻撃したときの handleAttack 内と、
          // 相手の攻撃ログ（もしあれば）をフックする必要がありますが、
          // 既存のWebSocket仕様を変えずに実現するため、「攻撃アクション」の結果をstateに保存します。

          if (data.type === "ATTACK_NOTIFY") {
            // バックエンドがこのイベントを送ってくれる場合の想定
            setLastAttack({
              targetIndex: data.targetIndex,
              guess: data.guess,
              isYourCard: true,
            });
            addLog(
              t.logDefended
                .replace("{i}", `${data.targetIndex + 1}`)
                .replace("{n}", `${data.guess}`),
              "defense"
            );
          }

          if (data.type === "ERROR") {
            alert(data.message);
            stopProcessing();
            setJoined(false);
            shouldReconnectRef.current = false;
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        stopProcessing();
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (shouldReconnectRef.current && joinedRef.current) {
          setTimeout(() => {
            if (shouldReconnectRef.current) {
              joinGameRef.current(id);
            }
          }, 3000);
        } else {
          setJoined(false);
          setGameState(null);
        }
      };
    },
    [cleanupConnection, sendMessage, addLog, lang, t]
  );

  useEffect(() => {
    joinGameRef.current = joinGame;
  }, [joinGame]);

  const handleAttack = useCallback(
    (guess: number) => {
      if (isProcessing) return;
      const targetIndex = guessModal.targetIndex;

      guessModalClosingRef.current = true;
      setGuessModal({ show: false, targetIndex: -1 });
      setTimeout(() => (guessModalClosingRef.current = false), 500);

      startProcessing();

      // ★追加: 自分の攻撃情報を保存
      setLastAttack({
        targetIndex,
        guess,
        isYourCard: false, // 相手のカードへの攻撃
      });

      const success = sendMessage({ type: "ATTACK", targetIndex, guess });
      if (success) {
        setHasMoved(true);
        addLog(
          t.logAttacked
            .replace("{i}", `${targetIndex + 1}`)
            .replace("{n}", `${guess}`),
          "attack"
        );
      } else {
        stopProcessing();
      }
    },
    [guessModal, isProcessing, sendMessage, addLog, lang, t]
  );

  const handleStay = useCallback(() => {
    if (isProcessing) return;
    startProcessing();
    const success = sendMessage({ type: "STAY" });
    if (success) {
      setHasMoved(true);
      addLog(lang === "ja" ? "パスしました" : "Passed turn", "defense");
      setLastAttack(null); // パスしたら攻撃表示は消す
    } else {
      stopProcessing();
    }
  }, [isProcessing, sendMessage, addLog, lang]);

  return {
    roomId,
    setRoomId,
    joined,
    setJoined,
    gameState,
    isProcessing,
    isConnected,
    hasMoved,
    gameLogs,
    lastAttack, // ★export
    guessModal,
    setGuessModal,
    joinGame,
    handleAttack,
    handleStay,
    guessModalClosingRef,
  };
}
