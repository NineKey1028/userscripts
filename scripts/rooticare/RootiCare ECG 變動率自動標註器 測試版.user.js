// ==UserScript==
// @name         RootiCare ECG 變動率自動標註器 測試版（S 標籤）
// @namespace    https://editoreu.rooticare.com/ecg-rate-test
// @version      0.2.0
// @description  以 RootiCare 既有 S 標籤為準，將對應間隔與心率標紅；保留平均心率快捷鍵。測試時請停用原版。
// @author       Alex
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 每個 annoGroup 獨立對應既有標籤，不以間隔推測 S/N/V 分類。
    const ENABLE_LOG = true;
    const DEBOUNCE_TIME = 100;
    const MAX_VAL_FILTER = 10000;
    const TARGET_COLOR = '#FF0000';
    const TRIGGER_KEY = '`';
    const OVERLAY_CLASS = 'ecg-rate-test-avg-overlay';
    const originalStyles = new WeakMap();
    let groupDataCache = [];
    let isKeyPressed = false;

    function pairLabels(group, durations) {
        const labels = Array.from(group.querySelectorAll('text.annoText'));
        const byIndex = new Map();
        for (const label of labels) {
            const index = label.__data__?.index;
            if (!Number.isFinite(index)) continue;
            // 同一組若有重複 index，不猜測對應。
            byIndex.set(index, byIndex.has(index) ? null : label);
        }
        // 已核對 RootiCare 公開繪圖程式 app.4b57c0e1.js：
        // annoText 綁定 n 的 {index,type}；annoDuration 綁定 n.map(item => item.index)。
        // 間隔是「前一顆到該顆」，因此依 index 對應右側的心跳標籤。
        // 保留空白間隔節點，不能先過濾，否則順序會錯位。
        const canPairByOrder = labels.length === durations.length &&
            labels.every(label => label.__data__ === undefined) &&
            durations.every(duration => duration.__data__ === undefined);
        return durations.map((duration, position) => {
            if (Number.isFinite(duration.__data__)) {
                const label = byIndex.get(duration.__data__);
                return { label: label || null, method: label ? '心跳 index' : '無對應標籤' };
            }
            // 手動量測的 annoDuration 綁定 {index:[start,end],sec,bpm}，不是單顆心跳。
            if (canPairByOrder) return { label: labels[position], method: '同組完整順序' };
            return { label: null, method: '無對應標籤／量測區間' };
        });
    }

    function highlight(element, enabled) {
        if (enabled) {
            if (!originalStyles.has(element)) {
                originalStyles.set(element, ['fill', 'font-weight'].map(property => ({
                    property, value: element.style.getPropertyValue(property),
                    priority: element.style.getPropertyPriority(property)
                })));
            }
            element.style.setProperty('fill', TARGET_COLOR, 'important');
            element.style.setProperty('font-weight', 'bold', 'important');
        } else if (originalStyles.has(element)) {
            for (const { property, value, priority } of originalStyles.get(element)) {
                if (value) element.style.setProperty(property, value, priority);
                else element.style.removeProperty(property);
            }
            originalStyles.delete(element);
        }
    }

    function readInterval(element) {
        // 只讀主文字，避免把 tspan 的 bpm 當成間隔。
        const mainText = Array.from(element.childNodes)
            .filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim();
        const match = mainText.match(/^\s*(\d+(?:\.\d+)?)\s*(?:ms)?\s*$/i);
        return match ? Number(match[1]) : null;
    }

    function processECGData() {
        groupDataCache = [];
        document.querySelectorAll('.annoGroup').forEach((group, groupIdx) => {
            const elements = Array.from(group.querySelectorAll('text.annoDuration'));
            const pairs = pairLabels(group, elements);
            const heartRates = [];
            const logRows = [];
            elements.forEach((element, index) => {
                const { label, method } = pairs[index];
                // 以畫面文字為準；網站修改分類時 __data__.type 可能還保留原值。
                const classification = label?.textContent.trim().toUpperCase() || '';
                const hit = classification === 'S';
                const ms = readInterval(element);
                const hrText = element.querySelector('tspan')?.textContent || '';
                const hrMatch = hrText.match(/\d+/);
                if (ms > 0 && ms < MAX_VAL_FILTER && hrMatch && Number(hrMatch[0]) > 0) {
                    heartRates.push(Number(hrMatch[0]));
                }
                highlight(element, hit);
                element.querySelectorAll('tspan').forEach(tspan => highlight(tspan, hit));
                logRows.push({
                    '順序': index + 1, '間隔 ms': ms, '既有標籤': classification || '—',
                    '標紅': hit, '對應方式': method
                });
            });
            const avgHR = heartRates.length ? (heartRates.reduce((a, b) => a + b, 0) / heartRates.length).toFixed(2) : null;
            groupDataCache.push({ element: group, avgHR });
            if (ENABLE_LOG && logRows.length) {
                console.groupCollapsed(`[ECG S 標籤測試版 v0.2.0] Group ${groupIdx + 1}`);
                console.table(logRows);
                console.groupEnd();
            }
        });
        if (isKeyPressed) showAverages();
    }

    function hideAverages() {
        document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(element => element.remove());
    }

    function showAverages() {
        hideAverages();
        groupDataCache.forEach(({ element, avgHR }) => {
            if (avgHR === null) return;
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const overlay = document.createElement('div');
            overlay.className = OVERLAY_CLASS;
            overlay.textContent = `Avg: ${avgHR} bpm`;
            Object.assign(overlay.style, {
                position: 'absolute', left: `${rect.left + window.scrollX + rect.width / 2}px`,
                top: `${rect.top + window.scrollY + rect.height / 2}px`, transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(0, 122, 204, 0.9)', color: '#ffffff', padding: '4px 8px',
                borderRadius: '4px', fontSize: '14px', fontWeight: 'bold', zIndex: '99999',
                pointerEvents: 'none', whiteSpace: 'nowrap'
            });
            document.body.appendChild(overlay);
        });
    }

    window.addEventListener('keydown', event => {
        const focused = document.activeElement;
        if (event.key !== TRIGGER_KEY || isKeyPressed ||
            focused?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused?.tagName)) return;
        isKeyPressed = true;
        showAverages();
    });
    function releaseAverages() { isKeyPressed = false; hideAverages(); }
    window.addEventListener('keyup', event => { if (event.key === TRIGGER_KEY) releaseAverages(); });
    window.addEventListener('blur', releaseAverages);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAverages(); });

    let timeout;
    const isOverlay = node => node.nodeType === 1 && node.classList.contains(OVERLAY_CLASS);
    const observer = new MutationObserver(mutations => {
        // 忽略自己的浮層增刪；不監看 style，避免重算迴圈。
        const relevant = mutations.some(mutation => mutation.type === 'characterData' ||
            [...mutation.addedNodes, ...mutation.removedNodes].some(node => !isOverlay(node)));
        if (!relevant) return;
        clearTimeout(timeout);
        timeout = setTimeout(processECGData, DEBOUNCE_TIME);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(processECGData, 2000);
})();
