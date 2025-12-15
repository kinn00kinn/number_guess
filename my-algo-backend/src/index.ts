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

// --- 変更点1: 4桁のランダム数字IDを発行 ---
app.get("/game/new", (c) => {
  // 1000 ~ 9999 の乱数を生成
  const roomId = Math.floor(1000 + Math.random() * 9000).toString();
  return c.text(roomId);
});

app.get("/game/:id", async (c) => {
  const id = c.req.param("id");
  // --- 変更点2: idFromName を使って、指定した文字列(数字)から部屋を作る ---
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

  // 状態配信（UI更新の要）
  broadcastState() {
    this.sessions.forEach((playerId, ws) => {
      const myData = this.state.players.find((p) => p.id === playerId);
      const opponentData = this.state.players.find((p) => p.id !== playerId);

      // まだ自分が参加処理中の場合はスキップ
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
        // エラー無視
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message as string);
    const senderId = this.sessions.get(ws);

    if (data.type === "JOIN") {
      // 既に満員なら弾く
      if (this.state.players.length >= 2) {
        ws.send(JSON.stringify({ type: "ERROR", message: "満員です" }));
        return;
      }

      // ID生成
      const playerId = `User-${Math.random().toString(36).slice(-4)}`;
      this.sessions.set(ws, playerId);
      this.state.players.push({ id: playerId, hand: [] });

      // --- 変更点3: 参加したら即座に全員（自分含む）へ状態を送信 ---
      // これにより「待機中」画面が表示されるようになる
      this.broadcastState();

      // 2人揃ったら開始
      if (this.state.players.length === 2) {
        this.startGame();
      }
    }

    if (this.state.phase !== "playing" || this.state.turnPlayerId !== senderId)
      return;

    if (data.type === "ATTACK") {
      const opponent = this.state.players.find((p) => p.id !== senderId);
      if (!opponent) return;

      const targetCard = opponent.hand[data.targetIndex];
      if (targetCard && !targetCard.isOpen) {
        if (targetCard.number === data.guess) {
          targetCard.isOpen = true;
          if (opponent.hand.every((c) => c.isOpen)) {
            this.state.phase = "finished";
            this.state.winner = senderId;
          }
        } else {
          if (this.state.drawnCard) {
            this.state.drawnCard.isOpen = true;
            this.insertDrawnCardToHand(senderId);
          }
          this.changeTurn();
        }
        this.broadcastState();
      }
    }

    if (data.type === "STAY") {
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
    // シャッフル
    for (let i = this.state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.deck[i], this.state.deck[j]] = [
        this.state.deck[j],
        this.state.deck[i],
      ];
    }

    // 配布
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
    const pid = this.sessions.get(ws);
    if (pid) {
      this.sessions.delete(ws);
      this.state.players = this.state.players.filter((p) => p.id !== pid);

      // 誰かが抜けたら強制リセット
      this.state.phase = "finished"; // finishedにしてから
      this.broadcastState(); // 一旦通知

      // 完全に初期化
      this.state.players = [];
      this.state.phase = "waiting";
      this.state.deck = [];
    }
  }
}
