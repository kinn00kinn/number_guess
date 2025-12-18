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

export interface GameState {
  phase: "waiting" | "playing" | "finished";
  players: Player[];
  deck: Card[];
  turnPlayerId: string | null;
  drawnCard: Card | null;
  winner: string | null;
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
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // CPU対戦フラグの確認
    if (url.searchParams.get("cpu") === "true") {
      this.isCpuMode = true;
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);

    // CPUモードなら、最初の接続時にCPUをプレイヤーとして登録しておく（まだプレイヤーが0人の場合）
    if (this.isCpuMode && this.state.players.length === 0) {
       // プレイヤーが入ってきたタイミングでCPUを追加する処理は JOIN で行う方が安全
       // ここではフラグだけ覚えておく手もあるが、URLパラメータはJOINメッセージには含まれないので
       // セッションに紐付けるか、あるいはJOIN時にクライアントから送ってもらう。
       // 今回はシンプルに、JOIN時に1人目がCPUモードで入ってきたら、即座にCPUも参加させるロジックにする。
    }

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
        opponentHand: opponentHandMasked,
        drawnCard: drawnCardMasked,
        winner: this.state.winner,
        deckCount: this.state.deck.length,
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

    if (data.type === "PING") {
      try {
        ws.send(JSON.stringify({ type: "PONG" }));
      } catch (e) {}
      return;
    }

    // 1. JOIN
    if (data.type === "JOIN") {
      if (this.state.players.length >= 2) {
        ws.send(JSON.stringify({ type: "ERROR", message: "満員です" }));
        return;
      }

      // ユーザーIDの決定（認証済みならDBのIDを使いたいが、ここでは簡易IDまたは渡されたID）
      // 本来はクエリパラメータやトークンからIDを特定すべき。
      // 今回は既存ロジックを踏襲しつつ、CPUモードならCPUを追加。
      const playerId = data.userId || `User-${Math.random().toString(36).slice(-4)}`;
      const playerName = data.userName || playerId;

      this.sessions.set(ws, playerId);
      
      // 既に自分がいないか確認
      if (!this.state.players.find(p => p.id === playerId)) {
        this.state.players.push({ id: playerId, name: playerName, hand: [], isCpu: false });
      }

      // CPUモード判定 (クライアントから送ってもらう or URLパラメータ)
      // ここではクライアントが "cpu": true を送ってくると仮定、または1人目が待機中にタイムアウトでCPU戦になった場合
      if ((data.mode === "cpu" || this.isCpuMode) && this.state.players.length === 1) {
         this.addCpuPlayer();
      }

      this.broadcastState();

      if (this.state.players.length === 2) {
        this.startGame();
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
        this.finishGame(attackerId);
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
    this.broadcastState();

    // レート計算と保存
    await this.updateRatings(winnerId);
  }

  async updateRatings(winnerId: string) {
    const winner = this.state.players.find(p => p.id === winnerId);
    const loser = this.state.players.find(p => p.id !== winnerId);
    if (!winner || !loser) return;

    // CPU戦の場合
    if (winner.isCpu || loser.isCpu) {
      // プレイヤーが勝った場合のみレートを少し上げる
      if (!winner.isCpu) {
        await this.env.DB.prepare("UPDATE users SET rate = rate + 10, wins = wins + 1, matches = matches + 1 WHERE id = ?").bind(winner.id).run();
      } else if (!loser.isCpu) {
        // プレイヤーが負けた場合
        await this.env.DB.prepare("UPDATE users SET matches = matches + 1 WHERE id = ?").bind(loser.id).run();
      }
      return;
    }

    // DBから現在のレートを取得
    const winnerData = await this.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(winner.id).first<any>();
    const loserData = await this.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(loser.id).first<any>();

    if (!winnerData || !loserData) return;

    const Rw = winnerData.rate;
    const Rl = loserData.rate;
    const K = 32;

    const Ew = 1 / (1 + Math.pow(10, (Rl - Rw) / 400));
    const El = 1 / (1 + Math.pow(10, (Rw - Rl) / 400));

    const newRw = Math.round(Rw + K * (1 - Ew));
    const newRl = Math.round(Rl + K * (0 - El));

    await this.env.DB.batch([
      this.env.DB.prepare("UPDATE users SET rate = ?, wins = wins + 1, matches = matches + 1 WHERE id = ?").bind(newRw, winner.id),
      this.env.DB.prepare("UPDATE users SET rate = ?, matches = matches + 1 WHERE id = ?").bind(newRl, loser.id)
    ]);
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
           this.finishGame(opponent.id);
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
      }
    }
  }
}
