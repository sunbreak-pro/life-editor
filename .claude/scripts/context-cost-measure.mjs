#!/usr/bin/env node
// context-cost-measure — セッション固定費（常時ロード分）の内訳を測る。
//
// 使い方:
//   node .claude/scripts/context-cost-measure.mjs           # 表形式
//   node .claude/scripts/context-cost-measure.mjs --json     # 機械可読
//   node .claude/scripts/context-cost-measure.mjs --sections # 上位項目を節ごとに分解（二段目）
//
// 何を測るか: ディスク上にあり、我々が動かせるファイルだけ。
// ハーネス側（Claude Code 本体のシステムプロンプト / ツール定義 / 組み込みスキルの説明文 /
// MCP サーバー由来の instructions）は disk に無いので本スクリプトの対象外。
// 内訳は計測結果ファイル（.claude/docs/reports/ 配下）側に手記録する。
//
// 分類:
//   always  = 毎セッション無条件でロードされる
//   scoped  = rules frontmatter の paths: に一致するファイルを触った時だけロードされる
//   listing = 一覧としてカタログ行（name + description）だけが常時ロードされる
//   ondemand= 明示起動・参照時にだけ読まれる（本体サイズ）

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const GLOBAL_DIR = path.join(os.homedir(), '.claude')

// トークン概算。ASCII と非 ASCII（主に日本語）で係数を変える。
// 係数は概算で、誤差は ±30% 程度を見込む。用途は「順位付け」と「再測定時の差分」であって
// 絶対値の精度ではない。再測定時に係数を変えると比較できなくなるので、変えるなら計測結果側に明記する。
const ASCII_CHARS_PER_TOKEN = 3.6
const WIDE_TOKENS_PER_CHAR = 0.9

function estTokens(text) {
  let ascii = 0
  let wide = 0
  for (const ch of text) {
    if (ch.codePointAt(0) < 128) ascii++
    else wide++
  }
  return Math.round(ascii / ASCII_CHARS_PER_TOKEN + wide * WIDE_TOKENS_PER_CHAR)
}

function readIfFile(p) {
  try {
    const st = fs.statSync(p)
    if (!st.isFile()) return null
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

// frontmatter を雑に取り出す（--- で挟まれた先頭ブロック）
function frontmatter(text) {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  return text.slice(3, end)
}

function hasPathsScope(text) {
  const fm = frontmatter(text)
  return fm !== null && /^\s*paths:/m.test(fm)
}

// SKILL.md / agent .md の name + description 行だけの長さ（= 一覧に載る分）
function listingCost(text) {
  const fm = frontmatter(text)
  if (fm === null) return null
  const lines = []
  let capturing = false
  for (const line of fm.split('\n')) {
    if (/^(name|description):/.test(line)) {
      capturing = /^description:/.test(line)
      lines.push(line)
    } else if (capturing && /^\s+\S/.test(line)) {
      lines.push(line) // 複数行 description の継続
    } else if (/^\S/.test(line)) {
      capturing = false
    }
  }
  return lines.join('\n')
}

const rows = []
function add(category, group, label, text, note = '') {
  if (text === null) return
  rows.push({
    category,
    group,
    label,
    bytes: Buffer.byteLength(text, 'utf8'),
    chars: [...text].length,
    tokens: estTokens(text),
    note,
  })
}

// ---- 1. CLAUDE.md（プロジェクト / グローバル）----
add('always', 'CLAUDE.md', 'project .claude/CLAUDE.md', readIfFile(path.join(PROJECT_DIR, '.claude/CLAUDE.md')))
add('always', 'CLAUDE.md', 'global ~/.claude/CLAUDE.md', readIfFile(path.join(GLOBAL_DIR, 'CLAUDE.md')))

// ---- 2. output style（settings.json の outputStyle が指すもの）----
try {
  const settings = JSON.parse(readIfFile(path.join(GLOBAL_DIR, 'settings.json')) || '{}')
  if (settings.outputStyle) {
    const p = path.join(GLOBAL_DIR, 'output-styles', `${settings.outputStyle}.md`)
    add('always', 'output-style', `output-style: ${settings.outputStyle}`, readIfFile(p))
  }
} catch {
  /* settings が読めなければ黙って飛ばす */
}

// ---- 3. rules（paths: の有無で always / scoped を機械判定する）----
for (const [scope, dir] of [
  ['project', path.join(PROJECT_DIR, '.claude/rules')],
  ['global', path.join(GLOBAL_DIR, 'rules')],
]) {
  let names = []
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()
  } catch {
    continue
  }
  for (const name of names) {
    const text = readIfFile(path.join(dir, name))
    if (text === null) continue
    const scoped = hasPathsScope(text)
    add(scoped ? 'scoped' : 'always', `rules (${scope})`, `${scope}/rules/${name}`, text)
  }
}

// ---- 4. skills（一覧に載る description と、本体サイズを分けて出す）----
for (const [scope, dir] of [
  ['project', path.join(PROJECT_DIR, '.claude/skills')],
  ['global', path.join(GLOBAL_DIR, 'skills')],
]) {
  let names = []
  try {
    names = fs.readdirSync(dir).sort()
  } catch {
    continue
  }
  for (const name of names) {
    const entry = path.join(dir, name)
    let isDir = false
    try {
      isDir = fs.statSync(entry).isDirectory()
    } catch {
      continue
    }
    if (!isDir) {
      // Mac 時代の死んだ symlink（中身はパスを 1 行書いたテキスト）。ロードされないので 0 として記録する
      rows.push({
        category: 'dead',
        group: `skills (${scope})`,
        label: `${scope}/skills/${name}`,
        bytes: 0,
        chars: 0,
        tokens: 0,
        note: 'dead pointer — 解決不能なのでロードされない',
      })
      continue
    }
    const text = readIfFile(path.join(entry, 'SKILL.md'))
    if (text === null) continue
    add('listing', `skills (${scope})`, `${scope}/skills/${name}`, listingCost(text))
    add('ondemand', `skills body (${scope})`, `${scope}/skills/${name}/SKILL.md`, text)
  }
}

// ---- 5. agents（同じく description だけが一覧に載る）----
{
  const dir = path.join(GLOBAL_DIR, 'agents')
  let names = []
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()
  } catch {
    names = []
  }
  for (const name of names) {
    const text = readIfFile(path.join(dir, name))
    if (text === null) continue
    add('listing', 'agents (global)', `global/agents/${name}`, listingCost(text))
    add('ondemand', 'agents body (global)', `global/agents/${name}`, text)
  }
}

// ---- 出力 ----
const args = process.argv.slice(2)

if (args.includes('--json')) {
  console.log(JSON.stringify({ project: PROJECT_DIR, rows }, null, 2))
  process.exit(0)
}

if (args.includes('--sections')) {
  // 二段目: 上位 2 ファイルを見出しごとに分解する（どの節が重いかを見る）
  const targets = [
    path.join(PROJECT_DIR, '.claude/CLAUDE.md'),
    path.join(GLOBAL_DIR, 'CLAUDE.md'),
    path.join(GLOBAL_DIR, 'rules/tone.md'),
    path.join(GLOBAL_DIR, 'output-styles/tone-persona.md'),
  ]
  for (const t of targets) {
    const text = readIfFile(t)
    if (text === null) continue
    console.log(`\n## ${path.relative(os.homedir(), t).replace(/\\/g, '/')}`)
    const lines = text.split('\n')
    let head = '(preamble)'
    let buf = []
    const flush = () => {
      if (buf.length === 0) return
      const s = buf.join('\n')
      console.log(`${String(estTokens(s)).padStart(6)} tok  ${head}`)
      buf = []
    }
    for (const line of lines) {
      if (/^#{1,2} /.test(line)) {
        flush()
        head = line.replace(/^#+\s*/, '')
      }
      buf.push(line)
    }
    flush()
  }
  process.exit(0)
}

const order = ['always', 'listing', 'scoped', 'ondemand', 'dead']
const catTotal = {}
for (const r of rows) catTotal[r.category] = (catTotal[r.category] || 0) + r.tokens

for (const cat of order) {
  const inCat = rows.filter((r) => r.category === cat)
  if (inCat.length === 0) continue
  console.log(`\n=== ${cat}  (合計 ${catTotal[cat]} tok / ${inCat.reduce((a, r) => a + r.bytes, 0)} B) ===`)
  const byGroup = {}
  for (const r of inCat) (byGroup[r.group] ||= []).push(r)
  for (const [group, list] of Object.entries(byGroup)) {
    const gt = list.reduce((a, r) => a + r.tokens, 0)
    console.log(`  -- ${group}: ${gt} tok`)
    for (const r of list.sort((a, b) => b.tokens - a.tokens)) {
      console.log(
        `     ${String(r.tokens).padStart(6)} tok ${String(r.bytes).padStart(7)} B  ${r.label}${r.note ? '  # ' + r.note : ''}`,
      )
    }
  }
}

console.log(
  `\n固定費（always + listing）= ${(catTotal.always || 0) + (catTotal.listing || 0)} tok（概算・係数 ascii ${ASCII_CHARS_PER_TOKEN} chars/tok, wide ${WIDE_TOKENS_PER_CHAR} tok/char）`,
)
