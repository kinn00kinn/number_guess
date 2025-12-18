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

  const [isSearching, setIsSearching] = useState(false);

  // 直近の攻撃情報（吹き出し表示用）
  const [lastAttack, setLastAttack] = useState<{
    targetIndex: number;
    guess: number;
    isYourCard: boolean; // trueなら「自分の手札」の上に表示、falseなら「相手の手札」
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
        // URLからクエリパラメータを解析して mode: "cpu" を付与
        const isCpu = id.includes("cpu=true");
        sendMessage({ type: "JOIN", mode: isCpu ? "cpu" : undefined });
        setJoined(true);
        setHasMoved(false);
        pingIntervalRef.current = setInterval(
          () => sendMessage({ type: "PING" }),
          3000
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "PONG") {
            setIsConnected(true);
            return;
          }

          // ★★★ 修正ポイント: 相手からの攻撃通知を受信して表示する ★★★
          if (data.type === "ATTACK_NOTIFY") {
            // attackerId が自分でない場合 ＝ 相手が自分を攻撃してきた
            const myId = prevGameStateRef.current?.me.id;
            const isMe = data.attackerId === myId;

            if (!isMe) {
              // 相手視点の targetIndex は、自分視点では「自分の手札のindex」
              setLastAttack({
                targetIndex: data.targetIndex,
                guess: data.guess,
                isYourCard: true, // 自分のカードに吹き出しを出す
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
              // ログ: 自分の手札が開いた (守備失敗)
              if (prev.me && data.me) {
                data.me.hand.forEach((c: Card, idx: number) => {
                  const prevCard = prev.me.hand[idx];
                  if (prevCard && !prevCard.isOpen && c.isOpen) {
                    addLog(t.logRevealed, "defense");
                  }
                });
              }
              // ログ: 相手の手札が開いた (攻撃成功)
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

              // ターンが自分に回ってきた時だけリセット
              if (!wasMyTurn && isMyTurnNow) {
                setHasMoved(false);
                // 注意: ここで setLastAttack(null) をしないことで、
                // 相手が間違えた時の「5?」という表示を残したまま自分のターンを開始できる
              }
            }

            prevGameStateRef.current = data;
            setGameState(data);
            stopProcessing();

            // モーダル制御
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
        
        // 意図的な切断（shouldReconnectRef.current = false）でない場合のみ再接続
        if (shouldReconnectRef.current && joinedRef.current) {
          // 再接続の頻度を少し下げる（3秒 -> 5秒）
          setTimeout(() => {
            if (shouldReconnectRef.current) {
              joinGameRef.current(id);
            }
          }, 5000);
        } else {
          setJoined(false);
          setGameState(null);
        }
      };
    },
    [cleanupConnection, sendMessage, addLog, lang, t]
  );

  const joinRanked = useCallback(() => {
    shouldReconnectRef.current = true;
    cleanupConnection();
    setIsSearching(true);

    const ws = new WebSocket(`${WS_URL}/match/random`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      addLog(lang === "ja" ? "対戦相手を探しています..." : "Searching for opponent...", "system");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "MATCH_FOUND") {
          const { roomId, mode } = data;
          ws.close();
          setIsSearching(false);
          const query = mode === "cpu" ? "?cpu=true" : "";
          joinGame(roomId + query);
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    ws.onclose = () => {
      // マッチング中の切断は再接続しない（キャンセル扱い）
      setIsConnected(false);
      setIsSearching(false);
    };
  }, [cleanupConnection, joinGame, addLog, lang]);

  const cancelSearch = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsSearching(false);
  }, []);

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

      // 自分が攻撃した時は即座にローカルステートを更新
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
    if (!hasMoved) return; // 攻撃していないならStay不可

    startProcessing();
    const success = sendMessage({ type: "STAY" });
    if (success) {
      addLog(lang === "ja" ? "パスしました" : "Passed turn", "defense");
      // 自分がパスしたら、自分の攻撃表示は消してOK
      setLastAttack(null);
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
    joinRanked,
    cancelSearch,
    isSearching,
    handleAttack,
    handleStay,
    guessModalClosingRef,
  };
}
