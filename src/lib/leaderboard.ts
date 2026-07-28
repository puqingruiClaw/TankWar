import { LEADERBOARD_MAX_ENTRIES, LEADERBOARD_STORAGE_KEY } from '@/game/constants'

/**
 * leaderboard —— T-21 引入的本地排行榜工具库。
 *
 * 设计目标：
 * - **纯函数 API**：除 [load](#L64-L82) / [save](#L84-L96) / [clear](#L138-L145) 三个显式与
 *   localStorage 交互的函数外，其余（[qualifies](#L98-L110)、[insert](#L112-L136)、
 *   [sanitizeName](#L45-L57)）均无副作用，方便 T-23 单元测试直接断言。
 * - **防御式反序列化**：外部数据可能被用户手动改脏，[parseEntries](#L21-L43) 会
 *   逐项校验并丢弃非法记录，绝不 throw。
 * - **稳定排序**：分数相同时后进者不能反超先进者——[insert](#L112-L136) 使用
 *   `stable` 排序（Array.prototype.sort 在现代浏览器里已经是稳定的，但我们仍
 *   通过 `createdAt` 兜底，确保平局按登记先后展示）。
 */

export interface LeaderboardEntry {
  name: string
  score: number
  stage: number
  createdAt: number
}

/**
 * parseEntries —— 把任意 JSON 字符串还原为一份合法的 LeaderboardEntry 数组。
 *
 * 不合法字段一律回填默认值；整体结构不对（不是数组、JSON 语法错误）直接返回 []。
 */
function parseEntries(raw: string | null): LeaderboardEntry[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .map((item): LeaderboardEntry | null => {
        if (!item || typeof item !== 'object') return null
        const rec = item as Record<string, unknown>
        const name = typeof rec.name === 'string' ? sanitizeName(rec.name) : 'AAA'
        const score = typeof rec.score === 'number' && Number.isFinite(rec.score) ? rec.score : 0
        const stage = typeof rec.stage === 'number' && Number.isFinite(rec.stage) ? rec.stage : 0
        const createdAt =
          typeof rec.createdAt === 'number' && Number.isFinite(rec.createdAt) ? rec.createdAt : 0
        return { name, score, stage, createdAt }
      })
      .filter((x): x is LeaderboardEntry => x !== null)
  } catch {
    return []
  }
}

/**
 * sanitizeName —— 强制昵称为 3 位大写字母（不足右补 A，多出截断）。
 *
 * PRD §2.3 要求"3 字母昵称"，NameEntryOverlay 的键盘输入保证只能是 A-Z，
 * 但从 localStorage 反序列化时可能拿到脏数据，因此统一在这里兜底。
 */
export function sanitizeName(raw: string): string {
  const upper = raw
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
  return (upper + 'AAA').slice(0, 3)
}

/**
 * load —— 从 localStorage 读取一份排序过的 Top N 榜单。
 *
 * 排序规则：score DESC → stage DESC → createdAt ASC（同分先到先得）。
 * 无 window 时（Node/SSR）返回 []，避免抛错。
 */
export function load(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY)
  const list = parseEntries(raw)
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.stage !== a.stage) return b.stage - a.stage
    return a.createdAt - b.createdAt
  })
  return list.slice(0, LEADERBOARD_MAX_ENTRIES)
}

/**
 * save —— 覆写 localStorage，容错处理配额溢出等异常。
 *
 * 内部会 slice 到 [LEADERBOARD_MAX_ENTRIES](file:///Users/puqingrui/workspace/Projects/TankWar/src/game/constants.ts#L233-L233)，
 * 避免恶意/错误代码把整个 localStorage 塞爆。
 */
export function save(entries: LeaderboardEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = entries.slice(0, LEADERBOARD_MAX_ENTRIES)
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // 忽略 QuotaExceededError / 隐私模式禁写 —— 排行榜是非关键功能，允许静默失败。
  }
}

/**
 * qualifies —— 判断该分数能否进入 Top N。
 *
 * 榜未满 → true；已满时必须**严格大于**末位分数才算破榜。
 * "并列末位不算破榜"是 8-bit 街机的常见口径（保护老玩家名次）。
 */
export function qualifies(score: number, list: LeaderboardEntry[] = load()): boolean {
  if (score <= 0) return false
  if (list.length < LEADERBOARD_MAX_ENTRIES) return true
  const last = list[list.length - 1]
  return score > last.score
}

/**
 * insert —— 插入一条新战绩，返回 { rank, list }。
 *
 * - rank：新条目落定后的 1-based 排名；若被挤出榜（超 Top N）返回 -1。
 * - list：已经排序 & 截断到 Top N 的新榜单。调用方拿去 save() 或直接展示均可。
 *
 * 注意 rank 计算走的是"新榜单中的位置"，而非"插入前的位置"，这样跳
 * /leaderboard?rank=N 高亮时能精确对上表格行。
 */
export function insert(
  entry: LeaderboardEntry,
  base: LeaderboardEntry[] = load(),
): { rank: number; list: LeaderboardEntry[] } {
  const merged = [...base, entry].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.stage !== a.stage) return b.stage - a.stage
    return a.createdAt - b.createdAt
  })
  const list = merged.slice(0, LEADERBOARD_MAX_ENTRIES)
  const rank = list.indexOf(entry) === -1 ? -1 : list.indexOf(entry) + 1
  return { rank, list }
}

/**
 * clear —— 一键清空本地榜（用于设置页 & 调试）。
 */
export function clear(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LEADERBOARD_STORAGE_KEY)
  } catch {
    // 同 save：非关键路径，静默失败。
  }
}
