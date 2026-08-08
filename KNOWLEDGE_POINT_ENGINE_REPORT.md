# LexCore v0.14.0 考點引擎改版紀錄

## 完成內容

- 新增 `KnowledgePoint`、`KnowledgeQuestion`、`KnowledgeMastery`、`KnowledgeReview` 四種資料模型。
- IndexedDB 升版至 v2；原有法規、法條、作答、錯題與熟練度 store 保留不變。
- 載入既有法條時，以原文規則建立一般原則、應／得／不得、例外但書、構成要件、程序、法律效果、數字、期間、金額與年齡等考點。
- 每個考點自動建立 2 至 20 題，題目均與 `knowledgePointId` 連結，並保存原文依據。
- 舊有 `LawArticle.questions` 會遷移到「既有題目／一般考點」，舊版 article mastery/review 會作為考點初始基準；舊紀錄不刪除。
- 今日任務優先以考點為單位，並支援考點的新增、編輯、刪除、合併與拆分。
- 新增 `/knowledge` 考點儀表板：熟練度、待複習、高風險、考點類型篩選、全文搜尋、考點地圖與訓練入口。
- `/training/:articleId?point=:knowledgePointId` 會進入考點題組訓練；原有法條訓練網址仍可使用。
- 備份格式向後相容；新備份會包含考點資料，舊備份匯入時缺少新陣列會自動視為空集合。

## 重要限制

- 規則引擎只擷取法條原文，不自行生成法律解釋；題目解釋欄目前顯示原文依據。
- 自訂考點的新增／編輯／拆分目前使用簡潔的本機輸入視窗，後續可再換成完整 modal 表單。
- IndexedDB 遷移會在第一次載入既有大量法條時建立考點與題目，首次啟動時間會依資料量增加。

## 驗證

- TypeScript build：通過。
- Vitest：17 個測試檔、48 個測試通過。
- Vite production build：通過。
