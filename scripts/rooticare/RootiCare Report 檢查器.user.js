// ==UserScript==
// @name         RootiCare Report 檢查器
// @namespace    https://editoreu.rooticare.com/
// @version      2.10
// @description  檢查 RootiCare Report 的 R-R、Max. sinus 標籤與 VT 平均心率。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20Report%20檢查器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20Report%20檢查器.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const CONFIG = {
        indicatorId: 'rooticare-report-checker-indicator',
        maxSinusIndicatorId: 'rooticare-report-checker-max-sinus-indicator',
        vtIndicatorId: 'rooticare-report-checker-vt-indicator',
        reportSelector: '#af-print-dialog',
        detailSelector: '.event-ecg-blk .ecgRMarker .annoDuration',
        maxIntervalMs: 10000,
        debounceMs: 250,
        visibleMargin: 48,
    };

    let indicator;
    let maxSinusIndicator;
    let vtIndicator;
    let observer;
    let scanTimer;
    let target = null;
    let maxSinusTarget = null;
    let vtTarget = null;
    let targetInterval = 0;
    let reportInterval = 0;
    let targetTimestamp = '';

    function parseReportSeconds(text) {
        const match = text.match(/([\d.,]+)\s*(?:sec|secs|s)\b/i);
        if (!match) return NaN;
        let value = match[1];
        if (value.includes(',') && value.includes('.')) {
            value = value.replaceAll(',', '');
        } else if (value.includes(',')) {
            value = /,\d{1,2}$/.test(value) ? value.replace(',', '.') : value.replaceAll(',', '');
        }
        return Number(value);
    }

    function normalizeLabel(text) {
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function parseAverageHeartRate(text) {
        const normalized = normalizeLabel(text).replace(/\u00a0/g, ' ');
        const label = /(?:avg\.?\s*hr|average\s*hr|mean\s*hr|hr\s*avg|fc\s*(?:moy(?:enne)?\.?|media|medio)|(?:frequence cardiaque|frecuencia cardiaca|frequenza cardiaca)\s*(?:moyenne|media|medio)|(?:gem\.?\s*hr|gemiddelde\s*(?:hartfrequentie|hartslag))|(?:durchschnitt(?:liche)?\s*(?:hf|herzfrequenz)|mittlere\s*herzfrequenz)|(?:平均\s*(?:心率|hr)))/i;
        const match = normalized.match(new RegExp(`${label.source}\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:bpm|beats?\\s*per\\s*minute)?`, 'i'));
        if (!match) return NaN;

        // A repeated report title/time can place a date right after the label, e.g.
        // "VT with Fastest Avg. HR 18/09/2026 ... Avg HR: 130bpm".
        // Prefer an explicitly bpm-qualified value so the date is never read as HR.
        const values = [...normalized.matchAll(new RegExp(`${label.source}\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(bpm|beats?\\s*per\\s*minute)`, 'ig'))];
        const selected = values.at(-1)?.[1] || match[1];
        return Number(selected.replace(',', '.'));
    }

    function isVTHeader(text) {
        const normalized = normalizeLabel(text);
        return /\bvt\b|\btv\b|ventricular\s+tachycardia|tachycardie\s+ventriculaire|tachicardia\s+ventricolare|taquicardia\s+ventricular|ventrikulare\s+tachykardie|心室頻(?:拍|脈)|室性心動過速/.test(normalized);
    }

    function isLongestVTHeader(text) {
        const normalized = normalizeLabel(text);
        return /\blongest\s+(?:vt|tv)\b|\b(?:vt|tv)\s+(?:(?:le\s+)?plus\s+long\w*|piu\s+lung\w*|langst\w*|mas\s+largo\w*|mais\s+long\w*)\b|(?:最長|最长|最久|最大)\s*(?:vt|tv)/.test(normalized);
    }

    function getLowAverageVTFinding(report) {
        const findings = [...report.querySelectorAll('.print-page-content-blk')]
            .filter(card => card.querySelector('.event-ecg-blk'))
            .map(card => {
                const header = card.querySelector('.event-ecg-header-blk');
                const headerText = header?.innerText?.trim().replace(/\s+/g, ' ') || '';
                const cardText = card.innerText?.trim().replace(/\s+/g, ' ') || card.textContent || '';
                return {
                    ecg: card.querySelector('.event-ecg-blk'),
                    avgHr: isVTHeader(headerText) && !isLongestVTHeader(headerText)
                        ? parseAverageHeartRate(cardText)
                        : NaN,
                };
            })
            .filter(item => Number.isFinite(item.avgHr) && item.avgHr < 100);
        if (!findings.length) return null;
        return {
            ...findings.reduce((lowest, item) => item.avgHr < lowest.avgHr ? item : lowest),
            count: findings.length,
        };
    }

    function isLongestRRLabel(text) {
        const normalized = text.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        // IRRmax/IRmax already includes the maximum qualifier. There is no
        // word boundary before "max" in these localized report labels.
        if (/\bir{1,2}\s*max\b/.test(normalized)) return true;
        const hasRR = /\br\s*[-–]?\s*r\b|\bir\s*max\b|\birr\s*max\b/.test(normalized);
        const hasLongestTerm = /\blongest\b|\b(?:le\s+)?plus\s+long\w*\b|\bpiu\s+lung\w*\b|\blangst\w*\b|\bmas\s+largo\w*\b|\bmais\s+long\w*\b|\blengest\w*\b|\blangsta\w*\b|\bnajdluzs\w*\b|\bmax(?:imum|im\w*)?\b|\bmassim\w*\b/.test(normalized) || /最長|最长|最久|最大/.test(text);
        return hasRR && hasLongestTerm;
    }

    function getReportIntervalInfo(report, intervals) {
        // Compare the actual millisecond annotations in Longest R-R strips.
        // The header can truncate 4579 ms to 4.57 s, causing duplicate warnings.
        const rrEcgs = [...report.querySelectorAll('.print-page-content-blk')]
            .filter(card => isLongestRRLabel(card.querySelector('.event-ecg-header-blk')?.textContent || ''))
            .flatMap(card => [...card.querySelectorAll('.event-ecg-blk')]);
        const rrIntervals = intervals.filter(item => rrEcgs.includes(item.ecg));
        if (rrIntervals.length) {
            const milliseconds = Math.max(...rrIntervals.map(item => item.milliseconds));
            return { seconds: milliseconds / 1000, milliseconds, sourceEcgs: rrEcgs };
        }

        const headerMetrics = [...report.querySelectorAll('.event-ecg-header-blk p')]
            .filter(item => isLongestRRLabel(item.textContent || ''))
            .map(item => ({
                seconds: parseReportSeconds(item.textContent || ''),
                ecg: item.closest('.print-page-content-blk')?.querySelector('.event-ecg-blk') || null,
            }))
            .filter(item => Number.isFinite(item.seconds));

        const summaryRows = [...report.querySelectorAll('.side-blk-2 .info-row')];
        const summaryRow = summaryRows.find(item =>
            isLongestRRLabel(item.querySelector('.info-cell')?.textContent || ''));
        if (summaryRow) {
            const value = summaryRow.querySelectorAll('.info-cell')[1]?.textContent || '';
            const seconds = parseReportSeconds(value);
            if (Number.isFinite(seconds)) {
                // Rounded summary and ECG-header values may differ slightly; retain the matching source ECG.
                const sourceEcgs = headerMetrics
                    .filter(item => item.ecg && Math.abs(item.seconds - seconds) <= 0.05)
                    .map(item => item.ecg);
                return { seconds, sourceEcgs };
            }
        }

        // Some report languages/layouts show this metric only in the ECG header.
        if (!headerMetrics.length) return { seconds: NaN, sourceEcgs: [] };
        const seconds = Math.max(...headerMetrics.map(item => item.seconds));
        const sourceEcgs = headerMetrics
            .filter(item => item.ecg && Math.abs(item.seconds - seconds) <= 0.05)
            .map(item => item.ecg);
        return { seconds, sourceEcgs };
    }

    function getDisplayedIntervals(report) {
        const intervals = [];
        for (const label of report.querySelectorAll(CONFIG.detailSelector)) {
            const rawInterval = label.childNodes[0]?.textContent.trim() || '';
            const rawBpm = label.querySelector('tspan')?.textContent.trim() || '';
            if (!/^\d+(?:[.,]\d+)?$/.test(rawInterval) || !/^\d+(?:\.\d+)?$/.test(rawBpm)) continue;

            const marker = label.closest('.ecgRMarker');
            const ecg = marker?.closest('.event-ecg-blk');
            if (!ecg) continue;

            // Values are milliseconds; locale decimals such as 2,83 seconds also map to 2830 ms.
            const milliseconds = Number(rawInterval.replace(',', '.')) *
                (Number(rawInterval.replace(',', '.')) < 100 ? 1000 : 1);
            if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > CONFIG.maxIntervalMs) continue;
            const bpm = Number(rawBpm);
            const calculatedBpm = 60000 / milliseconds;
            if (!Number.isFinite(bpm) || Math.abs(calculatedBpm - bpm) > Math.max(2.5, calculatedBpm * 0.08)) continue;

            const card = ecg?.closest('.print-page-content-blk');
            const title = card?.querySelector('.event-ecg-header-blk')?.innerText
                ?.trim().replace(/\s+/g, ' ') || 'Report ECG';
            intervals.push({ ecg, title, milliseconds });
        }
        return intervals;
    }

    function isMaxSinusHeader(text) {
        const normalized = normalizeLabel(text);
        const hasSinusTerm = /sinus\w*/.test(normalized) || /竇|窦|洞調律/.test(normalized);
        const hasMaximumTerm = /\bmax(?:imum|im\w*)?\b|\bmassim\w*/.test(normalized) || /最大|最高/.test(normalized);
        return hasSinusTerm && hasMaximumTerm;
    }

    function getMaxSinusTagFinding(report) {
        const card = [...report.querySelectorAll('.print-page-content-blk')].find(item =>
            isMaxSinusHeader(item.querySelector('.event-ecg-header-blk')?.textContent || ''));
        const ecg = card?.querySelector('.event-ecg-blk');
        if (!ecg) return null;

        const tags = [...new Set([...ecg.querySelectorAll('text')]
            .map(item => item.textContent.trim())
            .filter(text => text === 'S' || text === 'V'))];
        return tags.length ? { ecg, tags } : null;
    }

    function ensureIndicator(id, withTimestamp) {
        let element = document.getElementById(id);
        if (!element) {
            element = document.createElement('div');
            element.id = id;
            element.className = 'rooticare-report-checker-indicator';
            element.setAttribute('role', 'status');
            element.setAttribute('aria-live', 'polite');
            document.body.appendChild(element);
        }

        if (element.querySelector('.arrow')?.tagName !== 'BUTTON' ||
            element.lastElementChild !== element.querySelector('.arrow') ||
            element.querySelector('.jump') ||
            Boolean(element.querySelector('.timestamp')) !== withTimestamp) {
            element.innerHTML = `<span class="message"></span>${withTimestamp ? '<button class="timestamp" type="button" title="點擊複製目標時間"></button>' : ''}<button class="arrow" type="button" title="跳至對應 ECG" aria-label="跳至對應 ECG"></button>`;
            element.querySelector('.arrow').addEventListener('click', () => {
                const resolvedTarget = id === CONFIG.indicatorId ? target
                    : id === CONFIG.maxSinusIndicatorId ? maxSinusTarget : vtTarget;
                if (!resolvedTarget?.isConnected) return;
                const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
                resolvedTarget.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
            });
            if (withTimestamp) element.querySelector('.timestamp').addEventListener('click', copyTargetTimestamp);
        }
        return element;
    }

    function installStyle() {
        if (document.getElementById(`${CONFIG.indicatorId}-style`)) return;
        const style = document.createElement('style');
        style.id = `${CONFIG.indicatorId}-style`;
        style.textContent = `
            .rooticare-report-checker-indicator {
                position: fixed;
                left: 10px;
                z-index: 2147483000;
                display: none;
                align-items: center;
                gap: 6px;
                width: max-content;
                max-width: calc(100vw - 20px);
                padding: 5px 7px;
                border: 1px solid #d7873e;
                border-radius: 6px;
                background: rgba(255, 247, 225, .97);
                box-shadow: 0 2px 10px rgba(0, 0, 0, .24);
                color: #603b16;
                font: 600 11px/1.2 Arial, sans-serif;
                pointer-events: auto;
            }
            .rooticare-report-checker-indicator .message { order: 1; }
            .rooticare-report-checker-indicator .timestamp { order: 2; }
            .rooticare-report-checker-indicator .arrow {
                order: 3;
                display: grid;
                place-items: center;
                flex: 0 0 16px;
                width: 16px;
                height: 18px;
                margin: 0;
                padding: 0;
                appearance: none;
                border: 1px solid rgba(211, 84, 0, .28);
                border-radius: 4px;
                background: rgba(211, 84, 0, .1);
                color: #d35400;
                font-family: Arial, sans-serif;
                font-size: 14px;
                font-weight: 700;
                line-height: 1;
                cursor: pointer;
            }
            .rooticare-report-checker-indicator .arrow:hover { background: rgba(211, 84, 0, .2); }
            .rooticare-report-checker-indicator .arrow:focus-visible { outline: 2px solid #d35400; outline-offset: 1px; }
            .rooticare-report-checker-indicator .message {
                flex: 0 0 auto;
                min-width: 0;
                white-space: nowrap;
            }
            .rooticare-report-checker-indicator .timestamp {
                flex: 0 0 auto;
                padding: 3px 5px;
                border: 1px solid #c58a4f;
                border-radius: 4px;
                background: #fffdf7;
                color: #603b16;
                font: 600 10px/1.2 Arial, sans-serif;
                white-space: nowrap;
                cursor: pointer;
            }
            .rooticare-report-checker-indicator .timestamp:hover { background: #ffedcf; }
            .rooticare-report-checker-indicator .timestamp:disabled { opacity: .65; cursor: default; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function positionIndicator() {
        const items = [
            { target: target, element: indicator },
            { target: maxSinusTarget, element: maxSinusIndicator },
            { target: vtTarget, element: vtIndicator },
        ].filter(item => item.target?.isConnected && item.element?.isConnected && item.element.style.display !== 'none');
        if (!items.length) return;

        const margin = CONFIG.visibleMargin;
        const viewportHeight = window.innerHeight;
        const gap = 8;
        for (const item of items) {
            const rect = item.target.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            item.anchorY = rect.bottom < 0 ? margin : rect.top > viewportHeight ? viewportHeight - margin : centerY;
            item.orderY = centerY;
            item.arrow = rect.bottom < 0 ? '↗' : rect.top > viewportHeight ? '↘' : '→';
            item.height = item.element.getBoundingClientRect().height;
        }

        items.sort((a, b) => a.orderY - b.orderY);
        const first = items[0];
        const last = items[items.length - 1];
        const minCenter = Math.min(viewportHeight / 2, margin + first.height / 2);
        const maxCenter = Math.max(viewportHeight / 2, viewportHeight - margin - last.height / 2);
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        for (const item of items) {
            item.positionY = clamp(item.anchorY, minCenter, maxCenter);
        }
        for (let index = 1; index < items.length; index += 1) {
            const previous = items[index - 1];
            const current = items[index];
            const minY = previous.positionY + previous.height / 2 + current.height / 2 + gap;
            current.positionY = Math.max(current.positionY, minY);
        }
        for (let index = items.length - 1; index >= 0; index -= 1) {
            const current = items[index];
            const maxY = index === items.length - 1
                ? maxCenter
                : items[index + 1].positionY - current.height / 2 - items[index + 1].height / 2 - gap;
            current.positionY = Math.min(current.positionY, maxY);
        }

        for (const item of items) {
            item.element.style.top = `${item.positionY}px`;
            item.element.style.transform = 'translateY(-50%)';
            item.element.querySelector('.arrow').textContent = item.arrow;
        }
    }

    async function copyTargetTimestamp() {
        if (!targetTimestamp || !indicator) return;
        const button = indicator.querySelector('.timestamp');
        try {
            await navigator.clipboard.writeText(targetTimestamp);
        } catch {
            const temporaryInput = document.createElement('textarea');
            temporaryInput.value = targetTimestamp;
            temporaryInput.style.cssText = 'position:fixed;left:-9999px;top:0';
            document.body.appendChild(temporaryInput);
            temporaryInput.select();
            const copied = document.execCommand('copy');
            temporaryInput.remove();
            if (!copied) return;
        }
        button.textContent = '已複製';
        setTimeout(() => {
            if (button.isConnected) button.textContent = targetTimestamp;
        }, 1200);
    }

    function scanReport() {
        scanTimer = null;
        const report = document.querySelector(CONFIG.reportSelector);
        if (!report || !report.getClientRects().length) {
            target = null;
            maxSinusTarget = null;
            vtTarget = null;
            targetTimestamp = '';
            indicator?.remove();
            maxSinusIndicator?.remove();
            vtIndicator?.remove();
            indicator = null;
            maxSinusIndicator = null;
            vtIndicator = null;
            return;
        }

        const maxSinusFinding = getMaxSinusTagFinding(report);
        maxSinusTarget = maxSinusFinding?.ecg || null;
        if (maxSinusFinding) {
            maxSinusIndicator = ensureIndicator(CONFIG.maxSinusIndicatorId, false);
            maxSinusIndicator.querySelector('.message').textContent =
                `Max. sinus 有非 N 標籤：${maxSinusFinding.tags.join('、')}`;
            maxSinusIndicator.style.display = 'flex';
        } else {
            maxSinusIndicator?.remove();
            maxSinusIndicator = null;
        }

        const vtFinding = getLowAverageVTFinding(report);
        vtTarget = vtFinding?.ecg || null;
        if (vtFinding) {
            vtIndicator = ensureIndicator(CONFIG.vtIndicatorId, false);
            vtIndicator.querySelector('.message').textContent =
                `VT Avg HR ${vtFinding.avgHr.toFixed(0)} bpm <100${vtFinding.count > 1 ? `（${vtFinding.count} 條）` : ''}`;
            vtIndicator.style.display = 'flex';
        } else {
            vtIndicator?.remove();
            vtIndicator = null;
        }

        const intervals = getDisplayedIntervals(report);
        const reportIntervalInfo = getReportIntervalInfo(report, intervals);
        const longestReported = reportIntervalInfo.seconds;
        const baselineMs = reportIntervalInfo.milliseconds ?? longestReported * 1000;
        const longestInECG = intervals.reduce((best, item) =>
            item.milliseconds > (best?.milliseconds ?? baselineMs) ? item : best, null);

        if (!longestInECG ||
            longestInECG.milliseconds <= baselineMs ||
            reportIntervalInfo.sourceEcgs.includes(longestInECG.ecg)) {
            target = null;
            targetTimestamp = '';
            if (indicator) indicator.style.display = 'none';
            positionIndicator();
            return;
        }

        target = longestInECG.ecg;
        targetInterval = longestInECG.milliseconds / 1000;
        reportInterval = longestReported;
        const timestampMatch = longestInECG.title.match(/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\b/);
        targetTimestamp = timestampMatch?.[1] || '';
        indicator = ensureIndicator(CONFIG.indicatorId, true);
        indicator.querySelector('.message').textContent =
            `R-R ${targetInterval.toFixed(2)}s / 報告 ${reportInterval.toFixed(2)}s`;
        const timestampButton = indicator.querySelector('.timestamp');
        timestampButton.textContent = targetTimestamp || '無時間';
        timestampButton.disabled = !targetTimestamp;
        indicator.style.display = 'flex';
        positionIndicator();
    }

    function scheduleScan() {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(scanReport, CONFIG.debounceMs);
    }

    function init() {
        installStyle();
        scheduleScan();
        observer = new MutationObserver(records => {
            const indicatorIds = [CONFIG.indicatorId, CONFIG.maxSinusIndicatorId, CONFIG.vtIndicatorId];
            const isIndicatorNode = node => {
                const element = node instanceof Element ? node : node?.parentElement;
                return Boolean(element && (
                    indicatorIds.includes(element.id) || indicatorIds.some(id => element.closest(`#${id}`))
                ));
            };
            const hasReportChanges = records.some(record =>
                !isIndicatorNode(record.target) &&
                !(record.type === 'childList' && [...record.addedNodes, ...record.removedNodes]
                    .every(isIndicatorNode)));
            if (hasReportChanges) scheduleScan();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'x', 'y', 'width', 'height'],
        });
        window.addEventListener('scroll', positionIndicator, true);
        window.addEventListener('resize', scheduleScan);
        window.visualViewport?.addEventListener('resize', scheduleScan);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
