# Userscripts

集中管理不同網站的 Tampermonkey／Violentmonkey 腳本。

## 腳本

| 網站 | 腳本 | 功能 |
| --- | --- | --- |
| NovelAI | [NovelAI Prompt Weight Hotkeys](scripts/novelai/NovelAI-Prompt-Weight-Hotkeys.user.js) | 調整 prompt 強度，以及在 NovelAI 與 ComfyUI 強度格式間切換 |

## 快速安裝

1. 安裝 Tampermonkey 或 Violentmonkey。
2. 開啟所需 `.user.js` 檔案的 Raw 頁面。
3. 由 userscript 管理器確認安裝。

## 目錄規則

每個網站使用獨立資料夾：

```text
scripts/
  site-name/
    Script-Name.user.js
    README.md
```

新增腳本時，請同時補上網站資料夾內的說明，並更新本頁的腳本列表。

## NovelAI Prompt Weight Hotkeys

- `Ctrl + ↑`／`Ctrl + ↓`：以 0.1 增減選取內容或游標所在群組的 NovelAI prompt 強度。
- `Ctrl + Alt + C`：切換目前 prompt 全文的 NovelAI／ComfyUI 強度格式。
- NovelAI：`1.2::blue hair::`
- ComfyUI：`(blue hair:1.2)`

