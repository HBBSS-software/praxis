import { app } from './app';

const defaultPort = Number(process.env.PORT) || 3000;

export function startServer(port = defaultPort) {
  app.listen(port, () => {
    const resolvedPort = app.server?.port ?? port;
    console.log(`服务已启动：http://localhost:${resolvedPort}`);
  });

  return app;
}

if (import.meta.main) {
  startServer();
}

export { app };
