# NovelAI Prompt Weight Hotkeys

適用頁面：<https://novelai.net/image>

[安裝或更新腳本](https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/novelai/NovelAI-Prompt-Weight-Hotkeys.user.js)

## 自動更新

版本 2.2.0 起，腳本會透過 GitHub Raw 檢查更新。使用者安裝本版本一次後，往後只要倉庫內的 `@version` 提高，Tampermonkey／Violentmonkey 就能依個人設定通知或自動更新。管理器的檢查週期由使用者設定決定，因此不保證推送後立刻跳出通知。

## 快捷鍵

- `Ctrl + ↑`／`Ctrl + ↓`：調整強度，修改後保持反白，方便連續操作。
- `Ctrl + Alt + C`：切換整個 prompt 的強度格式。

```text
1.2::blue hair, green eyes::
(blue hair, green eyes:1.2)
```

腳本支援 NovelAI 的 ProseMirror 編輯器，會保留既有段落與空白行。
