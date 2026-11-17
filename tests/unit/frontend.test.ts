import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath: string): string =>
  readFileSync(join(PROJECT_ROOT, relativePath), 'utf8');

describe('frontend — entrypoint del esqueleto Vite + React (F00-T02)', () => {
  it('existe el HTML de entrada con el nodo root y el módulo main.tsx', () => {
    expect(existsSync(join(PROJECT_ROOT, 'frontend/index.html'))).toBe(true);

    const html = read('frontend/index.html');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('/src/main.tsx');
  });

  it('el entrypoint monta React con createRoot', () => {
    const main = read('frontend/src/main.tsx');

    expect(main).toContain('createRoot');
    expect(main).toContain('react-dom/client');
  });

  it('App.tsx existe y exporta el componente raíz del esqueleto', () => {
    const app = read('frontend/src/App.tsx');

    expect(app).toContain('export default function App');
    expect(app).toContain('MediaShrink Cloud');
  });
});
