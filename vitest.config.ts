import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/game/systems/CollisionSystem.ts',
        'src/game/systems/AISystem.ts',
        'src/lib/leaderboard.ts',
      ],
    },
    clearMocks: true,
    restoreMocks: true,
  },
})
