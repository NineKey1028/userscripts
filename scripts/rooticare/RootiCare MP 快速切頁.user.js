// ==UserScript==
// @name         RootiCare MP 快速切頁
// @namespace    https://editoreu.rooticare.com/
// @version      1.1
// @description  使用 Q、E 快速更換 type
// @author       Alex
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP%20快速切頁.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP%20快速切頁.user.js
// 
// 
// @grant        none
// ==/UserScript==

// MP 頁面中在 type 的第一或最後一頁使用 Q、E 切換上下 type
// Ctrl + E 快速往下選中 type

(function() {
    'use strict';

    // --- 配置與選擇器 ---
    const SELECTORS = {
        allPageLinks: '.pagination-container a, .pagination a',
        bItems: '.type-trend',
        activeBIndicator: '.selectedBackground',
        aRegion: '#right-list',
        selectedImages: '#right-list .ecg-trend .idBackground.selectedBackground'
    };

    // 防止按鍵重複觸發的旗標（防止長按導致連續跳轉）
    let isKeyDown = false;

    // --- 事件監聽：按下鍵盤 ---
    document.addEventListener('keydown', function(e) {
        // 如果按鍵已處於按下狀態，或使用者正在輸入框打字，則不執行邏輯
        if (isKeyDown) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toUpperCase();
        const links = Array.from(document.querySelectorAll(SELECTORS.allPageLinks));

        // 邏輯：按下 E 鍵 下一頁
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
        // 邏輯：按下 Q 鍵 上一頁
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

    // --- 事件監聽：放開鍵盤 ---
    document.addEventListener('keyup', function(e) {
        const key = e.key.toUpperCase();
        if (key === 'Q' || key === 'E') {
            isKeyDown = false; // 重置旗標，允許下次觸發
        }
    });

    /**
     * 核心功能：切換側邊欄項目
     * @param {string} direction - 'next' 代表向下一個項目，'prev' 代表向上一個項目
     */
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
