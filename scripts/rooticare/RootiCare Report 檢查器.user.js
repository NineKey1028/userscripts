// ==UserScript==
// @name         RootiCare Report 檢查器
// @namespace    https://editoreu.rooticare.com/
// @version      2.22
// @description  檢查 RootiCare Report 的 R-R、Max. sinus 標籤與 VT（含最長 VT）的 HR 範圍是否全部低於 100 bpm，以及 Specifics Note 與 Summary 的雙向一致性。
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
        longestRRSelector: '[ng-repeat="arrData in af.printDialog.longestRRTms track by $index"]',
        vtSelector: [
            '[ng-repeat="arrData in af.printDialog.longestVTTms track by $index"]',
            '[ng-repeat="arrData in af.printDialog.fastestAvgVTTms track by $index"]',
            '[ng-repeat="arrData in af.printDialog.firstVT track by $index"]',
            '[ng-repeat="pageData in af.printPartitionData.vtData track by $index"] [ng-repeat="arrData in pageData track by $index"]',
        ].join(', '),
        vtStatSelector: `[ng-show="checkEventStat('vt', arrData.tms)"]`,
        maxSinusSelector: '[ng-show="af.record.maxSinusHR.time > 0"]',
        maxIntervalMs: 10000,
        debounceMs: 250,
        visibleMargin: 48,
    };

    let indicator;
    let maxSinusIndicator;
    let vtIndicators = [];
    let specificsIndicators = [];
    let observer;
    let scanTimer;
    let target = null;
    let maxSinusTarget = null;
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

    function getLowVTHeartRateFindings(report) {
        const findings = [...report.querySelectorAll(CONFIG.vtSelector)]
            .map(card => {
                const ecg = card.querySelector('.event-ecg-blk');
                const stat = card.querySelector(CONFIG.vtStatSelector);
                if (!ecg || !stat || stat.classList.contains('ng-hide')) return null;

                // Read the HR range independently of translated labels and average HR.
                // Separate value elements prevent textContent joining bpm with the next label.
                const match = [...stat.querySelectorAll('b')]
                    .map(value => (value.textContent || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*bpm$/i))
                    .find(Boolean);
                if (!match) return null;
                const minHr = Number(match[1].replace(',', '.'));
                const maxHr = Number(match[2].replace(',', '.'));
                if (!Number.isFinite(minHr) || !Number.isFinite(maxHr) ||
                    minHr < 0 || minHr > maxHr || maxHr >= 100) return null;
                return { ecg, minHr, maxHr };
            })
            .filter(Boolean);
        return findings;
    }

    function getMissingSpecificsFindings(report) {
        const summaries = [...report.querySelectorAll('.diagnosis-textarea-blk textarea')];
        const summary = summaries[summaries.length - 1];
        if (!summary) return [];
        const normalize = text => text.replace(/\s+/g, ' ').trim();
        const normalizeForComparison = text => normalize(text)
            .normalize('NFKC')
            .toLocaleLowerCase()
            .replace(/[.,;:!?()\[\]{}]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        // Summary joins separate notes with commas and may remove each note's final period.
        const summaryText = normalizeForComparison(summary.value || summary.textContent || '');
        // Both firstSpecific and paginated specificData cards expose this action.
        const cards = [...report.querySelectorAll('.print-page-content-blk')]
            .filter(card => card.querySelector(`[ng-click^="editSelectGain('specific',"]`));
        const findings = cards
            .flatMap(card => {
                const note = normalize(card.querySelector('.event-ecg-header-blk p.print-hr-text b')?.textContent || '');
                if (!note || summaryText.includes(normalizeForComparison(note))) return [];
                return [{ target: card.querySelector('.event-ecg-blk') || card, note }];
            });

        // Inspect only explicitly labelled Specifics sections, not other clinical summary text.
        const sections = [];
        let section = null;
        for (const line of (summary.value || summary.textContent || '').split(/\r?\n/)) {
            const heading = line.match(/^\s*(?:[-•]\s*)?Specifics\s*[:：]\s*(.*)$/i);
            if (heading) {
                section = heading[1];
                sections.push(section);
            } else if (section !== null) {
                if (!line.trim() || /^\s*(?:[-•]|Reported by\s*:)/i.test(line)) {
                    section = null;
                } else {
                    section += ' ' + line.trim();
                    sections[sections.length - 1] = section;
                }
            }
        }
        const notes = cards.map(card => normalizeForComparison(
            card.querySelector('.event-ecg-header-blk p.print-hr-text b')?.textContent || ''));
        const seen = new Set();
        // Commas separate joined notes and clauses. Preserve decimal punctuation in numbers.
        for (const sectionText of sections) {
            const items = sectionText.split(/(?<!\d)[,;，；]|[,;，；](?!\d)|[.。](?=\s|$)/);
            for (const item of items) {
                const note = normalize(item);
                const key = normalizeForComparison(note);
                if (!key || /^(?:none|none found|n\/a|無|无)$/.test(key) || seen.has(key)) continue;
                seen.add(key);
                if (notes.some(text => ` ${text} `.includes(` ${key} `))) continue;
                findings.push({ target: summary, note, reverse: true });
            }
        }
        return findings;
    }

    function getReportIntervalInfo(report, intervals) {
        // Angular template attributes identify the strips independently of report language.
        // Prefer actual milliseconds to avoid truncated ECG-header values.
        const rrCards = [...report.querySelectorAll(CONFIG.longestRRSelector)];
        const rrEcgs = rrCards.flatMap(card => [...card.querySelectorAll('.event-ecg-blk')]);
        const rrIntervals = intervals.filter(item => rrEcgs.includes(item.ecg));
        if (rrIntervals.length) {
            const milliseconds = Math.max(...rrIntervals.map(item => item.milliseconds));
            return { seconds: milliseconds / 1000, milliseconds, sourceEcgs: rrEcgs };
        }

        // If annotations are unavailable, read only the metric paragraphs in the identified strips.
        const seconds = Math.max(...rrCards.flatMap(card =>
            [...card.querySelectorAll('.event-ecg-header-blk p')]
                .map(item => parseReportSeconds(item.textContent || '')))
            .filter(Number.isFinite));
        return { seconds: Number.isFinite(seconds) ? seconds : NaN, sourceEcgs: rrEcgs };
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

    function getMaxSinusTagFinding(report) {
        // The same ng-show also occurs on the summary row; require an ECG container.
        const card = [...report.querySelectorAll(CONFIG.maxSinusSelector)]
            .find(item => item.querySelector('.event-ecg-blk'));
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
            // Buttons remain clickable; wheel input over them scrolls the report dialog.
            element.addEventListener('wheel', event => {
                if (event.ctrlKey) return;
                let scroller = document.querySelector(CONFIG.reportSelector);
                while (scroller) {
                    const overflow = getComputedStyle(scroller).overflowY;
                    if (/(auto|scroll)/.test(overflow) && scroller.scrollHeight > scroller.clientHeight) break;
                    scroller = scroller.parentElement;
                }
                scroller ||= document.scrollingElement;
                if (!scroller) return;
                event.preventDefault();
                const scale = event.deltaMode === 1 ? 16
                    : event.deltaMode === 2 ? scroller.clientHeight : 1;
                scroller.scrollBy({ top: event.deltaY * scale, left: event.deltaX * scale, behavior: 'instant' });
            }, { passive: false });
            document.body.appendChild(element);
        }

        if (element.querySelector('.arrow')?.tagName !== 'BUTTON' ||
            !element.querySelector('.arrow svg') ||
            element.lastElementChild !== element.querySelector('.arrow') ||
            element.querySelector('.jump') ||
            Boolean(element.querySelector('.timestamp')) !== withTimestamp) {
            element.innerHTML = `<span class="message"></span>${withTimestamp ? '<button class="timestamp" type="button" title="點擊複製目標時間"></button>' : ''}<button class="arrow" type="button" title="跳至對應 ECG" aria-label="跳至對應 ECG"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 8H13M8 3L13 8L8 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
            element.querySelector('.arrow').addEventListener('click', () => {
                const resolvedTarget = id === CONFIG.indicatorId ? target
                    : id === CONFIG.maxSinusIndicatorId ? maxSinusTarget
                        : [...vtIndicators, ...specificsIndicators].find(item => item.element.id === id)?.target;
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
                pointer-events: none;
            }
            .rooticare-report-checker-indicator .message { order: 1; }
            .rooticare-report-checker-indicator .timestamp { order: 2; }
            .rooticare-report-checker-indicator .arrow {
                pointer-events: auto;
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
            .rooticare-report-checker-indicator .arrow svg {
                display: block;
                transform: rotate(var(--arrow-angle, 0deg));
                transform-origin: center;
            }
            .rooticare-report-checker-indicator .arrow:hover { background: rgba(211, 84, 0, .2); }
            .rooticare-report-checker-indicator .arrow:focus-visible { outline: 2px solid #d35400; outline-offset: 1px; }
            .rooticare-report-checker-indicator .message {
                flex: 0 0 auto;
                min-width: 0;
                white-space: nowrap;
            }
            .rooticare-report-checker-indicator .timestamp {
                pointer-events: auto;
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
            ...vtIndicators,
            ...specificsIndicators,
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
            item.arrowAngle = rect.bottom < 0 ? '-45deg' : rect.top > viewportHeight ? '45deg' : '0deg';
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
            item.element.querySelector('.arrow').style.setProperty('--arrow-angle', item.arrowAngle);
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
            targetTimestamp = '';
            indicator?.remove();
            maxSinusIndicator?.remove();
            vtIndicators.forEach(item => item.element.remove());
            indicator = null;
            maxSinusIndicator = null;
            vtIndicators = [];
            specificsIndicators.forEach(item => item.element.remove());
            specificsIndicators = [];
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

        const vtFindings = getLowVTHeartRateFindings(report);
        const previousVTIndicators = vtIndicators;
        vtIndicators = vtFindings.map((finding, index) => {
            const element = ensureIndicator(`${CONFIG.vtIndicatorId}-${index}`, false);
            element.querySelector('.message').textContent =
                `VT HR 範圍 <100 bpm（${finding.minHr} - ${finding.maxHr} bpm）`;
            element.style.display = 'flex';
            return { target: finding.ecg, element };
        });
        previousVTIndicators.forEach(item => {
            if (!vtIndicators.some(current => current.element === item.element)) item.element.remove();
        });

        const previousSpecificsIndicators = specificsIndicators;
        specificsIndicators = getMissingSpecificsFindings(report).map((finding, index) => {
            const element = ensureIndicator(`rooticare-report-checker-specifics-indicator-${index}`, false);
            element.querySelector('.message').textContent = finding.reverse
                ? `Summary 未見對應 Specifics：${finding.note}`
                : `Specifics 未列入 Summary：${finding.note}`;
            element.style.display = 'flex';
            return { target: finding.target, element };
        });
        previousSpecificsIndicators.forEach(item => {
            if (!specificsIndicators.some(current => current.element === item.element)) item.element.remove();
        });

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
            `R-R ${targetInterval.toFixed(2)}s > 報告最長 ${reportInterval.toFixed(2)}s`;
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
            const indicatorIds = [CONFIG.indicatorId, CONFIG.maxSinusIndicatorId,
                ...vtIndicators.map(item => item.element.id)];
            const isIndicatorNode = node => {
                const element = node instanceof Element ? node : node?.parentElement;
                return Boolean(element && (
                    element.classList.contains('rooticare-report-checker-indicator') ||
                    element.closest('.rooticare-report-checker-indicator') ||
                    indicatorIds.includes(element.id)
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
        document.addEventListener('input', event => {
            if (event.target.matches?.('#af-print-dialog .diagnosis-textarea-blk textarea')) scheduleScan();
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
