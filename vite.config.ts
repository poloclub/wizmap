import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import * as fs from 'fs';
import * as path from 'path';

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [svelte()]
// });

const removeDataDir = () => {
  return {
    name: 'remove-data-dir',
    resolveId(source) {
      return source === 'virtual-module' ? source : null;
    },
    writeBundle(outputOptions, inputOptions) {
      const outDir = outputOptions.dir;
      const dataDir = path.resolve(outDir, 'data');
      fs.rm(dataDir, { recursive: true }, () =>
        console.log(`Deleted ${dataDir}`)
      );
    }
  };
};

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
          plugins: [svelte(), removeDataDir()]
        };
      }

      case 'notebook': {
        // Production: notebook widget
        return {
          build: {
            outDir: 'notebook-widget/_wizmap',
            sourcemap: false,
            lib: {
              entry: 'src/main.ts',
              formats: ['iife'],
              name: 'wizmap',
              fileName: format => 'wizmap.js'
            }
          },
          plugins: [
            svelte({
              emitCss: false
            }),
            {
              name: 'my-post-build-plugin',
              writeBundle: {
                sequential: true,
                order: 'post',
                handler(options) {
                  // Move target file to the notebook package
                  fs.copyFile(
                    path.resolve(options.dir, 'wizmap.js'),
                    path.resolve(__dirname, 'notebook-widget/wizmap/wizmap.js'),
                    error => {
                      if (error) throw error;
                    }
                  );

                  // Delete all other generated files
                  fs.rm(options.dir, { recursive: true }, error => {
                    if (error) throw error;
                  });
                }
              }
            }
          ]
        };
      }

      default: {
        console.error(`Unknown production mode ${mode}`);
        return null;
      }
    }
  }
});
