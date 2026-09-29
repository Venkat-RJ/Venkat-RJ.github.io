// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://venkat-rj.github.io',
  trailingSlash: 'never',
  build: { format: 'directory' },
});
