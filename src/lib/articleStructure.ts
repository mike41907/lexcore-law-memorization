export type ArticleTextBlockKind = 'paragraph' | 'item' | 'subitem'

export interface ArticleTextBlock {
  kind: ArticleTextBlockKind
  paragraphNumber: number
  text: string
}

/**
 * 將法條原文的換行轉成可閱讀的項、款、目區塊。
 * 原文不會被修改；這些標籤只用於瀏覽畫面，避免把項次誤寫回法條內容。
 */
export function splitArticleTextBlocks(text: string): ArticleTextBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []

  let paragraphNumber = 0
  return lines.map((line) => {
    const kind = classifyTextBlock(line)
    if (kind === 'paragraph' || paragraphNumber === 0) paragraphNumber += 1
    return { kind, paragraphNumber, text: line }
  })
}

function classifyTextBlock(value: string): ArticleTextBlockKind {
  if (/^[（(][一二三四五六七八九十百千〇零○0-9０-９]+[）)]/.test(value)) return 'subitem'
  if (/^[一二三四五六七八九十百千〇零○0-9０-９]+[、.．)]/.test(value)) return 'item'
  return 'paragraph'
}
