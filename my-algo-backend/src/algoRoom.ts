import { DurableObject } from "cloudflare:workers";

// --- 型定義 ---
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
}

export type Bindings = {
  ALGO_ROOM: DurableObjectNamespace;
  MATCH_MAKER: DurableObjectNamespace;
  DB: D1Database;
};

export class AlgoRoom extends DurableObject {
  sessions: Map<WebSocket, string> = new Map();
  state: GameState;
  env: Bindings;

  isCpuMode: boolean = false;
  isRanked: boolean = false;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.env = env;
    this.state = {
      phase: "waiting",
      players: [],
      deck: [],
      turnPlayerId: null,
      drawnCard: null,
      winner: null,
      ratingUpdates: null,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Get user ID from the header added by the main app
    const userId = request.headers.get("X-User-ID");
    if (!userId) {
      return new Response("Unauthorized: Missing X-User-ID header", { status: 401 });
    }
    
    // CPU対戦フラグの確認
    if (url.searchParams.get("cpu") === "true") {
      this.isCpuMode = true;
    }
    // ランクマッチフラグの確認
    if (url.searchParams.get("ranked") === "true") {
      this.isRanked = true;
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    
    // Associate the user ID with the server-side WebSocket right away
    this.sessions.set(server, userId);

    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // 状態配信
  broadcastState() {
    this.sessions.forEach((playerId, ws) => {
      const myData = this.state.players.find((p) => p.id === playerId);
      // 相手データ（CPU含む）
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
        players: this.state.players, // 追加
        opponentHand: opponentHandMasked,
        drawnCard: drawnCardMasked,
        winner: this.state.winner,
        deckCount: this.state.deck.length,
        ratingUpdates: this.state.ratingUpdates,
      });

      try {
        ws.send(payload);
      } catch (e) {
        // 送信エラーは無視
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message as string);
    const senderId = this.sessions.get(ws);

    if (!senderId) {
      // This socket is not associated with a user ID.
      try { ws.close(1011, "User ID not found"); } catch(e) {}
      return;
    }

    if (data.type === "PING") {
      try {
        ws.send(JSON.stringify({ type: "PONG" }));
      } catch (e) {}
      return;
    }

    // 1. JOIN
    if (data.type === "JOIN") {
      // The user ID is now trusted as it comes from the session map.
      const playerId = senderId;
      // The client can suggest a name, but the ID is non-negotiable.
      const playerName = data.userName || "Player";

      // 既に自分がいるか確認（再接続）
      const existingPlayer = this.state.players.find(p => p.id === playerId);
      
      if (!existingPlayer && this.state.players.length >= 2) {
        ws.send(JSON.stringify({ type: "ERROR", message: "満員です" }));
        return;
      }
      
      if (!existingPlayer) {
        this.state.players.push({ id: playerId, name: playerName, hand: [], isCpu: false });
      } else {
        // 名前更新（もし変わっていれば）
        existingPlayer.name = playerName;
      }

      // CPUモード判定
      if ((data.mode === "cpu" || this.isCpuMode) && this.state.players.length === 1) {
         this.addCpuPlayer();
      }

      this.broadcastState();

      if (this.state.players.length === 2) {
        // 既にプレイ中なら開始しない
        if (this.state.phase === "waiting") {
          this.startGame();
        }
      }
      return;
    }

    // ゲーム中のアクション処理
    if (
      this.state.phase !== "playing" ||
      this.state.turnPlayerId !== senderId
    ) {
      if (["ATTACK", "STAY"].includes(data.type)) {
        this.broadcastState();
      }
      return;
    }

    // 2. ATTACK
    if (data.type === "ATTACK") {
      await this.handleAttack(senderId!, data.targetIndex, data.guess);
    }

    // 3. STAY
    if (data.type === "STAY") {
      this.handleStay(senderId!);
    }
  }

  addCpuPlayer() {
    const cpuId = "CPU";
    this.state.players.push({ id: cpuId, name: "CPU", hand: [], isCpu: true });
  }

  async handleAttack(attackerId: string, targetIndex: number, guess: number) {
    const opponent = this.state.players.find((p) => p.id !== attackerId);
    if (!opponent || !opponent.hand[targetIndex] || opponent.hand[targetIndex].isOpen) {
      this.broadcastState();
      return;
    }

    // 攻撃通知
    const notifyPayload = JSON.stringify({
      type: "ATTACK_NOTIFY",
      attackerId: attackerId,
      targetIndex: targetIndex,
      guess: guess,
    });
    this.sessions.forEach((_, clientWs) => {
      try { clientWs.send(notifyPayload); } catch (e) {}
    });

    const targetCard = opponent.hand[targetIndex];

    if (targetCard.number === guess) {
      // HIT
      targetCard.isOpen = true;
      if (opponent.hand.every((c) => c.isOpen)) {
        await this.finishGame(attackerId);
      } else {
        // 続けて攻撃可能だが、CPUの場合はどうするか？
        // CPUなら確率でStayさせるなどのロジックが必要。
        // 人間の場合はクライアントが選択する。
        this.broadcastState();
        
        // CPUの手番でHITした場合、連続攻撃するか判断
        if (this.state.players.find(p => p.id === attackerId)?.isCpu) {
           this.triggerCpuAction(2000); // 2秒後に再考
        }
      }
    } else {
      // MISS
      if (this.state.drawnCard) {
        this.state.drawnCard.isOpen = true;
        this.insertDrawnCardToHand(attackerId);
      }
      this.changeTurn();
    }
  }

  handleStay(playerId: string) {
    if (this.state.drawnCard) {
      this.insertDrawnCardToHand(playerId);
    }
    this.changeTurn();
    this.broadcastState();
  }

  startGame() {
    this.state.phase = "playing";
    this.state.winner = null;
    this.state.ratingUpdates = null;
    this.state.deck = [];
    for (let i = 0; i < 12; i++) {
      this.state.deck.push({ color: "black", number: i, isOpen: false, id: `b-${i}` });
      this.state.deck.push({ color: "white", number: i, isOpen: false, id: `w-${i}` });
    }
    // Shuffle
    for (let i = this.state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.deck[i], this.state.deck[j]] = [this.state.deck[j], this.state.deck[i]];
    }

    // Deal
    this.state.players.forEach((p) => {
      p.hand = this.state.deck.splice(0, 4);
      this.sortHand(p.hand);
    });

    this.state.turnPlayerId = this.state.players[0].id;
    this.drawCard();
    this.broadcastState();

    // 先攻がCPUなら思考開始
    const firstPlayer = this.state.players[0];
    if (firstPlayer.isCpu) {
      this.triggerCpuAction();
    }
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
    const nextPlayer = this.state.players[nextIndex];
    this.state.turnPlayerId = nextPlayer.id;
    this.drawCard();
    this.broadcastState();

    if (nextPlayer.isCpu) {
      this.triggerCpuAction();
    }
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

  async finishGame(winnerId: string) {
    this.state.phase = "finished";
    this.state.winner = winnerId;
    
    // レート計算と保存
    try {
      const updates = await this.updateRatings(winnerId);
      this.state.ratingUpdates = updates;
    } catch (e) {
      console.error("Failed to update ratings:", e);
    }

    this.broadcastState();
  }

  async updateRatings(winnerId: string): Promise<Record<string, RatingUpdate> | null> {
    // ランクマッチでない場合はレート更新しない
    if (!this.isRanked) {
      console.log("Not a ranked match. Skipping rating update.");
      return null;
    }

    const winner = this.state.players.find(p => p.id === winnerId);
    const loser = this.state.players.find(p => p.id !== winnerId);
    if (!winner || !loser) return null;

    console.log(`updateRatings called. Winner: ${winner.id}, Loser: ${loser.id}`);

    // Helper to get rate safely
    const getRate = async (id: string) => {
      try {
        const user = await this.env.DB.prepare("SELECT rate FROM users WHERE id = ?").bind(id).first<any>();
        return user?.rate ?? 1500;
      } catch (e) {
        return 1500;
      }
    };

    // CPU Match
    if (winner.isCpu || loser.isCpu) {
      const isPlayerWinner = !winner.isCpu;
      const player = isPlayerWinner ? winner : loser;
      
      const currentRate = await getRate(player.id);
      // Win: +10, Lose: -10
      const diff = isPlayerWinner ? 10 : -10;
      const newRate = Math.max(0, currentRate + diff);

      try {
        await this.env.DB.prepare(
          `UPDATE users SET rate = ?, ${isPlayerWinner ? "wins = wins + 1, " : ""}matches = matches + 1 WHERE id = ?`
        ).bind(newRate, player.id).run();
      } catch (e) {
        console.error("Error updating CPU match rate:", e);
      }

      return {
        [player.id]: { old: currentRate, new: newRate, diff }
      };
    }

    // PvP Match
    const rw = await getRate(winner.id);
    const rl = await getRate(loser.id);
    const K = 32;

    const ew = 1 / (1 + Math.pow(10, (rl - rw) / 400));
    const el = 1 / (1 + Math.pow(10, (rw - rl) / 400));

    const newRw = Math.round(rw + K * (1 - ew));
    const newRl = Math.round(rl + K * (0 - el));

    try {
      await this.env.DB.batch([
        this.env.DB.prepare("UPDATE users SET rate = ?, wins = wins + 1, matches = matches + 1 WHERE id = ?").bind(newRw, winner.id),
        this.env.DB.prepare("UPDATE users SET rate = ?, matches = matches + 1 WHERE id = ?").bind(newRl, loser.id)
      ]);
    } catch (e) {
      console.error("Error updating PvP match rates:", e);
    }

    return {
      [winner.id]: { old: rw, new: newRw, diff: newRw - rw },
      [loser.id]: { old: rl, new: newRl, diff: newRl - rl }
    };
  }

  // --- CPU Logic ---
  async triggerCpuAction(delay = 1500) {
    // 思考時間を演出
    setTimeout(async () => {
      if (this.state.phase !== "playing" || this.state.turnPlayerId !== "CPU") return;

      const cpu = this.state.players.find(p => p.isCpu);
      const opponent = this.state.players.find(p => !p.isCpu);
      if (!cpu || !opponent) return;

      // 1. 攻撃するかStayするか
      // ドローしたカードがある場合、Stayも選択肢。
      // ここではシンプルに「必ず攻撃する」戦略をとる。
      // ただし、既に攻撃を外した後（changeTurnされるのでここには来ないはずだが）や
      // 連続攻撃のチャンスの時は考える。

      // ターゲット選定
      // 相手の伏せカードを探す
      const hiddenIndices = opponent.hand
        .map((c, i) => ({ c, i }))
        .filter(item => !item.c.isOpen);

      if (hiddenIndices.length === 0) return; // 全て開いている（勝利確定のはず）

      // 推論ロジック
      // 自分の手札 + 自分のドローカード + 相手のオープンカード + 自分の過去の失敗(記憶していないが)
      // から、あり得ない数字を除外する。
      
      const visibleNumbers = new Set<number>();
      // 自分の手札
      cpu.hand.forEach(c => visibleNumbers.add(c.number));
      // ドローカード
      if (this.state.drawnCard && (this.state.drawnCard.isOpen || this.state.turnPlayerId === "CPU")) {
        visibleNumbers.add(this.state.drawnCard.number);
      }
      // 相手のオープンカード
      opponent.hand.forEach(c => {
        if (c.isOpen) visibleNumbers.add(c.number);
      });

      // ターゲット決定（ランダム）
      const target = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      
      // 数字決定
      // 0-11 の中で visibleNumbers にないもの
      const candidates = [];
      for(let i=0; i<12; i++) {
        if (!visibleNumbers.has(i)) candidates.push(i);
      }

      // さらに、相手のカードの並び順から推測（簡易版）
      // 左側は小さい、右側は大きい。
      // target.i が小さいほど小さい数字の可能性が高い。
      // 今回は完全ランダムで実装。
      const guess = candidates.length > 0 
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : 0;

      await this.handleAttack("CPU", target.i, guess);

    }, delay);
  }

  async webSocketClose(ws: WebSocket) {
    const pid = this.sessions.get(ws);
    if (pid) {
      this.sessions.delete(ws);
      // 切断時の処理
      // プレイ中なら相手の勝ち
      if (this.state.phase === "playing") {
        const opponent = this.state.players.find(p => p.id !== pid);
        if (opponent) {
           await this.finishGame(opponent.id);
        } else {
           // 両方いなくなった?
           this.state.phase = "finished";
        }
      }
      
      // プレイヤーリストから削除（再接続を考慮しない場合）
      this.state.players = this.state.players.filter((p) => p.id !== pid);
      if (this.state.players.length === 0) {
        this.state.phase = "waiting";
        this.state.deck = [];
        this.state.ratingUpdates = null;
      }
    }
  }
}