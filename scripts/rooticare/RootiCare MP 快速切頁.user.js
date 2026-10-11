// ==UserScript==
// @name         RootiCare MP 快速切頁
// @namespace    https://editoreu.rooticare.com/
// @version      1.1
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
// 右側同時選取多張縮圖時，腳本不切換 type；在輸入框中打字時不處理快捷鍵。

(function() {
    'use strict';

    // MP 分頁、type 與縮圖的定位設定
    const SELECTORS = {
        allPageLinks: '.pagination-container a, .pagination a',
        bItems: '.type-trend',
        activeBIndicator: '.selectedBackground',
        aRegion: '#right-list',
        selectedImages: '#right-list .ecg-trend .idBackground.selectedBackground'
    };

    // 防止按鍵重複觸發的旗標（防止長按導致連續跳轉）
    let isKeyDown = false;

    // 按下 Q / E 時檢查分頁邊界。
    document.addEventListener('keydown', function(e) {
        // 如果按鍵已處於按下狀態，或使用者正在輸入框打字，則不執行邏輯
        if (isKeyDown) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // 此處只接續 Q / E 在分頁邊界的 type 切換；Ctrl + E 仍與網站原生按鍵流程協作。
        const key = e.key.toUpperCase();
        const links = Array.from(document.querySelectorAll(SELECTORS.allPageLinks));

        // E：最後一頁時銜接下一個 type。
        if (key === 'E') {
            // 尋找內容為 ">" 的按鈕
            const nextBtn = links.find(el => el.innerText.trim() === '>');

            // 判斷是否已經是最後一頁：找不到按鈕、父層禁用、具備 disabled 屬性、隱藏或無法點擊
            const isLastPage = !nextBtn ||
                               nextBtn.parentElement.classList.contains('disabled') ||
                               nextBtn.hasAttribute('disabled') ||
                               nextBtn.classList.contains('ng-hide') ||
                               getComputedStyle(nextBtn).pointerEvents === 'none';

            // 如果已經到最後一頁，則切換到「下一個項目類型」
            if (isLastPage) {
                isKeyDown = true;
                switchType('next');
            }
        }
        // Q：第一頁時銜接上一個 type。
        else if (key === 'Q') {
            // 尋找內容為 "<" 的按鈕
            const prevBtn = links.find(el => el.innerText.trim() === '<');

            // 判斷是否已經是第一頁
            const isFirstPage = !prevBtn ||
                                prevBtn.parentElement.classList.contains('disabled') ||
                                prevBtn.hasAttribute('disabled') ||
                                prevBtn.classList.contains('ng-hide') ||
                                getComputedStyle(prevBtn).pointerEvents === 'none';

            // 如果已經在第一頁，則切換到「上一個項目類型」
            if (isFirstPage) {
                isKeyDown = true;
                switchType('prev');
            }
        }
    }, true); // 使用 Capture 模式確保優先捕獲事件

    // 放開 Q / E 後允許下一次切換。
    document.addEventListener('keyup', function(e) {
        const key = e.key.toUpperCase();
        if (key === 'Q' || key === 'E') {
            isKeyDown = false; // 重置旗標，允許下次觸發
        }
    });

    /**
     * 切換相鄰 type，並初始化右側清單的焦點與選取。
     * @param {string} direction - 'next' 代表向下一個項目，'prev' 代表向上一個項目
     */
    // direction 決定往上或往下切換；只處理仍在側欄範圍內的相鄰 type。
    // 以網站的選取樣式尋找目前 type，切換後交由原生點擊載入資料，再聚焦右側第一張縮圖。
    function switchType(direction) {
        // 多選時保護目前清單，避免切換 type 造成選取項目狀態意外改變。
        if (document.querySelectorAll(SELECTORS.selectedImages).length > 1) return;

        const items = Array.from(document.querySelectorAll(SELECTORS.bItems));
        let currentIndex = -1;

        // 找出目前畫面上哪一個項目是被選中的
        items.forEach((item, index) => {
            if (item.querySelector(SELECTORS.activeBIndicator)) {
                currentIndex = index;
            }
        });

        if (currentIndex === -1) return; // 若無選中項則跳出

        let targetIndex = -1;
        // 計算目標索引值
        if (direction === 'next' && currentIndex < items.length - 1) {
            targetIndex = currentIndex + 1;
        } else if (direction === 'prev' && currentIndex > 0) {
            targetIndex = currentIndex - 1;
        }

        // 如果目標索引有效，執行切換動作
        if (targetIndex !== -1) {
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
        }
    }
})();
