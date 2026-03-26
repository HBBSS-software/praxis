import { app } from './app';

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '0.0.0.0';

app.listen({
  port,
  hostname
});

console.log(`Server listening on http://${hostname}:${port}`);
