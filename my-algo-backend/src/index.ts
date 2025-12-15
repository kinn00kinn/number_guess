import { Hono } from "hono";
import { cors } from "hono/cors";
import { DurableObject } from "cloudflare:workers";

// --- 1. 型定義 (ゲームのデータ構造) ---
type CardColor = "black" | "white";

interface Card {
  color: CardColor;
  number: number; // 0-11
  isOpen: boolean;
}

interface Player {
  id: string;
  hand: Card[];
}

interface GameState {
  phase: "waiting" | "playing" | "finished";
  players: Player[];
  turnPlayerIndex: number;
}

type Bindings = {
  ALGO_ROOM: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();


app.use(
  "/*",
  cors({
    origin: "*", // 本番ではドメインを指定しますが、開発中はこれでOK
    allowHeaders: ["Content-Type", "Upgrade"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

// --- 2. ルーティング ---
app.get("/game/new", async (c) => {
  const id = c.env.ALGO_ROOM.newUniqueId();
  return c.text(id.toString());
});

app.get("/game/:id", async (c) => {
  const id = c.req.param("id");
  const stubId = c.env.ALGO_ROOM.idFromString(id);
  const stub = c.env.ALGO_ROOM.get(stubId);
  return stub.fetch(c.req.raw);
});

export default app;

// --- 3. Durable Object (ゲームロジック) ---
export class AlgoRoom extends DurableObject {
  // 接続中のクライアントとプレイヤー情報を紐付けるMap
  sessions: Map<WebSocket, string> = new Map();
  state: GameState;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    // 初期状態
    this.state = {
      phase: "waiting",
      players: [],
      turnPlayerIndex: 0,
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

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message as string);

    // --- メッセージ処理 ---

    // 1. ゲーム参加 (JOIN)
    if (data.type === "JOIN") {
      // プレイヤー登録 (最大2人)
      if (this.state.players.length >= 2) {
        ws.send(JSON.stringify({ type: "ERROR", message: "Room is full" }));
        return;
      }

      const playerId = `player-${this.state.players.length + 1}`;
      this.sessions.set(ws, playerId);

      this.state.players.push({ id: playerId, hand: [] });
      console.log(`${playerId} joined. Total: ${this.state.players.length}`);

      // 2人揃ったらゲーム開始
      if (this.state.players.length === 2) {
        this.startGame();
      } else {
        // まだ1人なら待機メッセージ
        this.broadcast({ type: "WAITING", message: "Waiting for opponent..." });
      }
    }
  }

  // ゲーム開始処理
  startGame() {
    this.state.phase = "playing";

    // 1. 山札作成 (0-11の黒・白)
    let deck: Card[] = [];
    for (let i = 0; i < 12; i++) {
      deck.push({ color: "black", number: i, isOpen: false });
      deck.push({ color: "white", number: i, isOpen: false });
    }

    // 2. シャッフル (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // 3. カードを配る (各4枚)
    this.state.players.forEach((player) => {
      player.hand = deck.splice(0, 4);

      // ★重要★ アルゴのルールでソート
      // 数字が小さい順。同じ数字なら黒が小さい（左）
      player.hand.sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        return a.color === "black" ? -1 : 1;
      });
    });

    // 4. 各プレイヤーに通知
    this.sessions.forEach((playerId, ws) => {
      const myData = this.state.players.find((p) => p.id === playerId);
      const opponentData = this.state.players.find((p) => p.id !== playerId);

      // ★ 相手の手札情報を「マスク」して作成
      // 数字は隠すが、色と位置、オープン状態は送る
      const opponentHandMasked = opponentData?.hand.map((card) => ({
        color: card.color,
        isOpen: card.isOpen,
        number: card.isOpen ? card.number : null, // 開いている時だけ数字を入れる
      }));

      ws.send(
        JSON.stringify({
          type: "GAME_START",
          me: myData,
          opponentHand: opponentHandMasked, // ★ ここを変更（枚数だけでなく配列を送る）
        })
      );
    });
  }

  // 全員に送信するヘルパー関数
  broadcast(data: any) {
    const msg = JSON.stringify(data);
    this.sessions.forEach((_, ws) => {
      try {
        ws.send(msg);
      } catch (e) {}
    });
  }

  async webSocketClose(ws: WebSocket) {
    // 1. セッションマップからプレイヤーIDを探す
    const playerId = this.sessions.get(ws);
    if (!playerId) return;

    // 2. プレイヤーリストから削除する
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    this.sessions.delete(ws);

    console.log(`${playerId} left. Remaining: ${this.state.players.length}`);

    // 3. ゲーム中なら「相手が切断しました」と通知してゲームをリセット（簡易実装）
    if (this.state.phase === "playing") {
      this.state.phase = "finished";
      this.broadcast({ type: "OPPONENT_LEFT", message: "相手が切断しました" });
      // 部屋の状態をリセット（次の対戦のために）
      this.state.players = [];
      this.state.phase = "waiting";
    }
  }
}
