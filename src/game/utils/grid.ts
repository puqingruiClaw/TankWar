/**
 * 网格 / AABB 相关的纯函数工具。
 *
 * 全部函数无副作用、只依赖参数，方便未来接入单元测试（T-24 阶段用 vitest）。
 */

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAP_COLS,
  MAP_ROWS,
  TILE_CODE,
  TILE_CODE_TO_TYPE,
  TILE_SIZE,
} from '../constants'
import type { GridPoint, LevelMap, Rect, TileCode, TileType, Vec2 } from '../types'

// ─── 数学 ────────────────────────────────────────────────────────────────────

/** 把 v 夹在 [min, max] 之间。*/
export function clamp(v: number, min: number, max: number): number {
  if (v < min) return min
  if (v > max) return max
  return v
}

/** 取整到 tile 边界（默认向下取整），用于坦克贴齐网格。*/
export function alignToTile(px: number, mode: 'floor' | 'round' | 'ceil' = 'floor'): number {
  const n = px / TILE_SIZE
  const r = mode === 'round' ? Math.round(n) : mode === 'ceil' ? Math.ceil(n) : Math.floor(n)
  return r * TILE_SIZE
}

// ─── 坐标转换 ────────────────────────────────────────────────────────────────

/** 像素坐标 → 网格坐标（向下取整）。*/
export function worldToGrid(x: number, y: number): GridPoint {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) }
}

/** 网格坐标 → 该格左上角像素坐标。*/
export function gridToWorld(col: number, row: number): Vec2 {
  return { x: col * TILE_SIZE, y: row * TILE_SIZE }
}

/** 网格坐标 → 该格中心点像素坐标。*/
export function gridCenter(col: number, row: number): Vec2 {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 }
}

// ─── 边界 / 查询 ─────────────────────────────────────────────────────────────

/** 网格坐标是否在合法范围内。*/
export function inGridBounds(col: number, row: number): boolean {
  return col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS
}

/** 矩形是否完全落在画布内。*/
export function inCanvasBounds(rect: Rect): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= CANVAS_WIDTH &&
    rect.y + rect.h <= CANVAS_HEIGHT
  )
}

/** 读取关卡指定格的 TileCode；越界返回 EMPTY。*/
export function tileCodeAt(map: LevelMap, col: number, row: number): TileCode {
  if (!inGridBounds(col, row)) return TILE_CODE.EMPTY
  return map[row][col]
}

/** 读取关卡指定格的语义 TileType；越界返回 'empty'。*/
export function tileTypeAt(map: LevelMap, col: number, row: number): TileType {
  return TILE_CODE_TO_TYPE[tileCodeAt(map, col, row)]
}

// ─── 碰撞 ────────────────────────────────────────────────────────────────────

/** AABB 相交（不含边界重合，即严格相交）。*/
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** 判断 rect 中心是否落在 grid (col, row) 内部。*/
export function rectCenterInCell(rect: Rect, col: number, row: number): boolean {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return (
    cx >= col * TILE_SIZE &&
    cx < (col + 1) * TILE_SIZE &&
    cy >= row * TILE_SIZE &&
    cy < (row + 1) * TILE_SIZE
  )
}

/**
 * 遍历 rect 覆盖到的所有网格 (col, row) 并调用回调。
 * 用于坦克 / 子弹与地形的碰撞查询。
 * 若回调返回 `true` 则提前终止。
 */
export function forEachOverlappedCell(
  rect: Rect,
  cb: (col: number, row: number) => boolean | void,
): void {
  const c0 = Math.floor(rect.x / TILE_SIZE)
  const r0 = Math.floor(rect.y / TILE_SIZE)
  const c1 = Math.floor((rect.x + rect.w - 1) / TILE_SIZE)
  const r1 = Math.floor((rect.y + rect.h - 1) / TILE_SIZE)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!inGridBounds(c, r)) continue
      if (cb(c, r) === true) return
    }
  }
}

/**
 * 判断 rect 是否与关卡内任意"阻挡型"地形重叠。
 * blockingSet 由调用方给出，例如：new Set(['brick', 'steel', 'water', 'base'])。
 */
export function collidesWithTerrain(
  map: LevelMap,
  rect: Rect,
  blockingSet: ReadonlySet<TileType>,
): boolean {
  let hit = false
  forEachOverlappedCell(rect, (c, r) => {
    if (blockingSet.has(tileTypeAt(map, c, r))) {
      hit = true
      return true
    }
  })
  return hit
}

// ─── 便捷构造 ────────────────────────────────────────────────────────────────

/** 快速构造 Rect。*/
export function makeRect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h }
}

/** 复制 Rect（避免外部修改影响原对象）。*/
export function cloneRect(r: Rect): Rect {
  return { x: r.x, y: r.y, w: r.w, h: r.h }
}
