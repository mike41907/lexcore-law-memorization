import { describe, expect, it } from 'vitest'
import { parseOfficialCommandHtml } from './officialCommands'

describe('official command parser', () => {
  it('extracts headings, numbers, and multiline article text from the official page shape', () => {
    const html = '<div class="h3 char-2">第 一 章 總則</div><div class="row"><div class="col-no"> <a href="x" name="1">第 1 條</a></div><div class="col-data"><div class="law-article"><div class="line-0000">第一項&nbsp;內容。</div><div class="line-0000 show-number">第二項&amp;補充。</div></div></div></div>'
    expect(parseOfficialCommandHtml(html, 'D0000000', '測試辦法')).toEqual({ code: 'D0000000', articles: [{ number: '1', content: '第一項 內容。\n第二項&補充。', heading: '第 一 章 總則' }] })
  })

  it('rejects an official page with no articles', () => {
    expect(() => parseOfficialCommandHtml('<html></html>', 'D0000000', '空白辦法')).toThrow('沒有讀到條文')
  })
})
