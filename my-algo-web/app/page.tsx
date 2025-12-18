"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

import { Lang, User, RankingItem } from "@/types";
import { TRANSLATIONS, API_URL } from "@/utils/constant";
import { useGame } from "@/hooks/useGame";

import GameHeader from "@/components/GameHeader";
import Lobby from "@/components/Lobby";
import GameBoard from "@/components/GameBoard";
import {
  ResultModal,
  GuessModal,
  HistoryModal,
  HelpModal,
  RankingModal,
  NameEditModal,
} from "@/components/Modals";

export default function Home() {
  const [lang, setLang] = useState<Lang>("ja");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);

  const fetchUser = useCallback(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

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
        fetchUser();
        setShowNameEdit(false);
      } else {
        alert("Failed to update name");
      }
    } catch {
      alert("Error updating name");
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    window.location.reload();
  };

  const t = TRANSLATIONS[lang];
  const game = useGame(lang);

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

  // ゲーム終了時にユーザー情報を再取得してレート更新を反映
  useEffect(() => {
    if (gameState?.phase === "finished") {
      // 少し遅延させてDB更新完了を待つ
      setTimeout(() => {
        fetchUser();
      }, 1000);
    }
  }, [gameState?.phase, fetchUser]);

  const isMyTurn = gameState?.turnPlayerId === gameState?.me.id;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-safe selection:bg-slate-200">
      {/* 接続切れアラート */}
      {joined && !isConnected && (
        <div className="fixed top-0 inset-x-0 bg-rose-500 text-white text-center py-2 z-[100] font-bold shadow-md flex items-center justify-center gap-2 text-sm animate-in slide-in-from-top">
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
          onShowHelp={() => setShowHelp(true)}
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
            onJoin={joinGame}
            onJoinRanked={joinRanked}
            user={user}
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
                hasMoved={hasMoved}
                gameLogs={gameLogs}
                lastAttack={lastAttack}
                onStay={handleStay}
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

      {/* --- モーダル --- */}
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

      {showHelp && <HelpModal lang={lang} onClose={() => setShowHelp(false)} />}
      
      {showRanking && (
        <RankingModal
          ranking={ranking}
          onClose={() => setShowRanking(false)}
        />
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