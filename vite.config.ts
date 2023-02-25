import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [svelte()]
// });

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    // Development
    return {
      plugins: [svelte()]
    };
  } else if (command === 'build') {
    switch (mode) {
      case 'production': {
        // Production: standard web page (default mode)
        return {
          build: {
            outDir: 'dist'
          },
          plugins: [svelte()]
        };
      }

      case 'vercel': {
        // Production: for vercel demo
        return {
          build: {
            outDir: 'dist'
          },
          plugins: [svelte()]
        };
      }

      case 'github': {
        // Production: github page
        return {
          base: '/wizmap/',
          build: {
            outDir: 'gh-page'
          },
          plugins: [svelte()]
        };
      }

      default: {
        console.error(`Unknown production mode ${mode}`);
        return null;
      }
    }
  }
});
