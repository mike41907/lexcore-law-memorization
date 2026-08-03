import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const commands = [
  { code: 'D0080070', name: '違反社會秩序維護法案件處理辦法' },
  { code: 'D0080076', name: '地方法院與警察機關處理違反社會秩序維護法案件聯繫辦法' },
]
const outputDir = resolve('public/official/commands')
await mkdir(outputDir, { recursive: true })

for (const command of commands) {
  const url = `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${command.code}`
  const response = await fetch(url, { headers: { 'User-Agent': 'LexCore-Official-Command-Builder/1.0' } })
  if (!response.ok) throw new Error(`${command.name} 下載失敗：HTTP ${response.status}`)
  const html = await response.text()
  const rowStarts = Array.from(html.matchAll(/<div class="row"><div class="col-no">/g), (match) => match.index ?? 0)
  const headings = Array.from(html.matchAll(/<div class="h[34][^"]*">([\s\S]*?)<\/div>/g), (match) => ({ position: match.index ?? 0, value: cleanHtml(match[1]) }))
  const articles = []
  for (let index = 0; index < rowStarts.length; index += 1) {
    const start = rowStarts[index]
    const chunk = html.slice(start, rowStarts[index + 1] ?? html.length)
    const number = chunk.match(/<a[^>]*name="([^"]+)"[^>]*>/)?.[1]
    if (!number) continue
    const lines = Array.from(chunk.matchAll(/<div class="line-0000[^>]*>([\s\S]*?)<\/div>/g), (match) => cleanHtml(match[1])).filter(Boolean)
    if (!lines.length) continue
    const heading = [...headings].reverse().find((item) => item.position < start)?.value ?? ''
    articles.push({ number, content: lines.join('\n'), heading })
  }
  if (!articles.length) throw new Error(`${command.name} 沒有讀到條文。`)
  const modifiedMatch = html.match(/修正日期：[\s\S]{0,200}?民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/)
  const modifiedDate = modifiedMatch ? `民國 ${modifiedMatch[1]} 年 ${modifiedMatch[2]} 月 ${modifiedMatch[3]} 日` : ''
  await writeFile(resolve(outputDir, `${command.code}.json`), JSON.stringify({ schemaVersion: 1, code: command.code, name: command.name, url, modifiedDate, articles }), 'utf8')
  console.log(`MOJ_COMMAND_OK code=${command.code} articles=${articles.length}`)
}

function cleanHtml(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
}

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
    const lower = entity.toLowerCase()
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
    if (named[lower]) return named[lower]
    const codePoint = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : whole
  })
}
