// ==UserScript==
// @name         RootiCare MP 快速切頁
// @namespace    https://editoreu.rooticare.com/
// @version      1.6
// @description  在 MP 分頁邊界以 Q / E 切換相鄰 type；Ctrl + E 配合網頁原生功能快速往下選中 type。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP%20快速切頁.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP%20快速切頁.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

// 使用教學：在 MP（Morphology）頁面，以 Q / E 配合網頁原生快捷鍵瀏覽 type。
// 第一頁按 Q：切換至上一個 type；最後一頁按 E：切換至下一個 type。
// Ctrl + E：與網頁原生功能協作，快速往下選中 type。
// 切換 type 後會將目標捲入畫面，聚焦右側清單並點選第一張 ECG 縮圖；
// 若下一個按鍵是 1 / 2 / 3，則改為對左側剛選中的 type 生效（按其他鍵或點滑鼠後恢復原本行為）。
// 右側跨頁合計選取多張縮圖時，腳本不切換 type；在輸入框中打字、開著 Morphology Player 等彈出視窗
// 或資料載入中時不處理快捷鍵。首尾頁以 MP 縮圖清單的分頁判斷，切換 type 後不再讓網站同時換頁。
// 剛換頁、該頁波形還沒載入完成時按首尾頁的 Q / E，會在載入完成後自動切換 type。
// 網站快速連續換頁時，下一次換頁會等上一頁載入完成才執行，避免網站讀錯資料而卡住。
// 若仍發生（例如載入中點選左側 type），腳本會自動重新載入目前頁，未儲存的修改會保留。
// 左側多選 type 時，隱藏右側灰色遮罩與虛線提示框的外觀，保留原生操作攔截。

(function() {
    'use strict';

    // 僅隱藏多選提示外觀；不移除遮罩或改動 pointer-events，保留網站的多選操作限制。
    const multipleSelectionStyle = document.createElement('style');
    multipleSelectionStyle.textContent = `
        .morphology .right-content > [ng-if="multipleSelected()"] > .ecg-cover,
        .morphology .right-content > [ng-if="multipleSelected()"] > .alert-blk {
            opacity: 0 !important;
        }
    `;
    (document.head || document.documentElement).appendChild(multipleSelectionStyle);

    // MP 分頁、type 與縮圖的定位設定
    const SELECTORS = {
        allPageLinks: '.pagination-container a, .pagination a',
        bItems: '.type-trend',
        activeBIndicator: '.selectedBackground',
        aRegion: '#right-list',
        selectedImages: '#right-list .ecg-trend .idBackground.selectedBackground'
    };

    function morphologyScope() {
        try {
            return window.angular?.element(document.querySelector('.morphology > .container'))?.scope?.() || null;
        } catch (_) {
            return null;
        }
    }

    // 與網站 MP 原生按鍵相同的略過條件：開著彈出視窗（例如 Morphology Player）、
    // 正在輸入文字或資料載入中時，Q / E 不屬於縮圖清單，不切換 type。
    function shouldIgnoreKey(e, scope) {
        if (e.repeat || e.isComposing || e.altKey || e.metaKey || e.shiftKey) return true;
        if (!document.querySelector('.morphology > .container')) return true;
        if (document.querySelector('.ngdialog')) return true;
        const target = e.target instanceof Element ? e.target : document.activeElement;
        if (target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
        try { if (typeof scope?.loading === 'function' && scope.loading()) return true; } catch (_) { /* 沿用一般判斷 */ }
        return false;
    }

    // 以 MP 縮圖清單的分頁模型判斷首尾頁；模型不可用時才退回右側清單的分頁按鈕。
    function pageEdge(scope, direction) {
        const page = Number(scope?.morphology?.pagination?.currentPage);
        const count = Number(scope?.morphology?.pagination?.pageCount);
        if (Number.isFinite(page) && Number.isFinite(count) && count >= 1) {
            return direction === 'next' ? page >= count : page <= 1;
        }
        const text = direction === 'next' ? '>' : '<';
        const area = document.querySelector('.morphology .right-content') || document;
        const button = Array.from(area.querySelectorAll(SELECTORS.allPageLinks)).find(el => el.textContent.trim() === text);
        return !button || button.parentElement.classList.contains('disabled') || button.hasAttribute('disabled')
            || button.classList.contains('ng-hide') || getComputedStyle(button).pointerEvents === 'none';
    }

    // 網站換頁時會先換縮圖清單，波形與標籤稍後才從快取讀回；讀回時以當下清單長度填入資料，
    // 若這段期間切換 type 讓清單變長，網站會讀到不存在的資料而報錯（reading 'waveformData'）。
    // Morphology 縮圖標籤以絕對取樣索引為鍵，每張縮圖的標籤都含有該 segment 的索引時才算載入完成。
    // 模型不可用時視為已載入，沿用原本的判斷。
    function pageDataReady(scope) {
        const segments = scope?.morphology?.state?.currentSegments;
        const labels = scope?.morphology?.ecgEnlargedChart?.annoData;
        if (!Array.isArray(segments) || !Array.isArray(labels)) return true;
        return segments.every((segment, i) => {
            const label = labels[i];
            if (Array.isArray(label)) return true;
            return Boolean(label) && typeof label === 'object'
                && Object.prototype.hasOwnProperty.call(label, segment?.absoluteIndex);
        });
    }

    // 等這一頁資料載入完成後呼叫 done(true)；逾時或離開 MP 時呼叫 done(false)。一律非同步執行。
    const PAGE_WAIT_MS = 3000;
    function whenPageReady(scope, timeout, done) {
        const start = Date.now();
        const tick = () => {
            if (!scope || scope.$$destroyed) return done(false);
            if (pageDataReady(scope)) return done(true);
            if (Date.now() - start >= timeout) return done(false);
            setTimeout(tick, 20);
        };
        setTimeout(tick, 0);
    }

    // pageChanged 定義在 MP 控制器的 scope 上，子 scope 只是繼承；包裝時要改在擁有它的那一層。
    function pageOwner(scope) {
        let owner = scope;
        while (owner && !Object.prototype.hasOwnProperty.call(owner, 'pageChanged')) owner = Object.getPrototypeOf(owner);
        return typeof owner?.pageChanged === 'function' ? owner : null;
    }

    // 網站所有 MP 換頁（原生 Q / E、分頁按鈕、拉桿）都呼叫 pageChanged()。上一頁還沒載入完成時先排隊，
    // 載入後才執行，並以當下頁碼為準，所以連續換頁只會執行最後一次；最多等 PAGE_WAIT_MS，逾時照常換頁。
    let pageChangeQueued = false;
    function installPageGuard(scope) {
        const owner = pageOwner(scope);
        if (!owner || owner.pageChanged.mpQuickSwitchOriginal) return;
        const original = owner.pageChanged;
        const guarded = function() {
            if (pageDataReady(owner)) return original.apply(this, arguments);
            if (pageChangeQueued) return;
            pageChangeQueued = true;
            whenPageReady(owner, PAGE_WAIT_MS, () => {
                pageChangeQueued = false;
                if (!owner.$$destroyed) owner.$apply(() => original.call(owner));
            });
        };
        guarded.mpQuickSwitchOriginal = original;
        owner.pageChanged = guarded;
    }

    // 補救：載入中點選左側 type 等腳本攔不到的操作仍會讓網站報錯，畫面留下上一頁的波形、其餘縮圖空白，
    // 且載入旗標卡住。網站第一次讀錯會交給自己的重試、不會報錯；重試又讀錯時才報錯，之後不再重試。
    // 報錯後延後 RECOVER_DELAY_MS 檢查（連續報錯會重新計時），畫面確實對不上時，
    // 以網站原本的換頁流程重新載入目前頁，載入完成後解除卡住的旗標。
    // 未儲存的修改記在 segment 與編輯紀錄上，網站換頁時會重新套用，這裡不碰這些資料。
    const RECOVER_DELAY_MS = 200;
    const RECOVER_LIMIT = 3;
    const recoverState = { timer: null, times: [] };
    function scheduleRecover() {
        clearTimeout(recoverState.timer);
        recoverState.timer = setTimeout(recoverPage, RECOVER_DELAY_MS);
    }
    function recoverPage() {
        const owner = pageOwner(morphologyScope());
        if (!owner || pageDataReady(owner)) return;
        const now = Date.now();
        recoverState.times = recoverState.times.filter(time => now - time < 10000);
        if (recoverState.times.length >= RECOVER_LIMIT) return;
        recoverState.times.push(now);
        const reload = owner.pageChanged.mpQuickSwitchOriginal || owner.pageChanged;
        owner.$apply(() => reload.call(owner));
        whenPageReady(owner, 5000, ready => {
            if (ready && owner.morphology?.loading?.segments) owner.$apply(() => { owner.morphology.loading.segments = false; });
        });
    }

    // 網站的錯誤會經過 Angular 的 $log.error；只觀察訊息，原樣交回網站。
    function installErrorWatch() {
        let log;
        try { log = window.angular?.element(document.body)?.injector?.()?.get?.('$log'); } catch (_) { return; }
        if (!log || typeof log.error !== 'function' || log.error.mpQuickSwitchWatch) return;
        const original = log.error;
        const watched = function(...args) {
            try {
                if (args.some(arg => /waveformData/.test(String(arg?.message || arg)))) scheduleRecover();
            } catch (_) { /* 只觀察 */ }
            return original.apply(this, args);
        };
        watched.mpQuickSwitchWatch = true;
        log.error = watched;
    }

    // 進入 MP 時才有控制器 scope，換頁面後 scope 會重建，所以定期檢查並補上包裝。
    function installGuards() {
        const scope = morphologyScope();
        if (!scope) return;
        installPageGuard(scope);
        installErrorWatch();
    }
    setInterval(installGuards, 500);

    // 首尾頁按 Q / E 時若這一頁還在載入，先記下來，載入完成後自動切換 type。
    // 等待期間按其他鍵、點滑鼠、換頁或換 type 就取消；最多等 PAGE_WAIT_MS。
    let pendingSwitch = null;
    function switchSnapshot(scope) {
        const state = scope?.morphology?.state;
        return `${state?.label}|${state?.type}|${scope?.morphology?.pagination?.currentPage}`;
    }
    function queueSwitch(scope, direction) {
        const token = { snapshot: switchSnapshot(scope) };
        pendingSwitch = token;
        whenPageReady(scope, PAGE_WAIT_MS, ready => {
            if (pendingSwitch !== token) return;
            pendingSwitch = null;
            if (!ready || scope !== morphologyScope() || switchSnapshot(scope) !== token.snapshot) return;
            if (document.querySelector('.ngdialog') || !pageEdge(scope, direction)) return;
            try { if (typeof scope.loading === 'function' && scope.loading()) return; } catch (_) { return; }
            switchType(direction);
        });
    }
    document.addEventListener('mousedown', () => { pendingSwitch = null; leftDigitAfterSwitch = false; }, true);

    // 切換 type 後焦點在右側（第一張縮圖）；若緊接著按 1 / 2 / 3，改為對左側剛選中的 type 生效。
    // 網站的 1 / 2 / 3 依 morphology.state.focus 決定改右側縮圖或左側 type，按鍵處理在 document.onkeydown，
    // 這裡在捕獲階段先呼叫網站的 focusLeft()，再交回網站處理。按其他鍵或點滑鼠即取消。
    let leftDigitAfterSwitch = false;
    const LEFT_DIGIT_CODES = /^(?:Digit|Numpad)[123]$/;
    document.addEventListener('keydown', function(e) {
        if (!leftDigitAfterSwitch || ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        leftDigitAfterSwitch = false;
        if (!LEFT_DIGIT_CODES.test(e.code || '') || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        const scope = morphologyScope();
        if (shouldIgnoreKey(e, scope) || !scope?.morphology?.state?.selectedTypes?.length) return;
        if (scope.morphology.state.focus === 'left' || typeof scope.focusLeft !== 'function') return;
        scope.$apply(() => scope.focusLeft());
    }, true);

    // 按下 Q / E 時檢查分頁邊界；只在第一頁按 Q、最後一頁按 E 時接手切換 type。
    // Ctrl + E 仍與網站原生按鍵流程協作。
    document.addEventListener('keydown', function(e) {
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) pendingSwitch = null;
        const key = e.key.toUpperCase();
        if (key !== 'Q' && key !== 'E') return;
        const scope = morphologyScope();
        installGuards();
        if (shouldIgnoreKey(e, scope)) return;
        const direction = key === 'E' ? 'next' : 'prev';
        if (!pageEdge(scope, direction)) return;
        if (!pageDataReady(scope)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            queueSwitch(scope, direction);
            return;
        }
        // 已切換 type 時攔下同一次按鍵，避免網站接著在新 type 的清單上再換頁。
        if (switchType(direction)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true); // 使用 Capture 模式確保優先捕獲事件

    // 網站模型包含其他頁的選取；保留 DOM 計數作為載入中或無 Angular 時的保護。
    function selectedThumbnailCount() {
        const visible = document.querySelectorAll(SELECTORS.selectedImages).length;
        try {
            const region = document.querySelector('.morphology > .container');
            const scope = window.angular?.element(region)?.scope?.();
            const selected = scope?.morphology?.state?.selectedSegments;
            return Array.isArray(selected) ? Math.max(visible, selected.length) : visible;
        } catch (_) {
            return visible;
        }
    }

    /**
     * 切換相鄰 type，並初始化右側清單的焦點與選取。
     * @param {string} direction - 'next' 代表向下一個項目，'prev' 代表向上一個項目
     */
    // direction 決定往上或往下切換；只處理仍在側欄範圍內的相鄰 type。
    // 以網站的選取樣式尋找目前 type，切換後交由原生點擊載入資料，再聚焦右側第一張縮圖。
    function switchType(direction) {
        // 多選時保護目前清單，避免切換 type 造成選取項目狀態意外改變。
        if (selectedThumbnailCount() > 1) return false;

        const items = Array.from(document.querySelectorAll(SELECTORS.bItems));
        let currentIndex = -1;

        // 找出目前畫面上哪一個項目是被選中的
        items.forEach((item, index) => {
            if (item.querySelector(SELECTORS.activeBIndicator)) {
                currentIndex = index;
            }
        });

        if (currentIndex === -1) return false; // 若無選中項則跳出

        let targetIndex = -1;
        // 計算目標索引值
        if (direction === 'next' && currentIndex < items.length - 1) {
            targetIndex = currentIndex + 1;
        } else if (direction === 'prev' && currentIndex > 0) {
            targetIndex = currentIndex - 1;
        }

        // 已在第一個或最後一個 type 時不處理，交回網站原生按鍵。
        if (targetIndex === -1) return false;

        const targetItem = items[targetIndex];

        // 模擬滑鼠點擊動作
        targetItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        targetItem.click();

        // 將目標項目滾動到可視範圍（靠最近邊界）
        targetItem.scrollIntoView({ block: 'nearest' });

        // 自動聚焦到右側詳情區域
        const aRegion = document.querySelector(SELECTORS.aRegion);
        if (aRegion) {
            // 如果該區域不可聚焦，強制給予 tabIndex 使其可被 focus
            if (aRegion.tabIndex < 0) {
                aRegion.tabIndex = 0;
            }
            aRegion.focus();

            // 自動點擊右側區域內的第一個心電圖圖表或數據項
            const firstEcg = aRegion.querySelector('.ecg-trend');
            if (firstEcg) {
                firstEcg.click();
            }
        }
        leftDigitAfterSwitch = true;
        return true;
    }
})();
