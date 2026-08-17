export const dynamic = "force-dynamic";

export function GET() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>404</title></head><body><main><h1>404</h1><p>This page could not be found.</p></main></body></html>`,
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
      status: 404,
    },
  );
}
