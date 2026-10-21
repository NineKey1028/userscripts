// ==UserScript==
// @name         RootiCare MP 快速切頁
// @namespace    https://editoreu.rooticare.com/
// @version      1.4
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
// 切換 type 後會將目標捲入畫面，聚焦右側清單並點選第一張 ECG 縮圖。
// 右側跨頁合計選取多張縮圖時，腳本不切換 type；在輸入框中打字、開著 Morphology Player 等彈出視窗
// 或資料載入中時不處理快捷鍵。首尾頁以 MP 縮圖清單的分頁判斷，切換 type 後不再讓網站同時換頁。
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

    // 按下 Q / E 時檢查分頁邊界；只在第一頁按 Q、最後一頁按 E 時接手切換 type。
    // Ctrl + E 仍與網站原生按鍵流程協作。
    document.addEventListener('keydown', function(e) {
        const key = e.key.toUpperCase();
        if (key !== 'Q' && key !== 'E') return;
        const scope = morphologyScope();
        if (shouldIgnoreKey(e, scope)) return;
        const direction = key === 'E' ? 'next' : 'prev';
        if (!pageEdge(scope, direction)) return;
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
        return true;
    }
})();
