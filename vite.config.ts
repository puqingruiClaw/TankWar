import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * Vite 构建配置。
 *
 * 关键决策（T-26 生产构建加固）：
 * 1. `base: './'` —— 产物用相对路径引用 assets。这一改动让 dist/ 目录可以直接
 *    部署到任意静态托管的任意路径（Vercel 根、GitHub Pages 子路径、内网 nginx
 *    子目录），无需为每个环境重新构建。代价：不能用 `<base href>` 干预，但本
 *    项目也不需要。
 * 2. `react-dev-locator` babel 插件只对本地开发的"点组件跳源码"有用，生产构建
 *    走 `command === 'build'` 分支时省掉，减少 Babel 变换开销。
 * 3. `build.target: 'es2020'` —— 与 PRD 里"最新两版主流浏览器"要求对齐；避免
 *    默认 es2015 引入不必要的 polyfill。
 * 4. `chunkSizeWarningLimit: 500` —— 技术要求把 gzip 预算定在 500KB，警告阈值
 *    与预算齐平，一旦冲预算 CI 会立刻告警。
 * 5. `sourcemap: 'hidden'` —— 生成 .map 但不在 JS 尾注入 `sourceMappingURL`。
 *    这样线上不暴露源码，同时保留给错误监控系统上传使用。
 */
export default defineConfig(({ command }) => ({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 500,
  },
  plugins: [
    react({
      babel: {
        plugins: command === 'serve' ? ['react-dev-locator'] : [],
      },
    }),
    tsconfigPaths(),
  ],
}))
