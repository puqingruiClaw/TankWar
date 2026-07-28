# TankWar · 坦克大战

> 用 Vite + React + TypeScript + Canvas 2D 复刻的网页版 **Battle City**。
> 5 关手工关卡、AI 敌军、道具、排行榜、纯键盘操控，一份 `dist/` 就能扔到任意静态托管。

**在线体验**：部署到 Vercel 后填写此处。
**版本**：v0.1.0（M4 完成后即为 v1.0）

---

## 1. 亮点一览

- 🎮 **60 FPS 固定步长**：`FIXED_DT = 1/60`，logic 与 render 解耦，快慢机都是同一局。
- 🧠 **AI 状态机 + BFS 寻路**：4 种敌军行为（Basic / Fast / Power / Armor），拆基地时会主动绕墙。
- 🎨 **像素完美**：`imageSmoothingEnabled = false`，13×13 tile grid，还原红白机手感。
- 🎧 **WebAudio 音效**：射击/爆炸/道具 5 段合成音效，M 键任何页面一键静音。
- 🏆 **本地排行榜**：localStorage 保存 Top10，破榜后昵称录入 + 首页高亮闪烁。
- ♿ **纯键盘可玩**：菜单/游戏/结算全流程都不必碰鼠标。
- 📦 **88 KB gzip**：远低于 500 KB 预算，Lighthouse Perf ≥ 95。

## 2. 玩法与键位

| 键        | 动作                             |
| --------- | -------------------------------- |
| `↑ ↓ ← →` | 移动 / 转向                      |
| `Space`   | 射击                             |
| `Esc`     | 暂停 · 结算页返回菜单            |
| `Enter`   | 结算页 RETRY / REPLAY · 昵称提交 |
| `M`       | 静音切换                         |

**目标**：护住基地 🦅、击毁全部敌军后进入下一关；共 5 关，通关或阵亡后可提交昵称上榜。

**道具**：⭐ 升级 · 💥 全屏清怪 · 🛡️ 基地铁墙 · ❤️ 加命 · 🕒 冻结敌军。

## 3. 快速开始

```bash
# 需要 Node ≥ 18、pnpm ≥ 8
pnpm install
pnpm dev             # → http://localhost:5173
```

### 常用脚本

| 命令                                | 说明                                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                          | 本地开发（Vite HMR）                                              |
| `pnpm build`                        | TS 类型检查 + 生产构建到 `dist/`                                  |
| `pnpm preview`                      | 本地起 4173 端口预览 `dist/`                                      |
| `pnpm preview:host`                 | 同上但暴露到局域网，方便手机 / 平板真机验收                       |
| `pnpm test`                         | 一次性跑完 Vitest（52 case）                                      |
| `pnpm test:watch`                   | 交互式 watch                                                      |
| `pnpm test:coverage`                | 生成 v8 覆盖率报告到 `coverage/`                                  |
| `pnpm lint`                         | ESLint 检查                                                       |
| `pnpm check`                        | 仅 TS `tsc --noEmit`                                              |
| `pnpm format` / `pnpm format:check` | Prettier 写入 / 校验                                              |
| `pnpm verify`                       | 一键跑 format:check → lint → check → test → build，**发布前必跑** |

## 4. 部署

### 方案 A：Vercel（零配置一键）

1. 把仓库 push 到 GitHub。
2. 在 Vercel 控制台 **Import Project** → 选中仓库，**其他都保持默认**：`vercel.json` 已经声明好 `pnpm build` / `dist/` / SPA rewrite / 长效缓存。
3. 首次部署完成后，后续每次 push 到 `main` 都会自动触发生产部署，Pull Request 会拿到独立预览域名。

或用 CLI 一次性部署：

```bash
pnpm dlx vercel@latest deploy --prod
```

### 方案 B：任意静态托管（GitHub Pages / Cloudflare Pages / nginx / OSS）

因为 `vite.config.ts` 里配置了 `base: './'`，产物用**相对路径**引用 assets，因此可以直接把 `dist/` 整个目录扔到任何路径下：

```bash
pnpm build
# dist/  ← 把这个目录上传到你的静态托管即可
```

如果宿主环境把根路径改成了 `/tankwar/` 之类的子目录，因为路由使用 `HashRouter`，URL 会是 `https://your.site/tankwar/#/leaderboard`，**无需**为宿主配置 SPA rewrite。

> 如果你打算改用 `BrowserRouter`，那么静态托管需要额外配置 fallback：
>
> - **nginx**：`try_files $uri /index.html;`
> - **GitHub Pages**：复制一份 `index.html` 为 `404.html`
> - **Cloudflare Pages**：Build settings → Framework preset 选 `React` 会自动处理

## 5. 项目结构

```
src/
├── App.tsx                    HashRouter + 全局 GlobalAudio 挂载
├── main.tsx                   React 18 createRoot 入口
├── index.css                  Tailwind 与像素字体
├── pages/                     4 个页面：Menu / Play / Leaderboard / Help
├── components/
│   ├── GameCanvas.tsx         Canvas 挂载 + 尺寸适配
│   ├── GameHUD.tsx            右侧 HUD（分数 / 剩余敌军 / 关卡）
│   └── overlays/              暂停、GameOver、GameComplete、StageClear、NameEntry
├── game/                      不依赖 React 的游戏内核
│   ├── GameEngine.ts          固定步长主循环 + EngineStats 广播（+ smoke tests）
│   ├── constants.ts           tile size / 关卡时长 / AI 权重
│   ├── types.ts               ECS 无关的实体形状定义
│   ├── entities/              Tank · Bullet · PowerUp（纯数据 + 少量方法）
│   ├── maps/                  stage-01 ~ stage-05 关卡布局与敌军编队
│   ├── systems/               Input · Movement · Collision · AI · PowerUp · Spawn · Render · Audio
│   └── utils/                 grid（BFS）、rng（可 seed 的随机）
├── hooks/                     useGameLoop / useKeyboard / useAudio / useTheme
├── lib/leaderboard.ts         Top10 增删读，localStorage 持久化
└── layouts/StageLayout.tsx    Canvas + HUD 的组合布局
```

## 6. 技术要点

- **固定步长 & 死循环保护**：帧间隔上限 250ms，单帧最多跑 5 个逻辑步，避免切后台归来一次性追 100 帧。
- **纯 Canvas 2D**：不引 Phaser，掌控每一个像素 + 保证 88 KB gzip。
- **HashRouter**：绕过静态托管 SPA rewrite 需求，让"随便扔一个目录就能跑"成为可能。
- **相对路径 base**：`base: './'` 让同一份 `dist/` 可以部署在根路径、子路径、file:// 协议下。
- **测试**：52 个 Vitest 单测覆盖引擎、AI、碰撞、排行榜；GameEngine 用受控 RAF + `performance.now` mock 保证确定性。
- **性能**：详见 [COMPAT-PERF-REPORT.md](./docs/COMPAT-PERF-REPORT.md)。

## 7. 性能预算与实际

| 指标                                | 预算     | 当前实测    |
| ----------------------------------- | -------- | ----------- |
| Bundle gzip                         | < 500 KB | **88 KB**   |
| Lighthouse Performance              | ≥ 90     | 95+         |
| Lighthouse Accessibility            | ≥ 90     | 92          |
| 游戏内 FPS（Chrome/Firefox/Safari） | 60 稳定  | 59.8 – 60.1 |
| 冷启动到可玩（Fast 3G）             | < 3 s    | 1.8 s       |

## 8. 路线图

- v1.0：M1–M4 完整体验（5 关 + 排行榜 + 键盘全流程）
- v1.1（候选）：Bullet/Explosion 对象池、mobile viewport 缩放、Accessibility 92 → 100
- v1.2（候选）：可配置键位（当前 Help 页说明 "SETTINGS PAGE PLANNED FOR A LATER RELEASE."）

## 9. 验收与录屏

v1.0 交付时随附三份 T-27 文档，供 PM 与验收方核对：

- [ACCEPTANCE.md](./docs/ACCEPTANCE.md) —— 功能 / 性能 / 兼容 / 交付四大块共 40+ 条可勾选检查项，每项标注满足依据（源文件、命令或报告）
- [DEMO-SCRIPT.md](./docs/DEMO-SCRIPT.md) —— 2 分钟演示视频的分镜头脚本、旁白与录制注意事项
- [RELEASE-NOTES-v1.0.md](./docs/RELEASE-NOTES-v1.0.md) —— 五大亮点、里程碑地图、成绩单、部署一键跑与已知限制
- [COMPAT-PERF-REPORT.md](./docs/COMPAT-PERF-REPORT.md) —— 三大浏览器手动矩阵 + Lighthouse 预算对齐

一键复现验收：

```bash
pnpm install --frozen-lockfile
pnpm verify          # format:check → lint → check → test → build 一次跑齐
pnpm preview         # http://localhost:4173/ 跟着 DEMO-SCRIPT 手动走一遍
```

## 10. 许可

MIT（或按项目实际决定，本仓库当前不含 LICENSE 文件，发布前请补齐）。
