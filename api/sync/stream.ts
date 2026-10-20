export const config = {
  runtime: 'edge',
};

export default function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
      },
    });
  }

  const url = new URL(req.url);
  const clientId =
    url.searchParams.get('clientId') ||
    `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial padding to force proxy buffer flush
      controller.enqueue(encoder.encode(':' + ' '.repeat(2048) + '\n\n'));
      controller.enqueue(encoder.encode(`: heartbeat initial ${Date.now()}\n\n`));
      controller.enqueue(encoder.encode('retry: 3000\n\n'));

      // 2. Handshake event
      const eventId = 1001;
      const handshake = JSON.stringify({
        type: 'CONNECTED',
        clientId,
        eventId,
        timestamp: Date.now(),
      });
      controller.enqueue(encoder.encode(`id: ${eventId}\ndata: ${handshake}\n\n`));

      // 3. Heartbeat every 15s to maintain edge connection
      const interval = setInterval(() => {
        try {
          const pingSeq = Math.floor(Date.now() / 1000);
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          controller.enqueue(
            encoder.encode(
              `id: ${pingSeq}\ndata: ${JSON.stringify({ type: 'PING', eventId: pingSeq, timestamp: Date.now() })}\n\n`
            )
          );
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      // Auto close stream after 5 minutes so client reconnects with backoff naturally
      setTimeout(() => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // ignore
        }
      }, 300000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
    },
  });
}
