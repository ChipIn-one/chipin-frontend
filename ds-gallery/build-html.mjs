// Inlines the gallery bundle into one self-contained HTML file: ds-gallery/standalone.html
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname;
const out = resolve(here, '../node_modules/.cache/ds-gallery');
const css = readFileSync(resolve(out, 'gallery.css'), 'utf8');
const js = readFileSync(resolve(out, 'gallery.js'), 'utf8').replaceAll('</script', '<\\/script');

writeFileSync(
    resolve(here, 'standalone.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chipin Components</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
);
console.log('ds-gallery/standalone.html written');
