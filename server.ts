import index from './index.html';
import { apiRoutes } from './src/server/routes';

const server = Bun.serve({
  port: 5173, // for compatibility
  routes: {
    '/': index,
    ...apiRoutes,
  },
  development: { hmr: true },
});

console.log('Serving at', server.url.toString());
