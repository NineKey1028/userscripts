// ==UserScript==
// @name         RootiCare ECG 變動率縮圖標記器
// @namespace    https://editoreu.rooticare.com/
// @version      1.3
// @description  依 ECG 縮圖心搏點間距計算變動率，以可自訂淡藍色標記達 12% 的縮圖；每次載入預設關閉。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率縮圖標記器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率縮圖標記器.user.js
// 
// 
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // 個人化顏色設定：修改 TARGET_COLOR 即可快速更換標記顏色。
    const TARGET_COLOR = "#9fcfff"; // 達標縮圖的近白淡藍標記顏色
    const TARGET_COLOR_OPACITY = 0.22; // 標記透明度，讓 ECG 波形清楚透出
    const RECLASSIFIED_COLOR = "#ffe3ad"; // 已改為其他屬性但仍達標的提示色
    const RECLASSIFIED_COLOR_OPACITY = 0.4; // 屬性變更提示色透明度
    const HIGHLIGHT_COLOR = hexToRGBA(TARGET_COLOR, TARGET_COLOR_OPACITY);
    const RECLASSIFIED_HIGHLIGHT_COLOR = hexToRGBA(RECLASSIFIED_COLOR, RECLASSIFIED_COLOR_OPACITY);

    const CONFIG = {
        threshold: 0.12,
        controlId: 'rooticare-ecg-rate-thumbnail-highlighter-control',
        hitClass: 'rooticare-ecg-rate-thumbnail-hit',
        reclassifiedClass: 'rooticare-ecg-rate-thumbnail-reclassified',
        debounceMs: 180,
    };

    let enabled = false;
    let observer;
    let scheduled = false;

    function hexToRGBA(hex, alpha) {
        const value = hex.replace('#', '');
        const red = parseInt(value.slice(0, 2), 16);
        const green = parseInt(value.slice(2, 4), 16);
        const blue = parseInt(value.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    function installStyle() {
        if (document.getElementById(`${CONFIG.controlId}-style`)) return;
        const style = document.createElement('style');
        style.id = `${CONFIG.controlId}-style`;
        style.textContent = `
            #right-list .ecg-trend.${CONFIG.hitClass}:not(:has(.idBackground.selectedBackground)) .idBackground {
                background-color: ${HIGHLIGHT_COLOR} !important;
                border-radius: 2px;
            }
            #right-list .ecg-trend.${CONFIG.hitClass}.${CONFIG.reclassifiedClass}:not(:has(.idBackground.selectedBackground)) .idBackground {
                background-color: ${RECLASSIFIED_HIGHLIGHT_COLOR} !important;
            }
            #${CONFIG.controlId} {
                position: absolute;
                left: 14px;
                bottom: 16px;
                z-index: 20;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin: 0;
                padding: 5px 9px;
                border: 1px solid #b8c8b2;
                border-radius: 4px;
                background: #f6faf4;
                color: #3d563b;
                font: 13px/1.3 Arial, sans-serif;
                white-space: nowrap;
                cursor: pointer;
            }
            #${CONFIG.controlId} input { margin: 0; cursor: pointer; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureControl() {
        const container = document.querySelector('.morphology > .container');
        if (!container) return;
        let label = document.getElementById(CONFIG.controlId);
        if (!label) {
            label = document.createElement('label');
            label.id = CONFIG.controlId;
            label.title = '開啟後，按心搏點間距計算變動率並淡藍標記達 12% 的縮圖';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = enabled;
            checkbox.addEventListener('change', () => {
                enabled = checkbox.checked;
                scheduleUpdate();
            });
            const text = document.createElement('span');
            text.textContent = 'ECG 變動率標記';
            label.append(checkbox, text);
        } else {
            const checkbox = label.querySelector('input');
            if (checkbox) checkbox.checked = enabled;
        }
        if (label.parentElement !== container) container.appendChild(label);
    }

    function numericX(dot) {
        const x = Number(dot.getAttribute('cx'));
        return Number.isFinite(x) ? x : null;
    }

    function isBlackDot(dot) {
        const fill = getComputedStyle(dot).fill;
        return /rgb\(\s*(38|0)\s*,\s*(38|0)\s*,\s*(38|0)\s*\)/i.test(fill)
            || fill === 'black';
    }

    function findRateHits() {
        const hits = new Set();
        const thumbnails = [...document.querySelectorAll('#right-list .ecg-trend')];
        for (const thumbnail of thumbnails) {
            const dots = [...thumbnail.querySelectorAll('circle.anno-dot')]
                .map(dot => ({ dot, x: numericX(dot) }))
                .filter(item => item.x !== null)
                .sort((a, b) => a.x - b.x);
            const redIndex = dots.findIndex(({ dot }) => {
                const fill = getComputedStyle(dot).fill;
                return /rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/i.test(fill);
            });
            if (redIndex < 2) continue;

            const currentBeat = dots[redIndex];
            const previousBeat = dots[redIndex - 1];
            const beforePreviousBeat = dots[redIndex - 2];
            if (!isBlackDot(previousBeat.dot) || !isBlackDot(beforePreviousBeat.dot)) continue;

            const previousInterval = previousBeat.x - beforePreviousBeat.x;
            const currentInterval = currentBeat.x - previousBeat.x;
            if (previousInterval <= 0 || currentInterval <= 0) continue;

            // 同一 SVG 的水平座標以固定比例代表時間；換算成毫秒後，比例在變動率中相消。
            const rate = (previousInterval - currentInterval) / currentInterval;
            if (rate >= CONFIG.threshold) hits.add(thumbnail);
        }
        return hits;
    }

    function getClassification(thumbnail) {
        const label = thumbnail.querySelector('.ecgWave svg text');
        return label?.textContent.trim().toUpperCase() || '';
    }

    function update() {
        ensureControl();
        const thumbnails = document.querySelectorAll('#right-list .ecg-trend');
        thumbnails.forEach(thumb => thumb.classList.remove(
            CONFIG.hitClass,
            CONFIG.reclassifiedClass
        ));
        if (!enabled) return;

        // 每張縮圖各自讀取 ECG 心搏點並計算相鄰 RR 間距變動率。
        const hits = findRateHits();
        hits.forEach(thumb => {
            thumb.classList.add(CONFIG.hitClass);

            // 先記錄分類，避免選取狀態的淡綠色分支跳過分類更新。
            const classification = getClassification(thumb);
            if (classification && classification !== 'V') {
                thumb.classList.add(CONFIG.reclassifiedClass);
            }

        });
    }

    function scheduleUpdate() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
            scheduled = false;
            update();
        }, CONFIG.debounceMs);
    }

    function init() {
        installStyle();
        enabled = false;
        update();
        observer = new MutationObserver(records => {
            const relevant = records.some(record => {
                if (record.type !== 'attributes' || record.attributeName !== 'class') return true;
                const target = record.target;
                if (!(target instanceof Element)) return true;
                const stripClasses = (value, ignored) => (value || '').split(/\s+/)
                    .filter(name => name && !ignored.has(name)).sort().join(' ');

                // CSS :has() 直接跟隨網站的 selectedBackground，選取色即時顯示，毋須整批重算。
                if (target.matches('#right-list .idBackground')) {
                    const ignored = new Set(['selectedBackground']);
                    return stripClasses(record.oldValue, ignored) !== stripClasses(target.getAttribute('class'), ignored);
                }

                if (!target.matches('#right-list .ecg-trend')) return true;
                const ownClasses = new Set([CONFIG.hitClass, CONFIG.reclassifiedClass]);
                return stripClasses(record.oldValue, ownClasses) !== stripClasses(target.getAttribute('class'), ownClasses);
            });
            if (relevant) scheduleUpdate();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ['class', 'fill', 'style']
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
