// ==UserScript==
// @name         RootiCare ECG 變動率縮圖標記器
// @namespace    https://editoreu.rooticare.com/
// @version      1.10.1
// @description  依 ECG 縮圖心搏點間距標記變動率或以可選比較方式標記指定心律的縮圖；支援 AND／OR 組合篩選與 Morphology Player 快速修改；每次載入預設關閉。
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
        heartRateOperatorId: 'rooticare-ecg-rate-thumbnail-heart-rate-operator',
        variabilityOperatorId: 'rooticare-ecg-rate-thumbnail-variability-operator',
        combinationOperatorId: 'rooticare-ecg-rate-thumbnail-combination-operator',
        hitClass: 'rooticare-ecg-rate-thumbnail-hit',
        reclassifiedClass: 'rooticare-ecg-rate-thumbnail-reclassified',
        debounceMs: 180,
    };

    let enabled = false;
    let heartRateEnabled = false;
    let observer;
    let scheduled = false;
    let controlContainer;

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

            #rooticare-morphology-quick-editor {
                box-sizing: border-box; margin: 0 0 7px; padding: 6px 8px 5px;
                border: 1px solid #dde4d5; border-radius: 7px;
                background: #fff; color: #344035; font: 12px/1.3 Arial, "Microsoft JhengHei", sans-serif;
                box-shadow: 0 2px 6px #24332108;
            }
            #rooticare-morphology-quick-editor * { box-sizing: border-box; }
            #rooticare-morphology-quick-editor .qe-toolbar { display: flex; align-items: center; gap: 8px; overflow-x: auto; }
            #rooticare-morphology-quick-editor .qe-row { display: flex; align-items: center; flex-wrap: nowrap; gap: 5px; flex-shrink: 0; }
            #rooticare-morphology-quick-editor .qe-actions { margin-left: auto; padding-left: 8px; border-left: 1px solid #edf0e9; }
            #rooticare-morphology-quick-editor .qe-caption { color: #778170; font-size: 11px; font-weight: 600; letter-spacing: .5px; margin-right: 3px; }
            #rooticare-morphology-quick-editor .qe-condition { display: inline-flex; align-items: center; gap: 4px; padding: 2px 5px; background: #f5f6f3; border: 1px solid transparent; border-radius: 7px; }
            #rooticare-morphology-quick-editor .qe-condition:has(input:checked) { border-color: #b9cf8b; background: #f5f9ed; }
            #rooticare-morphology-quick-editor label { display: inline-flex; align-items: center; gap: 4px; margin: 0; font-weight: 500; white-space: nowrap; cursor: pointer; }
            #rooticare-morphology-quick-editor input[type=checkbox] { appearance: auto; width: 12px; height: 12px; margin: 0; accent-color: #739d29; cursor: pointer; }
            #rooticare-morphology-quick-editor select, #rooticare-morphology-quick-editor input[type=number] {
                position: static; float: none; margin: 0; height: 23px; min-height: 23px;
                border: 1px solid #dce2d5; border-radius: 5px; background-color: #fff;
                color: #344035; font: inherit; line-height: normal; padding: 1px 4px;
            }
            #rooticare-morphology-quick-editor select { cursor: pointer; width: auto; }
            #rooticare-morphology-quick-editor input[type=number] { width: 51px; }
            #rooticare-morphology-quick-editor [data-role=combination] { font-size: 11px; font-weight: 700; color: #6e7c5a; border-color: transparent; background-color: #f0f3eb; }
            #rooticare-morphology-quick-editor .qe-unit { color: #7f8978; font-size: 11px; }
            #rooticare-morphology-quick-editor [data-role=label] { min-width: 46px; font-weight: 700; }
            #rooticare-morphology-quick-editor .qe-speed { margin-left: 5px; }
            #rooticare-morphology-quick-editor .qe-buttons { display: inline-flex; gap: 5px; margin-left: auto; }
            #rooticare-morphology-quick-editor button { position: static; float: none; width: auto; margin: 0; height: 25px; padding: 0 8px; border: 1px solid #dce2d5; border-radius: 6px; background: #fff; color: #526047; font: 600 12px Arial, "Microsoft JhengHei", sans-serif; cursor: pointer; transition: background .12s, border-color .12s; }
            #rooticare-morphology-quick-editor button:hover { background: #f2f5ed; border-color: #a9bb92; }
            #rooticare-morphology-quick-editor [data-role=play] { min-width: 70px; border-color: #74972e; background: #7c9f32; color: #fff; }
            #rooticare-morphology-quick-editor [data-role=play]:hover { background: #6c8e27; }
            #rooticare-morphology-quick-editor [data-role=play][data-running=true] { background: #526448; border-color: #526448; }
            #rooticare-morphology-quick-editor :is(button,select,input):focus-visible { outline: 2px solid #99b86c; outline-offset: 2px; }
            #rooticare-morphology-quick-editor .qe-footer { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 14px; margin-top: 4px; color: #8b9386; font-size: 11px; font-variant-numeric: tabular-nums; }
            #rooticare-morphology-quick-editor .qe-counts { display: inline-flex; gap: 12px; white-space: nowrap; }
            #rooticare-morphology-quick-editor .qe-counts b { display: inline-block; min-width: 4ch; text-align: right; font-weight: 600; color: #526047; }
            #rooticare-morphology-quick-editor [data-role=status] { text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #rooticare-morphology-quick-editor [data-role=status] { color: #6c785f; }
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

            const variabilityGroup = document.createElement('span');
            variabilityGroup.style.cssText = 'display:inline-flex;align-items:center;gap:5px';
            const variabilityLabel = document.createElement('label');
            const variabilityCheckbox = document.createElement('input');
            variabilityCheckbox.type = 'checkbox';
            variabilityCheckbox.dataset.mode = 'variability';
            const variabilityText = document.createElement('span');
            variabilityText.textContent = 'ECG 變動率';
            variabilityLabel.append(variabilityCheckbox, variabilityText);
            const variabilityOperator = document.createElement('select');
            variabilityOperator.id = CONFIG.variabilityOperatorId;
            variabilityOperator.setAttribute('aria-label', '變動率比較方式');
            variabilityOperator.title = '選擇變動率的比較方式';
            for (const [value, text] of [['>=', '≥'], ['<=', '≤']]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = text;
                variabilityOperator.appendChild(option);
            }
            variabilityOperator.value = '>=';
            variabilityOperator.addEventListener('change', scheduleUpdate);
            variabilityGroup.append(variabilityLabel, variabilityOperator);

            const heartRateGroup = document.createElement('span');
            heartRateGroup.style.cssText = 'display:inline-flex;align-items:center;gap:5px';
            const heartRateLabel = document.createElement('label');
            const heartRateCheckbox = document.createElement('input');
            heartRateCheckbox.type = 'checkbox';
            heartRateCheckbox.dataset.mode = 'heart-rate';
            const heartRateText = document.createElement('span');
            heartRateText.textContent = '紅點心律';
            const operatorSelect = document.createElement('select');
            operatorSelect.id = CONFIG.heartRateOperatorId;
            operatorSelect.setAttribute('aria-label', '心律比較方式');
            operatorSelect.title = '選擇紅點心律的比較方式';
            for (const [value, text] of [['>=', '≥'], ['<=', '≤']]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = text;
                operatorSelect.appendChild(option);
            }
            operatorSelect.value = '>=';
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
            heartRateGroup.append(heartRateLabel, operatorSelect, thresholdInput, bpmText);
            // 防止拖曳反白輸入值時，事件傳到網站的選取／拖曳處理器。
            for (const eventName of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'keydown', 'keyup']) {
                thresholdInput.addEventListener(eventName, event => event.stopPropagation());
            }

            variabilityCheckbox.addEventListener('change', () => {
                enabled = variabilityCheckbox.checked;
                scheduleUpdate();
            });
            heartRateCheckbox.addEventListener('change', () => {
                heartRateEnabled = heartRateCheckbox.checked;
                scheduleUpdate();
            });
            thresholdInput.addEventListener('input', scheduleUpdate);
            operatorSelect.addEventListener('change', scheduleUpdate);

            const combinationOperator = document.createElement('select');
            combinationOperator.id = CONFIG.combinationOperatorId;
            combinationOperator.setAttribute('aria-label', '兩項條件的組合方式');
            combinationOperator.title = '兩項同時啟用時：AND 需同時符合，OR 符合任一項';
            for (const value of ['AND', 'OR']) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                combinationOperator.appendChild(option);
            }
            combinationOperator.value = 'AND';
            combinationOperator.addEventListener('change', scheduleUpdate);

            control.append(variabilityGroup, combinationOperator, heartRateGroup);
        }
        const variabilityCheckbox = control.querySelector('[data-mode="variability"]');
        const heartRateCheckbox = control.querySelector('[data-mode="heart-rate"]');
        if (controlContainer && controlContainer !== container) {
            enabled = false;
            heartRateEnabled = false;
        }
        controlContainer = container;
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

    function findRateHits(operator) {
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
            if (operator === '<=' ? rate <= CONFIG.threshold : rate >= CONFIG.threshold) hits.add(thumbnail);
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

    function findHeartRateHits(thresholdBpm, operator) {
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
            if (heartRateBpm !== null && (operator === '<=' ? heartRateBpm <= thresholdBpm : heartRateBpm >= thresholdBpm)) {
                hits.add(thumbnail);
            }
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

    const PLAYER_CONTROL_ID = 'rooticare-morphology-quick-editor';
    let playerDialog = null;
    let playerTimer = null;
    let playerRunning = false;
    let playerPending = null;
    let playerLoadingSince = 0;
    let playerPriming = null;
    let playerChanged = 0;
    let playerSkipped = 0;

    let playerLiveText = '';
    let playerStatusMessage = '檢視中';
    let playerViewObserver = null;
    let playerViewTimer = null;
    let playerViewedSignature = '';
    let playerStatusUpdatedAt = 0;
    let playerCountsUpdatedAt = 0;

    function playerStatus(message, live = false) {
        playerStatusMessage = message;
        const now = Date.now();
        // 計數靠左、數字等寬；即時項目靠右，每秒最多更新四次，不影響處理速度。
        if (!live || now - playerCountsUpdatedAt >= 100) {
            for (const [role, value] of [['changed-count', playerChanged], ['skipped-count', playerSkipped]]) {
                const count = document.querySelector(`#${PLAYER_CONTROL_ID} [data-role="${role}"]`);
                if (count && count.textContent !== String(value)) count.textContent = String(value);
            }
            playerCountsUpdatedAt = now;
        }
        if (live && now - playerStatusUpdatedAt < 250) return;
        const text = playerLiveText ? `${playerLiveText} · ${message}` : message;
        const status = document.querySelector(`#${PLAYER_CONTROL_ID} [data-role="status"]`);
        if (status && status.textContent !== text) {
            status.textContent = text;
            status.title = text;
        }
        playerStatusUpdatedAt = now;
    }

    function pausePlayer(message = '已暫停') {
        playerRunning = false;
        clearTimeout(playerTimer);
        playerTimer = null;
        playerPending = null;
        playerPriming = null;
        playerLoadingSince = 0;
        const button = document.querySelector(`#${PLAYER_CONTROL_ID} [data-role="play"]`);
        if (button) {
            button.textContent = '▶ 播放';
            button.dataset.running = 'false';
        }
        playerStatus(message);
    }

    function readPlayerSettings() {
        const panel = document.getElementById(PLAYER_CONTROL_ID);
        if (!panel) return null;
        const field = role => panel.querySelector(`[data-role="${role}"]`);
        return {
            variability: field('variability').checked,
            variabilityOperator: field('variability-operator').value,
            heartRate: field('heart-rate').checked,
            heartRateOperator: field('heart-rate-operator').value,
            bpm: Number(field('bpm').value),
            combination: field('combination').value,
            label: field('label').value,
            interval: [10, 20, 40, 100].includes(Number(field('speed')?.value)) ? Number(field('speed').value) : 10,
        };
    }

    function validPlayerSettings(settings) {
        if (!settings || (!settings.variability && !settings.heartRate)) {
            playerStatus('請至少勾選一項篩選條件');
            return false;
        }
        if (settings.heartRate && (!Number.isFinite(settings.bpm) || settings.bpm <= 0)) {
            playerStatus('請輸入大於 0 的 BPM 門檻');
            return false;
        }
        return ['V', 'S', 'N', 'A'].includes(settings.label);
    }

    function readPlayerPosition(dialog) {
        const text = dialog.querySelector('.state-panel span')?.textContent;
        const match = text?.match(/(\d+)\s*\/\s*(\d+)/);
        if (!match || Number(match[1]) < 1 || Number(match[2]) < Number(match[1])) return null;
        const wave = dialog.querySelector('.wave-frame > .wave');
        const timestamp = wave?.querySelector('span')?.textContent.trim();
        // 排列第一列就是 progress 指向的項目，後四列僅供預覽。
        if (!wave || !timestamp) return null;
        return { wave, index: Number(match[1]), total: Number(match[2]), signature: `${match[1]}:${timestamp}` };
    }

    function readPlayerMetrics(wave) {
        const marker = wave.querySelector('svg.ecgRMarker');
        const width = Number(marker?.getAttribute('width'));
        const duration = Number(marker?.getAttribute('seg-sec'));
        if (!(width > 0 && duration > 0)) return null;
        const beats = [...marker.querySelectorAll('.annoGroup .annoText')].map(text => {
            // 原站 x = 心搏位置 - parseInt(文字寬度)/2；還原時間座標。
            const rawX = text.getAttribute('x');
            const x = rawX === null ? NaN : Number(rawX) + Math.trunc(text.getComputedTextLength()) / 2;
            return { x, normal: text.getAttribute('typeIdx') === '0', classification: ['N', 'S', 'V', 'A'][Number(text.getAttribute('typeIdx'))] || '—' };
        }).filter(beat => Number.isFinite(beat.x)).sort((a, b) => a.x - b.x);
        // 原站每筆以 absoluteIndex 前後各 5 秒取樣，目標在 10 秒波形正中央。
        // 找不到唯一中央標記時拒絕修改，避免把附近其他 V/S 當成目標。
        const central = beats.map((beat, index) => ({ beat, index }))
            .filter(({ beat }) => Math.abs(beat.x - width / 2) < 1);
        if (central.length !== 1) return null;
        const index = central[0].index;
        const current = beats[index];
        const previous = beats[index - 1];
        const beforePrevious = beats[index - 2];
        const interval = previous ? current.x - previous.x : 0;
        const previousInterval = beforePrevious ? previous.x - beforePrevious.x : 0;
        return {
            classification: current.classification,
            // 縮圖非目前心搏的黑點不等於 N；相鄰 V/S/A 也應以實際間距計算。
            displayBpm: interval > 0 ? Math.round(60 * width / (interval * duration)) : null,
            displayRate: interval > 0 && previousInterval > 0 ? (previousInterval - interval) / interval : null,
            bpm: interval > 0 ? Math.round(60 * width / (interval * duration)) : null,
            rate: interval > 0 && previousInterval > 0
                ? (previousInterval - interval) / interval : null,
        };
    }

    function readVerifiedPlayerItem(dialog, position) {
        // 自動修改只接受播放器原始資料，不能將重畫中的 SVG 當成新項目。
        const angular = window.angular;
        if (!angular?.element || !position) return null;
        const scope = angular.element(position.wave).scope?.();
        const player = scope?.morphologyPlayer;
        const progress = Number(player?.progress);
        const value = Number(player?.progressBar?.value);
        const item = player?.ecgWaveDatas?.[progress];
        if (!Number.isInteger(progress) || progress !== position.index - 1 || value !== position.index
            || !item || scope.ecgWaveData !== item || !(item.ecgData?.length > 0)) return null;
        const target = Number(item.absoluteIndex);
        const sampleRate = Number(item.posInfo?.sampleRate || player.sampleRate);
        if (!Number.isFinite(target) || !(sampleRate > 0) || !Array.isArray(item.annoData)) return null;
        const beats = item.annoData.slice().sort((a, b) => Number(a.index) - Number(b.index));
        if (beats.some((beat, i) => !Number.isFinite(Number(beat.index))
            || !['N', 'A', 'V', 'X'].includes(beat.type)
            || (i > 0 && Number(beat.index) <= Number(beats[i - 1].index)))) return null;
        const index = beats.findIndex(beat => Number(beat.index) === target);
        if (index < 0) return null;
        const previous = beats[index - 1];
        const beforePrevious = beats[index - 2];
        const interval = previous ? target - Number(previous.index) : 0;
        const precedingInterval = beforePrevious ? Number(previous.index) - Number(beforePrevious.index) : 0;
        const bpm = interval > 0 ? Math.round(60 * sampleRate / interval) : null;
        const rate = interval > 0 && precedingInterval > 0 ? (precedingInterval - interval) / interval : null;
        return { player, item, progress, target, metrics: {
            classification: ({ N: 'N', A: 'S', V: 'V', X: 'A' })[beats[index].type],
            displayBpm: bpm, displayRate: rate,
            // 黑點表示非目前目標，不代表 N；不能因前一搏為 V/S/A 而排除。
            bpm, rate,
        } };
    }

    function playerMatches(metrics, settings) {
        const compare = (value, threshold, operator) => value !== null
            && (operator === '<=' ? value <= threshold : value >= threshold);
        const rateHit = settings.variability && compare(metrics.rate, CONFIG.threshold, settings.variabilityOperator);
        const bpmHit = settings.heartRate && compare(metrics.bpm, settings.bpm, settings.heartRateOperator);
        if (settings.variability && settings.heartRate) return settings.combination === 'OR' ? rateHit || bpmHit : rateHit && bpmHit;
        return settings.variability ? rateHit : bpmHit;
    }

    function pauseNativePlayer(dialog) {
        const toggle = dialog.querySelector('[ng-click="togglePlay()"]');
        if (toggle?.classList.contains('glyphicon-pause')) toggle.click();
    }

    function sendPlayerClassification(label) {
        // 使用原站 document keydown：其分類流程會更新 modified 集合並自行前進。
        const key = { V: '1', S: '2', N: '3', A: '4' }[label];
        if (!key) return;
        const code = key.charCodeAt(0);
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key, code: `Digit${key}`, keyCode: code, which: code, bubbles: true, cancelable: true,
        }));
    }

    function playerStep(single = false) {
        try {
            runPlayerStep(single);
        } catch (error) {
            console.warn('[RootiCare 快速修改器]', error);
            pausePlayer('已暫停：播放器資料暫時無法讀取，請重新播放');
        }
    }

    function runPlayerStep(single = false) {
        const dialog = playerDialog;
        if (!dialog?.isConnected || document.querySelector('.ngdialog.confirm-dialog') || document.hidden) {
            pausePlayer('已暫停：播放器關閉、確認視窗開啟或頁面隱藏');
            return;
        }
        const settings = readPlayerSettings();
        if (!validPlayerSettings(settings)) { pausePlayer('已暫停：請檢查篩選設定'); return; }
        pauseNativePlayer(dialog);
        const position = readPlayerPosition(dialog);
        // 原站初始 value=0，但顯示 1/總數；分類或 Next 只會將它加到 1，
        // progress 仍是 0。先透過原生 range 的 ng-change 同步為 1，不更改分類。
        const range = dialog.querySelector('input[type="range"][ng-model="morphologyPlayer.progressBar.value"]');
        if (range && Number(range.value) === 0 && position?.index === 1) {
            if (!playerPriming) {
                playerPriming = { time: Date.now() };
                range.value = '1';
                range.dispatchEvent(new Event('input', { bubbles: true }));
                range.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (Date.now() - playerPriming.time > 2000) {
                pausePlayer('已暫停：起始進度未同步，請手動移動播放器進度後再試');
                return;
            }
            playerStatus('正在同步起始進度…');
            playerTimer = setTimeout(() => playerStep(single), 50);
            return;
        }
        playerPriming = null;
        if (playerPending) {
            if (position && position.signature !== playerPending.signature) {
                if (position.index !== playerPending.index + 1) { pausePlayer('已暫停：項目位置被改變'); return; }
                playerPending = null;
            } else {
                if (Date.now() - playerPending.time > 3000) { pausePlayer('已暫停：網站未前進，請檢查本筆'); return; }
                playerStatus('等待下一筆…', true);
                playerTimer = setTimeout(playerStep, 50);
                return;
            }
        }
        const verified = readVerifiedPlayerItem(dialog, position);
        const metrics = verified?.metrics;
        if (!metrics) {
            if (single) { playerStatus('本筆資料尚未就緒或無法定位中央心搏'); return; }
            if (!playerLoadingSince) playerLoadingSince = Date.now();
            if (Date.now() - playerLoadingSince > 15000) { pausePlayer('已暫停：無法確認目前項目的原始資料，未跳過本筆'); return; }
            playerLiveText = position ? `${position.index}/${position.total} · BPM — · 變動率 —` : '';
            playerStatus('等待項目資料同步…', true);
            playerTimer = setTimeout(playerStep, settings.interval);
            return;
        }
        playerLoadingSince = 0;
        const hit = playerMatches(metrics, settings);
        if (single && !hit) { playerStatus('本筆不符合條件，未修改'); return; }
        const next = dialog.querySelector('[ng-click="progressAdjustment(1)"]');
        if (!hit && position.index < position.total && (!next || next.classList.contains('disabled'))) {
            pausePlayer('已暫停：無法前進到下一筆'); return;
        }
        playerPending = { signature: position.signature, index: position.index, time: Date.now() };
        if (hit) sendPlayerClassification(settings.label);
        else if (position.index < position.total) next.click();
        // 原站 keydown/ng-click 會在本次 Angular $apply 內完成變更。
        // 未收到正確分類/進度確認就停下，不能當成成功或重發修改。
        const expectedProgress = position.index < position.total ? verified.progress + 1 : verified.progress;
        const classificationConfirmed = !hit || verified.item.modified === settings.label
            || (verified.player.originLabel === settings.label && verified.item.modified == null);
        if (Number(verified.player.progress) !== expectedProgress || !classificationConfirmed) {
            pausePlayer('已暫停：網站未確認分類或前進，請檢查目前項目');
            return;
        }
        if (hit) playerChanged++;
        else playerSkipped++;
        const bpmText = metrics.displayBpm === null ? '—' : String(metrics.displayBpm);
        const rateText = metrics.displayRate === null ? '—' : `${(metrics.displayRate * 100).toFixed(1)}%`;
        playerViewedSignature = position.signature;
        playerLiveText = `${position.index}/${position.total} · ${metrics.classification}${hit ? `→${settings.label}` : ''} · BPM ${bpmText} · 變動率 ${rateText}`;
        playerStatus(hit ? '修改' : '跳過', true);
        if (position.index === position.total) {
            pausePlayer('完成 · 請檢查後 Save');
        } else if (single) {
            // 單筆不啟動自動循環。
            playerPending = null;
        } else {
            // 使用所選的 10/20/40/100ms 間隔；網站尚未前進時由 pending 檢查等待。
            playerTimer = setTimeout(playerStep, settings.interval);
        }
    }

    function refreshPlayerView() {
        if (playerRunning || !playerDialog?.isConnected) return;
        try {
            const position = readPlayerPosition(playerDialog);
            const metrics = position && readPlayerMetrics(position.wave);
            if (position && playerViewedSignature && position.signature !== playerViewedSignature) {
                playerStatusMessage = '檢視中';
            }
            playerViewedSignature = position?.signature || '';
            const bpm = metrics?.displayBpm == null ? '—' : String(metrics.displayBpm);
            const rate = metrics?.displayRate == null ? '—' : `${(metrics.displayRate * 100).toFixed(1)}%`;
            playerLiveText = `${position ? `${position.index}/${position.total}` : '—'} · ${metrics?.classification || '—'} · BPM ${bpm} · 變動率 ${rate}`;
            playerStatus(metrics ? playerStatusMessage : '等待 ECG 載入…');
        } catch (error) {
            playerLiveText = 'BPM — · 變動率 —';
            playerStatus('等待播放器畫面更新…');
        }
    }

    function schedulePlayerView() {
        if (playerRunning || playerViewTimer !== null) return;
        // 等待原站本次 DOM 重畫完成；手動操作不套用播放的 250ms 顯示節流。
        playerViewTimer = setTimeout(() => {
            playerViewTimer = null;
            refreshPlayerView();
        }, 30);
    }

    function watchPlayerView(dialog) {
        playerViewObserver?.disconnect();
        playerViewObserver = new MutationObserver(records => {
            if (playerRunning) return;
            const changed = records.some(record => {
                const target = record.target instanceof Element ? record.target : record.target.parentElement;
                return !target?.closest(`#${PLAYER_CONTROL_ID}`);
            });
            if (changed) schedulePlayerView();
        });
        playerViewObserver.observe(dialog, {
            subtree: true, childList: true, characterData: true, attributes: true,
            attributeFilter: ['x', 'typeIdx', 'width', 'seg-sec', 'class', 'style'],
        });
        dialog.addEventListener('input', schedulePlayerView);
        dialog.addEventListener('change', schedulePlayerView);
        refreshPlayerView();
    }

    function ensurePlayerControl() {
        const dialog = document.querySelector('.player-dialog .morphology-player-dialog');
        if (dialog !== playerDialog) {
            playerViewObserver?.disconnect();
            playerViewObserver = null;
            clearTimeout(playerViewTimer);
            playerViewTimer = null;
            playerViewedSignature = '';
            playerStatusMessage = '檢視中';
            pausePlayer();
            playerDialog = dialog;
            playerChanged = 0;
            playerSkipped = 0;
            playerLiveText = '';
            playerStatusMessage = '檢視中';
            playerStatusUpdatedAt = 0;
            playerCountsUpdatedAt = 0;
            playerLoadingSince = 0;
        }
        if (!dialog || dialog.querySelector(`#${PLAYER_CONTROL_ID}`)) return;
        const panel = document.createElement('div');
        panel.id = PLAYER_CONTROL_ID;
        panel.innerHTML = `
            <div class="qe-toolbar"><div class="qe-row">
                <span class="qe-caption">篩選</span>
                <div class="qe-condition">
                    <label><input type="checkbox" data-role="variability"> ECG 變動率</label>
                    <select data-role="variability-operator" aria-label="播放器變動率比較方式"><option value=">=">≥</option><option value="<=">≤</option></select><span class="qe-unit">12%</span>
                </div>
                <select data-role="combination" aria-label="播放器條件組合"><option>AND</option><option>OR</option></select>
                <div class="qe-condition">
                    <label><input type="checkbox" data-role="heart-rate"> 紅點心律</label>
                    <select data-role="heart-rate-operator" aria-label="播放器心律比較方式"><option value=">=">≥</option><option value="<=">≤</option></select>
                    <input type="number" data-role="bpm" aria-label="播放器 BPM 門檻" min="1" max="300" step="1" value="100"><span class="qe-unit">BPM</span>
                </div>
            </div>
            <div class="qe-row qe-actions">
                <label><span class="qe-caption">改為</span><select data-role="label" aria-label="目標分類"><option value="V">V</option><option value="S">S</option><option value="N">N</option><option value="A">A</option></select></label>
                <label class="qe-speed"><span class="qe-caption">速度</span><select data-role="speed" aria-label="自動修改速度" title="網站尚未完成切換時會自動等待"><option value="10">10 ms</option><option value="20">20 ms</option><option value="40">40 ms</option><option value="100">100 ms</option></select></label>
                <div class="qe-buttons"><button type="button" data-role="play" data-running="false">▶ 播放</button></div>
            </div>
            </div><div class="qe-footer"><span class="qe-counts"><span>修改 <b data-role="changed-count">0</b></span><span>跳過 <b data-role="skipped-count">0</b></span></span><span data-role="status">待命 · BPM — · 變動率 — · Esc 暫停</span></div>`;
        const source = document.getElementById(CONFIG.controlId);
        if (source) {
            panel.querySelector('[data-role="variability"]').checked = enabled;
            panel.querySelector('[data-role="heart-rate"]').checked = heartRateEnabled;
            for (const [role, id] of [['variability-operator', CONFIG.variabilityOperatorId], ['heart-rate-operator', CONFIG.heartRateOperatorId], ['combination', CONFIG.combinationOperatorId], ['bpm', CONFIG.heartRateInputId]]) {
                const original = document.getElementById(id);
                if (original) panel.querySelector(`[data-role="${role}"]`).value = original.value;
            }
        }
        panel.querySelector('[data-role="heart-rate"]').parentElement.title = '播放器以中央目標心搏計算，對應縮圖紅點';
        // 原站 keydown 在 document；表單操作不得傳入分類/導覽快捷鍵處理器。
        for (const name of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']) {
            panel.addEventListener(name, event => event.stopPropagation());
        }
        panel.addEventListener('change', () => pausePlayer('設定已變更，請重新播放'));
        panel.addEventListener('input', () => pausePlayer('設定已變更，請重新播放'));
        panel.querySelector('[data-role="play"]').addEventListener('click', () => {
            if (playerRunning) { pausePlayer(); refreshPlayerView(); return; }
            if (!validPlayerSettings(readPlayerSettings())) return;
            playerRunning = true;
            playerPending = null;
            playerLoadingSince = 0;
            const button = panel.querySelector('[data-role="play"]');
            button.textContent = 'Ⅱ 暫停';
            button.dataset.running = 'true';
            playerStep();
        });
        dialog.prepend(panel);
        watchPlayerView(dialog);
    }

    function update() {
        ensureControl();
        ensurePlayerControl();
        const thumbnails = document.querySelectorAll('#right-list .ecg-trend');
        thumbnails.forEach(thumb => thumb.classList.remove(
            CONFIG.hitClass,
            CONFIG.reclassifiedClass
        ));
        if (!enabled && !heartRateEnabled) return;

        const thresholdInput = document.getElementById(CONFIG.heartRateInputId);
        const operatorSelect = document.getElementById(CONFIG.heartRateOperatorId);
        const variabilityOperator = document.getElementById(CONFIG.variabilityOperatorId);
        const thresholdBpm = Number(thresholdInput?.value);
        const validHeartRateThreshold = Number.isFinite(thresholdBpm) && thresholdBpm > 0;
        const combinationOperator = document.getElementById(CONFIG.combinationOperatorId);

        // 單項啟用使用該項結果；兩項啟用按 AND 取交集或 OR 取聯集。
        // 無效 BPM 門檻視為該項無命中，OR 仍可顯示變動率命中。
        const currentCategory = getCurrentCategory();
        const variabilityHits = enabled ? findRateHits(variabilityOperator?.value) : new Set();
        const heartRateHits = heartRateEnabled && validHeartRateThreshold
            ? findHeartRateHits(thresholdBpm, operatorSelect?.value)
            : new Set();
        let hits;
        if (enabled && heartRateEnabled) {
            hits = combinationOperator?.value === 'OR'
                ? new Set([...variabilityHits, ...heartRateHits])
                : new Set([...variabilityHits].filter(thumb => heartRateHits.has(thumb)));
        } else {
            hits = enabled ? variabilityHits : heartRateHits;
        }
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
        heartRateEnabled = false;
        update();
        observer = new MutationObserver(records => {
            if (!document.querySelector('.morphology > .container')) {
                enabled = false;
                heartRateEnabled = false;
                controlContainer = null;
            }
            const relevant = records.some(record => {
                if (record.target instanceof Element && record.target.closest(`#${PLAYER_CONTROL_ID}`)) return false;
                if (record.target.parentElement?.closest(`#${PLAYER_CONTROL_ID}`)) return false;
                // 播放器每筆會重畫多個波形；面板仍存在時不重掃背後的縮圖列表。
                const playerTarget = record.target instanceof Element ? record.target : record.target.parentElement;
                if (playerTarget?.closest('.morphology-player-dialog')?.querySelector(`#${PLAYER_CONTROL_ID}`)) return false;
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
        document.addEventListener('keydown', event => {
            if (!playerRunning || !event.isTrusted) return;
            if (event.key === 'Escape') {
                pausePlayer();
                event.preventDefault();
                event.stopImmediatePropagation();
            } else if (!event.target.closest?.(`#${PLAYER_CONTROL_ID}`)) {
                pausePlayer('手動操作，已暫停');
            }
        }, true);
        document.addEventListener('pointerdown', event => {
            if (playerRunning && event.isTrusted && !event.target.closest?.(`#${PLAYER_CONTROL_ID}`)) {
                pausePlayer('手動操作，已暫停');
            }
        }, true);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) pausePlayer('頁面隱藏，已暫停');
        });
        window.addEventListener('resize', scheduleUpdate);
        window.visualViewport?.addEventListener('resize', scheduleUpdate);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
