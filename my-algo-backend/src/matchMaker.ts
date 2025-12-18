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
    // マッチング処理
    // レートが近い人をマッチングさせるロジックを入れると良いが、
    // まずは単純なFIFOで実装。
    
    while (this.queue.length >= 2) {
      const p1 = this.queue.shift()!;
      const p2 = this.queue.shift()!;

      // 接続が切れている可能性があるのでチェック（Durable ObjectのWebSocket管理は自動だが念のため）
      if (p1.ws.readyState !== WebSocket.OPEN) {
        this.queue.unshift(p2); // p2を戻す
        continue;
      }
      if (p2.ws.readyState !== WebSocket.OPEN) {
        this.queue.unshift(p1); // p1を戻す（実際はp1は捨てて良いが）
        continue;
      }

      const roomId = crypto.randomUUID();
      
      try {
        p1.ws.send(JSON.stringify({ type: "MATCH_FOUND", roomId, opponentRate: p2.rate }));
        p2.ws.send(JSON.stringify({ type: "MATCH_FOUND", roomId, opponentRate: p1.rate }));
        p1.ws.close();
        p2.ws.close();
      } catch (e) {
        // エラーハンドリング
      }
    }

    // CPU対戦へのフォールバック
    const now = Date.now();
    const timeout = 15000; // 15秒待ったらCPU

    // 待機時間が長いプレイヤーを探す
    // queueは後ろに追加されるので、先頭が一番古い
    while (this.queue.length > 0 && now - this.queue[0].joinedAt > timeout) {
      const p = this.queue.shift()!;
      if (p.ws.readyState === WebSocket.OPEN) {
        const roomId = crypto.randomUUID();
        try {
          p.ws.send(JSON.stringify({ type: "MATCH_FOUND", roomId, mode: "cpu" }));
          p.ws.close();
        } catch (e) {}
      }
    }

    // まだキューに残っているなら、再度アラームをセット
    if (this.queue.length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 3000);
    }
  }
}
