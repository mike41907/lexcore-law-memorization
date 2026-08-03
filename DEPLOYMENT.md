# LexCore GitHub Pages 部署

公開網址：<https://mike41907.github.io/lexcore-law-memorization/>

每次推送到 `main` 後，GitHub Actions 會依序安裝依賴、執行測試、從法務部 OpenAPI 下載最新中文法律資料、建立分片索引與 `dist`，再發布到 GitHub Pages。排程也會在台北時間每週六早上自動重建官方資料。

## 本機資料邊界

法規、已選法條、作答、錯題、進度與設定都儲存在瀏覽器 IndexedDB。GitHub Pages 只提供程式檔與唯讀的官方法規索引／條文分片，不會接收使用者資料。

不同網址屬於不同的瀏覽器儲存空間。若要從舊網址搬移資料，請先在舊系統匯出 JSON 備份，再到公開網址還原。

## PWA 安裝

以 Chrome、Edge 或 Safari 開啟公開網址，再使用「安裝應用程式」或「加入主畫面」。第一次開啟時需連線下載程式；完成後可離線使用。

官方法規索引與開啟過的條文分片會由 Service Worker 快取；已匯入的法條則永久留在 IndexedDB。第一次搜尋官方資料仍需連線。
