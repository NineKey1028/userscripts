// ==UserScript==
// @name         RootiCare ECG 變動率縮圖標記器
// @namespace    https://editoreu.rooticare.com/
// @version      1.19.2
// @description  依變動率、BPM、彩色波形高度／寬度、波形方向與雜訊判斷（測試版）標記 ECG 縮圖並同步標示 type；支援逐頁批次分類，以及含前一搏分類篩選的 Morphology Player 自動修改。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率縮圖標記器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率縮圖標記器.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

/*
 * ── 使用教學 ────────────────────────────────────────────
 * 在 MP（Morphology）頁面，按清單下方的 ＋ 新增篩選條件。
 * 符合所有條件的縮圖會上色；已移出目前 type 的項目以淡黃色提示。
 *
 * 【篩選條件】（皆可設 ≥ / ≤ 門檻）
 *   變動率      百分比
 *   心律        BPM
 *   高度        mV，以平坦基準線為 0，向下為負
 *   寬度        ms，主峰兩側回到基準線的距離
 *   前一個點    = / ≠ 指定分類（A 視為 S；沒有前一搏時不命中）
 *   波形方向    向上或向下，同時標示左側相符的 type（僅縮圖）
 *   雜訊判斷    = / ≠ 雜訊（測試版，僅縮圖；滑過選取數可看轉折次數）
 *
 * 【批次修改】選擇「改為」分類與速度，按「▶ 批次修改」
 *   縮圖清單          逐頁修改符合條件的項目
 *   Morphology Player  逐搏修改或跳過；前一搏條件與縮圖分開設定
 *   速度 10／20／40／100 ms（網站資料未同步時會等待）
 *   暫停：按暫停鈕或 Esc；變更設定、點擊面板外或切走頁面也會暫停
 *
 * 【快速選印】VEB / SVEB 分頁選取縮圖後按 5
 *   選印該心搏所屬清單（VT、Triplet、Couplet、Bigeminy 等）中的心電圖；
 *   都不屬於時選印 VEB / SVEB 清單；全部已選印時再按 5 取消。
 */

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
        typeHitClass: 'rooticare-ecg-rate-type-direction-hit',
        debounceMs: 180,
    };

    let enabled = false;
    let heartRateEnabled = false;
    let observer;
    let scheduled = false;
    let controlContainer;

    // 將設定的十六進位顏色換算為 RGBA，供縮圖半透明背景使用。
    function hexToRGBA(hex, alpha) {
        const value = hex.replace('#', '');
        const red = parseInt(value.slice(0, 2), 16);
        const green = parseInt(value.slice(2, 4), 16);
        const blue = parseInt(value.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    // 只建立一次縮圖標記與播放器面板樣式；選取中的縮圖交由網站原生樣式顯示。
    function installStyle() {
        if (document.getElementById(`${CONFIG.controlId}-style`)) return;
        const style = document.createElement('style');
        style.id = `${CONFIG.controlId}-style`;
        style.textContent = `
            .rc-condition-editor, .rc-condition-editor [data-role=conditions] { display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap; }
            .rc-condition-editor .rc-condition { display:inline-flex;align-items:center;gap:4px;white-space:nowrap;padding:3px 5px;border:1px solid #e1e8d9;border-radius:5px;background:#f7f9f4; }
            .rc-condition-editor .rc-condition-group { display:inline-flex;flex-direction:column;gap:2px;padding:3px 5px;border:1px solid #e1e8d9;border-radius:5px;background:#f7f9f4; }
            .rc-condition-editor .rc-condition-heading { display:flex;align-items:center;justify-content:flex-start;gap:4px;white-space:nowrap;font-weight:600; }
            .rc-condition-editor .rc-condition-group .rc-condition { padding:0;border:0;background:transparent; }
            .rc-condition-editor .rc-bound-label { display:inline-flex;align-items:center;gap:3px;min-width:24px; }
            #${CONFIG.controlId} .rc-condition-group input[type=number], #rooticare-morphology-quick-editor .rc-condition-group input[type=number] { width:78px;min-width:78px;flex-shrink:0;font-variant-numeric:tabular-nums; }
            .rc-condition-editor [hidden] { display:none !important; }
            .rc-condition-editor .rc-unit { color:#7b8574;font-size:11px; }
            #${CONFIG.controlId} .rc-condition-editor button, #rooticare-morphology-quick-editor .rc-condition-editor button { min-width:0;width:25px;height:25px;padding:0;border:1px solid #dce3d6;border-radius:5px;background:#f0f5e9;color:#526a36;font-size:17px; }
            #${CONFIG.controlId} .rc-condition-editor [data-role=condition-remove], #rooticare-morphology-quick-editor .rc-condition-editor [data-role=condition-remove] { width:18px;height:20px;background:transparent;border:0;color:#889180;font-size:16px; }
            #rooticare-morphology-quick-editor .qe-toolbar { flex-wrap:wrap; }

            /* 移出 type 或跨分類的達標格子提示淡黃；選取色交由網站處理。 */
            #right-list .ecg-trend.${CONFIG.hitClass}:not(:has(.idBackground.selectedBackground)) .idBackground:not(.move-out-color) {
                background-color: ${HIGHLIGHT_COLOR} !important;
                border-radius: 2px;
            }
            /* 左側 type 依波形方向上色，與縮圖命中同色；選取中的 type 仍由網站顯示。 */
            .morphology .type-trend.${CONFIG.typeHitClass}:not(:has(.idBackground.selectedBackground)) .idBackground {
                background-color: ${HIGHLIGHT_COLOR} !important;
            }
            .rc-condition-editor .rc-condition[data-kind=direction] { flex-direction:column;align-items:flex-start;gap:2px; }
            #right-list .ecg-trend.${CONFIG.hitClass}.${CONFIG.reclassifiedClass}:not(:has(.idBackground.selectedBackground)) .idBackground,
            #right-list .ecg-trend.${CONFIG.hitClass}:not(:has(.idBackground.selectedBackground)) .idBackground.move-out-color {
                background-color: ${RECLASSIFIED_HIGHLIGHT_COLOR} !important;
            }
            #${CONFIG.controlId} {
                position: relative; left: auto; bottom: auto; z-index: 1; clear: both;
                display: inline-flex; align-items: stretch; flex-wrap: nowrap; gap: 7px 9px;
                overflow-x:auto;min-width:0;
                width: max-content; max-width: calc(100% - 28px); margin: 12px 14px 16px; padding: 6px 9px;
                box-sizing: border-box; border: 1px solid #dce3d6; border-radius: 8px;
                background: #fff; color: #374333; box-shadow: 0 3px 14px #24332118;
                font: 12px/1.45 Arial, "Microsoft JhengHei", sans-serif; cursor: default;
            }
            #${CONFIG.controlId} * { box-sizing: border-box; }
            #${CONFIG.controlId} > *, #${CONFIG.controlId} .rc-condition-group { flex-shrink:0; }
            #${CONFIG.controlId} .rc-condition-editor,
            #${CONFIG.controlId} .rc-condition-editor [data-role=conditions],
            #${CONFIG.controlId} .thumbnail-batch-actions { flex-wrap:nowrap; }
            #${CONFIG.controlId} .rc-condition-editor [data-role=conditions] { align-self:stretch;align-items:stretch; }
            #${CONFIG.controlId} .rc-condition-group,
            #${CONFIG.controlId} .thumbnail-batch-actions { min-height:78px; }
            #${CONFIG.controlId} label { display: inline-flex; align-items: center; gap: 4px; margin: 0; padding: 0; font: inherit; color: inherit; white-space: nowrap; cursor: pointer; }
            #${CONFIG.controlId} input[type=checkbox] { appearance: auto; position: static; float: none; width: 12px; height: 12px; min-height: 0; margin: 0; accent-color: #779b3a; cursor: pointer; }
            #${CONFIG.controlId} select, #${CONFIG.controlId} input[type=number] {
                appearance: auto; position: static; float: none; display: inline-block;
                width: auto; height: 23px; min-height: 0; margin: 0; padding: 1px 4px;
                border: 1px solid #dce3d6; border-radius: 4px; background: #fff; color: #374333; font: inherit;
            }
            #${CONFIG.controlId} select { cursor: pointer; }
            #${CONFIG.controlId} input[type=number] { width: 51px; }
            #${CONFIG.controlId} .thumbnail-batch-actions { display:inline-grid;grid-template-columns:repeat(3,max-content);grid-template-rows:27px 1fr;align-items:start;gap:4px 7px;padding:3px 0 3px 9px;border-left:1px solid #e7ece2; }
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
            #${CONFIG.controlId} [data-role=batch-single] { grid-column:3;grid-row:1;background:#326b9b;border-color:#2b608d;color:#fff; }
            #${CONFIG.controlId} [data-role=batch-single]:hover { background:#285a84;border-color:#244f74; }
            #${CONFIG.controlId} [data-role=batch-play] { grid-column:3;grid-row:2;background:#7c9f32;border-color:#74972e;color:#fff; }
            #${CONFIG.controlId} [data-role=batch-play]:hover { background:#6c8e27;border-color:#638326; }
            /* 狀態區固定三行、固定欄寬；文字變長只截斷成省略號，不換行也不推動其他元件。 */
            #${CONFIG.controlId} [data-role=batch-status] { grid-column:1 / 3;grid-row:2;display:grid;grid-template-rows:repeat(3,13px);row-gap:1px;width:25em;height:41px;overflow:hidden;color:#64705e;font-size:11px;line-height:13px;font-variant-numeric:tabular-nums; }
            #${CONFIG.controlId} .st-row { display:grid;column-gap:8px;min-width:0; }
            /* BPM 保留三位數範圍「BPM 100～200」所需寬度；計數欄依最多四位數修改、三位數頁碼配置。 */
            #${CONFIG.controlId} .st-row[data-row=summary] { grid-template-columns:5.5em minmax(8em,1fr) 5em 3.5em; }
            #${CONFIG.controlId} .st-row[data-row=shape] { grid-template-columns:minmax(0,1fr) minmax(0,1.15fr); }
            #${CONFIG.controlId} .st-row > span { min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
            #${CONFIG.controlId} [data-slot=message] { white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
            #${CONFIG.controlId} [data-role=batch-status][data-notice=true] [data-slot=message] { color:#b0563a;font-weight:600; }

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
            #rooticare-morphology-quick-editor .qe-buttons { display:inline-flex;flex-direction:column;align-items:stretch;gap:5px;margin-left:auto; }
            #rooticare-morphology-quick-editor [data-role=single] { background:#326b9b;border-color:#2b608d;color:#fff; }
            #rooticare-morphology-quick-editor [data-role=single]:hover { background:#285a84;border-color:#244f74; }
            #rooticare-morphology-quick-editor button { position: static; float: none; width: auto; margin: 0; height: 25px; padding: 0 8px; border: 1px solid #dce2d5; border-radius: 6px; background: #fff; color: #526047; font: 600 12px Arial, "Microsoft JhengHei", sans-serif; cursor: pointer; transition: background .12s, border-color .12s; }
            #rooticare-morphology-quick-editor button:hover { background: #f2f5ed; border-color: #a9bb92; }
            #rooticare-morphology-quick-editor [data-role=play] { min-width: 70px; border-color: #74972e; background: #7c9f32; color: #fff; }
            #rooticare-morphology-quick-editor [data-role=play]:hover { background: #6c8e27; }
            #rooticare-morphology-quick-editor [data-role=play][data-running=true] { background: #526448; border-color: #526448; }
            #rooticare-morphology-quick-editor :is(button,select,input):focus-visible { outline: 2px solid #99b86c; outline-offset: 2px; }
            /* 底列固定單行：計數、量測值各有固定欄寬，訊息佔剩餘空間並以省略號截斷。 */
            #rooticare-morphology-quick-editor .qe-footer { display: grid; grid-template-columns: 6.5em 6.5em 7.5em 8.5em 8.5em minmax(0, 1fr); column-gap: 10px; align-items: center; height: 16px; margin-top: 4px; color: #8b9386; font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums; }
            #rooticare-morphology-quick-editor .qe-footer > span { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #rooticare-morphology-quick-editor .qe-footer b { display: inline-block; min-width: 4ch; text-align: right; font-weight: 600; color: #526047; }
            #rooticare-morphology-quick-editor [data-role=status] { text-align: right; color: #6c785f; }
            #rooticare-morphology-quick-editor [data-role=status][data-notice=true] { color: #b0563a; font-weight: 600; }
            #rooticare-morphology-quick-editor .qe-buttons button { width: 7.5em; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    const conditionEditors = new Set();
    const CONDITION_LABELS = { rate: '心搏變動率', bpm: '心搏速率', height: '心搏高度', width: '心搏寬度' };
    const boundsMessages = { thumbnail: '', player: '' };
    const boundsMessageTimers = { thumbnail: null, player: null };

    function clearBoundsMessage(kind) {
        clearTimeout(boundsMessageTimers[kind]);
        boundsMessageTimers[kind] = null;
        boundsMessages[kind] = '';
        if (kind === 'player') playerStatus(playerStatusMessage);
        else refreshThumbnailStatus();
    }

    function showBoundsMessage(kind, message) {
        clearTimeout(boundsMessageTimers[kind]);
        boundsMessages[kind] = message;
        if (kind === 'player') playerStatus(playerStatusMessage);
        else refreshThumbnailStatus();
        boundsMessageTimers[kind] = setTimeout(() => clearBoundsMessage(kind), 2500);
    }
    const isShapeCondition = condition => ['height', 'width'].includes(condition.kind);
    // 只出現在縮圖清單的條件；不加入播放器，也不參與兩處同步。
    const THUMBNAIL_ONLY_LABELS = { direction: '波形方向', noise: '雜訊判斷(測試版)' };
    // 只屬於單一面板的條件：前一搏分類僅在播放器，波形方向與雜訊判斷僅在縮圖清單。
    const isLocalCondition = condition => ['previous', 'direction', 'noise'].includes(condition.kind);
    let sharedConditions = [];
    let playerPreviousConditions = [];
    let thumbnailLocalConditions = [];
    let syncingConditions = false;

    // 同步縮圖與播放器共用的數值條件；前一搏分類由兩處各自設定，波形方向與雜訊判斷只保留在縮圖清單。
    // 以同步鎖阻止 change 事件互相回傳，並移除已離開 DOM 的編輯器參照。
    function synchronizeConditions(source) {
        if (syncingConditions) return;
        const settings = readConditions(source.parentElement);
        const editorConditions = settings.editorConditions || settings.conditions;
        if (source.dataset?.allowPrevious === 'true') {
            playerPreviousConditions = settings.conditions.filter(condition => condition.kind === 'previous')
                .map(condition => ({ ...condition }));
        } else {
            thumbnailLocalConditions = editorConditions.filter(condition => condition.kind in THUMBNAIL_ONLY_LABELS || condition.kind === 'previous')
                .map(condition => ({ ...condition }));
        }
        sharedConditions = editorConditions.filter(condition => !isLocalCondition(condition))
            .map(condition => ({ ...condition }));
        syncingConditions = true;
        try {
            for (const editor of conditionEditors) {
                if (!editor.isConnected) { conditionEditors.delete(editor); continue; }
                if (editor === source) continue;
                const target = readConditions(editor.parentElement);
                const local = (target.editorConditions || target.conditions).filter(isLocalCondition);
                editor.replaceConditions([...sharedConditions, ...local]);
                // 通知另一處的既有處理器暫停並重算；同步鎖避免互相回傳。
                editor.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } finally { syncingConditions = false; }
    }

    // 每種數值指標用一個容器，內含可獨立啟用的上下限；前一搏分類沿用獨立條件列。
    // allowPrevious 決定是否提供前一搏分類；初值與共用條件以複本保存，避免多處共用同一物件。
    function createConditionEditor(parent, allowPrevious, initial = []) {
        const editor = document.createElement('span');
        editor.className = 'rc-condition-editor';
        editor.dataset.allowPrevious = String(allowPrevious);
        editor.innerHTML = `<span data-role="conditions"></span><button type="button" data-role="condition-add" aria-label="新增條件" title="新增條件">＋</button><select data-role="condition-menu" aria-label="選擇新增條件" hidden>${Object.entries(CONDITION_LABELS).map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('')}<option value="previous">前一個點</option>${allowPrevious ? '' : Object.entries(THUMBNAIL_ONLY_LABELS).map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('')}</select>`;
        const rows = editor.querySelector('[data-role="conditions"]');
        const statusKind = allowPrevious ? 'player' : 'thumbnail';
        const clearBoundsNotice = () => {
            if (!boundsMessages[statusKind]) return;
            clearBoundsMessage(statusKind);
        };
        const menu = editor.querySelector('[data-role="condition-menu"]');
        const notify = () => editor.dispatchEvent(new Event('change', { bubbles: true }));
        const addButton = editor.querySelector('[data-role="condition-add"]');
        const used = (kind, operator, except = null) => [...rows.querySelectorAll('.rc-condition')].some(row => row !== except
            && row.dataset.kind === kind && row.querySelector('[data-role="condition-operator"]').value === operator);
        // 輸入期間只更新原生 min/max，允許負號及多位數正常輸入；
        // 提交或新增條件時修正正在編輯的值，保留另一端的設定。
        function refreshNumericBounds(changedRow = null) {
            const numericRows = [...rows.querySelectorAll('.rc-condition')].filter(row => !isLocalCondition(row.dataset));
            for (const row of numericRows) {
                const input = row.querySelector('[data-role="condition-value"]');
                const operator = row.querySelector('[data-role="condition-operator"]').value;
                const other = numericRows.find(candidate => candidate !== row && candidate.dataset.kind === row.dataset.kind
                    && candidate.querySelector('[data-role="condition-operator"]').value !== operator);
                const otherText = other?.querySelector('[data-role="condition-value"]').value ?? '';
                const otherEnabled = other?.querySelector('[data-role="condition-enabled"]')?.checked;
                const otherValue = otherEnabled && otherText.trim() !== '' ? Number(otherText) : NaN;
                const active = row.querySelector('[data-role="condition-enabled"]').checked;
                input.disabled = !active;
                const baseMin = row.dataset.kind === 'bpm' ? 1 : row.dataset.kind === 'width' ? 0 : -Infinity;
                const min = operator === '<=' && Number.isFinite(otherValue) ? Math.max(baseMin, otherValue) : baseMin;
                const max = operator === '>=' && Number.isFinite(otherValue) ? otherValue : Infinity;
                input.min = Number.isFinite(min) ? String(min) : '';
                input.max = Number.isFinite(max) ? String(max) : '';
                if (active && row === changedRow && input.value.trim() !== '' && Number.isFinite(Number(input.value))) {
                    const before = Number(input.value);
                    const corrected = Math.max(min, Math.min(max, before));
                    input.value = String(corrected);
                    if (corrected !== before) {
                        const label = CONDITION_LABELS[row.dataset.kind];
                        showBoundsMessage(statusKind, `${label}目前篩選不可 ${before > max ? '>' : '<'} ${corrected}`);
                    }
                }
            }
            // 修正一端後再更新另一端的原生限制。
            if (changedRow) refreshNumericBounds();
        }
        // 依已使用的條件組合停用重複選項；所有組合用盡時停用新增按鈕並收起選單。
        function refreshAvailability() {
            for (const option of menu.options) {
                if (!option.value) continue;
                const [kind] = option.value.split(':');
                // 前一個點只有一個選單項目；= 與 ≠ 都已加入時才停用。
                option.disabled = kind === 'previous' ? used(kind, '=') && used(kind, '!=')
                    : Boolean(rows.querySelector(`[data-group-kind="${kind}"]`));
            }
            const previousRows = rows.querySelectorAll('.rc-condition[data-kind="previous"]');
            for (const row of previousRows) {
                const select = row.querySelector('[data-role="condition-operator"]');
                for (const option of select.options) option.disabled = used(row.dataset.kind, option.value, row);
                // 只有一列時由卡片標題的移除鈕整張移除。
                row.querySelector('[data-role="condition-remove"]').hidden = previousRows.length < 2;
            }
            addButton.disabled = [...menu.options].filter(option => option.value).every(option => option.disabled);
            if (addButton.disabled) menu.hidden = true;
        }
        // 插入一列條件並設定初值與刪除事件；達列數上限或組合重複時不新增。
        function add(condition, announce = true) {
            if (used(condition.kind, condition.operator)) return;
            const row = document.createElement('span');
            row.className = 'rc-condition';
            row.dataset.kind = condition.kind;
            // 每種條件一張卡片：第一行為標題與移除鈕，條件列放在下方。
            let group = rows.querySelector(`[data-group-kind="${condition.kind}"]`);
            if (!group) {
                group = document.createElement('span');
                group.className = 'rc-condition-group';
                group.dataset.groupKind = condition.kind;
                group.innerHTML = `<span class="rc-condition-heading"><button type="button" data-role="condition-remove" aria-label="移除此指標">×</button>${CONDITION_LABELS[condition.kind] || THUMBNAIL_ONLY_LABELS[condition.kind] || '前一個點'}</span>`;
                const removable = group;
                group.querySelector('[data-role="condition-remove"]').addEventListener('click', () => {
                    clearBoundsNotice(); removable.remove(); refreshAvailability(); refreshNumericBounds(); notify();
                });
                rows.appendChild(group);
            }
            if (condition.kind === 'previous') {
                // = 與 ≠ 可各加一列；同卡片有兩列時，各列尾端顯示自己的移除鈕。
                row.innerHTML = '<select data-role="condition-operator" aria-label="比較方式"><option value="=">=</option><option value="!=">≠</option></select>'
                    + '<select data-role="condition-value" aria-label="前一搏分類"><option>V</option><option>S</option><option>N</option></select>'
                    + '<button type="button" data-role="condition-remove" aria-label="移除此條件" title="移除此條件">×</button>';
            } else if (condition.kind === 'noise') {
                // 找不到平坦基準線（寬高無法量測）即視為雜訊；= 只留雜訊，≠ 排除雜訊。
                row.innerHTML = '<select data-role="condition-operator" aria-label="雜訊判斷" title="找不到平坦基準線、紅色心搏後 ST-T 段大幅來回擺動 2 次以上，或紅點旁緊接著另一個 QRS，視為雜訊"><option value="=">= 雜訊</option><option value="!=">≠ 雜訊</option></select><input type="hidden" data-role="condition-value">';
            } else if (condition.kind === 'direction') {
                // 向上／向下互斥，兩者皆未勾選時此條件不生效；值存在隱藏欄位供讀取。
                row.innerHTML = '<input type="hidden" data-role="condition-operator"><input type="hidden" data-role="condition-value">'
                    + [['up', '↑ 向上'], ['down', '↓ 向下']].map(([value, label]) => `<label class="rc-bound-label" title="主峰偏離基準線最大的方向"><input type="checkbox" data-role="direction-option" value="${value}" aria-label="波形${label.slice(2)}"${condition.value === value ? ' checked' : ''}>${label}</label>`).join('');
                row.addEventListener('change', event => {
                    const option = event.target.closest?.('[data-role="direction-option"]');
                    if (!option) return;
                    for (const other of row.querySelectorAll('[data-role="direction-option"]')) {
                        if (other !== option) other.checked = false;
                    }
                    row.querySelector('[data-role="condition-value"]').value = option.checked ? option.value : '';
                });
            } else {
                const unit = condition.kind === 'rate' ? '%' : condition.kind === 'bpm' ? 'BPM' : condition.kind === 'height' ? 'mV' : 'ms';
                const operator = condition.operator === '>=' ? '≥' : '≤';
                row.innerHTML = `<label class="rc-bound-label"><input type="checkbox" data-role="condition-enabled" aria-label="啟用${CONDITION_LABELS[condition.kind]} ${operator}">${operator}</label><input type="hidden" data-role="condition-operator"><input type="number" data-role="condition-value" aria-label="${CONDITION_LABELS[condition.kind]} ${operator}" step="${condition.kind === 'bpm' ? '1' : '0.1'}"><span class="rc-unit">${unit}</span>`;
                row.querySelector('[data-role="condition-enabled"]').checked = condition.enabled !== false;
                row.querySelector('[data-role="condition-enabled"]').addEventListener('change', () => {
                    clearBoundsNotice(); refreshNumericBounds(row);
                });
            }
            row.querySelector('[data-role="condition-operator"]').value = condition.operator;
            if (isShapeCondition(condition)) {
                const input = row.querySelector('[data-role="condition-value"]');
                input.setAttribute('aria-label', condition.kind === 'height' ? '心搏高度門檻' : '心搏寬度門檻');
                input.step = condition.kind === 'height' ? '0.01' : '1';
                if (condition.kind === 'width') input.min = '0';
                row.querySelector('.rc-unit').textContent = condition.kind === 'height' ? 'mV' : 'ms';
                row.title = condition.kind === 'height'
                    ? 'mV：以平坦波形估算基準線為 0，向上為正、向下為負；依實際電壓比例換算。'
                    : 'ms：主峰兩側首次回到基準線容差帶的時間；依實際時間比例換算。無法確認兩端時不命中。';
            }
            row.querySelector('[data-role="condition-value"]').value = String(condition.value);
            row.querySelector('[data-role="condition-remove"]')?.addEventListener('click', () => {
                clearBoundsNotice(); row.remove();
                if (group && !group.querySelector('.rc-condition')) group.remove();
                refreshAvailability(); refreshNumericBounds(); notify();
            });
            const operatorSelect = row.querySelector('[data-role="condition-operator"]');
            let previousOperator = condition.operator;
            operatorSelect.addEventListener('change', () => {
                clearBoundsNotice();
                if (used(condition.kind, operatorSelect.value, row)) operatorSelect.value = previousOperator;
                else previousOperator = operatorSelect.value;
                refreshAvailability();
                refreshNumericBounds(row);
            });
            if (!isLocalCondition(condition)) {
                const input = row.querySelector('[data-role="condition-value"]');
                input.addEventListener('input', () => { clearBoundsNotice(); refreshNumericBounds(); });
                input.addEventListener('change', () => refreshNumericBounds(row));
                input.addEventListener('blur', () => {
                    const before = input.value;
                    refreshNumericBounds(row);
                    if (input.value !== before) notify();
                });
            }
            (group || rows).appendChild(row);
            refreshAvailability();
            refreshNumericBounds(announce ? row : null);
            if (announce) notify();
        }
        // 收起新增選單並恢復 ＋ 按鈕，清空選中項以便再次選取同一選項。
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
            const [kind] = menu.value.split(':');
            const value = kind === 'rate' ? 12 : kind === 'bpm' ? 100 : kind === 'previous' ? 'V' : 0;
            // 前一個點預設 =，已有 = 時改加 ≠；比較方式可在該列切換。
            if (kind === 'previous') add({ kind, operator: used(kind, '=') ? '!=' : '=', value });
            // 新增波形方向時預設勾選向上，可再改為向下或取消勾選。
            else if (kind === 'direction') add({ kind, operator: '=', value: 'up' });
            else if (kind === 'noise') add({ kind, operator: '=', value: 'noise' });
            else {
                add({ kind, operator: '>=', value, enabled: true }, false);
                add({ kind, operator: '<=', value, enabled: false }, false);
                notify();
            }
            collapseConditionMenu();
        });
        editor.replaceConditions = conditions => {
            clearBoundsNotice();
            rows.replaceChildren();
            conditions.forEach(condition => add({ ...condition }, false));
            refreshAvailability();
            collapseConditionMenu();
        };
        [...sharedConditions, ...initial.filter(isLocalCondition)]
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

    // 把條件列讀成 kind / operator / value；空白數值轉為 NaN 交由驗證函式攔截。
    function readConditions(parent) {
        const editor = parent?.querySelector('.rc-condition-editor');
        const editorConditions = [...(editor?.querySelectorAll('.rc-condition') || [])].map(row => {
            const text = row.querySelector('[data-role="condition-value"]').value;
            const local = isLocalCondition(row.dataset);
            return {
                kind: row.dataset.kind,
                // 波形方向未勾選任何一側時視為停用；前一搏分類永遠啟用。
                enabled: row.dataset.kind === 'direction' ? text !== '' : ['previous', 'noise'].includes(row.dataset.kind)
                    || row.querySelector('[data-role="condition-enabled"]')?.checked !== false,
                operator: row.querySelector('[data-role="condition-operator"]').value,
                value: local ? text : text.trim() === '' ? NaN : Number(text),
            };
        });
        return { conditions: editorConditions.filter(condition => condition.enabled), editorConditions };
    }

    // 至少需要一項條件；核對種類、運算子及數值，BPM 門檻必須大於零。
    function validConditions(settings) {
        return settings?.conditions?.length > 0 && settings.conditions.every(condition =>
            condition.kind === 'previous' ? ['V', 'S', 'N'].includes(condition.value) && ['=', '!='].includes(condition.operator)
                : condition.kind === 'direction' ? condition.operator === '=' && ['up', 'down'].includes(condition.value)
                : condition.kind === 'noise' ? ['=', '!='].includes(condition.operator) && condition.value === 'noise'
                : ['rate', 'bpm', 'height', 'width'].includes(condition.kind) && ['>=', '<='].includes(condition.operator)
                    && Number.isFinite(condition.value) && (condition.kind !== 'bpm' || condition.value > 0)
                    && (condition.kind !== 'width' || condition.value >= 0))
            && ['rate', 'bpm', 'height', 'width'].every(kind => {
                const lower = settings.conditions.find(condition => condition.kind === kind && condition.operator === '>=');
                const upper = settings.conditions.find(condition => condition.kind === kind && condition.operator === '<=');
                return !lower || !upper || lower.value <= upper.value;
            });
    }

    // 比較單一條件；變動率輸入的百分比先轉比例，缺少可用指標時一律視為不符合。
    function conditionMatches(metrics, condition) {
        if (condition.kind === 'previous') {
            // 不存在前一搏時，不讓 ≠ 誤判成命中。
            if (!metrics.previousClassification || metrics.previousClassification === '—') return false;
            return condition.operator === '!=' ? metrics.previousClassification !== condition.value
                : metrics.previousClassification === condition.value;
        }
        if (condition.kind === 'direction') {
            // 主峰偏離基準線最大的一側；雜訊縮圖由備援基準提供方向，否則依高度正負。
            const height = metrics.height;
            const direction = metrics.direction !== undefined ? metrics.direction
                : height == null || !Number.isFinite(height) || height === 0 ? null : height > 0 ? 'up' : 'down';
            return direction !== null && direction === condition.value;
        }
        if (condition.kind === 'noise') {
            // 無法讀取波形時不知道是否為雜訊，= 與 ≠ 都不命中。
            if (typeof metrics.noisy !== 'boolean') return false;
            return condition.operator === '!=' ? !metrics.noisy : metrics.noisy;
        }
        const value = metrics[condition.kind];
        if (value == null || !Number.isFinite(value)) return false;
        const threshold = condition.kind === 'rate' ? condition.value / 100 : condition.value;
        return condition.operator === '<=' ? value <= threshold : value >= threshold;
    }

    // 只顯示畫面未直接提供的量測資訊，各值放在固定欄位，缺值顯示破折號。
    function playerMetricSlots(metrics) {
        const shape = (value, digits, unit) => value == null ? '—' : `${value.toFixed(digits)} ${unit}`;
        return {
            rate: `變動 ${metrics?.displayRate == null ? '—' : `${(metrics.displayRate * 100).toFixed(1)}%`}`,
            width: `寬 ${shape(metrics?.width, 1, 'ms')}`,
            height: `高 ${shape(metrics?.height, 3, 'mV')}`,
        };
    }

    // 狀態文字寫入固定寬度的欄位；只更新有變化的欄位，完整內容放在 title 供滑鼠查看。
    // 值可為字串，或 { text, title } 以在欄位顯示精簡文字、提示顯示完整說明。
    function setStatusSlots(root, values) {
        for (const [slot, value] of Object.entries(values)) {
            const cell = root.querySelector(`[data-slot="${slot}"]`);
            if (!cell) continue;
            const text = typeof value === 'string' ? value : value.text;
            const title = typeof value === 'string' ? value : value.title;
            if (cell.textContent !== text) cell.textContent = text;
            if (cell.title !== title) cell.title = title;
        }
    }


    // 將條件與批次控制放到目前 Morphology 容器；容器更換時暫停舊任務再重新掛載。
    let thumbnailLayoutObserver;
    let thumbnailLayoutContainer;
    function fitThumbnailControl() {
        const control = document.getElementById(CONFIG.controlId);
        const container = control?.parentElement;
        if (!container) return;
        const bounds = control.getBoundingClientRect();
        const parentBounds = container.getBoundingClientRect();
        const page = container.querySelector('.pagination-blk');
        const pageBounds = page?.getBoundingClientRect();
        // getBoundingClientRect 包含縮放，換回 CSS px 後保留頁碼前 12 px 間距。
        const scale = container.offsetWidth > 0 && parentBounds.width > 0 ? parentBounds.width / container.offsetWidth : 1;
        const right = pageBounds?.width > 0 ? Math.min(parentBounds.right, pageBounds.left) : parentBounds.right;
        const width = Math.max(0, Math.floor((right - bounds.left) / scale - 12));
        const maximum = `${width}px`;
        if (control.style.maxWidth !== maximum) control.style.maxWidth = maximum;
    }
    window.addEventListener('resize', fitThumbnailControl);
    function ensureControl() {
        const container = document.querySelector('.morphology > .container');
        if (!container) return;
        let control = document.getElementById(CONFIG.controlId);
        if (controlContainer && controlContainer !== container) {
            pauseThumbnails('頁面已變更'); control?.remove(); control = null;
        }
        if (!control) {
            control = document.createElement('div'); control.id = CONFIG.controlId;
            createConditionEditor(control, false, thumbnailLocalConditions);
            installThumbnailBatchControl(control);
            control.addEventListener('change', scheduleUpdate);
            control.addEventListener('input', scheduleUpdate);
        }
        controlContainer = container;
        if (control.parentElement !== container) container.appendChild(control);
        if (thumbnailLayoutContainer !== container && typeof ResizeObserver !== 'undefined') {
            thumbnailLayoutObserver?.disconnect();
            thumbnailLayoutContainer = container;
            thumbnailLayoutObserver = new ResizeObserver(fitThumbnailControl);
            thumbnailLayoutObserver.observe(container);
            const page = container.querySelector('.pagination-blk');
            if (page) thumbnailLayoutObserver.observe(page);
        }
        fitThumbnailControl();
    }

    // 讀取圓點的 SVG 水平座標；無效數字回傳 null，供排序前排除。
    function numericX(dot) {
        const x = Number(dot.getAttribute('cx'));
        return Number.isFinite(x) ? x : null;
    }

    // 辨識網站用來呈現非目前目標的黑色圓點；此顏色本身不代表 N 分類。
    function isBlackDot(dot) {
        const fill = getComputedStyle(dot).fill;
        return /rgb\(\s*(38|0)\s*,\s*(38|0)\s*,\s*(38|0)\s*\)/i.test(fill)
            || fill === 'black';
    }

    // 依水平位置排序心搏點，定位紅點及其前兩點，計算前後間距的變動率。
    // 此縮圖路徑要求前兩點為黑點；條件不足或間距非正數時略過，結果以 Set 去重。
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

    // 優先用 D3 綁定的絕對取樣索引及取樣率計算紅點 BPM。
    // 索引不可用時才以同組繪圖寬度及實際時間窗換算，兩種來源均不足時回傳 null。
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

    // 掃描有紅點及前一黑點的縮圖，換算 BPM 後依所選 ≥ / ≤ 篩選。
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

    // 讀取縮圖 SVG 中的顯示分類，用來辨識是否已移出目前分類。
    function getClassification(thumbnail) {
        const label = thumbnail.querySelector('.ecgWave svg text');
        return label?.textContent.trim().toUpperCase() || '';
    }

    // 判斷左側 type 代表波形的方向：R 標記約在第 36%，取 25%～60% 區段內偏離基準線最大的一側。
    // 基準線取區段外樣本的中位數；偏離不到 0.05 mV（例如平線）時無法判斷，回傳 null。
    function templateDirection(samples) {
        const values = Array.isArray(samples) ? samples.map(Number) : [];
        if (values.length < 20 || !values.every(Number.isFinite)) return null;
        const from = Math.floor(values.length * 0.25), to = Math.ceil(values.length * 0.6);
        const outside = values.filter((_, i) => i < from || i > to).sort((a, b) => a - b);
        const baseline = outside[Math.floor(outside.length / 2)];
        let peak = 0;
        for (let i = from; i <= to; i++) {
            if (Math.abs(values[i] - baseline) > Math.abs(peak)) peak = values[i] - baseline;
        }
        return Math.abs(peak) < 0.05 ? null : peak > 0 ? 'up' : 'down';
    }

    // 依波形方向條件為左側 type 區塊上色；只切換需要變更的類別，避免觸發多餘的重畫通知。
    function refreshTypeDirection(direction) {
        let charts = [];
        try { charts = thumbnailScope()?.morphology?.morphologyChart?.data || []; }
        catch (_) { /* 無 Angular 時不標示 type。 */ }
        for (const tile of document.querySelectorAll('.morphology .type-trend[id^="type-trend-"]')) {
            const index = Number(tile.id.slice('type-trend-'.length));
            const hit = Boolean(direction) && templateDirection(charts[index]?.data) === direction;
            if (tile.classList.contains(CONFIG.typeHitClass) !== hit) tile.classList.toggle(CONFIG.typeHitClass, hit);
        }
    }

    // 從目前選中的分類按鈕解析 setLabel 參數，避免依按鈕翻譯文字推測分類。
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
    let playerShapeReady = null;
    let playerChanged = 0;
    let playerSkipped = 0;

    let playerLiveMetrics = null;
    let playerStatusMessage = '檢視中';
    let playerViewObserver = null;
    let playerViewTimer = null;
    let playerViewedSignature = '';
    let playerStatusUpdatedAt = 0;
    let playerCountsUpdatedAt = 0;

    // 分別更新左側累積計數與右側即時資訊；播放期間對顯示節流，避免拖慢分類處理。
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
        const panel = document.getElementById(PLAYER_CONTROL_ID);
        if (panel) {
            setStatusSlots(panel, { ...playerMetricSlots(playerLiveMetrics), message: boundsMessages.player || message });
            const status = panel.querySelector('[data-role="status"]');
            if (status) status.dataset.notice = String(Boolean(boundsMessages.player));
        }
        playerStatusUpdatedAt = now;
    }

    // 停止排程並清除等待前進、起始同步及載入狀態；保留已累積計數及目標分類。
    let playerSingleTarget = '';
    function pausePlayer(message = '已暫停') {
        playerSingleTarget = '';
        playerRunning = false;
        clearTimeout(playerTimer);
        playerTimer = null;
        playerPending = null;
        playerPriming = null;
        playerShapeReady = null;
        playerLoadingSince = 0;
        const button = document.querySelector(`#${PLAYER_CONTROL_ID} [data-role="play"]`);
        if (button) {
            button.textContent = '▶ 批次修改';
            button.dataset.running = 'false';
        }
        playerStatus(message);
    }

    // 讀取播放器條件、目標分類與排程間隔；速度只接受 10 / 20 / 40 / 100 ms。
    function readPlayerSettings() {
        const panel = document.getElementById(PLAYER_CONTROL_ID);
        if (!panel) return null;
        const field = role => panel.querySelector(`[data-role="${role}"]`);
        return { ...readConditions(panel), label: field('label').value,
            interval: [10, 20, 40, 100].includes(Number(field('speed')?.value)) ? Number(field('speed').value) : 10 };
    }

    // 先驗證條件並顯示原因，再確認目標分類是 V / S / N / A 之一。
    function validPlayerSettings(settings) {
        if (!validConditions(settings)) { playerStatus('請新增至少一項條件並輸入有效數值'); return false; }
        return ['V', 'S', 'N', 'A'].includes(settings.label);
    }

    // 解析顯示進度與第一列時間，以「項目序號:時間」辨識目前畫面是否已換筆。
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

    // 由已繪製的 SVG 還原心搏位置，定位唯一中央心搏並計算相鄰 R-R、BPM 及變動率。
    // 這條路徑用於停止播放時的畫面資訊；自動修改另以原始資料核對，避免重畫期間認錯項目。
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
            ...readColoredWaveShape(wave, true),
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

    // 交叉核對畫面序號、progress、進度條及目前波形所綁定的資料，全部一致才接受本筆。
    // 由 absoluteIndex 與取樣率計算指標；將網站原始 N / A / V / X 映射為面板的 N / S / V / A。
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
        let shape = null;
        if (readPlayerSettings()?.conditions.some(isShapeCondition)) {
            const waveScope = angular.element(position.wave.querySelector('.ecgWave')).isolateScope?.();
            // 條件使用 SVG 時額外核對繪圖元件資料，未同步時先等待，不能直接跳過。
            if (waveScope?.ecgData !== item.ecgData || waveScope?.annoData !== item.annoData
                || waveScope?.posInfo !== item.posInfo) return null;
            const path = position.wave.querySelector('.ecgWave path.ecg-path');
            const gradient = path?.closest('svg')?.querySelector('linearGradient');
            if (!path || !gradient) return null;
            const signature = `${position.signature}:${path.getAttribute('d')}:${gradient.innerHTML}`;
            if (playerShapeReady?.item !== item || playerShapeReady.signature !== signature) {
                playerShapeReady = { item, signature };
                return null;
            }
            shape = readColoredWaveShape(position.wave, true);
            if (['V', 'A'].includes(beats[index].type) && !shape) return null;
        }
        return { player, item, progress, target, metrics: {
            ...shape,
            classification: ({ N: 'N', A: 'S', V: 'V', X: 'A' })[beats[index].type],
            previousClassification: previous ? ({ N: 'N', A: 'S', V: 'V', X: 'A' })[previous.type] : null,
            rrMs: interval > 0 ? interval / sampleRate * 1000 : null,
            previousRrMs: precedingInterval > 0 ? precedingInterval / sampleRate * 1000 : null,
            displayBpm: bpm, displayRate: rate,
            // 黑點表示非目前目標，不代表 N；不能因前一搏為 V/S/A 而排除。
            bpm, rate,
        } };
    }

    // 播放器採所有條件的交集；只有每項比較都通過才允許修改本筆。
    function playerMatches(metrics, settings) {
        if (!validConditions(settings)) return false;
        return settings.conditions.every(condition => conditionMatches(metrics, condition));
    }

    // 自動修改前先停下網站原生播放，避免兩套進度控制同時前進。
    function pauseNativePlayer(dialog) {
        const toggle = dialog.querySelector('[ng-click="togglePlay()"]');
        if (toggle?.classList.contains('glyphicon-pause')) toggle.click();
    }

    // 將面板目標轉為原生數字鍵 1～4，讓網站自行記錄修改並推進播放器。
    function sendPlayerClassification(label) {
        // 使用原站 document keydown：其分類流程會更新 modified 集合並自行前進。
        const key = { V: '1', S: '2', N: '3', A: '4' }[label];
        if (!key) return;
        const code = key.charCodeAt(0);
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key, code: `Digit${key}`, keyCode: code, which: code, bubbles: true, cancelable: true,
        }));
    }

    // 包住單次播放器處理；資料讀取或網站操作拋錯時顯示原因並暫停，避免排程繼續。
    function playerStep(single = false) {
        try {
            runPlayerStep(single);
        } catch (error) {
            console.warn('[RootiCare 快速修改器]', error);
            pausePlayer('已暫停：播放器資料暫時無法讀取，請重新播放');
        }
    }

    // 每一步先核對視窗及設定，再同步起始進度、等待上一筆前進、讀取可信資料並判斷條件。
    // 符合時發送分類，不符合時前進；必須收到原生分類與進度確認才計數，再決定是否排程下一筆。
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
        if (single && position) {
            if (playerSingleTarget && playerSingleTarget !== position.signature) {
                pausePlayer('本筆位置已變更，未修改'); return;
            }
            playerSingleTarget = position.signature;
        }
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
            if (!playerLoadingSince) playerLoadingSince = Date.now();
            if (Date.now() - playerLoadingSince > 15000) { pausePlayer('已暫停：無法確認目前項目的原始資料，未跳過本筆'); return; }
            playerLiveMetrics = null;
            playerStatus('等待項目資料同步…', true);
            playerTimer = setTimeout(() => playerStep(single), settings.interval);
            return;
        }
        playerLoadingSince = 0;
        const hit = playerMatches(metrics, settings);
        if (single && !hit) { pausePlayer('本筆不符合條件，未修改'); return; }
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
        playerViewedSignature = position.signature;
        playerLiveMetrics = metrics;
        playerStatus(hit ? '修改' : '跳過', true);
        if (position.index === position.total) {
            pausePlayer('完成');
        } else if (single) {
            // 單筆不啟動自動循環。
            pausePlayer('單次完成');
        } else {
            // 使用所選的 10/20/40/100ms 間隔；網站尚未前進時由 pending 檢查等待。
            playerTimer = setTimeout(playerStep, settings.interval);
        }
    }

    // 停止自動播放時仍更新目前心搏資訊，支援使用者手動前進、返回與改分類。
    // 只刷新資訊，不增加修改 / 跳過計數，也不觸發分類操作。
    function refreshPlayerView() {
        if (playerRunning || !playerDialog?.isConnected) return;
        try {
            const position = readPlayerPosition(playerDialog);
            const metrics = position && readPlayerMetrics(position.wave);
            if (position && playerViewedSignature && position.signature !== playerViewedSignature) {
                playerStatusMessage = '檢視中';
            }
            playerViewedSignature = position?.signature || '';
            playerLiveMetrics = metrics || null;
            playerStatus(metrics ? playerStatusMessage : '等待 ECG 載入…');
        } catch (error) {
            playerLiveMetrics = null;
            playerStatus('等待播放器畫面更新…');
        }
    }

    // 合併手動操作造成的重畫通知，延遲 30 ms 後再讀取畫面，避免讀到中間狀態。
    function schedulePlayerView() {
        if (playerRunning || playerViewTimer !== null) return;
        // 等待原站本次 DOM 重畫完成；手動操作不套用播放的 250ms 顯示節流。
        playerViewTimer = setTimeout(() => {
            playerViewTimer = null;
            refreshPlayerView();
        }, 30);
    }

    // 更換播放器時斷開舊觀察器，再監看新視窗的波形、文字及輸入事件。
    // 忽略面板本身的更新；播放中的資訊由自動流程提供，避免兩種更新互相覆蓋。
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

    // 在目前播放器建立條件、目標、速度與播放面板；新視窗重設計數並保留頁面內目標分類。
    // 面板內事件不送到原生快捷鍵；設定變動先暫停，開始播放前則停止縮圖批次任務。
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
            playerLiveMetrics = null;
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
                <div class="qe-buttons"><button type="button" data-role="single">單次修改</button><button type="button" data-role="play" data-running="false">▶ 批次修改</button></div>
            </div>
            </div><div class="qe-footer"><span>修改 <b data-role="changed-count">0</b></span><span>跳過 <b data-role="skipped-count">0</b></span><span data-slot="rate">變動 —</span><span data-slot="width">寬 —</span><span data-slot="height">高 —</span><span data-role="status" data-slot="message">待命 · Esc 暫停</span></div>`;
        const editor = createConditionEditor(panel.querySelector('[data-role="player-conditions"]'), true, playerPreviousConditions);
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
        panel.querySelector('[data-role="single"]').addEventListener('click', () => {
            pausePlayer('單次修改中');
            boundsMessages.player = '';
            if (!validPlayerSettings(readPlayerSettings())) return;
            if (thumbnailRun) pauseThumbnails('播放器單次修改，縮圖批次已暫停');
            playerStep(true);
        });
        panel.querySelector('[data-role="play"]').addEventListener('click', () => {
            boundsMessages.player = '';
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
    let thumbnailMessage = '待命 · Esc 暫停';
    let thumbnailStatusScheduled = false;

    function scheduleThumbnailStatus() {
        if (thumbnailStatusScheduled) return;
        thumbnailStatusScheduled = true;
        setTimeout(() => {
            thumbnailStatusScheduled = false;
            refreshThumbnailStatus();
        }, 0);
    }

    // 單選顯示該搏；多選顯示各指標範圍。只量目前頁面已繪製的選取縮圖。
    // 回傳各欄位的文字，沒有選取時回傳 null。
    function thumbnailSelectionInfo() {
        const selected = [...document.querySelectorAll('#right-list .ecg-trend')]
            .filter(thumb => thumb.querySelector('.idBackground.selectedBackground'));
        let total = selected.length;
        try { total = Math.max(total, thumbnailScope()?.morphology?.state?.selectedSegments?.length || 0); }
        catch (_) { /* 無 Angular 時仍可顯示本頁 DOM 選取。 */ }
        if (!total) return null;
        const values = selected.map(thumb => {
            const dots = [...thumb.querySelectorAll('circle.anno-dot')]
                .map(dot => ({ dot, x: numericX(dot) })).filter(item => item.x !== null).sort((a, b) => a.x - b.x);
            let index = dots.findIndex(({ dot }) => dot.classList.contains('current'));
            if (index < 0) index = dots.findIndex(({ dot }) => /rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/i.test(getComputedStyle(dot).fill));
            let shape = null, bpm = null;
            try {
                shape = readColoredWaveShape(thumb);
                if (index > 0) bpm = getRedBeatBpm(thumb, dots[index], dots[index - 1]);
            } catch (_) { /* 重畫中無法量測的數值顯示缺值。 */ }
            return { bpm, width: shape?.width, height: shape?.height, turns: shape?.turns, noisy: shape?.noisy };
        });
        const range = (kind, digits, unit) => {
            const available = values.map(value => value[kind]).filter(value => Number.isFinite(value));
            if (!available.length) return '—';
            const low = Math.min(...available), high = Math.max(...available);
            const text = low.toFixed(digits) === high.toFixed(digits) ? low.toFixed(digits)
                : `${low.toFixed(digits)}～${high.toFixed(digits)}`;
            const missing = available.length < selected.length ? `（${selected.length - available.length} 筆缺值）` : '';
            return `${text}${unit}${missing}`;
        };
        const crossPage = total !== selected.length;
        return {
            count: crossPage ? `本頁選取 ${selected.length} / 共 ${total}（以下為本頁）`
                : selected.length === 1 ? '選取 1 搏' : `多選 ${selected.length} 搏`,
            shortCount: crossPage ? `本頁 ${selected.length}/${total}`
                : selected.length === 1 ? '選取 1 搏' : `多選 ${selected.length} 搏`,
            bpm: range('bpm', 0, ''), width: range('width', 1, ' ms'), height: range('height', 3, ' mV'),
            // 只放在選取數的滑鼠提示，方便在不同 type 觀察雜訊門檻是否合適。
            noise: `ST-T 轉折 ${range('turns', 0, ' 次')} · 雜訊 ${values.filter(value => value.noisy === true).length} 搏`,
        };
    }

    function thumbnailSelectionText() {
        const info = thumbnailSelectionInfo();
        return info ? `${info.count} · 心搏速率(BPM) ${info.bpm} · 心搏寬度 ${info.width} · 心搏高度 ${info.height}` : '';
    }

    // 三行固定欄位：選取數／BPM／修改數／頁數、寬／高、訊息。
    // 未選取時保留欄位並顯示破折號，避免狀態區高度或位置隨內容改變。
    function refreshThumbnailStatus() {
        const status = document.querySelector(`#${CONFIG.controlId} [data-role="batch-status"]`);
        if (!status) return;
        const selection = thumbnailSelectionInfo();
        const notice = boundsMessages.thumbnail;
        // 欄位只放數值範圍，「（n 筆缺值）」等補充說明移到 title，避免撐長而被截斷。
        const metric = (label, value) => {
            const full = `${label} ${selection ? value : '—'}`;
            return { text: full.replace(/（[^）]*）$/, ''), title: full };
        };
        setStatusSlots(status, {
            count: selection ? { text: selection.shortCount, title: `${selection.count}\n${selection.noise}` } : '未選取',
            bpm: metric('BPM', selection?.bpm),
            changed: `修改 ${thumbnailChanged}`,
            pages: `頁 ${thumbnailPages}`,
            width: metric('寬', selection?.width),
            height: metric('高', selection?.height),
            message: notice || thumbnailMessage,
        });
        status.dataset.notice = String(Boolean(notice));
    }

    // 顯示縮圖批次的目前等待 / 完成狀態；修改數與頁數另有固定欄位。
    function thumbnailStatus(message) {
        thumbnailMessage = message;
        refreshThumbnailStatus();
    }

    // 清除目前任務及計時器，並遞增 epoch，使已排程的舊回呼即使執行也不再操作頁面。
    function pauseThumbnails(message = '已暫停') {
        thumbnailRun = null;
        thumbnailEpoch++;
        clearTimeout(thumbnailTimer);
        thumbnailTimer = null;
        const button = document.querySelector(`#${CONFIG.controlId} [data-role="batch-play"]`);
        if (button) button.textContent = '▶ 批次修改';
        thumbnailStatus(message);
    }

    // 讀取清單面板條件、目標分類與排程速度；啟動時會保存本次設定快照。
    function readThumbnailSettings() {
        return { ...readConditions(document.getElementById(CONFIG.controlId)),
            label: document.querySelector(`#${CONFIG.controlId} [data-role="batch-label"]`)?.value,
            interval: [10, 20, 40, 100].includes(Number(document.querySelector(`#${CONFIG.controlId} [data-role="batch-speed"]`)?.value))
                ? Number(document.querySelector(`#${CONFIG.controlId} [data-role="batch-speed"]`)?.value) : 10 };
    }

    // 從目前 Morphology 容器取得 Angular scope，供選取、頁碼與資料繫結核對。
    function thumbnailScope() {
        return window.angular?.element(document.querySelector('.morphology > .container')).scope?.();
    }

    // 核對頁碼、項目數、載入旗標及每張縮圖的 segment / 波形 / 標籤 / 索引繫結。
    // 任一資料尚未同步時回傳 null；成功時附頁面簽章，供批次流程確認重畫穩定及分類後是否位移。
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

    const shapeCache = new WeakMap();

    // 讀取網站 D3 basis 產生的 M/L/C 路徑。保留曲線極值及密集取樣，
    // 不讀紅點，也不使用螢幕像素；遇到未知命令時拒絕量測。
    function sampleWavePath(d) {
        const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
        const points = [];
        let i = 0, x = 0, y = 0;
        while (i < tokens.length) {
            const command = tokens[i++];
            const count = command === 'C' ? 6 : ['M', 'L'].includes(command) ? 2 : 0;
            if (!count || i + count > tokens.length) return null;
            const values = tokens.slice(i, i + count).map(Number);
            if (!values.every(Number.isFinite)) return null;
            i += count;
            if (command !== 'C') {
                [x, y] = values;
                points.push({ x, y });
                continue;
            }
            const [x1, y1, x2, y2, x3, y3] = values;
            if (!(x <= x1 && x1 <= x2 && x2 <= x3)) return null;
            const ts = [0.25, 0.5, 0.75, 1];
            const a = -y + 3 * y1 - 3 * y2 + y3;
            const b = 2 * (y - 2 * y1 + y2);
            const c = y1 - y;
            if (Math.abs(a) < 1e-12) {
                if (Math.abs(b) > 1e-12) ts.push(-c / b);
            } else {
                const discriminant = b * b - 4 * a * c;
                if (discriminant >= 0) {
                    ts.push((-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a));
                }
            }
            for (const t of ts.filter(t => t > 0 && t <= 1).sort((a, b) => a - b)) {
                const u = 1 - t;
                points.push({ x: u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
                    y: u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3 });
            }
            x = x3; y = y3;
        }
        return points.length > 2 ? points : null;
    }

    // 以彩色區附近、非彩色區的低斜率波形估算等電位基準。
    // 取 0.5 SVG px 分箱的加權眾數，避免 R 峰或負向峰拉動平均值。
    function estimateWaveBaseline(points, left, right) {
        const bins = new Map();
        const padding = (right - left) * 3;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i];
            const x = (a.x + b.x) / 2;
            const dx = b.x - a.x;
            if (!(dx > 0) || (b.x >= left && a.x <= right)
                || x < left - padding || x > right + padding) continue;
            const slope = Math.abs((b.y - a.y) / dx);
            if (slope > 1) continue;
            const y = (a.y + b.y) / 2;
            const key = Math.round(y * 2);
            const weight = dx / (1 + slope * slope * 16);
            const bin = bins.get(key) || { weight: 0, sum: 0 };
            bin.weight += weight; bin.sum += y * weight;
            bins.set(key, bin);
        }
        const best = [...bins.values()].sort((a, b) => b.weight - a.weight)[0];
        return best && best.weight >= 0.5 ? best.sum / best.weight : null;
    }

    // 找不到平坦基準線（視為雜訊）時，只供判斷波形方向的備援基準：
    // 與上方相同範圍內所有線段中點的中位數；雜訊上下抖動時仍落在等電位線附近。
    // 不用於寬度與高度，避免把雜訊縮圖的量測值當成可靠數值。樣本過少時回傳 null。
    function medianWaveLevel(points, left, right) {
        const padding = (right - left) * 3;
        const levels = [];
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i];
            const x = (a.x + b.x) / 2;
            if (!(b.x > a.x) || (b.x >= left && a.x <= right)
                || x < left - padding || x > right + padding) continue;
            levels.push((a.y + b.y) / 2);
        }
        if (levels.length < 20) return null;
        levels.sort((a, b) => a - b);
        return levels[Math.floor(levels.length / 2)];
    }

    // 量中央主峰的基準線寬度。正負峰使用同一規則；過零即為回到基準線，
    // 不將另一側的反向峰或相鄰心搏接在一起。找不到完整兩端時回傳 null。
    function measureWaveWidth(points, baseline, center, leftLimit, rightLimit, peakRadius, anchoredPeak = null) {
        if (!Number.isFinite(baseline)) return null;
        let peak = anchoredPeak === null ? -1 : anchoredPeak;
        for (let i = 0; anchoredPeak === null && i < points.length; i++) {
            if (Math.abs(points[i].x - center) > peakRadius
                || points[i].x <= leftLimit || points[i].x >= rightLimit) continue;
            if (peak < 0 || Math.abs(points[i].y - baseline) > Math.abs(points[peak].y - baseline)) peak = i;
        }
        if (peak < 0) return null;
        const amplitude = Math.abs(points[peak].y - baseline);
        const tolerance = Math.max(0.5, amplitude * 0.05);
        if (amplitude <= tolerance * 2) return null;
        const sign = Math.sign(baseline - points[peak].y);
        const departure = point => sign * (baseline - point.y);
        function crossing(direction) {
            let previous = points[peak];
            for (let i = peak + direction; i >= 0 && i < points.length; i += direction) {
                let point = points[i];
                const limit = direction < 0 ? leftLimit : rightLimit;
                const outside = direction < 0 ? point.x < limit : point.x > limit;
                if (outside) {
                    if (point.x === previous.x) return null;
                    point = { x: limit, y: previous.y + (point.y - previous.y)
                        * (limit - previous.x) / (point.x - previous.x) };
                }
                if (departure(point) <= tolerance) {
                    const from = departure(previous), to = departure(point);
                    return previous.x + (point.x - previous.x) * (from - tolerance) / (from - to);
                }
                // 未回到容差帶便再度遠離基準線時，低於峰高 12% 的谷底即為主峰邊界，
                // 避免把緊鄰的 P 波併入寬度；正負向相同。寬 QRS 的切跡通常高於此比例，
                // 實測 P 波谷底約 7～12%、倒向寬 QRS 切跡約 15% 起，提高門檻會截斷寬 QRS。
                if (departure(point) > departure(previous) && departure(previous) <= amplitude * 0.12) {
                    return previous.x;
                }
                if (outside) return null;
                previous = point;
            }
            return null;
        }
        const left = crossing(-1), right = crossing(1);
        return left !== null && right !== null && right > left ? right - left : null;
    }

    // Player 比較標記附近短時間範圍內的正負極值，保留雙向波形的主要方向。
    function anchoredWavePeak(points, baseline, center, left, right, radius) {
        if (!Number.isFinite(baseline)) return -1;
        let peak = -1;
        for (let i = 1; i < points.length - 1; i++) {
            const p = points[i], before = points[i - 1], after = points[i + 1];
            if (p.x <= left || p.x >= right || Math.abs(p.x - center) > radius
                || Math.abs(p.y - baseline) <= 1) continue;
            const extremum = (p.y < before.y && p.y <= after.y) || (p.y > before.y && p.y >= after.y);
            if (!extremum) continue;
            if (peak < 0 || Math.abs(p.y - baseline) > Math.abs(points[peak].y - baseline)) peak = i;
        }
        return peak;
    }

    // 縮圖保留彩線高度；Player 的高度與寬度使用同一個中央心搏主峰。
    // objectBoundingBox 漸層以 path 自身範圍換算；平移不影響相對高度或寬度。
    function readColoredWavePixels(container, player = false) {
        const path = container.querySelector('.ecgWave path.ecg-path');
        const svg = path?.closest('svg');
        const gradient = svg?.querySelector('linearGradient');
        if (!path || !gradient || gradient.getAttribute('gradientUnits') === 'userSpaceOnUse') return null;
        const stops = [...gradient.querySelectorAll('stop')];
        const isColored = stop => /^(red|#f00|#ff0000|#0568f7|blue|#00f|#0000ff)$/i
            .test(stop.getAttribute('stop-color') || '');
        const offset = stop => {
            const text = stop.getAttribute('offset') || '';
            return text.endsWith('%') ? parseFloat(text) / 100 : Number(text);
        };
        // Player 同一列可有多個紅／藍區段，中央 stop 才是目標心搏。
        const colored = player ? stops.findIndex(stop => Math.abs(offset(stop) - 0.5) < 1e-6)
            : stops.findIndex(isColored);
        if (colored < 1 || colored >= stops.length - 1 || !isColored(stops[colored])) return null;
        let first = colored, last = colored;
        const color = stops[colored].getAttribute('stop-color').toLowerCase();
        while (!player && first > 0 && stops[first - 1].getAttribute('stop-color')?.toLowerCase() === color) first--;
        while (!player && last < stops.length - 1 && stops[last + 1].getAttribute('stop-color')?.toLowerCase() === color) last++;
        if (first === 0 || last === stops.length - 1) return null;
        // 相鄰不同彩色心搏間沒有灰色停止點時，以漸層中點分界，排除另一搏的峰。
        const start = isColored(stops[first - 1])
            ? (offset(stops[first - 1]) + offset(stops[first])) / 2 : offset(stops[first - 1]);
        const end = isColored(stops[last + 1])
            ? (offset(stops[last]) + offset(stops[last + 1])) / 2 : offset(stops[last + 1]);
        if (!(start >= 0 && end <= 1 && end > start)) return null;
        const d = path.getAttribute('d') || '';
        // Player 的相鄰 stop 是心搏位置；取中點限制寬度搜尋，避免跨入相鄰心搏。
        // 縮圖的相鄰 stop 只是固定著色邊界，故允許搜尋到上色區之外。
        const centerOffset = offset(stops[colored]);
        const widthStart = player ? (offset(stops[colored - 1]) + centerOffset) / 2 : Math.max(0, centerOffset - 0.1);
        const widthEnd = player ? (offset(stops[colored + 1]) + centerOffset) / 2 : Math.min(1, centerOffset + 0.1);
        const segmentSeconds = readWaveScale(container).seconds;
        const playerSeconds = segmentSeconds > 0 && Number.isFinite(segmentSeconds) ? segmentSeconds : 10;
        const key = `${player}:${playerSeconds}:${start}:${end}:${widthStart}:${widthEnd}:${centerOffset}:${d}`;
        const cached = shapeCache.get(path);
        if (cached?.key === key) return cached.value;
        const points = sampleWavePath(d);
        let value = null;
        if (points) {
            const minX = points[0].x, maxX = points[points.length - 1].x;
            const left = minX + (maxX - minX) * (player ? widthStart : start);
            const right = minX + (maxX - minX) * (player ? widthEnd : end);
            const inside = points.filter(point => point.x >= left && point.x <= right);
            // 補上漸層邊界的插值，避免邊界剛好落在兩個取樣點間。
            for (const boundary of [left, right]) {
                const index = points.findIndex(point => point.x >= boundary);
                if (index > 0) {
                    const a = points[index - 1], b = points[index];
                    if (b.x > a.x) inside.push({ x: boundary,
                        y: a.y + (b.y - a.y) * (boundary - a.x) / (b.x - a.x) });
                }
            }
            const baseline = estimateWaveBaseline(points, left, right);
            if (inside.length && right > left) {
                const upper = baseline === null ? null : baseline - Math.min(...inside.map(point => point.y));
                const lower = baseline === null ? null : baseline - Math.max(...inside.map(point => point.y));
                const span = maxX - minX;
                // 找不到平坦基準線即判為雜訊：寬高維持無法量測，方向改用中位數備援基準判斷。
                const directionBase = baseline ?? medianWaveLevel(points, left, right);
                const deviation = directionBase === null ? 0 : [directionBase - Math.min(...inside.map(point => point.y)),
                    directionBase - Math.max(...inside.map(point => point.y))].sort((a, b) => Math.abs(b) - Math.abs(a))[0];
                value = { width: measureWaveWidth(points, baseline, minX + span * centerOffset,
                    minX + span * widthStart, minX + span * widthEnd, span * 0.01), height: baseline === null ? null
                    : Math.abs(upper) >= Math.abs(lower) ? upper : lower, baseline,
                    noisy: baseline === null, direction: deviation > 0 ? 'up' : deviation < 0 ? 'down' : null };
                if (player) {
                    const center = minX + span * centerOffset;
                    // ±60 ms 納入緊鄰的小 R／深 S，避免沿整段彩線搜尋到較晚的 T 波。
                    const peak = anchoredWavePeak(points, baseline, center, left, right, span * 0.06 / playerSeconds);
                    value.height = peak < 0 ? null : baseline - points[peak].y;
                    value.width = measureWaveWidth(points, baseline, center, left, right, span * 0.01, peak);
                }
            }
        }
        shapeCache.set(path, { key, value });
        return value;
    }

    // 與網站 ecgWave 的線性座標相同：整個 centerGroup 寬度對應 segSec，
    // 高度對應 maxMVolt-minMVolt。偏移僅改變零點，不影響相對振幅。
    function readWaveScale(container) {
        const wave = container.querySelector('.ecgWave');
        const group = wave?.querySelector('.centerGroup');
        let scope;
        try { scope = window.angular?.element(wave)?.isolateScope?.(); } catch (_) { /* 未載入 */ }
        const number = (key, attribute) => {
            const value = scope?.[key];
            if (value != null && Number.isFinite(Number(value))) return Number(value);
            const text = wave?.getAttribute(attribute);
            return text != null && text.trim() !== '' ? Number(text) : NaN;
        };
        const seconds = number('segSec', 'seg-sec');
        const minimum = number('minMVolt', 'min-m-volt'), maximum = number('maxMVolt', 'max-m-volt');
        const width = Number(group?.getAttribute('width')), height = Number(group?.getAttribute('height'));
        const zoom = number('zoomScale', 'zoom-scale');
        const zoomFactor = Number.isFinite(zoom) && zoom > 0 ? Number(zoom.toFixed(1)) : 1;
        return {
            seconds,
            msPerPixel: seconds > 0 && width > 0 ? seconds * 1000 / width : null,
            mvPerPixel: Number.isFinite(minimum) && Number.isFinite(maximum) && maximum > minimum
                && height > 0 && zoomFactor > 0 ? (maximum - minimum) / height / zoomFactor : null
        };
    }

    // 雜訊判斷門檻，以 type 0（110 張人工標記）、type 95、type 36（336 張正常 V）調校：
    // 1. 紅色心搏回到基線後至 500 ms 內，擺動超過「正常心搏振幅 20%」達 2 次（ST-T 段出現大幅來回擺動）；
    //    只用大擺動計數，肌電般的細小抖動或 T 波上的小凹口不算雜訊；
    // 2. 紅色心搏前後 80～220 ms 內出現與正常 QRS 同向、同等陡峭的尖峰（真正的心搏不可能相隔這麼近，
    //    代表紅點不是真正的心搏）。門檻都相對於同一張縮圖的正常心搏，不受訊號大小影響。
    const NOISE_TURN_RATIO = 0.2;
    const NOISE_TURN_LIMIT = 2;

    // 以網站提供的原始 mV 取樣分析紅色心搏附近是否為雜訊；資料或正常心搏不足時回傳 null。
    function analyzeBeatNoise(container) {
        const wave = container.querySelector('.ecgWave');
        let scope;
        try { scope = window.angular?.element(wave)?.isolateScope?.(); } catch (_) { /* 未載入 */ }
        const samples = scope?.ecgData;
        if (!Array.isArray(samples) || samples.length < 20) return null;
        const v = samples.map(Number);
        if (!v.every(Number.isFinite)) return null;
        const n = v.length;
        const seconds = Number(scope.segSec);
        const rate = Number(scope.posInfo?.sampleRate || scope.sampleRate) || (seconds > 0 ? n / seconds : NaN);
        const groupWidth = Number(wave.querySelector('.centerGroup')?.getAttribute('width'));
        if (!(rate > 0) || !(groupWidth > 0)) return null;
        const ms = value => Math.round(value * rate / 1000);
        const median = values => {
            const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
            return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
        };
        const dots = [...container.querySelectorAll('circle.anno-dot')].map(dot => ({
            index: Math.round(Number(dot.getAttribute('cx')) / groupWidth * n), current: dot.classList.contains('current'),
        })).filter(dot => Number.isFinite(dot.index)).sort((a, b) => a.index - b.index);
        const center = dots.find(dot => dot.current)?.index;
        if (!Number.isFinite(center)) return null;
        // 局部基準：心搏前 120～400 ms 與後 250～500 ms 的中位數，避開 QRS 本身。
        const base = index => median([...v.slice(Math.max(0, index - ms(400)), Math.max(0, index - ms(120))),
            ...v.slice(index + ms(250), index + ms(500))]);
        const peak = (index, radius) => {
            const level = base(index);
            let at = index;
            for (let i = Math.max(0, index - radius); i <= Math.min(n - 1, index + radius); i++) {
                if (Math.abs(v[i] - level) > Math.abs(v[at] - level)) at = i;
            }
            return { at, deviation: v[at] - level };
        };
        const others = dots.filter(dot => !dot.current && dot.index > ms(400) && dot.index < n - ms(500));
        if (others.length < 2) return null;
        const normals = others.map(dot => peak(dot.index, ms(40)));
        const normalAmp = median(normals.map(item => Math.abs(item.deviation)));
        const normalSign = Math.sign(median(normals.map(item => item.deviation)));
        const normalSlope = median(others.map(dot => Math.max(...v.slice(dot.index - ms(40), dot.index + ms(40))
            .map((value, i, list) => i ? Math.abs(value - list[i - 1]) : 0))));
        if (!(normalAmp > 0) || !(normalSlope > 0)) return null;
        const level = base(center);
        const red = peak(center, ms(60));
        const settled = Math.max(0.15 * Math.abs(red.deviation), 0.2 * normalAmp);
        // 從紅色心搏峰值往外走到回到基線附近，寬 QRS 的切跡不算雜訊。
        const complexEnd = direction => {
            let i = red.at;
            while (Math.abs(i - center) < ms(250) && i > 0 && i < n - 1 && Math.abs(v[i] - level) > settled) i += direction;
            return Math.abs(i - center);
        };
        let spike = false;
        for (const direction of [1, -1]) {
            for (let i = center + direction * Math.max(ms(80), complexEnd(direction)); !spike && Math.abs(i - center) <= ms(220)
                && i > 0 && i < n; i += direction) {
                const deviation = v[i] - level;
                spike = Math.abs(v[i] - v[i - 1]) >= 0.6 * normalSlope && Math.abs(deviation) >= 0.5 * normalAmp
                    && Math.sign(deviation) === normalSign;
            }
        }
        const from = center + Math.max(ms(100), complexEnd(1)), to = Math.min(n, center + ms(500));
        const threshold = NOISE_TURN_RATIO * normalAmp;
        let direction = 0, extreme = v[from], turns = 0;
        for (let i = from; i < to; i++) {
            const delta = v[i] - extreme;
            if (direction >= 0 && delta < -threshold) {
                if (direction > 0) turns++;
                direction = -1; extreme = v[i];
            } else if (direction <= 0 && delta > threshold) {
                if (direction < 0) turns++;
                direction = 1; extreme = v[i];
            } else if ((direction > 0 && v[i] > extreme) || (direction < 0 && v[i] < extreme)) {
                extreme = v[i];
            }
        }
        return { turns, spike, noisy: spike || turns >= NOISE_TURN_LIMIT };
    }

    function readColoredWaveShape(container, player = false) {
        const pixels = readColoredWavePixels(container, player);
        if (!pixels) return null;
        const scale = readWaveScale(container);
        // 雜訊：找不到平坦基準線，或紅色心搏附近的原始資料判為雜訊；播放器不使用此判斷。
        const noise = player ? null : analyzeBeatNoise(container);
        return {
            width: pixels.width != null && scale.msPerPixel != null ? pixels.width * scale.msPerPixel : null,
            height: pixels.height != null && scale.mvPerPixel != null ? pixels.height * scale.mvPerPixel : null,
            noisy: pixels.noisy || Boolean(noise?.noisy), turns: noise?.turns ?? null, spike: noise?.spike ?? null,
            direction: pixels.direction,
        };
    }

    // 縮圖畫面上的非目標心搏都畫成黑點，但網站在縮圖資料中保存了每一搏的分類；
    // 以圓點綁定的絕對取樣索引查表，網站的 N / A / V / X 對應面板的 N / S / V / A。找不到時回傳 null。
    function readPreviousClassification(thumb) {
        const wave = thumb.querySelector('.ecgWave');
        let labels;
        try { labels = window.angular?.element(wave)?.isolateScope?.()?.annoData; } catch (_) { /* 未載入 */ }
        if (!labels || typeof labels !== 'object') return null;
        const dots = [...thumb.querySelectorAll('circle.anno-dot')]
            .map(dot => ({ dot, x: numericX(dot) })).filter(item => item.x !== null).sort((a, b) => a.x - b.x);
        const index = dots.findIndex(({ dot }) => dot.classList.contains('current'));
        const previous = index > 0 ? dots[index - 1].dot.__data__ : null;
        return previous == null ? null : ({ N: 'N', A: 'S', V: 'V', X: 'A' })[labels[previous]] || null;
    }

    // 各條件先各自產生命中集合，再取交集，確保同一縮圖符合全部條件。
    function thumbnailHits(settings) {
        if (!validConditions(settings)) return new Set();
        const shapes = new Map();
        if (settings.conditions.some(condition => isShapeCondition(condition) || condition.kind in THUMBNAIL_ONLY_LABELS)) {
            for (const thumb of document.querySelectorAll('#right-list .ecg-trend')) {
                shapes.set(thumb, readColoredWaveShape(thumb));
            }
        }
        const sets = settings.conditions.map(condition => condition.kind === 'rate'
            ? findRateHits(condition.operator, condition.value / 100)
            : condition.kind === 'bpm' ? findHeartRateHits(condition.value, condition.operator)
            : condition.kind === 'previous' ? new Set([...document.querySelectorAll('#right-list .ecg-trend')]
                .filter(thumb => conditionMatches({ previousClassification: readPreviousClassification(thumb) }, condition)))
                : new Set([...shapes].filter(([, metrics]) => metrics && conditionMatches(metrics, condition))
                    .map(([thumb]) => thumb)));
        return new Set([...sets[0]].filter(thumb => sets.every(set => set.has(thumb))));
    }

    // 使用網站原生 Ctrl 狀態及 selectEcg 建立精確目標集合，先清掉包含其他頁的舊選取。
    // finally 保證放開合成 Ctrl；操作後再核對模型與縮圖選取旗標，防止分類連帶修改其他項目。
    function selectThumbnailBatch(scope, page, targets, retainOtherPages = false) {
        const desired = new Set(targets.map(entry => entry.segment));
        if (retainOtherPages) {
            const current = new Set(page.entries.map(entry => entry.segment));
            for (const segment of scope.morphology.state.selectedSegments) {
                if (!current.has(segment)) desired.add(segment);
            }
        }
        // 原站以 document 的按鍵狀態決定是否多選，單純 click.ctrlKey 不足以累加選取。
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Control', code: 'ControlLeft', keyCode: 17, which: 17, ctrlKey: true, bubbles: true,
        }));
        try {
            scope.$apply(() => {
                scope.focusRight();
                // 包含其他頁的既有選取，避免分類按鈕順帶修改非命中項目。
                for (const segment of scope.morphology.state.selectedSegments.slice()) {
                    if (desired.has(segment)) continue;
                    const index = scope.morphology.ecgEnlargedChart.information.posInfo
                        .findIndex(info => Number(info.absoluteIndex) === Number(segment.absoluteIndex));
                    if (index < 0) throw new Error('無法定位既有選取');
                    scope.selectEcg(segment, index);
                }
                for (const entry of targets) {
                    if (!scope.morphology.state.selectedSegments.includes(entry.segment)) scope.selectEcg(entry.segment, entry.index);
                }
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

    // 沿用任務設定的速度排程下一步，並攜帶 epoch 排除已取消的任務。
    function scheduleThumbnailStep(epoch) {
        thumbnailTimer = setTimeout(() => thumbnailStep(epoch), thumbnailRun?.settings.interval || 10);
    }

    // 每輪核對任務身分、分類、type、模式及預期頁碼，再等待頁面資料連續兩次穩定。
    // 本頁只套用一次分類；網站確認後才累加計數，下一輪再檢查清單有無位移並翻頁。
    // 分類造成清單縮減、翻頁失敗或資料逾時時暫停，避免略過未處理項目或重複修改。
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
                const selectionOnly = run.settings.label === 'select';
                const targets = page.entries.filter(entry => hits.has(entry.thumb)
                    && (selectionOnly || (entry.segment.modifiedLabel || entry.segment.label) !== run.settings.label));
                selectThumbnailBatch(scope, page, targets, selectionOnly && run.selectionStarted);
                if (selectionOnly) run.selectionStarted = true;
                if (!selectionOnly && targets.length) {
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
                if (run.singlePage) { pauseThumbnails(selectionOnly ? '單頁選取完成' : '單頁完成'); return; }
                // 分類造成頁面縮減時停下，避免位移後跳過未處理心搏。
                if (model.state.type !== run.type || model.state.label !== run.category) {
                    pauseThumbnails('目前 type 已結束'); return;
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
            if (page.page >= page.total) { pauseThumbnails('已到最後一頁'); return; }
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

    // 驗證單一 type 與可用分類操作，尊重網站禁止改為 N 的設定。
    // 先停止播放器，再保存模型、分類、type、設定及預期頁碼，從目前頁開始執行。
    function startThumbnails(singlePage = false) {
        boundsMessages.thumbnail = '';
        const settings = readThumbnailSettings();
        const scope = thumbnailScope();
        const model = scope?.morphology;
        if (!validConditions(settings)) { thumbnailStatus('請新增至少一項條件並輸入有效數值'); return; }
        if (!['V', 'S', 'N', 'A', 'select'].includes(settings.label) || !model?.state?.type
            || typeof scope.selectEcg !== 'function' || typeof scope.focusRight !== 'function'
            || model.state.multipleTypesSelected || model.state.classificationMode || model.compareMode?.selectMode
            || document.querySelector('.ngdialog')) { thumbnailStatus('請選取單一 type 並關閉其他模式／視窗'); return; }
        if (settings.label === 'N' && model.content?.disableN) { thumbnailStatus('網站目前禁止改為 N'); return; }
        pausePlayer('縮圖批次修改中');
        thumbnailEpoch++;
        thumbnailRun = { model, settings, singlePage, category: model.state.label, type: model.state.type,
            expectedPage: Number(model.pagination.currentPage), waitSince: Date.now(), stableSignature: '', applied: false };
        document.querySelector(`#${CONFIG.controlId} [data-role="batch-play"]`).textContent = 'Ⅱ 暫停';
        thumbnailStep(thumbnailEpoch);
    }

    // 建立批次分類、速度與播放按鈕；攔截面板操作，避免傳入網站選取快捷鍵。
    // 條件變動暫停目前任務，重新按播放後才採用新設定。
    function installThumbnailBatchControl(control) {
        const group = document.createElement('span');
        group.className = 'thumbnail-batch-actions';
        group.innerHTML = `<label>改為 <select data-role="batch-label" aria-label="縮圖批次目標分類"><option>V</option><option>S</option><option>N</option><option>A</option><option value="select" selected>僅選中</option></select></label><label>速度 <select data-role="batch-speed" aria-label="縮圖批次修改速度" title="每次檢查／處理的排程間隔，資料未同步時會等待"><option value="10" selected>10 ms</option><option value="20">20 ms</option><option value="40">40 ms</option><option value="100">100 ms</option></select></label><button type="button" data-role="batch-play">▶ 批次修改</button>`;
        control.appendChild(group);
        const singlePage = document.createElement('button');
        singlePage.type = 'button';
        singlePage.dataset.role = 'batch-single';
        singlePage.textContent = '單頁修改';
        group.insertBefore(singlePage, group.querySelector('[data-role="batch-play"]'));
        singlePage.addEventListener('click', () => {
            if (thumbnailRun) pauseThumbnails();
            startThumbnails(true);
        });
        const status = document.createElement('span');
        status.dataset.role = 'batch-status';
        status.innerHTML = '<span class="st-row" data-row="summary"><span data-slot="count">未選取</span><span data-slot="bpm">BPM —</span><span data-slot="changed">修改 0</span><span data-slot="pages">頁 0</span></span>'
            + '<span class="st-row" data-row="shape"><span data-slot="width">寬 —</span><span data-slot="height">高 —</span></span>'
            + '<span data-slot="message">待命 · Esc 暫停</span>';
        group.appendChild(status);
        for (const name of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']) {
            control.addEventListener(name, event => event.stopPropagation());
        }
        // 保留表單編輯按鍵；非輸入狀態的原生翻頁鍵、分類鍵與修飾鍵交回網站。
        // keyup 同樣放行，避免原生長按／Ctrl 多選狀態卡住。
        for (const name of ['keydown', 'keyup']) control.addEventListener(name, event => {
            const key = event.key.toLowerCase();
            const modifier = ['control', 'shift', 'alt', 'meta'].includes(key);
            const editing = event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
            const navigation = ['q', 'e', '1', '2', '3', '4', 'arrowleft', 'arrowright', 'pageup', 'pagedown', 'home', 'end'].includes(key);
            if (modifier) return;
            if (!editing && navigation && !event.isComposing) {
                if (name === 'keydown') {
                    event.preventDefault();
                    const scope = thumbnailScope();
                    if (typeof scope?.focusRight === 'function') {
                        if (scope.$root?.$$phase) scope.focusRight();
                        else scope.$apply(() => scope.focusRight());
                    }
                }
                return;
            }
            event.stopPropagation();
        });
        for (const name of ['change', 'input']) control.addEventListener(name, () => {
            if (thumbnailRun) pauseThumbnails('設定已變更，請重新播放');
        });
        group.querySelector('[data-role="batch-play"]').addEventListener('click', () => {
            if (thumbnailRun) pauseThumbnails(); else startThumbnails();
        });
    }


    // 確保兩處控制面板存在，清除舊命中樣式後依目前條件重算縮圖標記。
    // 符合條件但顯示分類不同於目前分類者另加提示類別，不改變原生選取狀態。
    function update() {
        ensureControl(); ensurePlayerControl();
        refreshThumbnailStatus();
        document.querySelectorAll('#right-list .ecg-trend').forEach(thumb => thumb.classList.remove(CONFIG.hitClass, CONFIG.reclassifiedClass));
        const settings = readThumbnailSettings();
        const valid = validConditions(settings);
        // 左側 type 只依波形方向上色，不套用其他數值條件；條件設定無效時一併清除。
        refreshTypeDirection(valid ? settings.conditions.find(condition => condition.kind === 'direction')?.value : null);
        if (!valid) return;
        const category = getCurrentCategory();
        thumbnailHits(settings).forEach(thumb => {
            thumb.classList.add(CONFIG.hitClass);
            const classification = getClassification(thumb);
            if (category && classification && classification !== category) thumb.classList.add(CONFIG.reclassifiedClass);
        });
    }

    // 以 scheduled 合併短時間多次 DOM 通知，180 ms 後統一更新縮圖標記。
    function scheduleUpdate() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
            scheduled = false;
            update();
        }, CONFIG.debounceMs);
    }

    // 初次建立樣式及面板，再監看可能改變縮圖內容或顏色的 DOM 屬性。
    // 排除面板與純腳本標記更新，並監聽 Esc、手動操作及頁面隱藏，讓自動任務及時暫停。
    function init() {
        installStyle();
        enabled = false;
        heartRateEnabled = false;
        update();
        // capture 排程到原站選取完成之後；涵蓋 Ctrl/Shift 多選及取消選取。
        document.addEventListener('click', event => {
            if (event.target.closest?.('#right-list')) {
                if (!thumbnailRun && event.target.closest?.('.ecg-trend')) {
                    thumbnailMessage = '待命 · Esc 暫停';
                }
                clearBoundsMessage('thumbnail');
                scheduleThumbnailStatus();
            }
        }, true);
        observer = new MutationObserver(records => {
            if (!document.querySelector('.morphology > .container')) {
                enabled = false;
                heartRateEnabled = false;
                controlContainer = null;
            }
            const relevant = records.some(record => {
                const statusTarget = record.target instanceof Element ? record.target : record.target.parentElement;
                if (statusTarget?.closest(`#${CONFIG.controlId} [data-role="batch-status"]`)) return false;
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
                    // 選取色不必重算整頁標記，但必須更新單選／多選資訊。
                    if ((record.oldValue || '').includes('selectedBackground') !== target.classList.contains('selectedBackground')) {
                        scheduleThumbnailStatus();
                    }
                    const ignored = new Set(['selectedBackground']);
                    return stripClasses(record.oldValue, ignored) !== stripClasses(target.getAttribute('class'), ignored);
                }

                // 腳本自己切換的 type 方向標記不算網站變動，避免更新後又觸發更新。
                if (target.matches('.morphology .type-trend')) {
                    const ignored = new Set([CONFIG.typeHitClass]);
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

    // MP 快速選印：在 VEB / SVEB 分頁按 5，將選取的縮圖加入（或移出）報告選印。
    // 心搏依網站的分類規則歸入 VT、Triplet、Couplet、Bigeminy 等清單，選印該清單中包含此心搏的心電圖；
    // 都不屬於時才選印 VEB / SVEB 清單本身。直接讀寫網站保存的選印資料，與事件清單的印表機圖示相同。
    const PRINT_KEY = '5';
    const PRINT_STRIP_AFTER = 6; // 事件清單心電圖顯示起點前 4 秒至後 6 秒（網站 getTmsRange(t, 10)）
    const PRINT_RUN_GAP = 1.2; // 連發（Couplet、Triplet、VT 等）相鄰心搏的最大間隔（秒）
    // run：事件時間附近、間隔不超過 PRINT_RUN_GAP 的連續心搏都屬於該事件（beats 為最多心搏數）；
    // 其他分類：心搏時間等於事件時間，或落在事件心電圖（起點後 6 秒）內。
    const PRINT_CATEGORIES = {
        V: { list: 'tmsPVC', pos: 'posPVC', fallback: { key: 'pvcTmsArr', name: 'VEB' }, groups: [
            { record: 'VT_tms', key: 'vtTmsArr', name: 'VT', run: true },
            { record: 'triplet_tms', key: 'tripletTmsArr', name: 'Triplet', run: true, beats: 3 },
            { record: 'couplet_tms', key: 'coupletTmsArr', name: 'Couplet', run: true, beats: 2 },
            { record: 'bigemini_tms', key: 'bigeminiTmsArr', name: 'Bigeminy' },
            { record: 'trigemini_tms', key: 'trigeminiTmsArr', name: 'Trigeminy' },
        ] },
        S: { list: 'tmsSVEB', pos: 'posSVEB', fallback: { key: 'svebTmsArr', name: 'SVEB' }, groups: [
            { record: 'SVT_tms', key: 'svtTmsArr', name: 'SVT', run: true },
            { record: '3S_tms', key: 'S_tripletTmsArr', name: 'S Triplet', run: true, beats: 3 },
            { record: '2S_tms', key: 'S_coupletTmsArr', name: 'S Couplet', run: true, beats: 2 },
            { record: 'S_bigemini_tms', key: 'S_bigeminiTmsArr', name: 'S Bigeminy' },
            { record: 'S_trigemini_tms', key: 'S_trigeminiTmsArr', name: 'S Trigeminy' },
            { record: 'SVE_tms', key: 'sveTmsArr', name: 'SVE' },
        ] },
    };
    let printContext = null;
    let printBusy = false;

    function plainData(value) {
        return value && typeof value.plain === 'function' ? value.plain() : value;
    }
    function readStoredId(name) {
        try { return JSON.parse(localStorage.getItem(`rooti-care.${name}`)); } catch (_) { return null; }
    }
    // 讀取心搏位置與分類事件；同一份紀錄沿用快取，找不到心搏時才重新讀取。
    async function loadPrintContext(force = false) {
        const scope = thumbnailScope();
        const user = scope?.rooticare?.selectedUser;
        const ids = { vendorId: user?.vendorId, idNumber: user?.idNumber,
            measureId: readStoredId('_measureId'), afId: readStoredId('_afId') };
        if (!ids.vendorId || !ids.idNumber || !ids.measureId || !ids.afId) throw new Error('找不到病患或紀錄編號');
        const cacheKey = `${ids.vendorId}|${ids.idNumber}|${ids.measureId}|${ids.afId}`;
        if (!force && printContext?.cacheKey === cacheKey) return printContext;
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const [tags, subCategories, annoModified] = await Promise.all([
            manager.Af.getTagTms(ids.vendorId, ids.idNumber, ids.afId),
            manager.Af.getSubCategoryRecord(ids.vendorId, ids.idNumber, ids.measureId).catch(() => null),
            manager.Af.getAnnoModifiedData(ids.vendorId, ids.idNumber, ids.measureId).catch(() => null),
        ]);
        const record = Object.assign({}, plainData(tags) || {}, plainData(subCategories) || {});
        // 早搏清單（posPVC／posSVEB）是原始分析結果，儲存的標籤修改不會反映在裡面；
        // 依修改紀錄把改成 V／S 的心搏加入、從 V／S 改掉的移出，改過標籤的心搏才找得到時間。
        const beatSets = mergeLabelEdits({
            V: pairBeats(record[PRINT_CATEGORIES.V.list], record[PRINT_CATEGORIES.V.pos]),
            S: pairBeats(record[PRINT_CATEGORIES.S.list], record[PRINT_CATEGORIES.S.pos]),
        }, plainData(annoModified));
        const lists = {};
        for (const [label, config] of Object.entries(PRINT_CATEGORIES)) {
            const groups = config.groups.map(group => ({ ...group,
                starts: [...new Set((record[group.record] || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b) }));
            lists[label] = { groups, fallback: config.fallback };
            setListBeats(lists[label], beatSets[label]);
        }
        const sampleRate = Number(readStoredId('_sampleRate')) || 250;
        printContext = { cacheKey, ids, manager, lists, sampleRate };
        return printContext;
    }
    // 時間與位置清單配成 Map（位置 → 時間）。
    function pairBeats(times, positions) {
        const beats = new Map();
        const list = Array.isArray(positions) ? positions : [];
        list.forEach((pos, index) => {
            const position = Number(pos);
            const time = Number(times?.[index]);
            if (Number.isFinite(position) && Number.isFinite(time)) beats.set(position, time);
        });
        return beats;
    }
    // 套用標籤修改紀錄（[時間, 位置, 新標籤, 原標籤, 1]）：新標籤為 V 加入 V、S／A 加入 S，其他（N、X 等）兩邊都移除。
    function mergeLabelEdits(beatSets, edits) {
        for (const item of Array.isArray(edits) ? edits : []) {
            if (!Array.isArray(item) || !item[4]) continue;
            const time = Number(item[0]);
            const position = Number(item[1]);
            if (!Number.isFinite(position)) continue;
            beatSets.V.delete(position);
            beatSets.S.delete(position);
            const kind = item[2] === 'V' ? 'V' : item[2] === 'S' || item[2] === 'A' ? 'S' : null;
            if (kind && Number.isFinite(time)) beatSets[kind].set(position, time);
        }
        return beatSets;
    }
    // 依位置排序寫入清單，並重建查詢用的索引。
    function setListBeats(list, beats) {
        const sorted = [...beats].sort((a, b) => a[0] - b[0]);
        list.beats = beats;
        list.positions = sorted.map(([position]) => position);
        list.times = sorted.map(([, time]) => time);
        list.indexByPos = new Map(list.positions.map((position, index) => [position, index]));
        list.firstIndexByTime = new Map();
        list.times.forEach((time, index) => { if (!list.firstIndexByTime.has(time)) list.firstIndexByTime.set(time, index); });
    }
    // 第一個不早於 time 的位置（二分搜尋）。
    function lowerBound(values, time) {
        let low = 0, high = values.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (values[middle] < time) low = middle + 1; else high = middle;
        }
        return low;
    }
    // 事件時間只到秒，未必對到連發的第一搏；以事件時間的心搏為錨點，
    // 向前後擴展相鄰間隔不超過 PRINT_RUN_GAP 的心搏，得到整段連發的索引範圍。
    function runAround(list, anchor, sampleRate, maxBeats) {
        const gap = PRINT_RUN_GAP * sampleRate;
        let first = anchor, last = anchor;
        while (first > 0 && list.positions[first] - list.positions[first - 1] <= gap) first--;
        while (last < list.positions.length - 1 && list.positions[last + 1] - list.positions[last] <= gap) last++;
        // 有固定心搏數的分類（Couplet、Triplet）只取錨點附近的對應數量，避免併入相鄰的另一組。
        if (maxBeats && last - first + 1 > maxBeats) {
            first = Math.max(first, anchor - maxBeats + 1);
            last = Math.min(last, first + maxBeats - 1);
        }
        return [first, last];
    }
    // 依序檢查分類，找出包含此心搏的事件；都不符合時歸入 VEB / SVEB 清單本身。
    function resolvePrintTarget(list, index, sampleRate) {
        const time = list.times[index];
        for (const group of list.groups) {
            if (!group.starts.length) continue;
            if (group.run) {
                // 只需檢查附近的事件：連發的心搏與事件時間相差不會超過數秒。
                for (let i = lowerBound(group.starts, time - 10); i < group.starts.length && group.starts[i] <= time + 10; i++) {
                    const start = group.starts[i];
                    const anchor = list.firstIndexByTime.get(start);
                    if (anchor === undefined) continue;
                    const [first, last] = runAround(list, anchor, sampleRate, group.beats);
                    if (index >= first && index <= last) return { key: group.key, name: group.name, time: start };
                }
                continue;
            }
            const position = lowerBound(group.starts, time + 1) - 1; // 最後一個不晚於此心搏的事件
            const start = group.starts[position];
            if (start !== undefined && time - start <= PRINT_STRIP_AFTER) return { key: group.key, name: group.name, time: start };
        }
        return { key: list.fallback.key, name: list.fallback.name, time };
    }
    // 依縮圖目前的標籤（Morphology 未儲存的改標 modifiedLabel 優先）決定 V 或 S：
    // 心搏還在另一份清單（S↔V 改標後清單未更新）時移到正確的清單，避免選印到錯誤的分類；
    // allowInsert：重新讀取後仍找不到時，以縮圖本身的時間把這顆心搏加入對應清單。改成 N 等非早搏時不選印。
    function findBeat(context, segment, label, allowInsert = false) {
        const position = Number(segment.absoluteIndex);
        const current = segment.modifiedLabel || segment.label || label;
        const kind = current === 'V' ? 'V' : current === 'S' || current === 'A' ? 'S' : null;
        if (!kind || !Number.isFinite(position)) return null;
        const list = context.lists[kind];
        const other = context.lists[kind === 'V' ? 'S' : 'V'];
        const index = list.indexByPos.get(position);
        if (index !== undefined) return { list, index };
        let time = other.beats.get(position);
        if (time !== undefined) {
            other.beats.delete(position);
            setListBeats(other, other.beats);
        } else {
            time = Number(segment.timestamp);
            if (!allowInsert || !Number.isFinite(time)) return null;
        }
        list.beats.set(position, time);
        setListBeats(list, list.beats);
        return { list, index: list.indexByPos.get(position) };
    }
    function selectedPrintSegments(scope) {
        const selected = scope?.morphology?.state?.selectedSegments || [];
        if (selected.length) return selected.slice();
        // 沒有選取時改用滑鼠下方的縮圖。
        const hovered = document.querySelector('#right-list .ecg-trend:hover');
        const segment = hovered && window.angular.element(hovered).scope?.()?.segment;
        return segment ? [segment] : [];
    }

    function printToast(message, isError = false) {
        let toast = document.getElementById('rc-mp-print-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'rc-mp-print-toast';
            toast.setAttribute('role', 'status');
            toast.style.cssText = 'position:fixed;left:50%;bottom:28px;z-index:2147483000;transform:translateX(-50%);'
                + 'max-width:min(560px,calc(100vw - 32px));padding:8px 14px;border-radius:16px;color:#fff;'
                + 'font:600 13px/1.4 Arial,"Microsoft JhengHei",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);'
                + 'pointer-events:none;transition:opacity .2s;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.background = isError ? '#c0392b' : '#4f6b1a';
        toast.style.opacity = '1';
        clearTimeout(toast.rcTimer);
        // 訊息消失後重新開始累計。
        toast.rcTimer = setTimeout(() => { toast.style.opacity = '0'; printTally = null; }, isError ? 4000 : 2500);
    }
    // 訊息顯示期間連續選印時，依分類累加張數；改為取消選印（或反之）時重新計算。
    let printTally = null;
    function printTallyMessage(remove, changed, missing) {
        if (!printTally || printTally.remove !== remove) printTally = { remove, counts: new Map(), missing: 0 };
        for (const target of changed) printTally.counts.set(target.name, (printTally.counts.get(target.name) || 0) + 1);
        printTally.missing += missing;
        const detail = [...printTally.counts].map(([name, count]) => `${name} ${count} 張`).join('、');
        return `${remove ? '已取消選印' : '已選印'}：${detail || '0 張'}`
            + (printTally.missing ? `（${printTally.missing} 張找不到心搏時間）` : '');
    }

    async function togglePrintForSelection() {
        const scope = thumbnailScope();
        const label = scope?.morphology?.state?.label;
        if (label !== 'V' && label !== 'S') return; // NOR / ART 分頁不處理
        const segments = selectedPrintSegments(scope);
        if (!segments.length) { printToast('請先選取縮圖', true); return; }
        printBusy = true;
        try {
            let context = await loadPrintContext();
            let beats = segments.map(segment => findBeat(context, segment, label));
            if (beats.some(beat => !beat)) {
                context = await loadPrintContext(true);
                beats = segments.map(segment => findBeat(context, segment, label, true));
            }
            const missing = beats.filter(beat => !beat).length;
            const targets = new Map();
            for (const beat of beats) {
                if (!beat) continue;
                const target = resolvePrintTarget(beat.list, beat.index, context.sampleRate);
                targets.set(`${target.key}:${target.time}`, target);
            }
            if (!targets.size) { printToast('找不到這些心搏的時間，無法選印', true); return; }

            // 每次重新讀取網站保存的選印，避免覆蓋其他頁面的變更。
            const { ids, manager } = context;
            const events = plainData(await manager.Af.getPDFSelectedEvents(ids.vendorId, ids.idNumber, ids.measureId));
            if (!events || typeof events !== 'object') throw new Error('讀不到目前的選印資料');
            const has = target => (events[target.key] || []).some(time => Number(time) === target.time);
            const remove = [...targets.values()].every(has); // 全部已選印時改為取消
            // 只計入這次真的有變動的心電圖（已選印的不重複計算）。
            const changed = [...targets.values()].filter(target => remove ? has(target) : !has(target));
            for (const target of targets.values()) {
                const times = (events[target.key] || []).map(Number).filter(time => time !== target.time);
                if (!remove) times.push(target.time);
                events[target.key] = times.sort((a, b) => a - b);
                // 與網站相同：選入子分類時，從 VEB / SVEB 移除同一時間，避免重複列印。
                if (!remove) {
                    for (const fallback of [PRINT_CATEGORIES.V.fallback.key, PRINT_CATEGORIES.S.fallback.key]) {
                        if (fallback !== target.key && Array.isArray(events[fallback])) {
                            events[fallback] = events[fallback].filter(time => Number(time) !== target.time);
                        }
                    }
                }
            }
            await manager.Af.postPDFSelectedEvents(ids.vendorId, ids.idNumber, ids.measureId, events);

            printToast(printTallyMessage(remove, changed, missing));
        } catch (error) {
            printToast(`選印失敗：${error?.message || error}`, true);
        } finally {
            printBusy = false;
        }
    }

    document.addEventListener('keydown', event => {
        if (event.key !== PRINT_KEY || event.repeat || event.isComposing
            || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
        if (!document.querySelector('.morphology > .container') || document.querySelector('.ngdialog')) return;
        if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (thumbnailRun || playerRunning) return;
        const label = thumbnailScope()?.morphology?.state?.label;
        if (label !== 'V' && label !== 'S') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!printBusy) togglePrintForSelection();
    }, true);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
