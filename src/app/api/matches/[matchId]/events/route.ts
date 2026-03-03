import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await context.params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send existing timeline events first
      const timeline = await redis.lrange(
        redisKeys.matchTimeline(matchId),
        0,
        -1
      );

      for (const event of timeline) {
        const data = typeof event === "string" ? event : JSON.stringify(event);
        controller.enqueue(
          encoder.encode(`data: ${data}\n\n`)
        );
      }

      // Poll for new events (since Upstash REST doesn't support true pub/sub)
      let lastIndex = timeline.length;
      const interval = setInterval(async () => {
        try {
          const newEvents = await redis.lrange(
            redisKeys.matchTimeline(matchId),
            lastIndex,
            -1
          );

          for (const event of newEvents) {
            const data =
              typeof event === "string" ? event : JSON.stringify(event);
            controller.enqueue(
              encoder.encode(`data: ${data}\n\n`)
            );
          }

          lastIndex += newEvents.length;

          // Check if match is completed
          const status = await redis.get(redisKeys.matchStatus(matchId));
          if (
            status === "completed" ||
            status === "failed" ||
            status === "cancelled"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ eventType: "stream_end", status })}\n\n`
              )
            );
            clearInterval(interval);
            controller.close();
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 2000);

      // Clean up on abort
      _request.signal?.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
