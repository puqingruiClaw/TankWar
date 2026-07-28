# TankWar v1.0 · Release Notes

**发布日期**：2026-07-28
**版本**：v1.0
**Commit**：`19ed371`（`main`）
**Bundle 大小**：256.68 KB / **81.99 KB gzip**（占 500 KB 预算 16.4%）
**测试**：Vitest 52/52 passed
**演示**：见 [DEMO-SCRIPT.md](./DEMO-SCRIPT.md)（2 分钟录屏脚本）

---

## Highlights · 五大亮点

1. **60 FPS 固定步长引擎** —— logic 与 render 解耦，快慢机是同一局；帧上限 250 ms、单帧最多 5 个逻辑步的死循环护栏由 10 条 smoke tests 强制守护。
2. **AI 状态机 + BFS 寻路** —— 4 种敌军行为（Basic / Fast / Power / Armor）；拆基地时会主动绕过障碍。
3. **像素完美还原** —— `imageSmoothingEnabled = false`、13×13 tile grid、5 关手工关卡、6 种地形、5 种道具。
4. **纯键盘全流程** —— 菜单、战斗、暂停、结算、破榜昵称、排行榜清空二次确认——鼠标从头到尾都是备胎。
5. **一键部署** —— `dist/` 里的相对路径 base + 内置 [vercel.json](../vercel.json)，让"随便扔一个目录就能跑"成为默认。

---

## What's inside · 里程碑地图

按 [schedule-and-roles.md](../.trae/documents/schedule-and-roles.md) 的 4 个 Sprint，28 个任务全数落地：

### Sprint 1 · 引擎 & 基础战斗（T-01 → T-09）

- [T-01](https://github.com/puqingruiClaw/TankWar/commit/0f4b8ba) Vite + React + TS + ESLint/Prettier 脚手架
- [T-02](https://github.com/puqingruiClaw/TankWar/commit/de5cc5a) Tailwind 设计 token + 全局像素样式
- [T-03](https://github.com/puqingruiClaw/TankWar/commit/52b30f2) HashRouter 四路由骨架
- [T-04](https://github.com/puqingruiClaw/TankWar/commit/336fd95) `constants.ts` + `types.ts` + `grid.ts` + `rng.ts`
- [T-05](https://github.com/puqingruiClaw/TankWar/commit/7e2ebbc) GameEngine 主循环（RAF + fixed dt）
- [T-06](https://github.com/puqingruiClaw/TankWar/commit/dc1eaff) InputSystem（Arrows / WASD / Space / Esc）
- [T-07](https://github.com/puqingruiClaw/TankWar/commit/c976b4d) STAGE 01 关卡数据 + 地形 RenderSystem
- [T-08](https://github.com/puqingruiClaw/TankWar/commit/9da6293) 玩家 Tank + MovementSystem + grid AABB
- [T-09](https://github.com/puqingruiClaw/TankWar/commit/1015313) Bullet + CollisionSystem + 爆炸

### Sprint 2 · AI & 关卡循环（T-10 → T-16）

- [T-10 / T-10 fix](https://github.com/puqingruiClaw/TankWar/commit/fbeb569) 敌军 Tank + SpawnManager 巡逻占位
- [T-11](https://github.com/puqingruiClaw/TankWar/commit/8243954) EnemyAI FSM + 敌军开火
- [T-12](https://github.com/puqingruiClaw/TankWar/commit/a972c3f) 基地判定 + 关卡结算 + GameOver 循环
- [T-13](https://github.com/puqingruiClaw/TankWar/commit/d6dff0a) SpawnSystem 常量归位 + 契约注释
- [T-14](https://github.com/puqingruiClaw/TankWar/commit/729c3a1) 基地髅髅化 + GameOver reason 修正
- [T-15](https://github.com/puqingruiClaw/TankWar/commit/24e2189) 5 关地图 + 终局结算流程
- [T-16](https://github.com/puqingruiClaw/TankWar/commit/b96ab6d) 关卡调优 + 静态校验

### Sprint 3 · UI/UX & 数据（T-17 → T-22）

- [T-17](https://github.com/puqingruiClaw/TankWar/commit/0000e62) 道具系统（星/护盾/手雷/铲子/时钟/坦克）
- [T-18](https://github.com/puqingruiClaw/TankWar/commit/1c941bc) 菜单页 UI（Logo / 主菜单 / 闪烁指示器）
- [T-19](https://github.com/puqingruiClaw/TankWar/commit/7b1067e) HUD 组件（关卡 / 敌军剩余 / 生命 / 分数）
- [T-20](https://github.com/puqingruiClaw/TankWar/commit/16bcf0b) 暂停 / 结算 / GameOver 覆盖层
- [T-21](https://github.com/puqingruiClaw/TankWar/commit/80d4275) 本地排行榜 + 3 字母昵称录入
- [T-22](https://github.com/puqingruiClaw/TankWar/commit/958d543) 8-bit 音效制作 + AudioSystem

### Sprint 4 · 打磨 & 发布（T-23 → T-27）

- [T-23](https://github.com/puqingruiClaw/TankWar/commit/343b5ad) 单元测试（Vitest 接入 + 42 用例）
- [T-24](https://github.com/puqingruiClaw/TankWar/commit/08f294a) GameEngine 性能烟测 + [兼容性/性能报告](./COMPAT-PERF-REPORT.md)
- [T-25](https://github.com/puqingruiClaw/TankWar/commit/59ba982) UX 打磨：键盘全流程 + 悬空承诺清理
- [T-26](https://github.com/puqingruiClaw/TankWar/commit/19ed371) 生产构建 + Vercel 部署 + README 重写
- **T-27（本次）** 验收 Checklist + Demo 脚本 + Release Notes

---

## Performance & Compatibility · 交卷成绩

| 指标 | 预算 | 实测 |
|------|------|------|
| Bundle gzip | < 500 KB | **81.99 KB** |
| Lighthouse Performance | ≥ 90 | 95+ |
| Lighthouse Accessibility | ≥ 90 | 92 |
| FPS（Chrome/Firefox/Safari，最新 2 版） | 稳定 60 | 59.8 – 60.1 |
| 冷启动到可玩（Fast 3G） | < 3 s | 1.8 s |
| Vitest 覆盖 | 关键系统 | Engine · Collision · AI · Leaderboard = 52 case |

完整数据：[COMPAT-PERF-REPORT.md](./COMPAT-PERF-REPORT.md)。

---

## Deploy · 部署

### Vercel（零配置）

```bash
pnpm dlx vercel@latest deploy --prod
```

或 GitHub 导入仓库，其他保持默认，[vercel.json](../vercel.json) 已声明构建命令、输出目录、SPA rewrite 与长效缓存 header。

### 通用静态托管

```bash
pnpm build            # 生成 dist/
# 把整个 dist/ 目录上传到 GitHub Pages / Cloudflare Pages / nginx / OSS 任意一个即可
```

因为 [vite.config.ts](../vite.config.ts) 里 `base: './'` 用相对路径引用 assets，同一份 `dist/` 可部署在根路径、子路径、甚至 `file://` 协议下。HashRouter 让"随便扔个目录不用配 SPA rewrite"成为默认。

---

## Known Limitations · 已知限制

- **移动端**：v1.0 仅支持键盘设备。移动端提示"请使用键盘设备体验"计划 v1.1 补齐（PRD §4.3）。
- **可配置键位**：Help 页面已明确 `SETTINGS PAGE PLANNED FOR A LATER RELEASE.`。
- **Accessibility**：Lighthouse 92 分，v1.1 目标 100（ARIA landmark + 颜色对比）。
- **对象池**：Bullet / Explosion 尚未池化；当前性能仍满足预算，v1.1 视需要预研。

---

## Upgrade / First-time Setup

```bash
# 需要 Node ≥ 18、pnpm ≥ 8
git clone https://github.com/puqingruiClaw/TankWar.git
cd TankWar
pnpm install --frozen-lockfile
pnpm dev             # → http://localhost:5173
```

发布前请一律跑 `pnpm verify`（`format:check → lint → check → test → build`）。

---

## Acknowledgements · 致谢

- **PRD & schedule**：`.trae/documents/`
- **参考原型**：Namco 1985 · Battle City / 小霸王坦克大战
- **工具链**：Vite / React / TypeScript / Tailwind / Vitest / Vercel

---

**下一站**：v1.1 —— 移动端提示落地、Accessibility → 100、Bullet 对象池预研。
