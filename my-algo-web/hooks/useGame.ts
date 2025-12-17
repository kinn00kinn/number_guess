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
  
  // 初期値はfalse。ターン開始時にもfalseにする。
  const [hasMoved, setHasMoved] = useState(false);
  
  const [gameLogs, setGameLogs] = useState<LogItem[]>([]);
  
  // UI表示用：直近の攻撃情報（自分がした攻撃 or 相手からされた攻撃）
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

  useEffect(() => { guessModalRef.current = guessModal; }, [guessModal]);
  useEffect(() => { joinedRef.current = joined; }, [joined]);

  const addLog = useCallback((text: string, type: LogItem["type"] = "system") => {
    setGameLogs((prev) => [{ text, type, timestamp: Date.now() }, ...prev]);
  }, []);

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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    try {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const joinGame = useCallback((id: string) => {
    if (!id) return;
    shouldReconnectRef.current = true;
    cleanupConnection();

    const ws = new WebSocket(`${WS_URL}/game/${id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      sendMessage({ type: "JOIN" });
      setJoined(true);
      setHasMoved(false); // ゲーム参加時もリセット
      pingIntervalRef.current = setInterval(() => sendMessage({ type: "PING" }), 5000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "PONG") return;

        // ★攻撃通知の受信 (相手の行動を開示)
        // バックエンドが { type: "ATTACK_NOTIFY", attackerId, targetIndex, guess } を送ってくる想定
        if (data.type === "ATTACK_NOTIFY") {
            const isMe = data.attackerId === prevGameStateRef.current?.me.id;
            
            // 自分が攻撃した場合は handleAttack で既に設定済みなのでスキップ
            // 相手が攻撃してきた場合のみ処理
            if (!isMe) {
                setLastAttack({
                    targetIndex: data.targetIndex,
                    guess: data.guess,
                    isYourCard: true // 相手→自分への攻撃
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
          
          // 状態比較によるログ出力
          if (prev) {
             // 自分の手札が開いた ＝ 相手の攻撃が成功 or 自分の攻撃失敗で公開
             if (prev.me && data.me) {
              data.me.hand.forEach((c: Card, idx: number) => {
                const prevCard = prev.me.hand[idx];
                if (prevCard && !prevCard.isOpen && c.isOpen) {
                  addLog(t.logRevealed, "defense");
                }
              });
            }
            // 相手の手札が開いた ＝ 自分の攻撃が成功
            if (prev.opponentHand && data.opponentHand) {
              data.opponentHand.forEach((c: Card, idx: number) => {
                const prevCard = prev.opponentHand[idx];
                if (prevCard && !prevCard.isOpen && c.isOpen) {
                  addLog(t.logRevealed, "attack");
                }
              });
            }

            // ★修正: ターン切り替わり判定による hasMoved の厳密なリセット
            const isMyTurnNow = data.turnPlayerId === data.me.id;
            const wasMyTurn = prev.turnPlayerId === prev.me.id;

            // 相手のターンから自分のターンになった瞬間
            if (!wasMyTurn && isMyTurnNow) {
                setHasMoved(false);  // ★ここでリセットすることで初手スキップを防止
                setLastAttack(null); // 前のターンの矢印等を消す
            }
            // 自分のターンが終わった瞬間
            if (wasMyTurn && !isMyTurnNow) {
                setLastAttack(null);
            }
          } else {
             // 初回ロード時、もし自分のターンなら hasMoved は false (初期値) のまま
          }

          prevGameStateRef.current = data;
          setGameState(data);
          stopProcessing();

          // モーダル制御
          const gm = guessModalRef.current;
          if (gm.show && gm.targetIndex >= 0) {
            // ターゲットが開いたら閉じる
            if (data.opponentHand?.[gm.targetIndex]?.isOpen) {
              setGuessModal({ show: false, targetIndex: -1 });
            }
          }
          // ターンが終わったらモーダルを閉じる
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
  }, [cleanupConnection, sendMessage, addLog, lang, t]);

  useEffect(() => {
    joinGameRef.current = joinGame;
  }, [joinGame]);

  const handleAttack = useCallback((guess: number) => {
    if (isProcessing) return;
    const targetIndex = guessModal.targetIndex;
    
    guessModalClosingRef.current = true;
    setGuessModal({ show: false, targetIndex: -1 });
    setTimeout(() => (guessModalClosingRef.current = false), 500);

    startProcessing();
    
    // 自分の攻撃情報を保存
    setLastAttack({
        targetIndex,
        guess,
        isYourCard: false
    });

    const success = sendMessage({ type: "ATTACK", targetIndex, guess });
    if (success) {
      setHasMoved(true); // 攻撃したフラグを立てる
      addLog(
        t.logAttacked.replace("{i}", `${targetIndex + 1}`).replace("{n}", `${guess}`),
        "attack"
      );
    } else {
      stopProcessing();
    }
  }, [guessModal, isProcessing, sendMessage, addLog, lang, t]);

  const handleStay = useCallback(() => {
    if (isProcessing) return;
    
    // ★念のためここでもチェック（UIのdisabledが無効化された場合など）
    if (!hasMoved) {
        console.warn("Cannot stay before attacking.");
        return;
    }

    startProcessing();
    const success = sendMessage({ type: "STAY" });
    if (success) {
      // Stay後はターン終了なので、次のステート更新で hasMoved はリセットされるが
      // 念のためここでもログを出す
      addLog(lang === "ja" ? "パスしました" : "Passed turn", "defense");
      setLastAttack(null);
    } else {
      stopProcessing();
    }
  }, [isProcessing, sendMessage, addLog, lang, hasMoved]);

  return {
    roomId, setRoomId,
    joined, setJoined,
    gameState,
    isProcessing,
    isConnected,
    hasMoved,
    gameLogs,
    lastAttack,
    guessModal, setGuessModal,
    joinGame,
    handleAttack,
    handleStay,
    guessModalClosingRef
  };
}