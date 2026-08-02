# LexCore GitHub Pages 部署

公開網址：<https://mike41907.github.io/lexcore-law-memorization/>

每次推送到 `main` 後，GitHub Actions 會依序安裝依賴、執行測試、建立 `dist`，再發布到 GitHub Pages。

## 本機資料邊界

法規、法條、作答、錯題、進度與設定都儲存在瀏覽器 IndexedDB。GitHub Pages 僅提供程式檔，不會接收上述資料。

不同網址屬於不同的瀏覽器儲存空間。若要從舊網址搬移資料，請先在舊系統匯出 JSON 備份，再到公開網址還原。

## PWA 安裝

以 Chrome、Edge 或 Safari 開啟公開網址，再使用「安裝應用程式」或「加入主畫面」。第一次開啟時需連線下載程式；完成後可離線使用。
