// hooks/useGame.ts
import { useState, useRef, useEffect, useCallback, useReducer } from "react";
import { GameState, Card, LogItem, Lang, User } from "@/types";
import { WS_URL, TRANSLATIONS } from "@/utils/constant";
import { useToast } from "@/components/Toast";
import { playSe, vibrate } from "@/utils/effects";

// --- Types & Reducer ---

type GameAction =
  | { type: "RESET" }
  | { type: "JOINED"; payload: boolean }
  | { type: "SET_GAME_STATE"; payload: GameState | null }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_HAS_MOVED"; payload: boolean }
  | { type: "SET_SEARCHING"; payload: boolean }
  | { type: "ADD_LOG"; payload: { text: string; type: LogItem["type"] } }
  | {
      type: "SET_LAST_ATTACK";
      payload: {
        targetIndex: number;
        guess: number;
        isYourCard: boolean;
      } | null;
    }
  | {
      type: "SET_GUESS_MODAL";
      payload: { show: boolean; targetIndex: number };
    };

type State = {
  joined: boolean;
  gameState: GameState | null;
  isProcessing: boolean;
  isConnected: boolean;
  hasMoved: boolean;
  isSearching: boolean;
  gameLogs: LogItem[];
  lastAttack: {
    targetIndex: number;
    guess: number;
    isYourCard: boolean;
  } | null;
  guessModal: { show: boolean; targetIndex: number };
};

const initialState: State = {
  joined: false,
  gameState: null,
  isProcessing: false,
  isConnected: false,
  hasMoved: false,
  isSearching: false,
  gameLogs: [],
  lastAttack: null,
  guessModal: { show: false, targetIndex: -1 },
};

function gameReducer(state: State, action: GameAction): State {
  switch (action.type) {
    case "RESET":
      return { ...initialState };
    case "JOINED":
      return { ...state, joined: action.payload };
    case "SET_GAME_STATE":
      return { ...state, gameState: action.payload };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };
    case "SET_HAS_MOVED":
      return { ...state, hasMoved: action.payload };
    case "SET_SEARCHING":
      return { ...state, isSearching: action.payload };
    case "ADD_LOG":
      return {
        ...state,
        gameLogs: [
          { ...action.payload, timestamp: Date.now() },
          ...state.gameLogs,
        ],
      };
    case "SET_LAST_ATTACK":
      return { ...state, lastAttack: action.payload };
    case "SET_GUESS_MODAL":
      return { ...state, guessModal: action.payload };
    default:
      return state;
  }
}

// --- Hook ---

export function useGame(lang: Lang, user: User | null) {
  const t = TRANSLATIONS[lang];
  const { toasts, showToast, removeToast } = useToast();

  const [roomId, setRoomId] = useState("");
  // isReconnecting は UI に「再接続中...」と出すために追加
  const [isReconnecting, setIsReconnecting] = useState(false);

  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Ref to access state inside callbacks/effects
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const joinGameRef = useRef<(id: string) => void>(() => {});
  const guessModalClosingRef = useRef(false);

  // --- Helpers ---

  const addLog = useCallback(
    (text: string, type: LogItem["type"] = "system") => {
      dispatch({ type: "ADD_LOG", payload: { text, type } });
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      cleanupConnection();
    };
  }, [cleanupConnection]);

  const startProcessing = () => {
    dispatch({ type: "SET_PROCESSING", payload: true });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => dispatch({ type: "SET_PROCESSING", payload: false }),
      3000
    );
  };

  const stopProcessing = () => {
    dispatch({ type: "SET_PROCESSING", payload: false });
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

  // --- WebSocket Logic ---

  const joinGame = useCallback(
    (id: string) => {
      if (!id) return;
      shouldReconnectRef.current = true;
      cleanupConnection();

      // ローディング/再接続中表示
      setIsReconnecting(true);

      const wsUrl = new URL(`${WS_URL}/game/${id}`);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsReconnecting(false); // 接続成功で消す
        dispatch({ type: "SET_CONNECTED", payload: true });

        const isCpu = id.includes("cpu=true");
        sendMessage({
          type: "JOIN",
          mode: isCpu ? "cpu" : undefined,
          userId: user?.id,
          userName: user?.name,
        });

        dispatch({ type: "JOINED", payload: true });
        dispatch({ type: "SET_HAS_MOVED", payload: false });

        pingIntervalRef.current = setInterval(
          () => sendMessage({ type: "PING" }),
          3000
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "PONG") {
            dispatch({ type: "SET_CONNECTED", payload: true });
            return;
          }

          // 相手からの攻撃通知
          if (data.type === "ATTACK_NOTIFY") {
            const myId = stateRef.current.gameState?.me.id;
            const isMe = data.attackerId === myId;

            if (!isMe) {
              // 攻撃された！
              vibrate([50, 50, 50]);
              playSe("defense"); // 防御アラート音

              dispatch({
                type: "SET_LAST_ATTACK",
                payload: {
                  targetIndex: data.targetIndex,
                  guess: data.guess,
                  isYourCard: true,
                },
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
            const prev = stateRef.current.gameState;
            const next = data;

            // ログとSE判定
            if (prev) {
              // 自分の手札が開いた (守備失敗)
              if (prev.me && next.me) {
                next.me.hand.forEach((c: Card, idx: number) => {
                  if (!prev.me.hand[idx]?.isOpen && c.isOpen) {
                    addLog(t.logRevealed, "defense");
                    playSe("lose"); // ダメージ音
                  }
                });
              }
              // 相手の手札が開いた (攻撃成功)
              if (prev.opponentHand && next.opponentHand) {
                next.opponentHand.forEach((c: Card, idx: number) => {
                  if (!prev.opponentHand[idx]?.isOpen && c.isOpen) {
                    addLog(t.logRevealed, "attack");
                    playSe("select"); // 成功音
                  }
                });
              }

              const isMyTurnNow = next.turnPlayerId === next.me.id;
              const wasMyTurn = prev.turnPlayerId === prev.me.id;

              if (!wasMyTurn && isMyTurnNow) {
                dispatch({ type: "SET_HAS_MOVED", payload: false });
                vibrate(200); // 自分のターン開始で振動
                playSe("select"); // ターン開始音
              }
            }

            dispatch({ type: "SET_GAME_STATE", payload: next });
            stopProcessing();

            // モーダル制御
            const gm = stateRef.current.guessModal;
            if (gm.show && gm.targetIndex >= 0) {
              if (next.opponentHand?.[gm.targetIndex]?.isOpen) {
                dispatch({
                  type: "SET_GUESS_MODAL",
                  payload: { show: false, targetIndex: -1 },
                });
              }
            }
            if (next.phase === "playing" && next.turnPlayerId !== next.me.id) {
              dispatch({
                type: "SET_GUESS_MODAL",
                payload: { show: false, targetIndex: -1 },
              });
            }
          }

          if (data.type === "ERROR") {
            showToast(data.message, "error"); // Toastに変更
            stopProcessing();
            dispatch({ type: "JOINED", payload: false });
            shouldReconnectRef.current = false;
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        dispatch({ type: "SET_CONNECTED", payload: false });
        stopProcessing();
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        if (shouldReconnectRef.current && stateRef.current.joined) {
          setIsReconnecting(true); // 切断時は再接続中を表示
          setTimeout(() => {
            if (shouldReconnectRef.current) {
              joinGameRef.current(id);
            }
          }, 5000);
        } else {
          setIsReconnecting(false);
          dispatch({ type: "JOINED", payload: false });
          dispatch({ type: "SET_GAME_STATE", payload: null });
        }
      };
    },
    [cleanupConnection, sendMessage, addLog, lang, t, user, showToast]
  );

  const joinRanked = useCallback(() => {
    shouldReconnectRef.current = true;
    cleanupConnection();
    dispatch({ type: "SET_SEARCHING", payload: true });

    const wsUrl = new URL(`${WS_URL}/match/random`);

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: "SET_CONNECTED", payload: true });
      addLog(
        lang === "ja"
          ? "対戦相手を探しています..."
          : "Searching for opponent...",
        "system"
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "MATCH_FOUND") {
          const { roomId, mode } = data;
          ws.close();
          dispatch({ type: "SET_SEARCHING", payload: false });
          const params = new URLSearchParams();
          params.set("ranked", "true");
          if (mode === "cpu") params.set("cpu", "true");
          joinGame(`${roomId}?${params.toString()}`);
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onclose = () => {
      dispatch({ type: "SET_CONNECTED", payload: false });
      dispatch({ type: "SET_SEARCHING", payload: false });
    };
  }, [cleanupConnection, joinGame, addLog, lang]);

  const cancelSearch = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    dispatch({ type: "SET_SEARCHING", payload: false });
  }, []);

  useEffect(() => {
    joinGameRef.current = joinGame;
  }, [joinGame]);

  const setGuessModal = (payload: { show: boolean; targetIndex: number }) => {
    dispatch({ type: "SET_GUESS_MODAL", payload });
  };

  const handleAttack = useCallback(
    (guess: number) => {
      if (stateRef.current.isProcessing) return;
      const targetIndex = stateRef.current.guessModal.targetIndex;

      guessModalClosingRef.current = true;
      dispatch({
        type: "SET_GUESS_MODAL",
        payload: { show: false, targetIndex: -1 },
      });
      setTimeout(() => (guessModalClosingRef.current = false), 500);

      startProcessing();

      dispatch({
        type: "SET_LAST_ATTACK",
        payload: { targetIndex, guess, isYourCard: false },
      });

      const success = sendMessage({ type: "ATTACK", targetIndex, guess });
      if (success) {
        dispatch({ type: "SET_HAS_MOVED", payload: true });
        addLog(
          t.logAttacked
            .replace("{i}", `${targetIndex + 1}`)
            .replace("{n}", `${guess}`),
          "attack"
        );
        playSe("attack"); // 攻撃SE
      } else {
        stopProcessing();
      }
    },
    [sendMessage, addLog, t]
  );

  const handleStay = useCallback(() => {
    if (stateRef.current.isProcessing) return;
    if (!stateRef.current.hasMoved) return;

    startProcessing();
    const success = sendMessage({ type: "STAY" });
    if (success) {
      addLog(lang === "ja" ? "パスしました" : "Passed turn", "defense");
      dispatch({ type: "SET_LAST_ATTACK", payload: null });
      playSe("select"); // 決定音
    } else {
      stopProcessing();
    }
  }, [sendMessage, addLog, lang]);

  return {
    roomId,
    setRoomId,
    // state spread
    ...state,
    isReconnecting, // 追加
    // methods
    setGuessModal,
    joinGame,
    joinRanked,
    cancelSearch,
    handleAttack,
    handleStay,
    guessModalClosingRef,
    // toast methods to expose if needed by components
    toasts,
    removeToast,
  };
}
