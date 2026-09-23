import { DurableObject } from "cloudflare:workers";

interface QueuedPlayer {
  ws: WebSocket;
  userId: string;
  rate: number;
  joinedAt: number;
}

type MatchAttachment = {
  kind: "match-queue";
  userId: string;
  rate: number;
  joinedAt: number;
};

type Bindings = {
  ALGO_ROOM: DurableObjectNamespace;
};

export class MatchMaker extends DurableObject {
  queue: QueuedPlayer[] = [];
  env: Bindings;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.env = env;

    for (const ws of this.ctx.getWebSockets()) {
      try {
        const attachment = ws.deserializeAttachment() as MatchAttachment | null;
        if (attachment?.kind === "match-queue") {
          this.queue.push({
            ws,
            userId: attachment.userId,
            rate: attachment.rate,
            joinedAt: attachment.joinedAt,
          });
        }
      } catch {
        // Ignore stale sockets created before queue attachments existed.
      }
    }
  }

  private async configureRoom(
    roomId: string,
    config: { ranked: boolean; cpu: boolean; allowedPlayerIds: string[] },
  ) {
    const room = this.env.ALGO_ROOM.get(this.env.ALGO_ROOM.idFromName(roomId));
    const response = await room.fetch("https://room.internal/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(`Failed to configure room: ${response.status}`);
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const parsedRate = Number.parseInt(url.searchParams.get("rate") || "1500", 10);
    const rate = Number.isFinite(parsedRate) ? parsedRate : 1500;
    if (!userId) return new Response("Missing userId", { status: 400 });

    for (const existing of this.queue.filter((p) => p.userId === userId)) {
      try {
        existing.ws.close(1000, "Replaced by newer matchmaking session");
      } catch {}
    }
    this.queue = this.queue.filter((p) => p.userId !== userId);

    const { 0: client, 1: server } = new WebSocketPair();
    const joinedAt = Date.now();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      kind: "match-queue",
      userId,
      rate,
      joinedAt,
    } satisfies MatchAttachment);
    this.queue.push({ ws: server, userId, rate, joinedAt });

    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {
    // Matching is server-driven; client messages are intentionally ignored.
  }

  async webSocketClose(ws: WebSocket) {
    this.queue = this.queue.filter((p) => p.ws !== ws);
  }

  async alarm() {
    this.queue.sort((a, b) => a.rate - b.rate);

    let i = 0;
    while (i < this.queue.length - 1) {
      const p1 = this.queue[i];
      const p2 = this.queue[i + 1];

      if (p1.userId === p2.userId) {
        i++;
        continue;
      }

      const roomId = crypto.randomUUID();
      try {
        await this.configureRoom(roomId, {
          ranked: true,
          cpu: false,
          allowedPlayerIds: [p1.userId, p2.userId],
        });
        p1.ws.send(
          JSON.stringify({ type: "MATCH_FOUND", roomId, opponentRate: p2.rate }),
        );
        p2.ws.send(
          JSON.stringify({ type: "MATCH_FOUND", roomId, opponentRate: p1.rate }),
        );
        p1.ws.close(1000, "Match found");
        p2.ws.close(1000, "Match found");
        this.queue.splice(i, 2);
      } catch (error) {
        console.error("Failed to create ranked room", error);
        i += 2;
      }
    }

    const now = Date.now();
    const timeout = 10_000;
    const remainingQueue: QueuedPlayer[] = [];

    for (const player of this.queue) {
      if (now - player.joinedAt <= timeout) {
        remainingQueue.push(player);
        continue;
      }

      const roomId = crypto.randomUUID();
      try {
        await this.configureRoom(roomId, {
          ranked: true,
          cpu: true,
          allowedPlayerIds: [player.userId],
        });
        player.ws.send(
          JSON.stringify({ type: "MATCH_FOUND", roomId, mode: "cpu" }),
        );
        player.ws.close(1000, "CPU fallback");
      } catch (error) {
        console.error("Failed to create CPU ranked room", error);
        remainingQueue.push(player);
      }
    }

    this.queue = remainingQueue;
    if (this.queue.length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }
}
