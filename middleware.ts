const offlinePage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>TerraTrace is offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1110;color:#dce8dd;font:16px/1.6 system-ui,sans-serif}main{max-width:480px;padding:40px}span{color:#c9ef98;font-size:13px;letter-spacing:.15em}h1{font-size:34px;font-weight:500;line-height:1.2}p{color:#9aafa1}</style></head>
<body><main><span>TERRATRACE</span><h1>This website is offline.</h1><p>The climate workspace is currently stopped.</p></main></body></html>`;

// Keep the application and its data intact while the owner has it stopped.
// Remove this middleware only when the owner asks to bring the website back.
export function middleware() {
  return new Response(offlinePage, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export const config = {matcher: '/:path*'};
