import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// GitHub Pages 하위 경로에서도 동작하도록 상대 경로(base './')로 빌드한다.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2500,
  },
}));
