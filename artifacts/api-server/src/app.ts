import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  // In production the React SPA is built into artifacts/teamhub/dist/public.
  // Serve those static files and fall back to index.html for client-side routing.
  const staticDir = path.join(process.cwd(), "artifacts/teamhub/dist/public");
  logger.info({ staticDir, cwd: process.cwd() }, "Serving static files from");
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    const indexPath = path.join(staticDir, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        logger.error(
          { err, indexPath, cwd: process.cwd(), url: req.url },
          "Failed to serve index.html",
        );
        next(err);
      }
    });
  });
} else {
  // In development, proxy all non-API requests to the Vite dev server
  // so HMR and the full React app work while the API server handles /api.
  const vitePort = process.env.VITE_PORT ?? "18692";
  const viteTarget = `http://localhost:${vitePort}`;
  logger.info({ viteTarget }, "Proxying frontend requests to Vite dev server");
  app.use(
    "/",
    createProxyMiddleware({
      target: viteTarget,
      changeOrigin: true,
      ws: true,
    }),
  );
}

export default app;
