// ==UserScript==
// @name         RootiCare ECG 變動率縮圖標記器
// @namespace    https://editoreu.rooticare.com/
// @version      1.5.3
// @description  依 ECG 縮圖心搏點間距標記變動率或心律大於等於指定值的縮圖；每次載入預設關閉。
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
    const DEFAULT_HEART_RATE_THRESHOLD = 100; // 心律模式預設門檻 (BPM)
    const HIGHLIGHT_COLOR = hexToRGBA(TARGET_COLOR, TARGET_COLOR_OPACITY);
    const RECLASSIFIED_HIGHLIGHT_COLOR = hexToRGBA(RECLASSIFIED_COLOR, RECLASSIFIED_COLOR_OPACITY);

    const CONFIG = {
        threshold: 0.12,
        controlId: 'rooticare-ecg-rate-thumbnail-highlighter-control',
        heartRateInputId: 'rooticare-ecg-rate-thumbnail-heart-rate-threshold',
        hitClass: 'rooticare-ecg-rate-thumbnail-hit',
        reclassifiedClass: 'rooticare-ecg-rate-thumbnail-reclassified',
        debounceMs: 180,
    };

    let enabled = false;
    let heartRateEnabled = false;
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
            /* 移出 type 或跨分類的達標格子提示淡黃；選取色交由網站處理。 */
            #right-list .ecg-trend.${CONFIG.hitClass}:not(:has(.idBackground.selectedBackground)) .idBackground:not(.move-out-color) {
                background-color: ${HIGHLIGHT_COLOR} !important;
                border-radius: 2px;
            }
            #right-list .ecg-trend.${CONFIG.hitClass}.${CONFIG.reclassifiedClass}:not(:has(.idBackground.selectedBackground)) .idBackground,
            #right-list .ecg-trend.${CONFIG.hitClass}:not(:has(.idBackground.selectedBackground)) .idBackground.move-out-color {
                background-color: ${RECLASSIFIED_HIGHLIGHT_COLOR} !important;
            }
            #${CONFIG.controlId} {
                position: absolute;
                left: 14px;
                bottom: 16px;
                z-index: 20;
                display: inline-flex;
                align-items: center;
                gap: 10px;
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
            #${CONFIG.controlId} label { display: inline-flex; align-items: center; gap: 5px; margin: 0; cursor: pointer; }
            #${CONFIG.controlId} input[type="checkbox"] { margin: 0; cursor: pointer; }
            #${CONFIG.heartRateInputId} { width: 54px; box-sizing: border-box; padding: 2px 4px; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureControl() {
        const container = document.querySelector('.morphology > .container');
        if (!container) return;
        let control = document.getElementById(CONFIG.controlId);
        if (!control || control.tagName !== 'DIV') {
            control?.remove();
            control = document.createElement('div');
            control.id = CONFIG.controlId;

            const variabilityLabel = document.createElement('label');
            const variabilityCheckbox = document.createElement('input');
            variabilityCheckbox.type = 'checkbox';
            variabilityCheckbox.dataset.mode = 'variability';
            const variabilityText = document.createElement('span');
            variabilityText.textContent = 'ECG 變動率標記';
            variabilityLabel.append(variabilityCheckbox, variabilityText);

            const heartRateGroup = document.createElement('span');
            heartRateGroup.style.cssText = 'display:inline-flex;align-items:center;gap:5px';
            const heartRateLabel = document.createElement('label');
            const heartRateCheckbox = document.createElement('input');
            heartRateCheckbox.type = 'checkbox';
            heartRateCheckbox.dataset.mode = 'heart-rate';
            const heartRateText = document.createElement('span');
            heartRateText.textContent = '心律大於等於';
            const thresholdInput = document.createElement('input');
            thresholdInput.type = 'number';
            thresholdInput.id = CONFIG.heartRateInputId;
            thresholdInput.min = '1';
            thresholdInput.max = '300';
            thresholdInput.step = '1';
            thresholdInput.value = String(DEFAULT_HEART_RATE_THRESHOLD);
            thresholdInput.title = '紅色點的心律門檻 (BPM)';
            thresholdInput.setAttribute('aria-label', '紅點心律門檻 (BPM)');
            const bpmText = document.createElement('span');
            bpmText.textContent = 'BPM';
            heartRateLabel.append(heartRateCheckbox, heartRateText);
            heartRateGroup.append(heartRateLabel, thresholdInput, bpmText);
            // 防止拖曳反白輸入值時，事件傳到網站的選取／拖曳處理器。
            for (const eventName of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'keydown', 'keyup']) {
                thresholdInput.addEventListener(eventName, event => event.stopPropagation());
            }

            variabilityCheckbox.addEventListener('change', () => {
                enabled = variabilityCheckbox.checked;
                if (enabled) {
                    heartRateEnabled = false;
                    heartRateCheckbox.checked = false;
                }
                scheduleUpdate();
            });
            heartRateCheckbox.addEventListener('change', () => {
                heartRateEnabled = heartRateCheckbox.checked;
                if (heartRateEnabled) {
                    enabled = false;
                    variabilityCheckbox.checked = false;
                }
                scheduleUpdate();
            });
            thresholdInput.addEventListener('input', scheduleUpdate);

            control.append(variabilityLabel, heartRateGroup);
        }
        const variabilityCheckbox = control.querySelector('[data-mode="variability"]');
        const heartRateCheckbox = control.querySelector('[data-mode="heart-rate"]');
        if (variabilityCheckbox) variabilityCheckbox.checked = enabled;
        if (heartRateCheckbox) heartRateCheckbox.checked = heartRateEnabled;
        if (control.parentElement !== container) container.appendChild(control);
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

    function getRedBeatBpm(thumbnail, currentBeat, previousBeat) {
        // D3 的圓點綁定原始取樣索引；使用原始時間資料，不受 CSS、DPR 或網頁縮放影響。
        const wave = thumbnail.querySelector('.ecgWave');
        const angularElement = window.angular?.element(wave);
        const scope = angularElement?.isolateScope?.();
        const sampleRate = Number(scope?.posInfo?.sampleRate || scope?.sampleRate);
        const currentIndex = Number(currentBeat.dot.__data__);
        const previousIndex = Number(previousBeat.dot.__data__);
        if (currentBeat.dot.__data__ != null && previousBeat.dot.__data__ != null
            && Number.isFinite(currentIndex) && Number.isFinite(previousIndex)
            && Number.isFinite(sampleRate) && sampleRate > 0 && currentIndex > previousIndex) {
            return Math.round(60 * sampleRate / (currentIndex - previousIndex));
        }

        // 不能取得原始索引時，只用同一繪圖群組的座標及實際時間窗。
        // 不以 SVG 外框或螢幕像素代替繪圖寬度，也不猜測固定秒數。
        const group = currentBeat.dot.closest('.centerGroup');
        const width = Number(group?.getAttribute('width'));
        const duration = Number(scope?.segSec || wave?.getAttribute('seg-sec'));
        const interval = currentBeat.x - previousBeat.x;
        if (Number.isFinite(width) && width > 0 && Number.isFinite(duration)
            && duration > 0 && interval > 0) {
            return Math.round(60 * width / (interval * duration));
        }
        return null;
    }

    function findHeartRateHits(thresholdBpm) {
        const hits = new Set();
        const thumbnails = [...document.querySelectorAll('#right-list .ecg-trend')];
        for (const thumbnail of thumbnails) {
            const dots = [...thumbnail.querySelectorAll('circle.anno-dot')]
                .map(dot => ({ dot, x: numericX(dot) }))
                .filter(item => item.x !== null)
                .sort((a, b) => a.x - b.x);
            const redIndex = dots.findIndex(({ dot }) => /rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/i.test(getComputedStyle(dot).fill));
            if (redIndex < 1 || !isBlackDot(dots[redIndex - 1].dot)) continue;

            const heartRateBpm = getRedBeatBpm(thumbnail, dots[redIndex], dots[redIndex - 1]);
            if (heartRateBpm !== null && heartRateBpm >= thresholdBpm) hits.add(thumbnail);
        }
        return hits;
    }

    function getClassification(thumbnail) {
        const label = thumbnail.querySelector('.ecgWave svg text');
        return label?.textContent.trim().toUpperCase() || '';
    }

    function getCurrentCategory() {
        const selected = document.querySelector('.morphology .label-list .label-btn.current-label[ng-click]');
        const match = selected?.getAttribute('ng-click')?.match(/setLabel\(['"]([VSNA])['"]\)/);
        return match?.[1] || '';
    }

    function update() {
        ensureControl();
        const thumbnails = document.querySelectorAll('#right-list .ecg-trend');
        thumbnails.forEach(thumb => thumb.classList.remove(
            CONFIG.hitClass,
            CONFIG.reclassifiedClass
        ));
        if (!enabled && !heartRateEnabled) return;

        const thresholdInput = document.getElementById(CONFIG.heartRateInputId);
        const thresholdBpm = Number(thresholdInput?.value);
        if (heartRateEnabled && (!Number.isFinite(thresholdBpm) || thresholdBpm <= 0)) return;

        // 變動率與紅點 BPM 模式互斥，各自按其門檻找出需標記的縮圖。
        const currentCategory = getCurrentCategory();
        const hits = enabled ? findRateHits() : findHeartRateHits(thresholdBpm);
        hits.forEach(thumb => {
            thumb.classList.add(CONFIG.hitClass);

            // 與目前上方選取的分類比較；同分類維持淡藍，跨分類才淡黃。
            const classification = getClassification(thumb);
            if (currentCategory && classification && classification !== currentCategory) {
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
            attributeFilter: ['class', 'fill', 'style', 'cx', 'width', 'viewBox', 'transform', 'seg-sec', 'sample-rate']
        });
        window.addEventListener('resize', scheduleUpdate);
        window.visualViewport?.addEventListener('resize', scheduleUpdate);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
