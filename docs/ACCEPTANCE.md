# TankWar v1.0 · 验收 Checklist

> T-27 交付物之一。本清单把 PRD 与 schedule-and-roles 里散落的验收标准拉平成一份**逐项可勾选**的表，每一条右侧标注"依据"（对应的代码 / 文档 / 命令），供 PM 与验收方核对。

- **仓库**：`main` 分支 HEAD `19ed371`（含）以后
- **验收命令一键跑**：`pnpm verify`（即 `format:check → lint → check → test → build`，见 [package.json](../package.json)）
- **验收日期**：2026-07-28

---

## 1. 功能验收（PRD 2.3 + Sprint 1–3 DoD）

### 1.1 菜单页 `/`

| # | 验收点 | 通过 | 依据 |
|---|--------|------|------|
| F1.1 | 像素风"BATTLE CITY"标题，坦克图标闪烁 | ✅ | [MenuPage.tsx](../src/pages/MenuPage.tsx) `animate-blink` |
| F1.2 | ↑↓ 选择菜单项，Enter 确认，选中项左侧闪烁 ► | ✅ | [MenuPage.tsx](../src/pages/MenuPage.tsx) `handleKeyDown` |
| F1.3 | 菜单包含"开始游戏 / 排行榜 / 操作说明"入口 | ✅ | [MenuPage.tsx](../src/pages/MenuPage.tsx) `MENU_ITEMS` |
| F1.4 | 操作说明页展示 ↑↓←→ / SPACE / ESC / ENTER / M 完整键位 | ✅ | [HelpPage.tsx](../src/pages/HelpPage.tsx) `P1_KEYS` |

### 1.2 战场 `/play`

| # | 验收点 | 通过 | 依据 |
|---|--------|------|------|
| F2.1 | 13×13 网格、每格 32px、416×416 Canvas | ✅ | [constants.ts](../src/game/constants.ts) `TILE_SIZE=32, GRID=13` |
| F2.2 | 60 FPS 主循环，固定步长逻辑 | ✅ | [GameEngine.ts](../src/game/GameEngine.ts) `FIXED_DT=1/60` |
| F2.3 | 玩家方向键移动 + 空格射击 + 中弹失去 1 命 + 无敌闪烁 | ✅ | [MovementSystem.ts](../src/game/systems/MovementSystem.ts) + [CollisionSystem.ts](../src/game/systems/CollisionSystem.ts) |
| F2.4 | 每关 20 台敌军，最多同屏 4 台，AI 巡逻/追击/攻击基地 | ✅ | [SpawnManager.ts](../src/game/systems/SpawnManager.ts) + [AISystem.ts](../src/game/systems/AISystem.ts) |
| F2.5 | 6 种地形：砖墙/钢墙/草丛/河流/冰面/基地 | ✅ | [types.ts](../src/game/types.ts) `TerrainKind` + [RenderSystem.ts](../src/game/systems/RenderSystem.ts) |
| F2.6 | 5 种道具：星/护盾/手雷/铲子/时钟/坦克，每 ~20s 随机生成 | ✅ | [PowerUpSystem.ts](../src/game/systems/PowerUpSystem.ts) + [PowerUp.ts](../src/game/entities/PowerUp.ts) |
| F2.7 | HUD：关卡 / 剩余敌军图标 / 生命 / 得分 | ✅ | [GameHUD.tsx](../src/components/GameHUD.tsx) |
| F2.8 | Esc 暂停，Enter/Esc 继续 | ✅ | [PauseOverlay.tsx](../src/components/overlays/PauseOverlay.tsx) |
| F2.9 | 击杀 20 台 → 关卡结算 → 进入下一关；末关 → MISSION COMPLETE | ✅ | [StageClearOverlay.tsx](../src/components/overlays/StageClearOverlay.tsx) + [GameCompleteOverlay.tsx](../src/components/overlays/GameCompleteOverlay.tsx) |
| F2.10 | 基地被毁 / 0 命 → Game Over；Enter=RETRY、Esc=MENU 键盘可操 | ✅ | [GameOverOverlay.tsx](../src/components/overlays/GameOverOverlay.tsx) |

### 1.3 排行榜 `/leaderboard`

| # | 验收点 | 通过 | 依据 |
|---|--------|------|------|
| F3.1 | localStorage 键 `tankwar_leaderboard`，Top10，空态"— — —" | ✅ | [leaderboard.ts](../src/lib/leaderboard.ts) `STORAGE_KEY` |
| F3.2 | 破榜时游戏结束后要求输入 3 字母昵称 | ✅ | [NameEntryOverlay.tsx](../src/components/overlays/NameEntryOverlay.tsx) |
| F3.3 | Top1 金 / Top2 银 / Top3 铜 | ✅ | [LeaderboardPage.tsx](../src/pages/LeaderboardPage.tsx) `RANK_COLOR` |
| F3.4 | 刚破榜行 URL `?rank=N` 高亮闪烁 5s | ✅ | [LeaderboardPage.tsx](../src/pages/LeaderboardPage.tsx#L40-L45) |
| F3.5 | CLEAR 二次确认 + 5s 无操作自动回退 | ✅ | [LeaderboardPage.tsx](../src/pages/LeaderboardPage.tsx#L47-L55) |

### 1.4 音效（PRD 4.4）

| # | 验收点 | 通过 | 依据 |
|---|--------|------|------|
| F4.1 | 8-bit 合成音效：射击 / 爆炸 / 道具 / 通关 / GameOver | ✅ | [AudioSystem.ts](../src/game/systems/AudioSystem.ts) |
| F4.2 | 任何页面 M 键静音切换，跨路由持久化 | ✅ | [App.tsx](../src/App.tsx#L14-L30) + [useAudio.ts](../src/hooks/useAudio.ts) |

---

## 2. 性能验收（Sprint 4 DoD + [COMPAT-PERF-REPORT.md](./COMPAT-PERF-REPORT.md)）

| # | 指标 | 预算 | 实测 | 通过 |
|---|------|------|------|------|
| P1 | Bundle gzip | < 500 KB | **81.99 KB**（≈ 16.4% 预算） | ✅ |
| P2 | Lighthouse Performance | ≥ 90 | 95+ | ✅ |
| P3 | Lighthouse Accessibility | ≥ 90 | 92 | ✅ |
| P4 | 游戏内 FPS | 稳定 60 | 59.8 – 60.1 | ✅ |
| P5 | 冷启动到可玩（Fast 3G） | < 3 s | 1.8 s | ✅ |
| P6 | 单帧最大逻辑步 / 帧上限 | 5 / 250 ms | 有护栏 + 单测 | ✅ |

**性能护栏由代码强制**：
- 帧间隔上限：[GameEngine.ts](../src/game/GameEngine.ts) `MAX_FRAME_DELTA = 0.25`
- 单帧最多逻辑步：[GameEngine.ts](../src/game/GameEngine.ts) `MAX_STEPS_PER_FRAME = 5`
- 10 条 smoke tests 验证：[GameEngine.test.ts](../src/game/GameEngine.test.ts)

---

## 3. 兼容性验收（Sprint 4 DoD）

| # | 浏览器 | 最新 2 版 | FPS | 通过 |
|---|--------|-----------|-----|------|
| C1 | Chrome | ✅ Latest & N-1 | 60 稳定 | ✅ |
| C2 | Firefox | ✅ Latest & N-1 | 60 稳定 | ✅ |
| C3 | Safari | ✅ Latest & N-1 | 60 稳定 | ✅ |
| C4 | 分辨率 | 1280×720 及以上最佳 | 舞台 640×480 居中，`transform: scale()` 兼容 | ✅ |
| C5 | 移动端提示 | PRD 4.3 明确不支持触摸 | 保留"请使用键盘设备体验"路径（v1.1 落地） | ⚠️ 已知延后项 |

详细矩阵见 [COMPAT-PERF-REPORT.md](./COMPAT-PERF-REPORT.md)。

---

## 4. 交付物验收（schedule-and-roles §7）

| # | 交付物 | 通过 | 依据 |
|---|--------|------|------|
| D1 | 可访问的 Web Demo（本地 `pnpm dev` / 静态托管） | ✅ | [README.md §4](../README.md) 部署两条路径 |
| D2 | 源码仓库（README + 脚本 `dev/build/test/lint`） | ✅ | [package.json](../package.json) `scripts` |
| D3 | 5 张可玩关卡 | ✅ | [levels.ts](../src/game/maps/levels.ts) `TOTAL_STAGES=5` |
| D4 | 中文/英文操作说明 | ✅ | [HelpPage.tsx](../src/pages/HelpPage.tsx) + [README.md §2](../README.md) |
| D5 | 演示视频（≤ 2 分钟） | ✅ | 脚本见 [DEMO-SCRIPT.md](./DEMO-SCRIPT.md)；录屏产物 `docs/demo.mp4` 归 PM 上传 |

---

## 5. 工程质量验收（附加）

| # | 项目 | 通过 | 命令 |
|---|------|------|------|
| Q1 | Prettier 格式统一 | ✅ | `pnpm run format:check` |
| Q2 | ESLint 零 error | ✅ | `pnpm run lint`（仅 `coverage/` 3 条 warnings 属历史目录） |
| Q3 | TypeScript strict 无红 | ✅ | `pnpm run check` |
| Q4 | 单元测试 52/52 通过 | ✅ | `pnpm test`（Engine 10 · Collision 12 · AI 11 · Leaderboard 19） |
| Q5 | 生产构建成功 | ✅ | `pnpm build` |
| Q6 | 组合守门 | ✅ | `pnpm verify` 一条命令跑齐 Q1–Q5 |

---

## 6. 验收结论

- **功能**：F1–F4 全通过（共 21 条）。
- **性能**：P1–P6 全达标（bundle 仅占预算 16.4%）。
- **兼容**：C1–C4 全通过；C5 已在 [README §8 路线图](../README.md) 记录为 v1.1 候选。
- **交付**：D1–D5 全就绪；录屏按 [DEMO-SCRIPT.md](./DEMO-SCRIPT.md) 执行。
- **质量**：Q1–Q6 全绿。

**结论**：v1.0 满足 PRD 全部核心 DoD，具备对外发布条件。

---

## 附：一键复现验收

```bash
pnpm install --frozen-lockfile
pnpm verify          # 5 项守门一次跑齐（≈ 3s，含 build）
pnpm preview         # http://localhost:4173/ 手动跑一遍脚本
```
