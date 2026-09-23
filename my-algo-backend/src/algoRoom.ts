import { DurableObject } from "cloudflare:workers";
import { buildOpponentHandView, buildPublicPlayers, getAllowedGuesses, isValidGuestId, isValidGuessValue, sortCards } from "./gameLogic.js";

type CardColor = "black" | "white";

export interface Card {
  color: CardColor;
  number: number;
  isOpen: boolean;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isCpu: boolean;
}

export interface RatingUpdate {
  old: number;
  new: number;
  diff: number;
}

export interface GameState {
  phase: "waiting" | "playing" | "finished";
  players: Player[];
  deck: Card[];
  turnPlayerId: string | null;
  drawnCard: Card | null;
  winner: string | null;
  ratingUpdates: Record<string, RatingUpdate> | null;
  turnHasSuccessfulAttack: boolean;
}

export type Bindings = {
  ALGO_ROOM: DurableObjectNamespace;
  MATCH_MAKER: DurableObjectNamespace;
  DB: D1Database;
};

type SocketAttachment = {
  authUserId: string | null;
  playerId: string | null;
};

type PersistedRoom = {
  state: GameState;
  isCpuMode: boolean;
  isRanked: boolean;
  allowedPlayerIds: string[] | null;
  failedGuesses: Record<string, number[]>;
  reservedUntil: number | null;
  disconnectDeadlines: Record<string, number>;
  ratingCommitted: boolean;
};

const ROOM_STORAGE_KEY = "room";
const RECONNECT_GRACE_MS = 15_000;
const RESERVATION_MS = 5 * 60_000;

const freshState = (): GameState => ({
  phase: "waiting",
  players: [],
  deck: [],
  turnPlayerId: null,
  drawnCard: null,
  winner: null,
  ratingUpdates: null,
  turnHasSuccessfulAttack: false,
});

export class AlgoRoom extends DurableObject {
  sessions: Map<WebSocket, string> = new Map();
  state: GameState = freshState();
  env: Bindings;

  isCpuMode = false;
  isRanked = false;
  allowedPlayerIds: string[] | null = null;
  failedGuesses: Record<string, number[]> = {};
  reservedUntil: number | null = null;
  disconnectDeadlines: Record<string, number> = {};
  ratingCommitted = false;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.env = env;

    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get<PersistedRoom>(ROOM_STORAGE_KEY);
      if (saved) {
        this.state = saved.state;
        this.isCpuMode = saved.isCpuMode;
        this.isRanked = saved.isRanked;
        this.allowedPlayerIds = saved.allowedPlayerIds;
        this.failedGuesses = saved.failedGuesses || {};
        this.reservedUntil = saved.reservedUntil;
        this.disconnectDeadlines = saved.disconnectDeadlines || {};
        this.ratingCommitted = !!saved.ratingCommitted;
      }

      for (const ws of this.ctx.getWebSockets()) {
        try {
          const attachment = ws.deserializeAttachment() as SocketAttachment | null;
          if (attachment?.playerId) this.sessions.set(ws, attachment.playerId);
        } catch {
          // Ignore sockets created before attachments were introduced.
        }
      }
    });
  }

  private async persist() {
    const snapshot: PersistedRoom = {
      state: this.state,
      isCpuMode: this.isCpuMode,
      isRanked: this.isRanked,
      allowedPlayerIds: this.allowedPlayerIds,
      failedGuesses: this.failedGuesses,
      reservedUntil: this.reservedUntil,
      disconnectDeadlines: this.disconnectDeadlines,
      ratingCommitted: this.ratingCommitted,
    };
    await this.ctx.storage.put(ROOM_STORAGE_KEY, snapshot);
  }

  private async resetRoom() {
    this.state = freshState();
    this.isCpuMode = false;
    this.isRanked = false;
    this.allowedPlayerIds = null;
    this.failedGuesses = {};
    this.reservedUntil = null;
    this.disconnectDeadlines = {};
    this.ratingCommitted = false;
    await this.ctx.storage.deleteAlarm();
    await this.persist();
  }

  private hasLiveSession(playerId: string) {
    for (const id of this.sessions.values()) {
      if (id === playerId) return true;
    }
    return false;
  }

  private async scheduleDisconnectAlarm() {
    const deadlines = Object.values(this.disconnectDeadlines);
    if (deadlines.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/reserve" && request.method === "POST") {
      const now = Date.now();
      const reserved = this.reservedUntil !== null && this.reservedUntil > now;
      if (this.state.players.length > 0 || reserved || this.state.phase === "playing") {
        return new Response("occupied", { status: 409 });
      }
      if (this.state.phase === "finished") await this.resetRoom();
      this.reservedUntil = now + RESERVATION_MS;
      await this.persist();
      return Response.json({ reservedUntil: this.reservedUntil });
    }

    if (url.pathname === "/configure" && request.method === "POST") {
      if (this.state.players.length > 0 || this.state.phase === "playing") {
        return new Response("room already active", { status: 409 });
      }
      const config = (await request.json()) as {
        ranked: boolean;
        cpu: boolean;
        allowedPlayerIds: string[];
      };
      this.isRanked = !!config.ranked;
      this.isCpuMode = !!config.cpu;
      this.allowedPlayerIds = Array.from(new Set(config.allowedPlayerIds || []));
      this.reservedUntil = null;
      await this.persist();
      return Response.json({ ok: true });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    const authUserId = request.headers.get("x-binarily-user-id") || null;
    server.serializeAttachment({ authUserId, playerId: null } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcastState() {
    this.sessions.forEach((playerId, ws) => {
      const myData = this.state.players.find((p) => p.id === playerId);
      const opponentData = this.state.players.find((p) => p.id !== playerId);
      if (!myData) return;

      const opponentHandMasked = opponentData
        ? buildOpponentHandView({
            attackerHand: myData.hand,
            drawnCard:
              this.state.turnPlayerId === playerId ? this.state.drawnCard : null,
            opponentHand: opponentData.hand,
            failedGuesses: this.failedGuesses,
          })
        : [];

      let drawnCardMasked = null;
      if (this.state.drawnCard) {
        const isMyTurn = this.state.turnPlayerId === playerId;
        drawnCardMasked = {
          ...this.state.drawnCard,
          number:
            isMyTurn || this.state.drawnCard.isOpen
              ? this.state.drawnCard.number
              : null,
        };
      }

      const payload = JSON.stringify({
        type: "UPDATE_STATE",
        phase: this.state.phase,
        turnPlayerId: this.state.turnPlayerId,
        me: myData,
        players: buildPublicPlayers(this.state.players),
        opponentHand: opponentHandMasked,
        drawnCard: drawnCardMasked,
        winner: this.state.winner,
        deckCount: this.state.deck.length,
        ratingUpdates: this.state.ratingUpdates,
        canStay:
          this.state.turnPlayerId === playerId &&
          this.state.turnHasSuccessfulAttack,
      });

      try {
        ws.send(payload);
      } catch {
        // Close handling will clean stale sessions.
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let data: any;
    try {
      data = JSON.parse(message as string);
    } catch {
      ws.send(JSON.stringify({ type: "ERROR", message: "Invalid message", fatal: false }));
      return;
    }

    const senderId = this.sessions.get(ws);

    if (data.type === "PING") {
      try {
        ws.send(JSON.stringify({ type: "PONG" }));
      } catch {}
      return;
    }

    if (data.type === "JOIN") {
      const attachment = (ws.deserializeAttachment() || {
        authUserId: null,
        playerId: null,
      }) as SocketAttachment;
      const authUserId = attachment.authUserId;

      let playerId: string;
      if (this.isRanked) {
        if (!authUserId || !this.allowedPlayerIds?.includes(authUserId)) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Unauthorized ranked room", fatal: true }));
          ws.close(1008, "Unauthorized");
          return;
        }
        playerId = authUserId;
      } else if (authUserId) {
        playerId = authUserId;
      } else if (typeof data.guestId === "string" && isValidGuestId(data.guestId)) {
        playerId = data.guestId;
      } else {
        playerId = `guest-${crypto.randomUUID()}`;
      }

      let playerName =
        typeof data.userName === "string" && data.userName.trim()
          ? data.userName.trim().slice(0, 20)
          : playerId.startsWith("guest-")
            ? `Guest-${playerId.slice(-4)}`
            : playerId;

      if (authUserId) {
        try {
          const user = await this.env.DB.prepare("SELECT name FROM users WHERE id = ?")
            .bind(authUserId)
            .first<{ name: string }>();
          if (user?.name) playerName = user.name;
        } catch {
          // Keep fallback name if D1 is temporarily unavailable.
        }
      }

      const existingPlayer = this.state.players.find((p) => p.id === playerId);
      if (!existingPlayer && this.state.players.length >= 2) {
        ws.send(JSON.stringify({ type: "ERROR", message: "満員です", fatal: true }));
        return;
      }

      this.sessions.set(ws, playerId);
      ws.serializeAttachment({ authUserId, playerId } satisfies SocketAttachment);
      delete this.disconnectDeadlines[playerId];

      if (!existingPlayer) {
        this.state.players.push({ id: playerId, name: playerName, hand: [], isCpu: false });
      } else {
        existingPlayer.name = playerName;
      }

      if (this.isCpuMode && !this.state.players.some((p) => p.isCpu)) {
        this.addCpuPlayer();
      }

      this.reservedUntil = null;
      await this.persist();
      await this.scheduleDisconnectAlarm();
      this.broadcastState();

      if (this.state.players.length === 2 && this.state.phase === "waiting") {
        await this.startGame();
      }
      return;
    }

    if (this.state.phase !== "playing" || this.state.turnPlayerId !== senderId) {
      if (["ATTACK", "STAY"].includes(data.type)) this.broadcastState();
      return;
    }

    if (data.type === "ATTACK") {
      await this.handleAttack(senderId!, data.targetCardId, data.guess);
      return;
    }

    if (data.type === "STAY") {
      await this.handleStay(senderId!);
    }
  }

  addCpuPlayer() {
    if (this.state.players.some((p) => p.isCpu)) return;
    this.state.players.push({ id: "CPU", name: "CPU", hand: [], isCpu: true });
  }

  async handleAttack(attackerId: string, targetCardId: unknown, guess: unknown) {
    if (typeof targetCardId !== "string" || !isValidGuessValue(guess)) {
      this.broadcastState();
      return;
    }

    const guessedNumber = guess as number;

    const attacker = this.state.players.find((p) => p.id === attackerId);
    const opponent = this.state.players.find((p) => p.id !== attackerId);
    if (!attacker || !opponent) return;

    const targetCard = opponent.hand.find((card) => card.id === targetCardId);
    if (!targetCard || targetCard.isOpen) {
      this.broadcastState();
      return;
    }

    const allowedGuesses = getAllowedGuesses({
      attackerHand: attacker.hand,
      drawnCard: this.state.drawnCard,
      opponentHand: opponent.hand,
      targetCardId,
      failedGuessesByCard: this.failedGuesses,
    });
    if (!allowedGuesses.includes(guessedNumber)) {
      try {
        const attackerWs = [...this.sessions.entries()].find(([, id]) => id === attackerId)?.[0];
        attackerWs?.send(JSON.stringify({ type: "ERROR", message: "その数字は公開情報と矛盾しています", fatal: false }));
      } catch {}
      this.broadcastState();
      return;
    }

    const notifyPayload = JSON.stringify({
      type: "ATTACK_NOTIFY",
      attackerId,
      targetCardId,
      guess: guessedNumber,
    });
    this.sessions.forEach((_, clientWs) => {
      try {
        clientWs.send(notifyPayload);
      } catch {}
    });

    if (targetCard.number === guessedNumber) {
      targetCard.isOpen = true;
      this.state.turnHasSuccessfulAttack = true;
      await this.persist();

      if (opponent.hand.every((card) => card.isOpen)) {
        await this.finishGame(attackerId);
      } else {
        this.broadcastState();
        if (attacker.isCpu) this.triggerCpuAction(1200);
      }
      return;
    }

    const misses = new Set(this.failedGuesses[targetCardId] || []);
    misses.add(guessedNumber);
    this.failedGuesses[targetCardId] = [...misses].sort((a, b) => a - b);

    if (this.state.drawnCard) {
      this.state.drawnCard.isOpen = true;
      this.insertDrawnCardToHand(attackerId);
    }
    await this.changeTurn();
  }

  async handleStay(playerId: string) {
    if (!this.state.turnHasSuccessfulAttack) {
      this.broadcastState();
      return;
    }
    if (this.state.drawnCard) this.insertDrawnCardToHand(playerId);
    await this.changeTurn();
  }

  async startGame() {
    this.state.phase = "playing";
    this.state.winner = null;
    this.state.ratingUpdates = null;
    this.state.turnHasSuccessfulAttack = false;
    this.failedGuesses = {};
    this.ratingCommitted = false;
    this.state.deck = [];

    for (let number = 0; number < 12; number++) {
      this.state.deck.push({
        color: "black",
        number,
        isOpen: false,
        id: crypto.randomUUID(),
      });
      this.state.deck.push({
        color: "white",
        number,
        isOpen: false,
        id: crypto.randomUUID(),
      });
    }

    for (let i = this.state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.deck[i], this.state.deck[j]] = [this.state.deck[j], this.state.deck[i]];
    }

    this.state.players.forEach((player) => {
      player.hand = this.state.deck.splice(0, 4);
      sortCards(player.hand);
    });

    this.state.turnPlayerId = this.state.players[0].id;
    this.drawCard();
    await this.persist();
    this.broadcastState();

    if (this.state.players[0].isCpu) this.triggerCpuAction();
  }

  drawCard() {
    this.state.drawnCard = this.state.deck.pop() || null;
  }

  async changeTurn() {
    const currentIndex = this.state.players.findIndex((p) => p.id === this.state.turnPlayerId);
    if (currentIndex < 0 || this.state.players.length < 2) return;
    const nextIndex = (currentIndex + 1) % 2;
    const nextPlayer = this.state.players[nextIndex];
    this.state.turnPlayerId = nextPlayer.id;
    this.state.turnHasSuccessfulAttack = false;
    this.drawCard();
    await this.persist();
    this.broadcastState();
    if (nextPlayer.isCpu) this.triggerCpuAction();
  }

  insertDrawnCardToHand(playerId: string) {
    if (!this.state.drawnCard) return;
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;
    player.hand.push(this.state.drawnCard);
    sortCards(player.hand);
    this.state.drawnCard = null;
  }

  async finishGame(winnerId: string) {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";
    this.state.winner = winnerId;
    this.state.turnHasSuccessfulAttack = false;
    await this.persist();

    if (!this.ratingCommitted) {
      try {
        this.state.ratingUpdates = await this.updateRatings(winnerId);
        this.ratingCommitted = true;
      } catch (error) {
        console.error("Failed to update ratings:", error);
      }
      await this.persist();
    }
    this.broadcastState();
  }

  async updateRatings(winnerId: string): Promise<Record<string, RatingUpdate> | null> {
    if (!this.isRanked) return null;

    const winner = this.state.players.find((p) => p.id === winnerId);
    const loser = this.state.players.find((p) => p.id !== winnerId);
    if (!winner || !loser) return null;

    const getRate = async (id: string) => {
      try {
        const user = await this.env.DB.prepare("SELECT rate FROM users WHERE id = ?")
          .bind(id)
          .first<{ rate: number }>();
        return user?.rate ?? 1500;
      } catch {
        return 1500;
      }
    };

    if (winner.isCpu || loser.isCpu) {
      const isPlayerWinner = !winner.isCpu;
      const player = isPlayerWinner ? winner : loser;
      const currentRate = await getRate(player.id);
      const diff = isPlayerWinner ? 10 : -10;
      const newRate = Math.max(0, currentRate + diff);

      await this.env.DB.prepare(
        `UPDATE users SET rate = ?, ${isPlayerWinner ? "wins = wins + 1, " : ""}matches = matches + 1 WHERE id = ?`,
      )
        .bind(newRate, player.id)
        .run();

      return { [player.id]: { old: currentRate, new: newRate, diff } };
    }

    const rw = await getRate(winner.id);
    const rl = await getRate(loser.id);
    const K = 32;
    const ew = 1 / (1 + Math.pow(10, (rl - rw) / 400));
    const el = 1 / (1 + Math.pow(10, (rw - rl) / 400));
    const newRw = Math.round(rw + K * (1 - ew));
    const newRl = Math.max(0, Math.round(rl - K * el));

    await this.env.DB.batch([
      this.env.DB.prepare("UPDATE users SET rate = ?, wins = wins + 1, matches = matches + 1 WHERE id = ?").bind(newRw, winner.id),
      this.env.DB.prepare("UPDATE users SET rate = ?, matches = matches + 1 WHERE id = ?").bind(newRl, loser.id),
    ]);

    return {
      [winner.id]: { old: rw, new: newRw, diff: newRw - rw },
      [loser.id]: { old: rl, new: newRl, diff: newRl - rl },
    };
  }

  async triggerCpuAction(delay = 900) {
    setTimeout(async () => {
      if (this.state.phase !== "playing" || this.state.turnPlayerId !== "CPU") return;
      const cpu = this.state.players.find((p) => p.isCpu);
      const opponent = this.state.players.find((p) => !p.isCpu);
      if (!cpu || !opponent) return;

      const choices = opponent.hand
        .filter((card) => !card.isOpen)
        .map((card) => ({
          card,
          guesses: getAllowedGuesses({
            attackerHand: cpu.hand,
            drawnCard: this.state.drawnCard,
            opponentHand: opponent.hand,
            targetCardId: card.id,
            failedGuessesByCard: this.failedGuesses,
          }),
        }))
        .filter((choice) => choice.guesses.length > 0)
        .sort((a, b) => a.guesses.length - b.guesses.length);

      if (choices.length === 0) return;
      const smallest = choices[0].guesses.length;
      const bestChoices = choices.filter((choice) => choice.guesses.length === smallest);
      const target = bestChoices[Math.floor(Math.random() * bestChoices.length)];
      const guess = target.guesses[Math.floor(Math.random() * target.guesses.length)];
      await this.handleAttack("CPU", target.card.id, guess);
    }, delay);
  }

  async webSocketClose(ws: WebSocket) {
    const pid = this.sessions.get(ws);
    if (!pid) return;
    this.sessions.delete(ws);

    if (this.hasLiveSession(pid)) return;

    const player = this.state.players.find((p) => p.id === pid);
    if (!player || player.isCpu) return;

    this.disconnectDeadlines[pid] = Date.now() + RECONNECT_GRACE_MS;
    await this.persist();
    await this.scheduleDisconnectAlarm();
  }

  async alarm() {
    const now = Date.now();
    const expired = Object.entries(this.disconnectDeadlines)
      .filter(([, deadline]) => deadline <= now)
      .map(([playerId]) => playerId);

    const disconnectedHumans = this.state.players.filter(
      (player) => !player.isCpu && !this.hasLiveSession(player.id),
    );
    if (
      this.state.phase === "playing" &&
      disconnectedHumans.length === 2 &&
      disconnectedHumans.every(
        (player) => (this.disconnectDeadlines[player.id] ?? Infinity) <= now,
      )
    ) {
      await this.resetRoom();
      return;
    }

    for (const playerId of expired) {
      delete this.disconnectDeadlines[playerId];
      if (this.hasLiveSession(playerId)) continue;

      const player = this.state.players.find((p) => p.id === playerId);
      if (!player) continue;

      if (this.state.phase === "playing") {
        const opponent = this.state.players.find((p) => p.id !== playerId);
        if (opponent) await this.finishGame(opponent.id);
      }

      this.state.players = this.state.players.filter((p) => p.id !== playerId);
    }

    if (this.state.players.length === 0) {
      await this.resetRoom();
      return;
    }

    await this.persist();
    await this.scheduleDisconnectAlarm();
    this.broadcastState();
  }
}
