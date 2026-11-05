import index from './index.html';

const server = Bun.serve({
  port: 5173, // for compatibility
  routes: {
    '/': index,
  },
  development: { hmr: false },
});

console.log('Serving at', server.url.toString());
