import { DurableObject } from "cloudflare:workers";

export interface MatchRequest {
  userId: string;
  rate: number;
}

interface QueuedPlayer {
  ws: WebSocket;
  userId: string;
  rate: number;
  joinedAt: number;
}

export class MatchMaker extends DurableObject {
  queue: QueuedPlayer[] = [];

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const rate = parseInt(url.searchParams.get("rate") || "1500");

    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);

    // 接続と同時にキューに追加
    const player: QueuedPlayer = {
      ws: server,
      userId,
      rate,
      joinedAt: Date.now(),
    };
    this.queue.push(player);

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // クライアントからのメッセージは基本無視でOK（PING/PONGくらい？）
    // JOIN_QUEUEはfetchで処理済み
  }

  async webSocketClose(ws: WebSocket) {
    this.queue = this.queue.filter((p) => p.ws !== ws);
  }

  async alarm() {
    // 接続切れのプレイヤーを削除
    this.queue = this.queue.filter(p => {
      try {
        // readyStateチェック (Durable ObjectのWebSocketは標準と少し違うが、sendでエラーが出たら削除でも良い)
        // ここでは安全のため、明らかに切断されているものを除外したいが、
        // DOのWebSocketは自動でcloseイベントが来るので、webSocketCloseで処理されているはず。
        // 念のため、生存確認は送信時に行う。
        return true;
      } catch {
        return false;
      }
    });

    // レート順にソート（近いレートの人と当たりやすくする）
    this.queue.sort((a, b) => a.rate - b.rate);

    let i = 0;
    while (i < this.queue.length - 1) {
      const p1 = this.queue[i];
      const p2 = this.queue[i+1];

      // 自分自身とはマッチングしない
      if (p1.userId === p2.userId) {
        i++;
        continue;
      }

      // レート差のチェック（オプション：例えば差が500以内ならマッチングなど）
      // 今回はシンプルに隣り合う人とマッチングさせる
      
      // マッチング成立
      const roomId = crypto.randomUUID();
      try {
        p1.ws.send(JSON.stringify({ type: "MATCH_FOUND", roomId, opponentRate: p2.rate }));
        p2.ws.send(JSON.stringify({ type: "MATCH_FOUND", roomId, opponentRate: p1.rate }));
        p1.ws.close();
        p2.ws.close();
      } catch (e) {
        // 送信エラーならそのプレイヤーを削除してリトライすべきだが、
        // 次のアラームで処理されるか、webSocketCloseで消えるのを待つ
      }

      // マッチングした2人をキューから削除
      this.queue.splice(i, 2);
      // インデックスは進めなくて良い（削除されたので次のペアがiに来る）
    }

    // CPU対戦へのフォールバック
    const now = Date.now();
    const timeout = 10000; // 10秒待機

    // 待機時間が長いプレイヤーを探す
    // queueはレート順にソートされてしまったので、joinedAtを見る必要がある
    // 削除操作が入るので、後ろからループするか、filterを使う
    const remainingQueue: QueuedPlayer[] = [];
    
    for (const p of this.queue) {
      if (now - p.joinedAt > timeout) {
        // タイムアウト -> CPU戦
        const roomId = crypto.randomUUID();
        try {
          p.ws.send(JSON.stringify({ type: "MATCH_FOUND", roomId, mode: "cpu" }));
          p.ws.close();
        } catch (e) {}
      } else {
        remainingQueue.push(p);
      }
    }
    this.queue = remainingQueue;

    // まだキューに残っているなら、再度アラームをセット
    if (this.queue.length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }
}
