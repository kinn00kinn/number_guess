import { useState, useRef, useEffect, useCallback } from "react";
import { GameState, Card, LogItem, Lang } from "@/types";
import { WS_URL, TRANSLATIONS } from "@/utils/constant";

export function useGame(lang: Lang) {
  const t = TRANSLATIONS[lang];

  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [gameLogs, setGameLogs] = useState<LogItem[]>([]);

  const [lastAttack, setLastAttack] = useState<{
    targetIndex: number;
    guess: number;
    isYourCard: boolean;
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

          // ★攻撃通知: 相手の行動を受信
          if (data.type === "ATTACK_NOTIFY") {
            const isMe = data.attackerId === prevGameStateRef.current?.me.id;
            if (!isMe) {
              // 上書きすることで、前の表示を消して新しい攻撃を表示
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
          }

          if (data.type === "UPDATE_STATE") {
            const prev = prevGameStateRef.current;

            if (prev) {
              if (prev.me && data.me) {
                data.me.hand.forEach((c: Card, idx: number) => {
                  const prevCard = prev.me.hand[idx];
                  if (prevCard && !prevCard.isOpen && c.isOpen) {
                    addLog(t.logRevealed, "defense");
                  }
                });
              }
              if (prev.opponentHand && data.opponentHand) {
                data.opponentHand.forEach((c: Card, idx: number) => {
                  const prevCard = prev.opponentHand[idx];
                  if (prevCard && !prevCard.isOpen && c.isOpen) {
                    addLog(t.logRevealed, "attack");
                  }
                });
              }

              const isMyTurnNow = data.turnPlayerId === data.me.id;
              const wasMyTurn = prev.turnPlayerId === prev.me.id;

              // ターン交代時の処理
              if (!wasMyTurn && isMyTurnNow) {
                setHasMoved(false); // 初手スキップ防止のリセット

                // ★修正: ここで setLastAttack(null) を消しました
                // 相手が間違えてターンが自分に回ってきた場合、
                // 相手のミス（宣言した数字）を画面に残すためです。
                // 自分が次のアクションを起こした時に上書きされます。
              }
            }

            prevGameStateRef.current = data;
            setGameState(data);
            stopProcessing();

            // 状況に応じてモーダルを閉じる
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

      // ★新しい攻撃をしたので、ここで lastAttack を上書き
      setLastAttack({
        targetIndex,
        guess,
        isYourCard: false,
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
    if (!hasMoved) return;

    startProcessing();
    const success = sendMessage({ type: "STAY" });
    if (success) {
      addLog(lang === "ja" ? "パスしました" : "Passed turn", "defense");
      setLastAttack(null); // パスした時はクリアしてOK
    } else {
      stopProcessing();
    }
  }, [isProcessing, sendMessage, addLog, lang, hasMoved]);

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
    lastAttack,
    guessModal,
    setGuessModal,
    joinGame,
    handleAttack,
    handleStay,
    guessModalClosingRef,
  };
}
