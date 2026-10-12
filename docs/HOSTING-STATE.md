# Website stopped

The owner asked to stop the website on 8 October 2026. The local preview is stopped. The hosted application returns an HTTP 503 offline page through the root `middleware.ts`; the project, source history and browser-local records remain intact.

The hosting connector has no suspend/unpublish operation, so the hosting project remains registered. The offline response blocks application pages and API routes. Do not remove the middleware or restore the working hosted app until the owner asks to bring the website back.

Subsequent development adds a single-city view and a forecast rainwater lab locally. Internal browser checks use `TERRATRACE_LOCAL_PREVIEW=1` with the loopback development URL. The middleware accepts only `localhost` / `127.0.0.1`, and Vite compiles this switch off in every production build. This does not restart the hosted app. Stop the temporary preview after verification.
