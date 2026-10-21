// ==UserScript==
// @name         RootiCare Report 檢查器
// @namespace    https://editoreu.rooticare.com/
// @version      2.23
// @description  檢查 Longest R-R 間隔、Max. sinus 的 S / V 標籤、VT 心率範圍低於 100 bpm，以及 Specifics Note / Summary 雙向一致性。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20Report%20檢查器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20Report%20檢查器.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// 使用教學：開啟 RootiCare Report 預覽，腳本會自動檢查報告並顯示異常提示。
// 檢查項目：Longest R-R 與實際間隔、Max. sinus 標籤、VT 心率範圍，以及 Specifics Note / Summary 雙向一致性。
// VT 提示條件：可讀取的 HR 範圍全部低於 100 bpm。
// 點擊提示旁的箭頭：跳至對應 ECG；R-R 提示的時間按鈕可複製目標時間。
// 報告內容更新後會重新檢查；提示供人工核對使用，不會修改報告內容。

(() => {
    'use strict';

    // 檢查目標以網站範本屬性定位；時間上限用於排除異常間隔，visibleMargin 保留提示與視窗邊界距離。
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

    // 單一 R-R / Max. sinus 提示各保留節點；VT 與 Specifics 可有多筆，以陣列保存提示及其跳轉目標。
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

    // 從報告標題擷取帶 s / sec / secs 單位的秒數；未找到時回傳 NaN。
    // 同時支援千分位及逗號小數，讓後續比較使用數值而非顯示字串。
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

    // 掃描最長、最快平均、首筆與分頁 VT 卡片，回傳需提示的 ECG 與 HR 上下限。
    // 只接受可見統計列中格式完整且上限小於 100 bpm 的範圍；缺資料或範圍不合理時略過。
    function getLowVTHeartRateFindings(report) {
        const findings = [...report.querySelectorAll(CONFIG.vtSelector)]
            .map(card => {
                const ecg = card.querySelector('.event-ecg-blk');
                const stat = card.querySelector(CONFIG.vtStatSelector);
                if (!ecg || !stat || stat.classList.contains('ng-hide')) return null;

                // 直接讀取 HR 範圍，避免受翻譯文字或平均心率影響。
                // 逐一解析數值元素，避免 bpm 與下一個標題串接後無法辨識。
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

    // 以最後一個診斷文字欄作為 Summary，執行 Note → Summary 與 Specifics 摘要 → Note 的雙向比對。
    // 比較時統一全半形、大小寫、空白與部分標點；顯示提示時仍保留原始 Note 文字。
    function getMissingSpecificsFindings(report) {
        // 正向比對：每張 Specifics 卡片的 Note 都應出現在 Summary，缺漏時將箭頭指向該 ECG。
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
        // Summary 會以逗號串接多則 Note，且可能省略各則末尾的句點。
        const summaryText = normalizeForComparison(summary.value || summary.textContent || '');
        // 首筆 Specifics 與分頁卡片皆可透過此操作屬性定位。
        const cards = [...report.querySelectorAll('.print-page-content-blk')]
            .filter(card => card.querySelector(`[ng-click^="editSelectGain('specific',"]`));
        const findings = cards
            .flatMap(card => {
                const note = normalize(card.querySelector('.event-ecg-header-blk p.print-hr-text b')?.textContent || '');
                if (!note || summaryText.includes(normalizeForComparison(note))) return [];
                return [{ target: card.querySelector('.event-ecg-blk') || card, note }];
            });

        // 只比對明確標為 Specifics 的區段，避免混入其他摘要內容。
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
        // 反向比對：Summary 的 Specifics 子句應可在至少一張 Note 中找到；以正規化文字去除重複提示。
        const seen = new Set();
        // 將逗號視為 Note 或子句的分隔，但保留數字中的小數標點。
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

    // 取得報告 Longest R-R 的比較基準，並保留該項目所屬 ECG 清單。
    // 先取該清單實際間隔的最大毫秒值；沒有間隔資料才退回標題秒數，避免截位造成誤報。
    function getReportIntervalInfo(report, intervals) {
        // 以 Angular 範本屬性定位心電圖片段，避免依賴報告語言。
        // 優先讀取實際毫秒值，避免使用標題截短後的秒數。
        const rrCards = [...report.querySelectorAll(CONFIG.longestRRSelector)];
        const rrEcgs = rrCards.flatMap(card => [...card.querySelectorAll('.event-ecg-blk')]);
        const rrIntervals = intervals.filter(item => rrEcgs.includes(item.ecg));
        if (rrIntervals.length) {
            const milliseconds = Math.max(...rrIntervals.map(item => item.milliseconds));
            return { seconds: milliseconds / 1000, milliseconds, sourceEcgs: rrEcgs };
        }

        // 缺少間隔標註時，只讀取已定位片段內的指標段落。
        const seconds = Math.max(...rrCards.flatMap(card =>
            [...card.querySelectorAll('.event-ecg-header-blk p')]
                .map(item => parseReportSeconds(item.textContent || '')))
            .filter(Number.isFinite));
        return { seconds: Number.isFinite(seconds) ? seconds : NaN, sourceEcgs: rrEcgs };
    }

    // 判斷間隔文字的前一搏是否也繪在同一片段內。
    // 原站 ecgRMarker 的第一個間隔沒有片段內前一搏，改用 idxAdjust 顯示；該值由 getDurationDiff
    // 在整段取回資料中找前一搏，不檢查中間是否為無資料區或錄製起點，片段靠近錄製頭尾時會得到數秒的假間隔。
    // 這種間隔的前一搏不在片段內，無法從報告核對，因此不納入比較；片段內兩搏之間的長停頓仍照常計算。
    function hasPreviousBeatInStrip(label, marker) {
        const beats = [...marker.querySelectorAll('.annoText')];
        // d3 綁定資料：間隔文字為右側心搏索引，心搏文字為 { index, type }。
        const beatIndexes = beats.map(beat => Number(beat.__data__?.index)).filter(Number.isFinite);
        const labelIndex = Number(label.__data__);
        if (typeof label.__data__ === 'number' && Number.isFinite(labelIndex) && beatIndexes.length) {
            return beatIndexes.some(index => index < labelIndex);
        }
        // 沒有綁定資料時改用座標：片段內間隔的 px 位於兩搏中點，邊界間隔的 px 在第一搏左側。
        const px = Number(label.getAttribute('px'));
        const beatXs = beats.map(beat => Number(beat.getAttribute('x'))).filter(Number.isFinite);
        if (!Number.isFinite(px) || !beatXs.length) return true;
        return px > Math.min(...beatXs);
    }

    // 讀取報告畫面上的間隔與 BPM，回傳 ECG、標題及統一為毫秒的間隔值。
    // 數字格式、範圍與換算心率皆須合理，避免將量測文字或其他標註誤當成 R-R 間隔。
    function getDisplayedIntervals(report) {
        const intervals = [];
        for (const label of report.querySelectorAll(CONFIG.detailSelector)) {
            const rawInterval = label.childNodes[0]?.textContent.trim() || '';
            const rawBpm = label.querySelector('tspan')?.textContent.trim() || '';
            if (!/^\d+(?:[.,]\d+)?$/.test(rawInterval) || !/^\d+(?:\.\d+)?$/.test(rawBpm)) continue;

            const marker = label.closest('.ecgRMarker');
            const ecg = marker?.closest('.event-ecg-blk');
            if (!ecg || !hasPreviousBeatInStrip(label, marker)) continue;

            // 統一換算為毫秒；逗號小數格式如 2,83 秒，換算為 2830 ms。
            const milliseconds = Number(rawInterval.replace(',', '.')) *
                (Number(rawInterval.replace(',', '.')) < 100 ? 1000 : 1);
            if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > CONFIG.maxIntervalMs) continue;
            const bpm = Number(rawBpm);
            // 用 60000 / 間隔毫秒交叉檢查顯示 BPM，容許取整與顯示誤差；差距過大時不納入比較。
            const calculatedBpm = 60000 / milliseconds;
            if (!Number.isFinite(bpm) || Math.abs(calculatedBpm - bpm) > Math.max(2.5, calculatedBpm * 0.08)) continue;

            const card = ecg?.closest('.print-page-content-blk');
            const title = card?.querySelector('.event-ecg-header-blk')?.innerText
                ?.trim().replace(/\s+/g, ' ') || 'Report ECG';
            intervals.push({ ecg, title, milliseconds });
        }
        return intervals;
    }

    // 定位 Max. sinus 的 ECG，收集畫面中出現的 S / V 標籤並去重。
    // 只檢查既有顯示標籤，沒有 S / V 時回傳 null，不以心率推測分類。
    function getMaxSinusTagFinding(report) {
        // 摘要列也使用相同 ng-show，須同時存在 ECG 容器才視為目標。
        const card = [...report.querySelectorAll(CONFIG.maxSinusSelector)]
            .find(item => item.querySelector('.event-ecg-blk'));
        const ecg = card?.querySelector('.event-ecg-blk');
        if (!ecg) return null;

        const tags = [...new Set([...ecg.querySelectorAll('text')]
            .map(item => item.textContent.trim())
            .filter(text => text === 'S' || text === 'V'))];
        return tags.length ? { ecg, tags } : null;
    }

    // 依固定 ID 重用或建立提示，避免每次掃描重複註冊相同節點。
    // 提示包含訊息、可選的時間按鈕與跳轉箭頭；點擊時解析最新目標，避免閉包保留舊 ECG。
    function ensureIndicator(id, withTimestamp) {
        let element = document.getElementById(id);
        if (!element) {
            element = document.createElement('div');
            element.id = id;
            element.className = 'rooticare-report-checker-indicator';
            element.setAttribute('role', 'status');
            element.setAttribute('aria-live', 'polite');
            // 保留按鈕點擊功能，並將按鈕上方的滾輪操作用於捲動報告。
            element.addEventListener('wheel', event => {
                if (event.ctrlKey) return;
                // 由報告節點向上尋找實際可捲動容器；找不到才改用文件捲動根節點。
                let scroller = document.querySelector(CONFIG.reportSelector);
                while (scroller) {
                    const overflow = getComputedStyle(scroller).overflowY;
                    if (/(auto|scroll)/.test(overflow) && scroller.scrollHeight > scroller.clientHeight) break;
                    scroller = scroller.parentElement;
                }
                scroller ||= document.scrollingElement;
                if (!scroller) return;
                event.preventDefault();
                // wheel 的 deltaMode 可能是像素、行或頁，先換算尺度再捲動；Ctrl + 滾輪保留瀏覽器原生用途。
                const scale = event.deltaMode === 1 ? 16
                    : event.deltaMode === 2 ? scroller.clientHeight : 1;
                scroller.scrollBy({ top: event.deltaY * scale, left: event.deltaX * scale, behavior: 'instant' });
            }, { passive: false });
            document.body.appendChild(element);
        }

        // 檢查提示內部結構，只有按鈕缺失、排列不符或時間欄需求改變時重建，避免每次掃描洗掉事件。
        if (element.querySelector('.arrow')?.tagName !== 'BUTTON' ||
            !element.querySelector('.arrow svg') ||
            element.lastElementChild !== element.querySelector('.arrow') ||
            element.querySelector('.jump') ||
            Boolean(element.querySelector('.timestamp')) !== withTimestamp) {
            element.innerHTML = `<span class="message"></span>${withTimestamp ? '<button class="timestamp" type="button" title="點擊複製目標時間"></button>' : ''}<button class="arrow" type="button" title="跳至對應 ECG" aria-label="跳至對應 ECG"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 8H13M8 3L13 8L8 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
            element.querySelector('.arrow').addEventListener('click', () => {
                // 固定提示從最新狀態取目標，多筆提示從目前陣列查 ID；目標已卸載時不跳轉。
                const resolvedTarget = id === CONFIG.indicatorId ? target
                    : id === CONFIG.maxSinusIndicatorId ? maxSinusTarget
                        : [...vtIndicators, ...specificsIndicators].find(item => item.element.id === id)?.target;
                if (!resolvedTarget?.isConnected) return;
                // 尊重使用者的減少動態效果設定；正常模式平滑捲動，減少動態時立即定位。
                const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
                resolvedTarget.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
            });
            if (withTimestamp) element.querySelector('.timestamp').addEventListener('click', copyTargetTimestamp);
        }
        return element;
    }

    // 只插入一次提示樣式；採固定定位，提示位置由 positionIndicator 統一計算。
    // 提示外框不攔截滑鼠，時間與箭頭按鈕另開啟點擊，以減少對報告閱讀的干擾。
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

    // 將仍有效且可見的提示排列在視窗左側，依各自目標在報告中的位置排序。
    // 目標離開畫面時將提示靠近上下邊界並調整箭頭方向；以兩輪推移減少提示重疊。
    function positionIndicator() {
        // 只納入目標與提示都還在 DOM 且未隱藏的項目，避免舊報告節點參與排版。
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
            // 畫面上方 / 下方的目標將提示吸附於相應邊界；畫面內的目標先以中心高度作為理想位置。
            item.anchorY = rect.bottom < 0 ? margin : rect.top > viewportHeight ? viewportHeight - margin : centerY;
            item.orderY = centerY;
            item.arrowAngle = rect.bottom < 0 ? '-45deg' : rect.top > viewportHeight ? '45deg' : '0deg';
            item.height = item.element.getBoundingClientRect().height;
        }

        // 依報告內的位置排序，讓提示上下順序與來源一致；邊界限制以第一筆及最後一筆高度計算。
        items.sort((a, b) => a.orderY - b.orderY);
        const first = items[0];
        const last = items[items.length - 1];
        const minCenter = Math.min(viewportHeight / 2, margin + first.height / 2);
        const maxCenter = Math.max(viewportHeight / 2, viewportHeight - margin - last.height / 2);
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        for (const item of items) {
            item.positionY = clamp(item.anchorY, minCenter, maxCenter);
        }
        // 由上往下推開相鄰提示，間距包含兩筆各自半高及額外 8 px。
        for (let index = 1; index < items.length; index += 1) {
            const previous = items[index - 1];
            const current = items[index];
            const minY = previous.positionY + previous.height / 2 + current.height / 2 + gap;
            current.positionY = Math.max(current.positionY, minY);
        }
        // 再由下往上收回超出下緣的提示，保留相鄰間距；視窗過小或提示過多時仍可能無法完全容納。
        for (let index = items.length - 1; index >= 0; index -= 1) {
            const current = items[index];
            const maxY = index === items.length - 1
                ? maxCenter
                : items[index + 1].positionY - current.height / 2 - items[index + 1].height / 2 - gap;
            current.positionY = Math.min(current.positionY, maxY);
        }

        // 寫回固定定位座標及箭頭旋轉；translateY(-50%) 讓 top 對應提示中心而非上緣。
        for (const item of items) {
            item.element.style.top = `${item.positionY}px`;
            item.element.style.transform = 'translateY(-50%)';
            item.element.querySelector('.arrow').style.setProperty('--arrow-angle', item.arrowAngle);
        }
    }

    // 只複製目前 R-R 異常目標的時間；沒有時間或提示時直接結束。
    // 優先使用 Clipboard API，失敗才用暫存 textarea 備援；成功後短暫顯示「已複製」。
    async function copyTargetTimestamp() {
        if (!targetTimestamp || !indicator) return;
        const button = indicator.querySelector('.timestamp');
        try {
            await navigator.clipboard.writeText(targetTimestamp);
        } catch {
            // 剪貼簿 API 失敗時建立畫面外文字欄，選取後執行備援複製，再移除暫存節點。
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
        // 1.2 秒後還原時間文字；按鈕已離開 DOM 時不再更新。
        setTimeout(() => {
            if (button.isConnected) button.textContent = targetTimestamp;
        }, 1200);
    }

    // 一次掃描依序更新 Max. sinus、VT、Specifics 與 R-R 提示，各檢查互不依賴。
    // 報告關閉時清除所有提示；報告仍開啟時重用現有節點，移除已不再對應異常的提示。
    function scanReport() {
        scanTimer = null;
        const report = document.querySelector(CONFIG.reportSelector);
        // 報告不存在或不占畫面空間時，清掉提示與目標參照，避免關閉後仍看到上一次結果。
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

        // Max. sinus 是單一提示：本次無異常時立即移除，不保留上一輪內容。
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

        // VT 可同時多筆：以本輪索引重用提示，再移除上一輪已多出來的節點。
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

        // Specifics 兩個方向的缺漏共用提示陣列；訊息依 reverse 選擇方向，箭頭指向該 Note 或 Summary。
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
        // R-R 比較以毫秒進行；只有無實測基準時才將標題秒數乘 1000，避免顯示精度掩蓋差異。
        const baselineMs = reportIntervalInfo.milliseconds ?? longestReported * 1000;
        const longestInECG = intervals.reduce((best, item) =>
            item.milliseconds > (best?.milliseconds ?? baselineMs) ? item : best, null);

        // 僅提示比基準嚴格更大的間隔，且該間隔須位於 Longest R-R 來源之外。
        // 沒有可用基準或無較大值時不新增 R-R 提示，但仍更新其他提示的位置。
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
        // 從異常 ECG 標題擷取日期時間；沒有符合格式時停用複製按鈕，仍保留跳轉功能。
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

    // 每次內容變動重新計時，待 250 ms 沒有新的排程要求才掃描。
    // 合併 Angular / D3 連續更新，避免同一輪報告重畫期間反覆讀取半完成內容。
    function scheduleScan() {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(scanReport, CONFIG.debounceMs);
    }

    // 安裝樣式並排程首次掃描，再監看內容、輸入、捲動與視窗尺寸變動。
    // DOM 監聽須排除提示自己的更新；否則掃描產生提示又觸發掃描，會形成重複更新。
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
            // 忽略發生在提示內的變動，以及只新增 / 移除提示的批次；其他 DOM 更新才重新排程檢查。
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
        // textarea.value 的改變不一定產生 DOM mutation，另監聽輸入事件以更新 Summary 比對。
        document.addEventListener('input', event => {
            if (event.target.matches?.('#af-print-dialog .diagnosis-textarea-blk textarea')) scheduleScan();
        });
        // 捲動只重排提示位置；視窗或可視區尺寸改變則重新掃描，處理報告重排後的目標。
        window.addEventListener('scroll', positionIndicator, true);
        window.addEventListener('resize', scheduleScan);
        window.visualViewport?.addEventListener('resize', scheduleScan);
    }

    // 等待 DOM 可用再初始化；腳本於 document-idle 載入時可直接開始。
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
