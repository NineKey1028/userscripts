// ==UserScript==
// @name         RootiCare ECG 變動率縮圖標記器
// @namespace    https://editoreu.rooticare.com/
// @version      1.12.7
// @description  依 ECG 縮圖心搏點間距標記變動率或以可選比較方式標記指定心律的縮圖；所有篩選條件需同時符合與 Morphology Player 快速修改；支援縮圖逐頁批次選取與分類修改；每次載入預設關閉。
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
            .rc-condition-editor, .rc-condition-editor [data-role=conditions] { display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap; }
            .rc-condition-editor .rc-condition { display:inline-flex;align-items:center;gap:4px;white-space:nowrap;padding:3px 5px;border:1px solid #e1e8d9;border-radius:5px;background:#f7f9f4; }
            .rc-condition-editor [hidden] { display:none !important; }
            .rc-condition-editor .rc-unit { color:#7b8574;font-size:11px; }
            #${CONFIG.controlId} .rc-condition-editor button, #rooticare-morphology-quick-editor .rc-condition-editor button { min-width:0;width:25px;height:25px;padding:0;border:1px solid #dce3d6;border-radius:5px;background:#f0f5e9;color:#526a36;font-size:17px; }
            #${CONFIG.controlId} .rc-condition-editor [data-role=condition-remove], #rooticare-morphology-quick-editor .rc-condition-editor [data-role=condition-remove] { width:18px;height:20px;background:transparent;border:0;color:#889180;font-size:16px; }
            #rooticare-morphology-quick-editor .qe-toolbar { flex-wrap:wrap; }
            #rooticare-morphology-quick-editor .qe-footer { grid-template-columns:auto minmax(0,1fr); }
            #rooticare-morphology-quick-editor [data-role=status] { white-space:normal;overflow:visible; }

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
                position: relative; left: auto; bottom: auto; z-index: 1; clear: both;
                display: inline-flex; align-items: center; flex-wrap: wrap; gap: 7px 9px;
                width: max-content; max-width: calc(100% - 28px); margin: 12px 14px 16px; padding: 6px 9px;
                box-sizing: border-box; border: 1px solid #dce3d6; border-radius: 8px;
                background: #fff; color: #374333; box-shadow: 0 3px 14px #24332118;
                font: 12px/1.45 Arial, "Microsoft JhengHei", sans-serif; cursor: default;
            }
            #${CONFIG.controlId} * { box-sizing: border-box; }
            #${CONFIG.controlId} label { display: inline-flex; align-items: center; gap: 4px; margin: 0; padding: 0; font: inherit; color: inherit; white-space: nowrap; cursor: pointer; }
            #${CONFIG.controlId} input[type=checkbox] { appearance: auto; position: static; float: none; width: 12px; height: 12px; min-height: 0; margin: 0; accent-color: #779b3a; cursor: pointer; }
            #${CONFIG.controlId} select, #${CONFIG.controlId} input[type=number] {
                appearance: auto; position: static; float: none; display: inline-block;
                width: auto; height: 23px; min-height: 0; margin: 0; padding: 1px 4px;
                border: 1px solid #dce3d6; border-radius: 4px; background: #fff; color: #374333; font: inherit;
            }
            #${CONFIG.controlId} select { cursor: pointer; }
            #${CONFIG.controlId} input[type=number] { width: 51px; }
            #${CONFIG.controlId} .thumbnail-batch-actions { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 7px; padding-left: 9px; border-left: 1px solid #e7ece2; }
            #${CONFIG.controlId} [data-role=batch-label] { min-width: 43px; font-weight: 600; }
            #${CONFIG.controlId} button {
                appearance: none; position: static; float: none; display: inline-flex; align-items: center; justify-content: center;
                width: auto; min-width: 92px; height: 27px; min-height: 0; margin: 0; padding: 0 10px;
                border: 1px solid #c9d8b7; border-radius: 5px; background: #f0f5e9;
                color: #526a36; box-shadow: none; font: 600 12px/1 Arial, "Microsoft JhengHei", sans-serif;
                white-space: nowrap; cursor: pointer; transition: background .12s, border-color .12s;
            }
            #${CONFIG.controlId} button:hover { background: #e5eed9; border-color: #a7bd8b; }
            #${CONFIG.controlId} button:active { background: #dbe7cb; }
            #${CONFIG.controlId} :is(button,input,select):focus-visible { outline: 2px solid #91ad68; outline-offset: 1px; }
            #${CONFIG.controlId} :disabled { opacity: .45; cursor: default; }
            #${CONFIG.controlId} [data-role=batch-status] { color: #7b8574; font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }

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
        style.textContent += '\n#rooticare-morphology-quick-editor .qe-toolbar { flex-wrap:wrap; }\n#rooticare-morphology-quick-editor [data-role=status] { white-space:normal;overflow:visible; }';
        (document.head || document.documentElement).appendChild(style);
    }

    const conditionEditors = new Set();
    let sharedConditions = [];
    let syncingConditions = false;

    function synchronizeConditions(source) {
        if (syncingConditions) return;
        const settings = readConditions(source.parentElement);
        sharedConditions = settings.conditions.filter(condition => condition.kind !== 'previous')
            .map(condition => ({ ...condition }));
        syncingConditions = true;
        try {
            for (const editor of conditionEditors) {
                if (!editor.isConnected) { conditionEditors.delete(editor); continue; }
                if (editor === source) continue;
                const previous = readConditions(editor.parentElement).conditions.filter(condition => condition.kind === 'previous');
                editor.replaceConditions([...sharedConditions, ...previous]);
                // 通知另一處的既有處理器暫停並重算；同步鎖避免互相回傳。
                editor.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } finally { syncingConditions = false; }
    }

    function createConditionEditor(parent, allowPrevious, initial = []) {
        const editor = document.createElement('span');
        editor.className = 'rc-condition-editor';
        editor.innerHTML = `<span data-role="conditions"></span><button type="button" data-role="condition-add" aria-label="新增條件" title="新增條件">＋</button><select data-role="condition-menu" aria-label="選擇新增條件" hidden><option value="rate:>=">ECG 變動率 ≥</option><option value="rate:<=">ECG 變動率 ≤</option><option value="bpm:>=">紅點心律 ≥</option><option value="bpm:<=">紅點心律 ≤</option>${allowPrevious ? '<option value="previous:=">前一個點 =</option><option value="previous:!=">前一個點 ≠</option>' : ''}</select>`;
        const rows = editor.querySelector('[data-role="conditions"]');
        const menu = editor.querySelector('[data-role="condition-menu"]');
        const notify = () => editor.dispatchEvent(new Event('change', { bubbles: true }));
        const addButton = editor.querySelector('[data-role="condition-add"]');
        const used = (kind, operator, except = null) => [...rows.children].some(row => row !== except
            && row.dataset.kind === kind && row.querySelector('[data-role="condition-operator"]').value === operator);
        function refreshAvailability() {
            for (const option of menu.options) {
                if (!option.value) continue;
                const [kind, operator] = option.value.split(':');
                option.disabled = used(kind, operator);
            }
            for (const row of rows.children) {
                const select = row.querySelector('[data-role="condition-operator"]');
                for (const option of select.options) option.disabled = used(row.dataset.kind, option.value, row);
            }
            addButton.disabled = [...menu.options].filter(option => option.value).every(option => option.disabled);
            if (addButton.disabled) menu.hidden = true;
        }
        function add(condition, announce = true) {
            if (used(condition.kind, condition.operator) || rows.children.length >= (allowPrevious ? 6 : 4)) return;
            const row = document.createElement('span');
            row.className = 'rc-condition';
            row.dataset.kind = condition.kind;
            row.innerHTML = `<button type="button" data-role="condition-remove" aria-label="移除此條件" title="移除此條件">×</button><span>${condition.kind === 'rate' ? 'ECG 變動率' : condition.kind === 'bpm' ? '紅點心律' : '前一個點'}</span><select data-role="condition-operator" aria-label="比較方式">${condition.kind === 'previous' ? '<option value="=">=</option><option value="!=">≠</option>' : '<option value=">=">≥</option><option value="<=">≤</option>'}</select>${condition.kind === 'previous' ? '<select data-role="condition-value" aria-label="前一搏分類"><option>V</option><option>S</option><option>N</option></select>' : `<input type="number" data-role="condition-value" aria-label="${condition.kind === 'rate' ? '變動率百分比' : 'BPM 門檻'}" step="${condition.kind === 'rate' ? '0.1' : '1'}" ${condition.kind === 'bpm' ? 'min="1"' : ''}><span class="rc-unit">${condition.kind === 'rate' ? '%' : 'BPM'}</span>`}`;
            row.querySelector('[data-role="condition-operator"]').value = condition.operator;
            row.querySelector('[data-role="condition-value"]').value = String(condition.value);
            row.querySelector('[data-role="condition-remove"]').addEventListener('click', () => {
                row.remove(); refreshAvailability(); notify();
            });
            const operatorSelect = row.querySelector('[data-role="condition-operator"]');
            let previousOperator = condition.operator;
            operatorSelect.addEventListener('change', () => {
                if (used(condition.kind, operatorSelect.value, row)) operatorSelect.value = previousOperator;
                else previousOperator = operatorSelect.value;
                refreshAvailability();
            });
            rows.appendChild(row);
            refreshAvailability();
            if (announce) notify();
        }
        function collapseConditionMenu() {
            menu.hidden = true;
            addButton.hidden = false;
            menu.selectedIndex = -1;
        }
        addButton.addEventListener('click', () => {
            refreshAvailability();
            if (addButton.disabled) return;
            addButton.hidden = true;
            menu.hidden = false;
            menu.selectedIndex = -1;
            menu.focus();
            // 在使用者點擊的同一事件中直接開啟原生下拉選單。
            try { menu.showPicker?.(); } catch (_) { /* 不支援時仍可用鍵盤或點擊選單。 */ }
        });
        menu.addEventListener('blur', collapseConditionMenu);
        menu.addEventListener('change', () => {
            if (!menu.value) return;
            const [kind, operator] = menu.value.split(':');
            add({kind, operator, value: kind === 'rate' ? 12 : kind === 'bpm' ? 100 : 'N'});
            collapseConditionMenu();
        });
        editor.replaceConditions = conditions => {
            rows.replaceChildren();
            conditions.forEach(condition => add({ ...condition }, false));
            refreshAvailability();
            collapseConditionMenu();
        };
        [...sharedConditions, ...initial.filter(condition => condition.kind === 'previous')]
            .forEach(condition => add({ ...condition }, false));
        refreshAvailability();
        menu.selectedIndex = -1;
        editor.appendChild(rows);
        parent.appendChild(editor);
        conditionEditors.add(editor);
        editor.addEventListener('input', () => synchronizeConditions(editor));
        editor.addEventListener('change', () => synchronizeConditions(editor));
        return editor;
    }

    function readConditions(parent) {
        const editor = parent?.querySelector('.rc-condition-editor');
        return {
            conditions: [...(editor?.querySelectorAll('.rc-condition') || [])].map(row => ({
                kind: row.dataset.kind,
                operator: row.querySelector('[data-role="condition-operator"]').value,
                value: row.dataset.kind === 'previous' ? row.querySelector('[data-role="condition-value"]').value
                    : Number(row.querySelector('[data-role="condition-value"]').value || NaN),
            })),
        };
    }

    function validConditions(settings) {
        return settings?.conditions?.length > 0 && settings.conditions.every(condition =>
            condition.kind === 'previous' ? ['V', 'S', 'N'].includes(condition.value) && ['=', '!='].includes(condition.operator)
                : ['rate', 'bpm'].includes(condition.kind) && ['>=', '<='].includes(condition.operator)
                    && Number.isFinite(condition.value) && (condition.kind !== 'bpm' || condition.value > 0));
    }

    function conditionMatches(metrics, condition) {
        if (condition.kind === 'previous') {
            // 不存在前一搏時，不讓 ≠ 誤判成命中。
            if (!metrics.previousClassification || metrics.previousClassification === '—') return false;
            return condition.operator === '!=' ? metrics.previousClassification !== condition.value
                : metrics.previousClassification === condition.value;
        }
        const value = condition.kind === 'rate' ? metrics.rate : metrics.bpm;
        if (value == null || !Number.isFinite(value)) return false;
        const threshold = condition.kind === 'rate' ? condition.value / 100 : condition.value;
        return condition.operator === '<=' ? value <= threshold : value >= threshold;
    }

    function playerMetricText(metrics) {
        const rr = value => value == null ? '—' : `${Math.round(value)} ms`;
        return `前一搏 ${metrics.previousClassification || '—'} · RR ${rr(metrics.previousRrMs)} → ${rr(metrics.rrMs)}`;
    }


    function ensureControl() {
        const container = document.querySelector('.morphology > .container');
        if (!container) return;
        let control = document.getElementById(CONFIG.controlId);
        if (controlContainer && controlContainer !== container) {
            pauseThumbnails('頁面已變更'); control?.remove(); control = null;
        }
        if (!control) {
            control = document.createElement('div'); control.id = CONFIG.controlId;
            createConditionEditor(control, false);
            installThumbnailBatchControl(control);
            control.addEventListener('change', scheduleUpdate);
            control.addEventListener('input', scheduleUpdate);
        }
        controlContainer = container;
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

    function findRateHits(operator, threshold = CONFIG.threshold) {
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
            if (operator === '<=' ? rate <= threshold : rate >= threshold) hits.add(thumbnail);
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
    // 僅保留於目前頁面的腳本執行期；關閉播放器不重設，重新載入網頁才回到 V。
    let playerTargetLabel = 'V';
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
        return { ...readConditions(panel), label: field('label').value,
            interval: [10, 20, 40, 100].includes(Number(field('speed')?.value)) ? Number(field('speed').value) : 10 };
    }

    function validPlayerSettings(settings) {
        if (!validConditions(settings)) { playerStatus('請新增至少一項條件並輸入有效數值'); return false; }
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
            previousClassification: previous?.classification || null,
            rrMs: interval > 0 ? interval * duration / width * 1000 : null,
            previousRrMs: previousInterval > 0 ? previousInterval * duration / width * 1000 : null,
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
            previousClassification: previous ? ({ N: 'N', A: 'S', V: 'V', X: 'A' })[previous.type] : null,
            rrMs: interval > 0 ? interval / sampleRate * 1000 : null,
            previousRrMs: precedingInterval > 0 ? precedingInterval / sampleRate * 1000 : null,
            displayBpm: bpm, displayRate: rate,
            // 黑點表示非目前目標，不代表 N；不能因前一搏為 V/S/A 而排除。
            bpm, rate,
        } };
    }

    function playerMatches(metrics, settings) {
        if (!validConditions(settings)) return false;
        return settings.conditions.every(condition => conditionMatches(metrics, condition));
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
        playerLiveText = `${position.index}/${position.total} · ${metrics.classification}${hit ? `→${settings.label}` : ''} · BPM ${bpmText} · 變動率 ${rateText} · ${playerMetricText(metrics)}`;
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
            playerLiveText = `${position ? `${position.index}/${position.total}` : '—'} · ${metrics?.classification || '—'} · BPM ${bpm} · 變動率 ${rate} · ${metrics ? playerMetricText(metrics) : '前一搏 — · RR —'}`;
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
                <span data-role="player-conditions"></span>
            </div>
            <div class="qe-row qe-actions">
                <label><span class="qe-caption">改為</span><select data-role="label" aria-label="目標分類"><option value="V">V</option><option value="S">S</option><option value="N">N</option><option value="A">A</option></select></label>
                <label class="qe-speed"><span class="qe-caption">速度</span><select data-role="speed" aria-label="自動修改速度" title="網站尚未完成切換時會自動等待"><option value="10">10 ms</option><option value="20">20 ms</option><option value="40">40 ms</option><option value="100">100 ms</option></select></label>
                <div class="qe-buttons"><button type="button" data-role="play" data-running="false">▶ 播放</button></div>
            </div>
            </div><div class="qe-footer"><span class="qe-counts"><span>修改 <b data-role="changed-count">0</b></span><span>跳過 <b data-role="skipped-count">0</b></span></span><span data-role="status">待命 · BPM — · 變動率 — · Esc 暫停</span></div>`;
        const sourceSettings = readConditions(document.getElementById(CONFIG.controlId));
        const editor = createConditionEditor(panel.querySelector('[data-role="player-conditions"]'), true, sourceSettings.conditions);
        // 原站 keydown 在 document；表單操作不得傳入分類/導覽快捷鍵處理器。
        for (const name of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']) {
            panel.addEventListener(name, event => event.stopPropagation());
        }
        const targetLabel = panel.querySelector('[data-role="label"]');
        targetLabel.value = playerTargetLabel;
        targetLabel.addEventListener('change', () => {
            if (['V', 'S', 'N', 'A'].includes(targetLabel.value)) playerTargetLabel = targetLabel.value;
        });
        panel.addEventListener('change', () => pausePlayer('設定已變更，請重新播放'));
        panel.addEventListener('input', () => pausePlayer('設定已變更，請重新播放'));
        panel.querySelector('[data-role="play"]').addEventListener('click', () => {
            if (playerRunning) { pausePlayer(); refreshPlayerView(); return; }
            if (!validPlayerSettings(readPlayerSettings())) return;
            if (thumbnailRun) pauseThumbnails('播放器已啟動，縮圖批次已暫停');
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

    // 縮圖批次修改：每次只操作已核對原始資料的目前頁，沿用網站選取與分類流程。
    let thumbnailRun = null;
    let thumbnailTimer = null;
    let thumbnailEpoch = 0;
    let thumbnailChanged = 0;
    let thumbnailPages = 0;

    function thumbnailStatus(message) {
        const status = document.querySelector(`#${CONFIG.controlId} [data-role="batch-status"]`);
        if (status) status.textContent = `修改 ${thumbnailChanged} · 頁 ${thumbnailPages} · ${message}`;
    }

    function pauseThumbnails(message = '已暫停') {
        thumbnailRun = null;
        thumbnailEpoch++;
        clearTimeout(thumbnailTimer);
        thumbnailTimer = null;
        const button = document.querySelector(`#${CONFIG.controlId} [data-role="batch-play"]`);
        if (button) button.textContent = '▶ 批次修改';
        thumbnailStatus(message);
    }

    function readThumbnailSettings() {
        return { ...readConditions(document.getElementById(CONFIG.controlId)),
            label: document.querySelector(`#${CONFIG.controlId} [data-role="batch-label"]`)?.value,
            interval: [10, 20, 40, 100].includes(Number(document.querySelector(`#${CONFIG.controlId} [data-role="batch-speed"]`)?.value))
                ? Number(document.querySelector(`#${CONFIG.controlId} [data-role="batch-speed"]`)?.value) : 10 };
    }

    function thumbnailScope() {
        return window.angular?.element(document.querySelector('.morphology > .container')).scope?.();
    }

    function readThumbnailPage(scope) {
        const model = scope?.morphology;
        const page = Number(model?.pagination?.currentPage);
        const total = Number(model?.pagination?.pageCount);
        const size = Number(model?.pagination?.itemsPerPage);
        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(total) || total < page
            || !Number.isInteger(size) || size < 1) return null;
        const segments = model.state.currentSegments;
        const thumbs = [...document.querySelectorAll('#right-list .ecg-trend')];
        if (!Array.isArray(segments) || !segments.length || thumbs.length !== segments.length
            || Object.values(model.loading || {}).some(Boolean)) return null;
        const chart = model.ecgEnlargedChart;
        const offset = (page - 1) * size;
        const entries = [];
        for (let i = 0; i < thumbs.length; i++) {
            const wave = thumbs[i].querySelector('.ecgWave');
            const bound = window.angular.element(wave).isolateScope?.();
            const segmentScope = window.angular.element(thumbs[i]).scope?.();
            const segment = segments[i];
            const data = chart.ecgData[offset + i];
            const info = chart.information?.posInfo?.[offset + i];
            // 翻頁先更換 segment、稍後才重畫；所有繫結一致後才允許判斷。
            if (!data || !info || !Number.isFinite(Number(segment.absoluteIndex))
                || Number(info.absoluteIndex) !== Number(segment.absoluteIndex)
                || segmentScope?.segment !== segment
                || !chart.waveformData[i]?.length
                // Morphology 縮圖的 labels 是以絕對取樣索引為鍵的物件；播放器才使用陣列。
                || !chart.annoData[i] || typeof chart.annoData[i] !== 'object'
                || (!Array.isArray(chart.annoData[i])
                    && !Object.prototype.hasOwnProperty.call(chart.annoData[i], segment.absoluteIndex))
                || bound?.ecgData !== chart.waveformData[i] || bound?.annoData !== chart.annoData[i]
                || bound?.posInfo !== info || !wave.querySelector('circle.anno-dot.current')) return null;
            entries.push({ thumb: thumbs[i], segment, data, index: offset + i });
        }
        return { page, total, entries, signature: `${page}:${segments.map(s => s.absoluteIndex).join(',')}` };
    }

    function thumbnailHits(settings) {
        if (!validConditions(settings)) return new Set();
        const sets = settings.conditions.map(condition => condition.kind === 'rate'
            ? findRateHits(condition.operator, condition.value / 100)
            : findHeartRateHits(condition.value, condition.operator));
        return new Set([...sets[0]].filter(thumb => sets.every(set => set.has(thumb))));
    }

    function selectThumbnailBatch(scope, page, targets) {
        const desired = new Set(targets.map(entry => entry.segment));
        // 原站以 document 的按鍵狀態決定是否多選，單純 click.ctrlKey 不足以累加選取。
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17, ctrlKey: true, bubbles: true,
        }));
        try {
            scope.$apply(() => {
                scope.focusRight();
                // 包含其他頁的既有選取，避免分類按鈕順帶修改非命中項目。
                for (const segment of scope.morphology.state.selectedSegments.slice()) {
                    const index = scope.morphology.ecgEnlargedChart.information.posInfo
                        .findIndex(info => Number(info.absoluteIndex) === Number(segment.absoluteIndex));
                    if (index < 0) throw new Error('無法定位既有選取');
                    scope.selectEcg(segment, index);
                }
                for (const entry of targets) scope.selectEcg(entry.segment, entry.index);
            });
        } finally {
            document.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17, bubbles: true,
            }));
        }
        const selected = scope.morphology.state.selectedSegments;
        if (scope.morphology.state.focus !== 'right' || selected.length !== desired.size
            || selected.some(segment => !desired.has(segment))
            || page.entries.some(entry => Boolean(entry.data.selected) !== desired.has(entry.segment))) {
            throw new Error('網站未確認正確選取');
        }
    }

    function scheduleThumbnailStep(epoch) {
        thumbnailTimer = setTimeout(() => thumbnailStep(epoch), thumbnailRun?.settings.interval || 10);
    }

    function thumbnailStep(epoch) {
        if (!thumbnailRun || epoch !== thumbnailEpoch) return;
        try {
            const run = thumbnailRun;
            if (document.hidden || document.querySelector('.ngdialog')
                || !document.getElementById(CONFIG.controlId)?.isConnected) {
                pauseThumbnails('視窗開啟、頁面隱藏或離開 Morphology，已暫停'); return;
            }
            const scope = thumbnailScope();
            const model = scope?.morphology;
            if (!model || model !== run.model || model.state.label !== run.category
                || model.state.type !== run.type || model.state.multipleTypesSelected
                || model.state.classificationMode || model.compareMode?.selectMode) {
                pauseThumbnails('分類、type 或選取模式變更，已暫停'); return;
            }
            if (Number(model.pagination.currentPage) !== run.expectedPage) {
                pauseThumbnails('頁碼被改變，已暫停'); return;
            }
            const page = readThumbnailPage(scope);
            if (!page) {
                if (Date.now() - run.waitSince > 15000) { pauseThumbnails('資料未同步，未修改本頁'); return; }
                thumbnailStatus('等待縮圖資料同步…'); scheduleThumbnailStep(epoch); return;
            }
            // 至少兩次讀取相同頁面，讓 Angular/D3 完成本次重畫。
            if (run.stableSignature !== page.signature) {
                run.stableSignature = page.signature; scheduleThumbnailStep(epoch); return;
            }
            if (!run.applied) {
                const hits = thumbnailHits(run.settings);
                const targets = page.entries.filter(entry => hits.has(entry.thumb)
                    && (entry.segment.modifiedLabel || entry.segment.label) !== run.settings.label);
                selectThumbnailBatch(scope, page, targets);
                if (targets.length) {
                    const button = document.querySelector(`.right-content [ng-click="changeLabel('right-${run.settings.label}')"]`);
                    if (!button || button.classList.contains('disabled')) throw new Error('找不到可用分類按鈕');
                    button.click();
                    if (targets.some(entry => (entry.segment.modifiedLabel || entry.segment.label) !== run.settings.label)
                        || model.state.selectedSegments.length) throw new Error('網站未確認分類，請檢查目前頁');
                    thumbnailChanged += targets.length;
                }
                thumbnailPages++;
                run.applied = true;
                run.appliedSignature = page.signature;
                thumbnailStatus(`${page.page}/${page.total} · 本頁完成`);
                // 分類造成頁面縮減時停下，避免位移後跳過未處理心搏。
                if (model.state.type !== run.type || model.state.label !== run.category) {
                    pauseThumbnails('目前 type 已結束 · 請檢查後 Save'); return;
                }
                const after = readThumbnailPage(scope);
                if (after && after.signature !== page.signature) {
                    pauseThumbnails('分類後清單位置改變，請檢查後重新播放'); return;
                }
                scheduleThumbnailStep(epoch); return;
            }
            if (page.signature !== run.appliedSignature) {
                pauseThumbnails('分類後清單位置改變，請檢查後重新播放'); return;
            }
            if (page.page >= page.total) { pauseThumbnails('已到最後一頁 · 請檢查後 Save'); return; }
            const next = document.querySelector('.pagination-container [ng-click="selectPage(page + 1, $event)"], .pagination [ng-click="selectPage(page + 1, $event)"]');
            if (!next || next.closest('.disabled') || next.hasAttribute('disabled')) throw new Error('無法翻到下一頁');
            run.expectedPage = page.page + 1;
            run.stableSignature = '';
            run.applied = false;
            run.waitSince = Date.now();
            next.click();
            if (Number(model.pagination.currentPage) !== run.expectedPage) throw new Error('網站未確認翻頁');
            scheduleThumbnailStep(epoch);
        } catch (error) {
            console.warn('[RootiCare 縮圖批次修改]', error);
            pauseThumbnails(`已暫停：${error.message}`);
        }
    }

    function startThumbnails() {
        const settings = readThumbnailSettings();
        const scope = thumbnailScope();
        const model = scope?.morphology;
        if (!validConditions(settings)) { thumbnailStatus('請新增至少一項條件並輸入有效數值'); return; }
        if (!['V', 'S', 'N', 'A'].includes(settings.label) || !model?.state?.type
            || typeof scope.selectEcg !== 'function' || typeof scope.focusRight !== 'function'
            || model.state.multipleTypesSelected || model.state.classificationMode || model.compareMode?.selectMode
            || document.querySelector('.ngdialog')) { thumbnailStatus('請選取單一 type 並關閉其他模式／視窗'); return; }
        if (settings.label === 'N' && model.content?.disableN) { thumbnailStatus('網站目前禁止改為 N'); return; }
        pausePlayer('縮圖批次修改中');
        thumbnailEpoch++;
        thumbnailRun = { model, settings, category: model.state.label, type: model.state.type,
            expectedPage: Number(model.pagination.currentPage), waitSince: Date.now(), stableSignature: '', applied: false };
        document.querySelector(`#${CONFIG.controlId} [data-role="batch-play"]`).textContent = 'Ⅱ 暫停';
        thumbnailStep(thumbnailEpoch);
    }

    function installThumbnailBatchControl(control) {
        const group = document.createElement('span');
        group.className = 'thumbnail-batch-actions';
        group.innerHTML = `<label>改為 <select data-role="batch-label" aria-label="縮圖批次目標分類"><option>V</option><option>S</option><option>N</option><option>A</option></select></label><label>速度 <select data-role="batch-speed" aria-label="縮圖批次修改速度" title="每次檢查／處理的排程間隔，資料未同步時會等待"><option value="10" selected>10 ms</option><option value="20">20 ms</option><option value="40">40 ms</option><option value="100">100 ms</option></select></label><button type="button" data-role="batch-play">▶ 批次修改</button>`;
        control.appendChild(group);
        const status = document.createElement('span');
        status.dataset.role = 'batch-status';
        status.textContent = '待命 · Esc 暫停';
        group.appendChild(status);
        for (const name of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keyup']) {
            control.addEventListener(name, event => event.stopPropagation());
        }
        for (const name of ['change', 'input']) control.addEventListener(name, () => {
            if (thumbnailRun) pauseThumbnails('設定已變更，請重新播放');
        });
        group.querySelector('[data-role="batch-play"]').addEventListener('click', () => {
            if (thumbnailRun) pauseThumbnails(); else startThumbnails();
        });
    }


    function update() {
        ensureControl(); ensurePlayerControl();
        document.querySelectorAll('#right-list .ecg-trend').forEach(thumb => thumb.classList.remove(CONFIG.hitClass, CONFIG.reclassifiedClass));
        const settings = readThumbnailSettings();
        if (!validConditions(settings)) return;
        const category = getCurrentCategory();
        thumbnailHits(settings).forEach(thumb => {
            thumb.classList.add(CONFIG.hitClass);
            const classification = getClassification(thumb);
            if (category && classification && classification !== category) thumb.classList.add(CONFIG.reclassifiedClass);
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
        document.addEventListener('keydown', event => {
            if (!thumbnailRun || !event.isTrusted) return;
            if (event.key === 'Escape') {
                pauseThumbnails();
                event.preventDefault();
                event.stopImmediatePropagation();
            } else if (!event.target.closest?.(`#${CONFIG.controlId}`)) {
                pauseThumbnails('手動操作，已暫停');
            }
        }, true);
        document.addEventListener('pointerdown', event => {
            if (thumbnailRun && event.isTrusted && !event.target.closest?.(`#${CONFIG.controlId}`)) {
                pauseThumbnails('手動操作，已暫停');
            }
        }, true);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && thumbnailRun) pauseThumbnails('頁面隱藏，已暫停');
        });
        window.addEventListener('resize', scheduleUpdate);
        window.visualViewport?.addEventListener('resize', scheduleUpdate);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
