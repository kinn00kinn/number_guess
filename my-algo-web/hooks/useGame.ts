import { useState, useRef, useEffect, useCallback, useReducer } from "react";
import { GameState, Card, LogItem, Lang, User } from "@/types";
import { WS_URL, TRANSLATIONS } from "@/utils/constant";
import { useToast } from "@/components/Toast";
import { playSe, vibrate } from "@/utils/effects";

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
        targetCardId: string;
        guess: number;
        isYourCard: boolean;
      } | null;
    }
  | {
      type: "SET_GUESS_MODAL";
      payload: { show: boolean; targetCardId: string | null };
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
    targetCardId: string;
    guess: number;
    isYourCard: boolean;
  } | null;
  guessModal: { show: boolean; targetCardId: string | null };
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
  guessModal: { show: false, targetCardId: null },
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

const GUEST_ID_KEY = "binarily_guest_id";
function getOrCreateGuestId() {
  if (typeof window === "undefined") return undefined;
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing?.startsWith("guest-")) return existing;
  const id = `guest-${crypto.randomUUID()}`;
  window.localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export function useGame(lang: Lang, user: User | null) {
  const t = TRANSLATIONS[lang];
  const { toasts, showToast, removeToast } = useToast();
  const [roomId, setRoomId] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [state, dispatch] = useReducer(gameReducer, initialState);

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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    try {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, []);

  const joinGame = useCallback(
    (id: string) => {
      if (!id) return;
      shouldReconnectRef.current = true;
      cleanupConnection();
      setIsReconnecting(true);

      const ws = new WebSocket(`${WS_URL}/game/${id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsReconnecting(false);
        dispatch({ type: "SET_CONNECTED", payload: true });
        sendMessage({
          type: "JOIN",
          userName: user?.name,
          guestId: user ? undefined : getOrCreateGuestId(),
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

          if (data.type === "ATTACK_NOTIFY") {
            const current = stateRef.current.gameState;
            const myId = current?.me.id;
            const isMe = data.attackerId === myId;

            if (!isMe) {
              vibrate([50, 50, 50]);
              playSe("defense");
              dispatch({
                type: "SET_LAST_ATTACK",
                payload: {
                  targetCardId: data.targetCardId,
                  guess: data.guess,
                  isYourCard: true,
                },
              });

              const index = current?.me.hand.findIndex(
                (card) => card.id === data.targetCardId
              );
              addLog(
                t.logDefended
                  .replace("{i}", index !== undefined && index >= 0 ? `${index + 1}` : "?")
                  .replace("{n}", `${data.guess}`),
                "defense"
              );
            }
          }

          if (data.type === "UPDATE_STATE") {
            const prev = stateRef.current.gameState;
            const next = data as GameState;

            if (prev) {
              for (const card of next.me.hand) {
                const previous = prev.me.hand.find((item) => item.id === card.id);
                if (previous && !previous.isOpen && card.isOpen) {
                  addLog(t.logRevealed, "defense");
                  playSe("lose");
                }
              }

              for (const card of next.opponentHand) {
                const previous = prev.opponentHand.find((item) => item.id === card.id);
                if (previous && !previous.isOpen && card.isOpen) {
                  addLog(t.logRevealed, "attack");
                  playSe("select");
                }
              }

              const isMyTurnNow = next.turnPlayerId === next.me.id;
              const wasMyTurn = prev.turnPlayerId === prev.me.id;
              if (!wasMyTurn && isMyTurnNow) {
                vibrate(200);
                playSe("select");
              }
            }

            dispatch({ type: "SET_GAME_STATE", payload: next });
            dispatch({ type: "SET_HAS_MOVED", payload: !!next.canStay });
            stopProcessing();

            const gm = stateRef.current.guessModal;
            if (gm.show && gm.targetCardId) {
              const selected = next.opponentHand.find(
                (card) => card.id === gm.targetCardId
              );
              if (!selected || selected.isOpen) {
                dispatch({
                  type: "SET_GUESS_MODAL",
                  payload: { show: false, targetCardId: null },
                });
              }
            }

            if (next.phase === "playing" && next.turnPlayerId !== next.me.id) {
              dispatch({
                type: "SET_GUESS_MODAL",
                payload: { show: false, targetCardId: null },
              });
            }
          }

          if (data.type === "ERROR") {
            showToast(data.message, "error");
            stopProcessing();
            if (data.fatal) {
              dispatch({ type: "JOINED", payload: false });
              shouldReconnectRef.current = false;
            }
          }
        } catch (error) {
          console.error(error);
        }
      };

      ws.onclose = () => {
        dispatch({ type: "SET_CONNECTED", payload: false });
        stopProcessing();
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        if (shouldReconnectRef.current && stateRef.current.joined) {
          setIsReconnecting(true);
          setTimeout(() => {
            if (shouldReconnectRef.current) joinGameRef.current(id);
          }, 3000);
        } else {
          setIsReconnecting(false);
          dispatch({ type: "JOINED", payload: false });
          dispatch({ type: "SET_GAME_STATE", payload: null });
        }
      };
    },
    [cleanupConnection, sendMessage, addLog, t, user, showToast]
  );

  const joinRanked = useCallback(() => {
    shouldReconnectRef.current = true;
    cleanupConnection();
    dispatch({ type: "SET_SEARCHING", payload: true });

    const ws = new WebSocket(`${WS_URL}/match/random`);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: "SET_CONNECTED", payload: true });
      addLog(
        lang === "ja" ? "対戦相手を探しています..." : "Searching for opponent...",
        "system"
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "MATCH_FOUND") {
          ws.close();
          dispatch({ type: "SET_SEARCHING", payload: false });
          joinGame(data.roomId);
        }
      } catch (error) {
        console.error(error);
      }
    };

    ws.onclose = () => {
      dispatch({ type: "SET_CONNECTED", payload: false });
      dispatch({ type: "SET_SEARCHING", payload: false });
    };
  }, [cleanupConnection, joinGame, addLog, lang]);

  const cancelSearch = useCallback(() => {
    shouldReconnectRef.current = false;
    if (wsRef.current) wsRef.current.close();
    dispatch({ type: "SET_SEARCHING", payload: false });
  }, []);

  useEffect(() => {
    joinGameRef.current = joinGame;
  }, [joinGame]);

  const setGuessModal = (payload: { show: boolean; targetCardId: string | null }) => {
    dispatch({ type: "SET_GUESS_MODAL", payload });
  };

  const handleAttack = useCallback(
    (guess: number) => {
      if (stateRef.current.isProcessing) return;
      const targetCardId = stateRef.current.guessModal.targetCardId;
      if (!targetCardId) return;

      guessModalClosingRef.current = true;
      dispatch({
        type: "SET_GUESS_MODAL",
        payload: { show: false, targetCardId: null },
      });
      setTimeout(() => (guessModalClosingRef.current = false), 500);

      startProcessing();
      dispatch({
        type: "SET_LAST_ATTACK",
        payload: { targetCardId, guess, isYourCard: false },
      });

      const success = sendMessage({ type: "ATTACK", targetCardId, guess });
      if (success) {
        const index = stateRef.current.gameState?.opponentHand.findIndex(
          (card) => card.id === targetCardId
        );
        addLog(
          t.logAttacked
            .replace("{i}", index !== undefined && index >= 0 ? `${index + 1}` : "?")
            .replace("{n}", `${guess}`),
          "attack"
        );
        playSe("attack");
      } else {
        stopProcessing();
      }
    },
    [sendMessage, addLog, t]
  );

  const handleStay = useCallback(() => {
    if (stateRef.current.isProcessing || !stateRef.current.hasMoved) return;
    startProcessing();
    const success = sendMessage({ type: "STAY" });
    if (success) {
      addLog(lang === "ja" ? "パスしました" : "Passed turn", "defense");
      dispatch({ type: "SET_LAST_ATTACK", payload: null });
      playSe("select");
    } else {
      stopProcessing();
    }
  }, [sendMessage, addLog, lang]);

  return {
    roomId,
    setRoomId,
    ...state,
    isReconnecting,
    setGuessModal,
    joinGame,
    joinRanked,
    cancelSearch,
    handleAttack,
    handleStay,
    guessModalClosingRef,
    toasts,
    removeToast,
  };
}
