import { defineConfig } from 'vite';

// Relative base so the built bundle works from any subpath (GitHub Pages
// serves project sites at /<repo>/) as well as from a local preview.
export default defineConfig({
  base: './',
});
