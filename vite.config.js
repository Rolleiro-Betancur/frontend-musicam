import { defineConfig, loadEnv } from 'vite';
import { construirCsp } from './csp.config.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    server: { port: 5173, strictPort: true },
    plugins: [
      {
        // CSP solo en el build: el servidor de desarrollo necesita su canal HMR.
        name: 'csp-meta',
        apply: 'build',
        transformIndexHtml: (html) =>
          html.replace(
            '</title>',
            `</title>\n    <meta http-equiv="Content-Security-Policy" content="${construirCsp(env.VITE_API_URL)}" />`,
          ),
      },
    ],
  };
});
