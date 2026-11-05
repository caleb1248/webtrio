import { join } from 'node:path';
import { rm } from 'fs/promises';
import plugin from 'bun-plugin-tailwind';

const outdir = new URL('./dist/', import.meta.url);

await rm(outdir, { recursive: true, force: true });

await Bun.build({
  entrypoints: ['index.html'],
  outdir: outdir.pathname,
  plugins: [plugin],
});

const html = Bun.file(new URL('./index.html', outdir));

const rewriter = new HTMLRewriter();
rewriter.on('script', {
  async element(element) {
    const src = element.getAttribute('src');
    if (src) {
      element.removeAttribute('src');
      const contents = await fetch(new URL(src, outdir)).then((res) => res.text());
      element.setInnerContent(contents, { html: true });
    }
  },
});

rewriter.on('link[rel="stylesheet"]', {
  async element(element) {
    const href = element.getAttribute('href');
    if (href) {
      const contents = await fetch(new URL(href, outdir)).then((res) => res.text());
      const style = `<style>${contents}</style>`;
      element.after(style, { html: true });
      element.remove();
    }
  },
});

await Bun.write(new URL('./index-singlefile.html', outdir), rewriter.transform(new Response(html)));

console.log('url:', new URL('./dist/index.html', import.meta.url).href);
