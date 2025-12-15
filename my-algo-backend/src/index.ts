import { Hono } from "hono";
import { cors } from "hono/cors";
import { DurableObject } from "cloudflare:workers";

// --- 型定義 ---
type CardColor = "black" | "white";

interface Card {
  color: CardColor;
  number: number;
  isOpen: boolean;
  id: string;
}

interface Player {
  id: string;
  hand: Card[];
}

interface GameState {
  phase: "waiting" | "playing" | "finished";
  players: Player[];
  deck: Card[];
  turnPlayerId: string | null;
  drawnCard: Card | null;
  winner: string | null;
}

type Bindings = {
  ALGO_ROOM: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Upgrade"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

// 4桁のランダム数字IDを発行
app.get("/game/new", (c) => {
  const roomId = Math.floor(1000 + Math.random() * 9000).toString();
  console.log(`[API] Created new room request: ${roomId}`);
  return c.text(roomId);
});

app.get("/game/:id", async (c) => {
  const id = c.req.param("id");
  const stubId = c.env.ALGO_ROOM.idFromName(id);
  const stub = c.env.ALGO_ROOM.get(stubId);
  return stub.fetch(c.req.raw);
});

export default app;

// --- Durable Object ---
export class AlgoRoom extends DurableObject {
  sessions: Map<WebSocket, string> = new Map();
  state: GameState;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.state = {
      phase: "waiting",
      players: [],
      deck: [],
      turnPlayerId: null,
      drawnCard: null,
      winner: null,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // 状態配信
  broadcastState() {
    // console.log(`[Broadcast] Sending state to ${this.sessions.size} clients. Phase: ${this.state.phase}`)

    this.sessions.forEach((playerId, ws) => {
      const myData = this.state.players.find((p) => p.id === playerId);
      const opponentData = this.state.players.find((p) => p.id !== playerId);

      if (!myData) return;

      const opponentHandMasked =
        opponentData?.hand.map((c) => ({
          ...c,
          number: c.isOpen ? c.number : null,
        })) || [];

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
        opponentHand: opponentHandMasked,
        drawnCard: drawnCardMasked,
        winner: this.state.winner,
        deckCount: this.state.deck.length,
      });

      try {
        ws.send(payload);
      } catch (e) {
        console.error(`[Error] Failed to send to ${playerId}`);
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message as string);
    const senderId = this.sessions.get(ws);

    // --- PING (ログ汚染を防ぐため早期リターン) ---
    if (data.type === "PING") {
      return;
    }

    console.log(
      `[WS] Received from ${senderId || "Unknown"}:`,
      data.type,
      data
    );

    // 1. JOIN
    if (data.type === "JOIN") {
      if (this.state.players.length >= 2) {
        ws.send(JSON.stringify({ type: "ERROR", message: "満員です" }));
        return;
      }

      const playerId = `User-${Math.random().toString(36).slice(-4)}`;
      this.sessions.set(ws, playerId);
      this.state.players.push({ id: playerId, hand: [] });
      console.log(
        `[JOIN] New player: ${playerId}. Total: ${this.state.players.length}`
      );

      this.broadcastState();

      if (this.state.players.length === 2) {
        console.log(`[GAME] 2 players ready. Starting game...`);
        this.startGame();
      }
    }

    // ゲーム中のアクション処理
    if (
      this.state.phase !== "playing" ||
      this.state.turnPlayerId !== senderId
    ) {
      // 自分のターンじゃない時のアクションは無視するが、
      // フロントエンドの不整合を防ぐために念のためStateを送り返しても良い
      if (["ATTACK", "STAY"].includes(data.type)) {
        console.log(`[WARN] Action ignored (Not turn or Not playing)`);
        this.broadcastState();
      }
      return;
    }

    // 2. ATTACK
    if (data.type === "ATTACK") {
      const opponent = this.state.players.find((p) => p.id !== senderId);

      // バリデーション: 相手がいない、カードがない、既に開いている
      if (
        !opponent ||
        !opponent.hand[data.targetIndex] ||
        opponent.hand[data.targetIndex].isOpen
      ) {
        console.log(`[ATTACK] Invalid target. Sending state to unlock client.`);
        this.broadcastState(); // ★重要: これがないとクライアントが止まる
        return;
      }

      const targetCard = opponent.hand[data.targetIndex];
      console.log(
        `[ATTACK] Target: ${targetCard.number} (Guess: ${data.guess})`
      );

      if (targetCard.number === data.guess) {
        // HIT
        console.log(`[ATTACK] HIT!`);
        targetCard.isOpen = true;
        if (opponent.hand.every((c) => c.isOpen)) {
          console.log(`[GAME] Winner: ${senderId}`);
          this.state.phase = "finished";
          this.state.winner = senderId;
        }
      } else {
        // MISS
        console.log(`[ATTACK] MISS!`);
        if (this.state.drawnCard) {
          this.state.drawnCard.isOpen = true;
          this.insertDrawnCardToHand(senderId);
        }
        this.changeTurn();
      }
      this.broadcastState();
    }

    // 3. STAY
    if (data.type === "STAY") {
      console.log(`[STAY] Player chose to stay.`);
      if (this.state.drawnCard) {
        this.insertDrawnCardToHand(senderId);
      }
      this.changeTurn();
      this.broadcastState();
    }
  }

  startGame() {
    this.state.phase = "playing";
    this.state.winner = null;
    this.state.deck = [];
    for (let i = 0; i < 12; i++) {
      this.state.deck.push({
        color: "black",
        number: i,
        isOpen: false,
        id: `b-${i}`,
      });
      this.state.deck.push({
        color: "white",
        number: i,
        isOpen: false,
        id: `w-${i}`,
      });
    }
    // Shuffle
    for (let i = this.state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.deck[i], this.state.deck[j]] = [
        this.state.deck[j],
        this.state.deck[i],
      ];
    }

    // Deal
    this.state.players.forEach((p) => {
      p.hand = this.state.deck.splice(0, 4);
      this.sortHand(p.hand);
    });

    this.state.turnPlayerId = this.state.players[0].id;
    this.drawCard();
    this.broadcastState();
  }

  drawCard() {
    if (this.state.deck.length > 0) {
      this.state.drawnCard = this.state.deck.pop() || null;
      console.log(
        `[GAME] Card drawn. Deck remaining: ${this.state.deck.length}`
      );
    } else {
      this.state.drawnCard = null;
    }
  }

  changeTurn() {
    const currentIndex = this.state.players.findIndex(
      (p) => p.id === this.state.turnPlayerId
    );
    const nextIndex = (currentIndex + 1) % 2;
    this.state.turnPlayerId = this.state.players[nextIndex].id;
    console.log(`[GAME] Turn changed to: ${this.state.turnPlayerId}`);
    this.drawCard();
  }

  insertDrawnCardToHand(playerId: string) {
    if (!this.state.drawnCard) return;
    const player = this.state.players.find((p) => p.id === playerId);
    if (player) {
      player.hand.push(this.state.drawnCard);
      this.sortHand(player.hand);
      this.state.drawnCard = null;
    }
  }

  sortHand(hand: Card[]) {
    hand.sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      return a.color === "black" ? -1 : 1;
    });
  }

  async webSocketClose(ws: WebSocket) {
    const pid = this.sessions.get(ws)
    if(pid) {
      console.log(`[WS] Closed: ${pid}`)
      this.sessions.delete(ws)
      this.state.players = this.state.players.filter(p => p.id !== pid)
      
      // ★修正: ゲーム中(playing)の場合のみ、強制終了・リセットする
      if (this.state.phase === 'playing') {
        this.state.phase = 'finished' 
        this.state.winner = 'opponent-left' // 相手落ちで勝ち
        this.broadcastState()
        
        // 部屋を畳む
        this.state.players = []
        this.state.phase = 'waiting'
        this.state.deck = []
        console.log('[GAME] Reset room due to disconnection during game')
      } else {
        // ★待機中(waiting)なら、リセットせずに今の人数を通知するだけ
        this.broadcastState()
        console.log(`[WAIT] Player left. Remaining: ${this.state.players.length}`)
      }
    }
  }
}
