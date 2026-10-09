# NovelAI Prompt Weight Hotkeys

適用頁面：<https://novelai.net/image>

[安裝或更新腳本](https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/novelai/NovelAI-Prompt-Weight-Hotkeys.user.js)

## 自動更新

版本 2.2.0 起，腳本會透過 GitHub Raw 檢查更新。使用者安裝本版本一次後，往後只要倉庫內的 `@version` 提高，Tampermonkey／Violentmonkey 就能依個人設定通知或自動更新。管理器的檢查週期由使用者設定決定，因此不保證推送後立刻跳出通知。

## 快捷鍵

- `Ctrl + ↑`／`Ctrl + ↓`：調整強度，修改後保持反白，方便連續操作。
- `Ctrl + Alt + C`：切換整個 prompt 的強度格式。

## 統整並複製（2.3.3）

Base Prompt 輸入框下方的「統整並複製」按鈕，會依序收集 Base Prompt 與 Character 1～N 的正向提示詞，複製到剪貼簿，不修改原有欄位。

- 相同 tag 只保留第一次出現的內容與權重；比較時忽略大小寫及多餘空白。
- 保留提示詞與展開 Chunk 原有的換行、內部空白行；不同欄位之間換行排列。去重後的 tag 仍留在第一次出現的位置。
- 複製結果最後補上逗號；若已以逗號或句點 `.` 結尾，則不補。
- 移除獨立的 `girl`、`boy`，包含權重群組內的這兩個 tag；保留 `1girl`、`1boy`、`2girls` 等人數 tag。
- 僅展開已插入提示詞的 Prompt Chunk，不會複製整個 Chunk 資料庫。
- 分類名稱為 `style`（不分大小寫）的 Chunk 略過；其它分類複製實際 prompt，並一起去重。
- 直接讀取頁面已載入的 Chunk 清單，以 Chunk ID 與分類的 `childOrder` 判斷所屬分類；不需要開啟 Prompt Chunks。每次複製重新讀取，支援未分類的 Chunk 及 Chunk 內的引用，不以名稱或顏色猜測。
- 此功能使用 NovelAI 內部資料介面；若網站變更介面或清單尚未載入，會提示更新腳本或稍後重試。
- 不包含 Base／Character 的 Undesired Content，也不自動補上 Quality Preset 的內容。
- Character 的打勾按鈕暫時關閉時，略過該角色的全部提示詞與 Chunk。每次複製重新讀取狀態；仍啟用但收合的角色照常複製。

需要瀏覽器允許剪貼簿寫入；寫入失敗時會顯示提示。

```text
1.2::blue hair, green eyes::
(blue hair, green eyes:1.2)
```

轉回 NovelAI 時，輸出為 `1.2::blue hair, green eyes::,`；逗號會放在結尾 `::` 之後。

轉回 NovelAI 時也會移除 ComfyUI 普通括號的跳脫符號，例如 `\\(tag\\)` 會還原為 `(tag)`。格式切換不會反白全文；只有 `Ctrl + ↑`／`Ctrl + ↓` 會反白修改後的強度群組。

腳本支援 NovelAI 的 ProseMirror 編輯器，會保留既有段落與空白行。

轉成 ComfyUI 時，普通括號會自動跳脫，例如 `(tag)` 會變成 `\\(tag\\)`；加權群組的外層括號會保留為格式結構。
