"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

import { Lang, User, RankingItem } from "@/types";
import { TRANSLATIONS, API_URL } from "@/utils/constant";
import { useGame } from "@/hooks/useGame";

import GameHeader from "@/components/GameHeader";
import Lobby from "@/components/Lobby";
import GameBoard from "@/components/GameBoard";
import TurnOverlay from "@/components/TurnOverlay"; // ★ 追加
import TutorialModal from "@/components/TutorialModal"; // ★ 追加
import {
  ResultModal,
  GuessModal,
  HistoryModal,
  // HelpModal, // ← 廃止 (TutorialModalに置き換え)
  RankingModal,
  NameEditModal,
} from "@/components/Modals";

export default function Home() {
  const [lang, setLang] = useState<Lang>("ja");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false); // ★ Help -> Tutorial に変更
  const [showRanking, setShowRanking] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [fetchUserTrigger, setFetchUserTrigger] = useState(0);
  const refetchUser = () => setFetchUserTrigger((c) => c + 1);

  useEffect(() => {
    const doFetchUser = async () => {
      setIsUserLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });
        setUser(res.ok ? await res.json() : null);
      } catch (error) {
        console.error("Failed to fetch user:", error);
        setUser(null);
      } finally {
        setIsUserLoading(false);
      }
    };
    doFetchUser();
  }, [fetchUserTrigger]);

  const fetchRanking = useCallback(() => {
    fetch(`${API_URL}/ranking`)
      .then((res) => res.json())
      .then(setRanking)
      .catch(console.error);
  }, []);

  const handleUpdateName = async (name: string) => {
    try {
      const res = await fetch(`${API_URL}/user/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (res.ok) {
        refetchUser();
        setShowNameEdit(false);
      }
    } catch {
      alert("Error");
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.reload();
  };
  // ... (ここまで変更なし) ...

  const t = TRANSLATIONS[lang];
  const game = useGame(lang, user);

  // 分割代入
  const {
    roomId,
    setRoomId,
    joined,
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
  } = game;

  // レート更新確認
  useEffect(() => {
    if (gameState?.phase === "finished") {
      setTimeout(() => {
        refetchUser();
      }, 1000);
    }
  }, [gameState?.phase]);

  const isMyTurn = gameState?.turnPlayerId === gameState?.me.id;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-safe selection:bg-slate-200">
      {/* ★ ターン開始時のカットイン演出 */}
      {joined && gameState && <TurnOverlay isMyTurn={isMyTurn} lang={lang} />}

      {joined && !isConnected && (
        <div className="fixed top-16 inset-x-0 bg-rose-500 text-white text-center py-2 z-[90] font-bold shadow-md flex items-center justify-center gap-2 text-sm animate-in slide-in-from-top">
          <RefreshCw size={14} className="animate-spin" />
          <span>{t.reconnecting}</span>
        </div>
      )}

      <div className="w-full max-w-lg mx-auto relative min-h-screen flex flex-col">
        <GameHeader
          lang={lang}
          toggleLang={() => setLang(lang === "ja" ? "en" : "ja")}
          joined={joined}
          roomId={roomId}
          gameLogs={gameLogs}
          onShowHistory={() => setShowHistoryModal(true)}
          // ★ Helpボタンを押すとチュートリアルが開くように変更
          onShowHelp={() => setShowTutorial(true)}
          user={user}
          onShowRanking={() => {
            fetchRanking();
            setShowRanking(true);
          }}
          onEditName={() => setShowNameEdit(true)}
          onLogout={handleLogout}
        />

        {!joined ? (
          <Lobby
            lang={lang}
            roomId={roomId}
            setRoomId={setRoomId}
            onJoin={(id) => !isUserLoading && joinGame(id)}
            onJoinRanked={() => !isUserLoading && joinRanked()}
            user={user}
            isUserLoading={isUserLoading}
            isSearching={isSearching}
            onCancelSearch={cancelSearch}
          />
        ) : (
          gameState && (
            <>
              {gameState.phase === "finished" && gameState.winner && (
                <ResultModal gameState={gameState} lang={lang} />
              )}
              <GameBoard
                lang={lang}
                gameState={gameState}
                isMyTurn={isMyTurn}
                isProcessing={isProcessing}
                isConnected={isConnected}
                isReconnecting={game.isReconnecting} // 追加
                hasMoved={hasMoved}
                gameLogs={gameLogs}
                lastAttack={lastAttack}
                onStay={handleStay}
                toasts={game.toasts} // 追加
                removeToast={game.removeToast} // 追加
                onCardClick={(index) => {
                  if (guessModalClosingRef.current) return;
                  const card = gameState.opponentHand[index];
                  if (
                    isMyTurn &&
                    !card.isOpen &&
                    !isProcessing &&
                    isConnected
                  ) {
                    setGuessModal({ show: true, targetIndex: index });
                  }
                }}
              />
            </>
          )
        )}
      </div>

      {/* --- モーダル群 --- */}
      {guessModal.show && (
        <GuessModal
          lang={lang}
          isProcessing={isProcessing}
          isConnected={isConnected}
          onClose={() => setGuessModal({ show: false, targetIndex: -1 })}
          onAttack={handleAttack}
        />
      )}

      {showHistoryModal && (
        <HistoryModal
          lang={lang}
          logs={gameLogs}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* ★ HelpModalの代わりにTutorialModalを表示 */}
      {showTutorial && (
        <TutorialModal lang={lang} onClose={() => setShowTutorial(false)} />
      )}

      {showRanking && (
        <RankingModal ranking={ranking} onClose={() => setShowRanking(false)} />
      )}

      {showNameEdit && user && (
        <NameEditModal
          currentName={user.name}
          onSave={handleUpdateName}
          onClose={() => setShowNameEdit(false)}
        />
      )}
    </div>
  );
}
