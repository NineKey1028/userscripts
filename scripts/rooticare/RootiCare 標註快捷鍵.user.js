// ==UserScript==
// @name         RootiCare 標註快捷鍵
// @namespace    https://editoreu.rooticare.com/
// @version      1.67.4
// @description  以數字鍵與滑鼠中鍵新增、修改或刪除 V / S / N 標籤；支援區間篩選修改、早搏判讀、W / S 心電圖縮放與 A / D 半步切換時間。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @match        https://report2.rooticare.com/rooti-care/*
// @grant        none
// @inject-into  page
// ==/UserScript==

/*
 * ── 使用教學 ────────────────────────────────────────────
 * 滑鼠移到心電圖上要處理的位置，再按快捷鍵。
 * 所有修改都只加入「未儲存修改」，不會自動儲存。
 *
 * 【標註】
 *   1 / 2 / 3            新增或改為 V / S / N
 *   4／滑鼠中鍵          刪除標籤（Mac 觸控板無中鍵，用 4）
 *   滑鼠在心電圖波形上    以上按鍵與按住滑動同樣作用在該時間點的標籤（等同滑鼠在標籤列同一位置）
 *   按住 4 移動          連續刪除碰到的標籤
 *   按住 Alt+1/2/3 移動  只修改碰到的既有標籤（Mac 為 Option）
 *   Alt+左鍵拖曳         左右微調標籤位置（Esc 取消；Mac 為 Option）；
 *                        按在標籤列空白處或心電圖波形上會吸過最近的標籤；
 *                        開始後可放開 Alt，拖曳中按 1／2／3 改為 V／S／N，放開滑鼠一併送出
 *                        Shift 區間已選第一端點時，Alt+1/2/3 與 Alt 拖曳仍可使用（端點保留）
 *
 * 【區間】Shift+1/2/3/4 按兩次（起點、終點），可跨視窗；Esc 取消
 *   篩選修改  依 BPM、變動率、原標籤、前一個／後一個標籤、type（排除／限於 type 1,155）篩選後
 *            改為 V / S / N（結尾按 Shift+1/2/3）或刪除（結尾按 Shift+4）
 *   填補整理  在頭尾兩顆標籤外側各按一次，依開頭 RR 平均補滿中間心搏
 *            （頭尾不改；多刪少補，保留的維持原類型）
 *   早搏判讀  依 RR 變動率（預設超過 12%）判斷提早出現的心搏；只修改勾選的原標籤（預設 N、S）：
 *            結尾按 1／2 把判為早搏的改為 V／S，按 3 把未判為早搏的改為 N；
 *            以近期正常心律為基準，早搏後的代償間歇與恢復期不會讓後面的心搏被連帶判為早搏
 *            Isolated、Couplet／Triplet、Bigeminy／Trigeminy、SVE run 皆適用；區間前後整段都是早搏時改用 N→N 或週期平均推算基準
 *   同時標為 AF  面板上勾選後，以 Shift + 1／2／3 完成區間時，兩端點視為正常與 AF 的交界一併標為 AF（與 AFib + 相同，需在編輯模式）：
 *            AF 範圍直接以兩端點交給網站（不另外延伸）；Save 後自動把該段 AF 的 Start／End segment（與 AF 清單 ◀ ▶ 相同）設在交界後 6 秒，
 *            白色區塊（報告印出的 8 秒）正好涵蓋交界（AF 清單的分段要重新載入紀錄後才更新，Save 後重新整理頁面即自動完成）；
 *            開頭或結尾落在原有 AF 之中時，該端以原有 AF 為主（起訖與 Start／End segment 都維持原樣），只對準落在 AF 外的那一端；勾選時篩選修改的原標籤自動取消 V（可再勾回）；
 *            勾選後出現子選項「僅標為 AF」（預設不勾）：勾選後完成區間只標為 AF，不修改任何標籤；
 *            尚未儲存，按 Save（含心電圖視窗的 Save、Ctrl+S）時與標籤一起上傳；勾選保留到重新整理頁面
 *   面板開啟時按 1 / 2 / 3（不按 Shift）切換分頁：篩選修改／填補整理／早搏判讀。
 *   分頁選擇保留到重新整理頁面為止。
 *
 * 【檢視】
 *   W / S   縮放（↑ / ↓）
 *   Q / E   切換時間（← / →），縮放高度保持不變；滑鼠不必停在心電圖上
 *   A / D   以 Q / E 一半的距離切換時間（主畫面 30 秒、3 導程 10 秒、心電圖視窗 5 秒）；
 *           選印清單開啟時仍為切換上一張／下一張選印
 *   B       隱藏心電圖上的 AF 圖示，再按一次恢復顯示（重新整理頁面後恢復顯示）；與 MP 縮圖的 AF 圖示連動
 *   V       顯示隱藏的原始心搏：機器原本標的 S／V 沒被刪除、畫面上卻看不到的（例如旁邊又新增了一顆），
 *           以紫色標記畫在波形上方並加紫色虛線，與標籤列上的標籤同時顯示；這種心搏 Group 時仍會被算進去，
 *           可能讓 Triplet／SVE run 等子分類出錯。點紫色標記加入刪除（虛線框，未儲存），再點一下取消；
 *           按 Save 後再 Group 即修正。原始資料不變；原本為 N 的心搏網站沒有提供，不顯示。再按 V 關閉
 *   ch1～3 旁的眼睛  顯示／隱藏導程（重新載入恢復全開）
 *   滑過標籤列或波形時，顯示紅色垂直對齊線
 *
 * 【清單】
 *   HR Min／Max／Max sinus  「排除 ±1 分」移除後面相近時間的心電圖，再按一次取消；選印後保留，標題列可還原
 *   Max HR sinus            標題列「排除 AF 時段」（預設關）：開啟後移除與 AF 時段重疊的心電圖；
 *                          「排除高於 Max HR」（預設關）：開啟後移除平均 HR 高於 Max HR 方塊數值的心電圖；
 *                          「排除含 V／S」（預設關）：開啟後移除 10 秒內有 V 或 S 標籤的心電圖
 *   AF 清單 mid segment     下拉選單旁的 ◀ ▶ 切換上一個／下一個時段（編輯模式）
 *   Tachy／Brady 清單       網站 invert 按鈕旁的單頁「Invert」：本頁未修改的改為 artifact，
 *                          本頁已全部是 artifact 時改回未修改；psvt／vt 不變（編輯模式）
 *   Spéc. 清單              放大鏡前的「Invert」取消本頁所有星星、「Invert all」取消整個清單的星星，
 *                          備註與選印一併移除；再按一次可加回星星、備註與選印，按 Save 才儲存（編輯模式）
 *   時間輸入框              W／↑ 加 2 秒、S／↓ 減 2 秒，可按住連續調整；聚焦時顯示提示 3 秒
 *   HR 清單時間框           貼上或修改時間後，自動以該心電圖白色區段的平均 BPM 填入 HR 欄
 *   Min／Max HR、Max HR sinus、Longest R-R 清單  標題列「☰ 捲動檢視」：清單改為一頁、一欄，所有心電圖由上往下連續排列
 *                          （含排除後的結果）；卡片放在與原本清單同高的捲動區內，標題列（Salva 等按鈕）與工具列不會捲走；
 *                          卡片與網站原本相同（心電圖維持原本大小，格線為正方形），可照常修改標籤、選印、加星號、點時間開啟心電圖視窗；
 *                          為了讓修改標籤保持流暢，只有畫面附近的卡片會即時更新，遠處的卡片捲到附近時才補上最新的標籤；
 *                          每張標題列加上燈號與分數：綠＝滿分、黃＝有扣分、紅＝零分；
 *                          右側評分欄：扣分的條件逐行列出原因與扣分，通過的條件縮成綠色小標籤（滑過看說明）；
 *                          條件：BPM 速度是否平均（RR 與中位數的差距）、標籤是否集中或有一段沒有標籤，
 *                          Longest R-R 改看暫停本身：最長 R-R 是否完整印在白色區段內（找不到 R-R 為零分）、是否位於事件時間、
 *                          暫停前後各至少 2 顆心搏；
 *                          Min／Max HR、Max HR sinus 另顯示實際平均 BPM（白色區段 R-R 的平均，與按住 ` 相同），
 *                          與卡片右上角的清單 HR 相差超出 ±10 BPM 扣 40 分；另檢查合理心率：平均超出 30–220 bpm 扣 60 分，
 *                          單一 R-R 超過 2.5 秒或短於 0.27 秒各扣 40 分（多半是漏標、重複標註或雜訊）；
 *                          Max HR sinus 另檢查含 V／S 標籤或與 AF 時段重疊（皆為零分）；
 *                          所有清單另檢查雜訊（振幅過大或密集震盪的時間：0.4 秒以上扣 20、1 秒以上扣 40、2.5 秒以上扣 60），
 *                          Longest R-R 的最長 R-R 內或兩端有雜訊再扣 40（暫停可能是雜訊造成或心搏被雜訊蓋住）；
 *                          只看報告印出的白色 8 秒，含未儲存的標籤修改；
 *                          右側 Minimap 為所有燈號（左側深色條／「印」＝選印、★ 或金色圓點＝星號，藍框為畫面中的卡片），
 *                          左側為編號刻度；張數多時燈號維持可辨識的大小，Minimap 跟著清單捲動；點燈號跳到該張，
 *                          點空白處或拖曳可捲動，在 Minimap 上滾動滾輪即捲動清單；「返回分頁」或 Esc 回到原本的分頁，停在目前這張所在的頁。
 *                          捲動檢視只有 Esc（返回分頁）一個按鍵，沒有其他快捷鍵；選印清單開著時 Esc 只關閉選印清單
 *                          Minimap 上方「▲ 頂端」回到這頁第一張；「放大 ECG」隱藏評分欄，心電圖拉寬到填滿卡片，高度不變、格子維持正方形（波形跟著變高，標籤可照常修改）；
 *                          「選印範圍」每張改顯示報告下方 30 秒縮圖的範圍（同選印清單 👁）：一列填滿寬度（格子維持正方形，高度較矮），
 *                          使用網站自己的標籤列與心電圖，標籤可照常點擊或用快捷鍵修改；綠色底為印出的 8 秒，只讀取畫面附近的卡片；
 *                          兩個按鈕互斥，再按一次還原；
 *                          切換過的顯示方式在重新整理（F5）或重開網頁前，之後開啟的捲動檢視都沿用；重新整理後回到顯示評分欄的樣式
 *   VEB／SVEB 清單（Isolated、Couplet、Triplet、Bigeminy、Trigeminy、VT、SVE run、SVT）  同樣有「☰ 捲動檢視」，但不評分：
 *                          張數可達數千張，每頁 100 張、一欄連續排列，以上方頁碼列換頁；Minimap 為本頁各張（「印」＝有選印：綠色選印、橘色強制選印、藍色區段選印，
 *                          同時有兩種以上時左右分色；★＝星號），
 *                          頁數拉條、選印圓點、「選印 N 張」（選印清單）與「⚡ 快速選印」照常可用；點選印圓點會換到該頁並捲到該頁第一張選印；
 *                          「僅選印」只顯示有選印的心電圖（綠色、橘色強制、藍色選印），再按一次（顯示全部）或返回分頁即還原；選印紀錄不受影響；
 *                          僅選印中有新的選印（快速選印、加選、換一個等）時自動重新篩選並捲到第一張新的
 *                          選印的卡片（綠色、藍色；橘色強制選印除外）時間旁有「換一個」：依快速選印的規則換成另一張，換好後捲到換上的那張，
 *                          該張加黃框（出現時閃一下）並標「新選印」，Minimap 上黃框並標「新」；只標最近一次新增的選印
 *                          （換一個、快速選印、加選、點印表機圖示都算，同一次新增多張時一起標），再新增時原本的標示取消
 *   Tachycardia、Bradycardia、Pause（含 2–3／3–4／4–5／≥5 秒）清單  同樣有「☰ 捲動檢視」（不評分、每頁 100 張）；
 *                          編輯模式下（捲動檢視與一般分頁皆可）按住左鍵在心電圖上往下（或往上、橫向）拖曳，經過的卡片一次消除（Artifact），拖到捲動區上下緣會自動捲動，
 *                          按住時轉動滾輪也可捲動，捲到游標下的卡片同樣消除；按下後不會反白文字；
 *                          從已消除的卡片開始拖曳則為恢復；改成 PSVT／VT 的卡片不受影響；只點一下仍是網站原本的切換
 *                          只消除游標經過心電圖的卡片：拖曳中把游標移到心電圖左右兩側（例如右側空白處）再往下，經過的卡片會略過，移回心電圖上再繼續消除
 *   事件清單頁碼拉條       選印位置（綠色、橘色強制選印）下方的圓點可點擊跳頁，右側顯示選印張數
 *   V / S 事件清單          「⚡ 快速選印」依規則補足選印（時段分散、相隔 1 分鐘以上）；
 *                          按「選印 N 張」開啟選印清單：上方為心電圖視窗（可改標籤並 Save），
 *                          下方為縮圖列（A／D 切換），可「取消選印」「換一個」或「加選一個」；
 *                          心電圖視窗上也有「取消選印」「換一個」（作用於目前這張）；
 *                          「Group」先儲存標籤修改再執行 Group All，完成後重新開啟清單
 *                          選印清單開著時，點心電圖波形不會再出現量測虛線；只有開啟 Mesurer 等量測功能時才有
 *                          縮圖的標籤與上方心電圖視窗同步（未儲存的修改以淡黃底標示），Save 後自動重新讀取
 *                          在網站上點印表機圖示選印或取消時，開著的選印清單跟著更新；
 *                          強制選印同時也是藍色選印的，標示為「強制＋藍色」
 *                          「👁 列印範圍」：縮圖改顯示報告中波形下方的 30 秒縮圖範圍（綠色為印出的 8 秒），
 *                          所有清單的選印清單都有；預設關閉，開啟後保持到重新整理頁面
 *                          心電圖視窗「取消選印」旁也有「👁 列印範圍」：在上方心電圖標出實線（印出的 8 秒）
 *                          與虛線（下方 30 秒縮圖的範圍）；與縮圖的眼睛分開切換，預設關閉，開啟後保持到重新整理頁面
 *                          已不在清單中的選印（例如改成 Couplet 等子分類後重新 Group）會自動取消並提示
 *                          快速選印與換一個會先依目前標籤（含未儲存修改）驗證是否仍符合清單類型
 *                          換掉或取消選印的心電圖（及其前後 30 秒內的）重新整理頁面前不再被選回，
 *                          包含在網站上直接點印表機取消的；Group 後被重新分類到其他清單的不算；
 *                          快速選印的候選不足時，才依序用回前後 30 秒內的、取消過的本身
 *                          Isolated S 需變動率超過 12%；前兩顆依序為 V、N 的排在最後，其他候選不足時才選
 *                          SVE run／SVT 超過 30 秒的心電圖改用藍色選印（區段選印），橘色強制選印也會一併檢查
 *   Pause／Event Tag 清單  按「選印 N 張」開啟選印清單，可逐張檢視（A／D 切換）、修改標籤、取消選印；
 *                          沒有快速選印、換一個、加選一個與 Group
 *   Print Report 旁綠色清單圖示  主畫面印表機圖示左邊，右上角為選印總張數；開啟所有選印清單：
 *                          Min／Max HR、Max HR Sinus、Longest R-R（報告固定印出，只能檢視與改標籤）及 V、S 各清單、Pause、Event Tag、Tachy／Brady 的選印集中在一起，上方分頁切換清單，
 *                          A／D 到清單頭尾時換到前後清單；操作與各清單的選印清單相同（沒有 Group），
 *                          不必開事件清單，修改後自動上傳選印；按 Esc 或心電圖視窗的 X 時一併關閉；Event Tag 心電圖同樣標出選印範圍並可點選移動；AF、Spéc. 清單的選印不在其中
 *   Event Tag 心電圖視窗   滑鼠移到心電圖（上方 20 秒或下方 60 秒長條）出現 10 秒虛線框，點一下即把選印時間移過去，
 *                          取代逐次點 ◀ ▶；以 ◀ ▶ 的 5 秒步距對齊，範圍與網站相同；實線框為目前的選印範圍；
 *                          框內最後 2 秒以灰色標示（與清單上的灰色區塊相同，報告只印出前 8 秒）；
 *                          選印在畫面外時（紀錄開頭附近的標籤可用 ◀ ▶ 移出），60 秒長條邊緣標示選印時間；
 *                          Mesurer、R-type／Pause 編輯時或按著修飾鍵時不作用；選印清單的縮圖顯示選印範圍
 *                          視窗的 Save、Ctrl+S、按 X 後選 Yes 都與 Event Tag 清單的 Save 相同：一併儲存選印範圍、備註、刪除的虛擬標籤等；
 *                          視窗中改過 HR 時維持網站原本的 Save
 *
 * Morphology 頁面不提供以上功能。
 */

(function() {
    'use strict';

    // 設定與操作狀態
    const ENABLE_ALIGNMENT_GUIDE = true; // BPM／心律標籤的紅色垂直對齊線；false 關閉
    const USE_FIXED_POS = true; // V、S 輪轉會經過空白時， true：新標籤位置按原始位置生成； false：新標籤位置按滑鼠位置生成
    const sequence = ['', 'N', 'S', 'V']; // 點擊循環順序

    const TARGET_BLOCK_SELECTOR = '.ecg-individual-blk, .event-tag-blk.ng-scope'; // 追蹤的容器名稱
    // 依目前網址辨識 Morphology 路由；站內切頁不一定重新載入，因此操作前也要檢查。
    function isDisabledPage() {
        return /^\/rooti-care\/morphology(?:\/|$)/.test(window.location?.pathname || '');
    }
    // Alt（Mac 為 Option）+ 左鍵拖曳標籤。
    const isDragModifier = event => event.altKey;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let currentMousePos = { x: 0, y: 0 };

    const zoomPreservingFunctions = new WeakSet();
    // 網站 selectedDataRange 的第 4 個參數控制是否重設高度；方向鍵原本即傳 false。
    // 在原控制器入口沿用此選項，不於非同步載入後覆寫使用者新調整的縮放。
    // 取得網站 AF 控制器的 scope（擁有 selectedDataRange 與 adjustDisplayTime 的那一層）。
    function getDashboardScope() {
        const host = document.querySelector('[ng-controller="RootiCareDashboardAFCtrl"]');
        if (!host || !window.angular) return null;
        let scope;
        try { scope = window.angular.element(host).scope?.(); } catch (_) { return null; }
        while (scope && !Object.prototype.hasOwnProperty.call(scope, 'selectedDataRange')) scope = scope.$parent;
        return scope || null;
    }
    function installZoomPersistence() {
        const scope = getDashboardScope();
        const original = scope?.selectedDataRange;
        if (typeof original !== 'function' || zoomPreservingFunctions.has(original)) return;
        function preserveZoom(...args) {
            if (!isDisabledPage() && scope.af?.hrChart) args[3] = false;
            return original.apply(this, args);
        }
        zoomPreservingFunctions.add(preserveZoom);
        scope.selectedDataRange = preserveZoom;
    }
    document.addEventListener('mousedown', installZoomPersistence, true);
    document.addEventListener('wheel', installZoomPersistence, { capture: true, passive: true });

    const style = document.createElement('style');
    style.innerHTML = `
        ${TARGET_BLOCK_SELECTOR}:focus {
            outline: none !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(style);

    // 僅保存於本次頁面執行期；不寫入瀏覽器儲存或報告資料。
    const leadVisible = { ch1: true, ch2: true, ch3: true };
    const leadStyle = document.createElement('style');
    leadStyle.textContent = `
        .ecgWave path.ecg-path.rc-lead-hidden { visibility: hidden !important; }
        .rc-lead-eye { cursor: pointer; outline: none; }
        .rc-lead-eye:focus > rect { stroke: #779b3a; stroke-width: 2; }
    `;
    document.head.appendChild(leadStyle);
    const SVG_NS = 'http://www.w3.org/2000/svg';
    function svgElement(tag, attributes) {
        const element = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
        return element;
    }
    function refreshLeadVisibility() {
        if (isDisabledPage()) return;
        for (const wave of document.querySelectorAll('div.ecgWave')) {
            const paths = [...wave.querySelectorAll('path.ecg-path')];
            if (paths.length !== 3) continue;
            const labels = [...wave.querySelectorAll('text')].filter(text => /^ch[123]$/.test(text.textContent.trim()));
            let switched = labels[0]?.textContent.trim() === 'ch2';
            if (!labels.length) {
                try { switched = Boolean(window.angular?.element(wave)?.isolateScope?.()?.channelSwitch); }
                catch (_) { continue; }
            }
            const order = switched ? ['ch2', 'ch1', 'ch3'] : ['ch1', 'ch2', 'ch3'];
            paths.forEach((path, index) => path.classList.toggle('rc-lead-hidden', !leadVisible[order[index]]));
            for (const label of labels) {
                const lead = label.textContent.trim();
                const group = label.parentElement;
                let button = group.querySelector(`[data-rc-lead="${lead}"]`);
                if (!button) {
                    button = svgElement('g', { class: 'rc-lead-eye', 'data-rc-lead': lead,
                        role: 'button', tabindex: '0' });
                    button.appendChild(svgElement('title', {}));
                    button.appendChild(svgElement('rect', { x: 0, y: 0, width: 24, height: 18,
                        rx: 3, fill: 'transparent' }));
                    button.appendChild(svgElement('path', { d: 'M3 9 Q12 -1 21 9 Q12 19 3 9 Z M12 6 A3 3 0 1 0 12 12 A3 3 0 1 0 12 6',
                        fill: 'none', stroke: '#526047', 'stroke-width': '1.5' }));
                    button.appendChild(svgElement('line', { class: 'rc-eye-slash', x1: 3, y1: 2,
                        x2: 21, y2: 16, stroke: '#a54141', 'stroke-width': 2 }));
                    const toggle = event => {
                        event.preventDefault(); event.stopPropagation();
                        leadVisible[lead] = !leadVisible[lead];
                        refreshLeadVisibility();
                    };
                    button.addEventListener('click', toggle);
                    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick'])
                        button.addEventListener(type, event => event.stopPropagation());
                    button.addEventListener('keydown', event => {
                        event.stopPropagation();
                        if (event.key === 'Enter' || event.key === ' ') toggle(event);
                    });
                    group.appendChild(button);
                }
                const y = Number(label.getAttribute('y')) - 12;
                button.setAttribute('transform', `translate(44,${y})`);
                button.setAttribute('aria-pressed', String(leadVisible[lead]));
                const description = `${leadVisible[lead] ? '隱藏' : '顯示'} ${lead}`;
                button.setAttribute('aria-label', description);
                // 避免重寫文字引發 childList observer 的無限重畫。
                const title = button.querySelector('title');
                if (title.textContent !== description) title.textContent = description;
                button.querySelector('.rc-eye-slash').setAttribute('visibility', leadVisible[lead] ? 'hidden' : 'visible');
            }
        }
    }
    let leadRefreshPending = false;
    function scheduleLeadRefresh() {
        if (leadRefreshPending) return;
        leadRefreshPending = true;
        requestAnimationFrame(() => { leadRefreshPending = false; refreshLeadVisibility(); });
    }
    new MutationObserver(scheduleLeadRefresh).observe(document.body, { childList: true, subtree: true });
    scheduleLeadRefresh();

    // 使用螢幕座標對齊標籤列與主波形；獨立覆層不接收滑鼠事件，不改動網站 SVG。
    const alignmentGuide = document.createElement('div');
    alignmentGuide.setAttribute('aria-hidden', 'true');
    alignmentGuide.style.cssText = 'display:none;position:fixed;width:1px;background:#e02020;pointer-events:none;z-index:2147482000;';
    document.body.appendChild(alignmentGuide);
    let guideMarker = null;
    let guideMouseX = 0;
    let guideMouseY = 0;
    let guideFrame = null;
    function hideAlignmentGuide() {
        guideMarker = null;
        if (guideFrame !== null) cancelAnimationFrame(guideFrame);
        guideFrame = null;
        alignmentGuide.style.display = 'none';
    }
    function drawAlignmentGuide() {
        guideFrame = null;
        if (!ENABLE_ALIGNMENT_GUIDE || isDisabledPage() || !guideMarker?.isConnected) { hideAlignmentGuide(); return; }
        const overWave = guideMarker.matches('div.ecgWave');
        const wave = overWave ? guideMarker : guideMarker.nextElementSibling;
        if (!wave?.matches('div.ecgWave')) { hideAlignmentGuide(); return; }
        // 部分頁面在開啟 Measure 前沒有 centerRect，改用 centerGroup 或波形 SVG 的範圍。
        const plot = overWave ? (wave.querySelector('.centerGroup .centerRect')
            || wave.querySelector('.centerGroup') || wave.querySelector('svg')) : null;
        if (overWave && !plot) { hideAlignmentGuide(); return; }
        const markerBounds = (plot || guideMarker).getBoundingClientRect();
        const waveBounds = (plot || wave).getBoundingClientRect();
        if (waveBounds.height <= 0 || guideMouseX < markerBounds.left || guideMouseX > markerBounds.right
            || guideMouseX < waveBounds.left || guideMouseX > waveBounds.right
            || (overWave && (guideMouseY < waveBounds.top || guideMouseY > waveBounds.bottom))) {
            hideAlignmentGuide(); return;
        }
        // 對齊實體像素邊界，固定為一個實體像素，避免瀏覽器縮放／DPI 讓紅線跨兩欄像素。
        const ratio = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
            ? window.devicePixelRatio : 1;
        const snap = value => Math.round(value * ratio) / ratio;
        // 同一區塊可能有主波形及下方概覽；向前尋找共用的標籤列。
        let labelRow = overWave ? wave.previousElementSibling : guideMarker;
        while (labelRow?.matches('div.ecgWave')) labelRow = labelRow.previousElementSibling;
        const labelBounds = labelRow?.matches('svg.ecgRMarker') ? labelRow.getBoundingClientRect() : null;
        const top = snap(labelBounds && labelBounds.height > 0 ? Math.min(labelBounds.top, markerBounds.top) : markerBounds.top);
        alignmentGuide.style.width = `${1 / ratio}px`;
        alignmentGuide.style.left = `${snap(guideMouseX)}px`;
        alignmentGuide.style.top = `${top}px`;
        alignmentGuide.style.height = `${snap(waveBounds.bottom) - top}px`;
        alignmentGuide.style.background = overWave ? 'rgba(224, 32, 32, 0.3)' : '#e02020';
        alignmentGuide.style.display = 'block';
    }
    // 波形上方可能蓋著透明圖層（Measure 未開啟時尤其如此），事件目標不一定是波形本身；
    // 找不到時改查游標下方所有元素。
    const GUIDE_MARKER_SELECTOR = 'svg.ecgRMarker, div.ecgWave';
    function findGuideMarker(event) {
        const direct = event.target.closest?.(GUIDE_MARKER_SELECTOR);
        if (direct) return direct;
        for (const el of document.elementsFromPoint(event.clientX, event.clientY)) {
            if (el === alignmentGuide) continue;
            const marker = el.closest?.(GUIDE_MARKER_SELECTOR);
            if (marker) return marker;
        }
        return null;
    }
    document.addEventListener('mousemove', event => {
        if (labelDrag) return; // 拖曳期間由標籤的實際位置更新紅線，避免被游標位置覆蓋。
        if (!ENABLE_ALIGNMENT_GUIDE || isDisabledPage()) { hideAlignmentGuide(); return; }
        const marker = findGuideMarker(event);
        if (!marker) { hideAlignmentGuide(); return; }
        guideMarker = marker;
        guideMouseX = event.clientX;
        guideMouseY = event.clientY;
        if (guideFrame === null) guideFrame = requestAnimationFrame(drawAlignmentGuide);
    }, { passive: true });
    document.addEventListener('mouseleave', hideAlignmentGuide);
    document.addEventListener('scroll', hideAlignmentGuide, true);
    window.addEventListener('resize', hideAlignmentGuide);
    window.addEventListener('blur', hideAlignmentGuide);

    // 記錄滑鼠位置
    window.addEventListener('mousemove', (e) => {
        currentMousePos.x = e.clientX;
        currentMousePos.y = e.clientY;
    }, { passive: true });

    // 按住 4 或 Alt + 1 / 2 / 3 時直接跟隨滑鼠處理，不等鍵盤連發的延遲。
    // 每次移動沿上一點到目前位置取樣，快速甩過也不漏掉中間的標籤；只處理碰到的既有標籤。
    const SWEEP_STEP = 3; // 取樣間距（像素）
    const SWEEP_MAX_SAMPLES = 200;
    let heldSweep = null; // { key, code, tag, alt, last: { x, y } }
    function stopHeldSweep() { heldSweep = null; }
    function sweepTo(x, y) {
        const from = heldSweep.last;
        heldSweep.last = { x, y };
        const distance = Math.hypot(x - from.x, y - from.y);
        const samples = Math.min(SWEEP_MAX_SAMPLES, Math.max(1, Math.ceil(distance / SWEEP_STEP)));
        for (let i = 1; i <= samples; i++) {
            // 在波形上滑動時同樣投影到標籤列，碰到該 x 的既有標籤就處理。
            const point = toLabelRowPoint({ x: from.x + (x - from.x) * i / samples, y: from.y + (y - from.y) * i / samples });
            const el = getElementAtPoint(point.x, point.y);
            if (!el?.classList.contains('annoText') || el.textContent.trim() === heldSweep.tag) continue;
            const block = el.closest(TARGET_BLOCK_SELECTOR);
            if (!block) continue;
            processCommand(heldSweep.tag, point, block);
        }
    }
    window.addEventListener('mousemove', (e) => {
        if (!heldSweep) return;
        // 區間已選第一端點時仍可按住 Alt + 1／2／3 修改；按住 4 刪除則不處理。
        if (isDisabledPage() || rangeBusy || labelDrag || (rangeMode && !heldSweep.alt) || (heldSweep.alt && !e.altKey)) {
            stopHeldSweep(); return;
        }
        sweepTo(e.clientX, e.clientY);
    }, { passive: true });
    document.addEventListener('keyup', (e) => {
        if (heldSweep && (e.code === heldSweep.code || (e.key === 'Alt' && heldSweep.alt))) stopHeldSweep();
    }, true);
    window.addEventListener('blur', stopHeldSweep);

    // 檢查滑鼠位置下是否有 ECG 區塊
    function getActiveBlockUnderMouse() {
        if (isDisabledPage()) return null;
        const elements = document.elementsFromPoint(currentMousePos.x, currentMousePos.y);
        for (let el of elements) {
            const block = el.closest(TARGET_BLOCK_SELECTOR);
            if (block) return block;
        }
        return null;
    }

    // 畫面上是否有可見的 ECG 區塊（不論滑鼠位置）。
    function hasVisibleECGBlock() {
        if (isDisabledPage()) return false;
        return [...document.querySelectorAll(TARGET_BLOCK_SELECTOR)].some(block => block.getClientRects().length > 0);
    }

    // 取得當前位置的元素（優先抓取標籤文字，次之為標籤列的背景矩形）。
    // 只接受標籤列（svg.ecgRMarker）內的矩形：心電圖外框（centerRect）的線寬會延伸到標籤列底部，點到會觸發量測。
    function getElementAtPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        return elements.find(el => el.classList.contains('annoText')) ||
               elements.find(el => el.tagName.toLowerCase() === 'rect' && el.closest('svg.ecgRMarker'));
    }

    // 滑鼠在心電圖波形上時，把位置垂直投影到同一區塊的標籤列（x 不變），
    // 讓數字鍵、Alt、按住滑動與中鍵在波形上也能新增或修改該時間點的標籤，效果與滑鼠在標籤列上相同。
    // 該 x 已有標籤時落在標籤中心，沒有時落在標籤列中線；已在標籤列上或不在 ECG 區塊內則不變。
    function toLabelRowPoint(point, block = null) {
        if (!block) {
            for (const element of document.elementsFromPoint(point.x, point.y)) {
                block = element.closest?.(TARGET_BLOCK_SELECTOR);
                if (block) break;
            }
        }
        const marker = block?.querySelector('svg.ecgRMarker');
        if (!marker) return point;
        const row = marker.getBoundingClientRect();
        if (!row.height || (point.y >= row.top && point.y <= row.bottom) || point.x < row.left || point.x > row.right) return point;
        const label = findLabelAtX(block, point.x);
        if (label) {
            const rect = label.getBoundingClientRect();
            return { x: point.x, y: rect.top + rect.height / 2 };
        }
        return { x: point.x, y: row.top + row.height / 2 };
    }

    // 標籤列與心電圖的交界：畫面縮放時兩者之間可能出現縫隙，加上心電圖外框的線寬，
    // 點到交界下方這一條會變成點擊心電圖（等同開啟 Measure 後點心電圖）。交界下方 3px 內的滑鼠點擊直接忽略。
    const LABEL_SEAM_PX = 3;
    function isLabelSeamClick(event) {
        const wave = event.target?.closest?.('.ecgWave');
        const marker = wave?.closest('.ecg-individual-blk')?.querySelector('svg.ecgRMarker');
        if (!marker) return false;
        const edge = Math.max(wave.getBoundingClientRect().top, marker.getBoundingClientRect().bottom);
        return event.clientY < edge + LABEL_SEAM_PX;
    }
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick']) {
        window.addEventListener(type, event => {
            // 只處理實際的滑鼠操作；腳本模擬的標籤點擊目標在標籤列上，不受影響。
            if (!event.isTrusted || event.button !== 0 || isDisabledPage() || !isLabelSeamClick(event)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
    }

    // 依原始 X 座標尋找目前 ECG 區塊內的標籤。
    function findLabelAtX(activeBlock, targetX) {
        if (!activeBlock) return null;
        // 找出該區塊內所有的標籤
        const annos = activeBlock.querySelectorAll('.annoText');
        for (let anno of annos) {
            const rect = anno.getBoundingClientRect();
            // 檢查原點擊的 X 座標是否落在這個標籤的左右範圍內
            if (targetX >= rect.left && targetX <= rect.right) {
                return anno;
            }
        }
        return null;
    }

    // 當滑鼠移入時自動聚焦，避免快捷鍵失效。
    // 正在輸入文字時不搶焦點：Spéc. 的 Note 輸入框在區塊內，搶走焦點會讓備註下拉清單（datalist）在滑鼠移過去時關閉。
    function isEditingText() {
        const el = document.activeElement;
        return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
            (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(el.type)));
    }
    document.addEventListener('mouseover', (e) => {
        if (isDisabledPage() || isEditingText()) return;
        const block = e.target.closest(TARGET_BLOCK_SELECTOR);
        if (block && document.activeElement !== block) {
            if (block.tabIndex < 0) block.tabIndex = 0;
            block.focus({ preventScroll: true });
        }
    }, { passive: true });

    // 區間修改更新顯示文字後，原生 D3 點擊狀態 typeIdx 可能仍保留舊值。
    // 原生循環為 N / A（顯示 S）/ V / X（刪除），點擊前以顯示標籤同步。
    function syncLabelClickState(el) {
        if (isDisabledPage()) return;
        if (!el?.classList?.contains('annoText') || !el.closest(TARGET_BLOCK_SELECTOR)) return;
        const indices = { N: 0, S: 1, A: 1, V: 2, X: 3, '': 3 };
        const text = el.textContent.trim();
        if (Object.prototype.hasOwnProperty.call(indices, text)) {
            el.setAttribute('typeIdx', String(indices[text]));
        }
    }

    // 也處理使用者直接左鍵點擊；capture 階段早於原生標籤 click handler。
    document.addEventListener('click', (e) => {
        syncLabelClickState(e.target.closest?.('.annoText'));
    }, true);

    // 依序發送左鍵按下、放開與點擊事件。
    function doLockedClick(el, x, y) {
        if (!el) return;
        syncLabelClickState(el);
        const opts = {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            clientX: x,
            clientY: y
        };
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
    }

    // 發送原生方向鍵事件，沿用網站的縮放處理。
    function triggerOriginalKey(keyCode, keyName) {
        const eventProps = {
            bubbles: true, cancelable: true,
            keyCode: keyCode, which: keyCode,
            key: keyName, code: keyName, view: window
        };
        document.dispatchEvent(new KeyboardEvent('keydown', eventProps));
    }

    // A / D：以 Q / E 一半的距離移動心電圖時間，判斷順序與網站原生方向鍵相同。
    // 主畫面原生一次 60 秒（3 導程模式 20 秒），心電圖視窗原生一次 10 秒；
    // 事件清單、分頁等原生為換頁的畫面不處理。成功移動時回傳 true。
    function halfStepECG(direction) {
        const scope = getDashboardScope();
        const af = scope?.af;
        if (!af || af.loading?.ecg || !af.tmsline?.timeRange) return false;
        const has = selector => !!document.querySelector(selector);
        if (has('#af-pr-dialog') || has('#af-add-tag-dialog')) return false;
        if (has('.event-tag-list') && !has('#af-ecg-dialog-v2')) return false;
        const apply = fn => (scope.$root?.$$phase ? fn() : scope.$apply(fn));
        if (has('#af-ecg-dialog-v2')) {
            const dialog = af.ECGTrendDialog;
            const chart = af.ecgChart;
            if (af.focusBlock || !dialog || !chart || !Array.isArray(dialog.timeRange)) return false;
            const step = 5 * direction;
            apply(() => {
                dialog.startTime += step;
                chart.shiftSec = Math.min(40, Math.max(0, chart.shiftSec + step));
                dialog.startTime = Math.min(dialog.timeRange[1] - 20, Math.max(dialog.timeRange[0], dialog.startTime));
            });
            return true;
        }
        if (has('.fixed-board') || !af.hrChart?.trendExtend) return false;
        const chartIdx = Array.isArray(af.hrChart.hr) ? af.hrChart.hr.findIndex(item => item?.ecgSwitch) : -1;
        const start = Number(af.ecgChart?.chartStartTms);
        if (chartIdx < 0 || !Number.isFinite(start) || typeof scope.selectedDataRange !== 'function') return false;
        const step = (af.record?.ecgLeadMode ? 10 : 30) * direction;
        const range = [start + step, start + 60 + step];
        installZoomPersistence();
        apply(() => {
            if (af.labelEditing) { af.labelEditing.selectedTime = [...range]; af.labelEditing.chartIdx = chartIdx; }
            if (af.ecgAnno) { af.ecgAnno.selectedTime = [...range]; af.ecgAnno.chartIdx = chartIdx; }
            scope.selectedDataRange(range[0], range[1], chartIdx, false);
        });
        return true;
    }

    // 計算從當前狀態切換到目標狀態需要的點擊次數
    function getSteps(current, target) {
        let currIdx = sequence.indexOf(current);
        if (currIdx === -1) currIdx = 0;
        let targetIdx = sequence.indexOf(target);
        if (targetIdx === -1) targetIdx = 0;
        let steps = targetIdx - currIdx;
        return steps < 0 ? steps + sequence.length : steps;
    }

    // 以模擬點擊將指定位置的標籤切換至目標分類。
    async function processCommand(targetText, point = currentMousePos, rangeBlock = null) {
        if (isDisabledPage()) return;
        // 滑鼠在波形上時改以標籤列上同一 x 的位置處理。
        point = toLabelRowPoint(point, rangeBlock);
        const lockedX = point.x;
        const lockedY = point.y;

        let currentEl = getElementAtPoint(lockedX, lockedY);
        const activeBlock = rangeBlock || getActiveBlockUnderMouse();

        if (!currentEl && activeBlock) {
            currentEl = activeBlock.querySelector('rect');
        }

        if (!currentEl) return;

        let currentText = currentEl.classList.contains('annoText') ? currentEl.textContent.trim() : '';
        if (currentText === targetText) return;

        let stepsNeeded = getSteps(currentText, targetText);

        let clickX = lockedX;
        let clickY = lockedY;

        if (USE_FIXED_POS && currentEl.classList.contains('annoText')) {
            const rect = currentEl.getBoundingClientRect();
            clickX = rect.left + rect.width / 2;
            clickY = rect.top + rect.height / 2;
        }

        for (let i = 0; i < stepsNeeded; i++) {
            let targetEl = getElementAtPoint(clickX, clickY) || currentEl;

            // 重新定位時只搜尋原始 X 座標涵蓋的標籤，
            // 避免畫面更新後誤點同區塊中的其他標籤。
            if (!targetEl || !targetEl.classList.contains('annoText')) {
                const localAnno = findLabelAtX(activeBlock, lockedX);
                if (localAnno) {
                    targetEl = localAnno;
                    // 將後續點擊座標移到找到的標籤中心。
                    const rect = targetEl.getBoundingClientRect();
                    clickX = rect.left + rect.width / 2;
                    clickY = rect.top + rect.height / 2;
                }
            }

            if (!targetEl) break;

            doLockedClick(targetEl, clickX, clickY);

            // 若網站重畫尚未完成，可啟用下一行等待後再點擊。
            // await sleep(30);
        }
    }

    let rangeMode = null;
    let rangeBusy = false;
    // 區間修改完成後顯示的結果提示（如「已修改 N 個標籤」）；此時 Esc 交還給網頁本身處理。
    let rangeResultShown = false;
    const rangeHint = document.createElement('div');
    rangeHint.id = 'rooticare-range-hotkeys';
    rangeHint.style.display = 'none';
    const rangeStyle = document.createElement('style');
    rangeStyle.textContent = `
        #rooticare-range-hotkeys { position:fixed;left:12px;bottom:12px;z-index:2147483000;
            width:370px;max-width:calc(100vw - 24px);padding:9px 11px;box-sizing:border-box;
            border:1px solid #dce3d6;border-radius:8px;background:#fff;color:#374333;
            box-shadow:0 3px 14px #24332118;font:12px/1.45 Arial,"PingFang TC","Microsoft JhengHei",sans-serif; }
        #rooticare-range-hotkeys * { box-sizing:border-box; }
        #rooticare-range-hotkeys .rh-head { display:flex;align-items:center;gap:8px; }
        #rooticare-range-hotkeys [data-role=message] { flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere; }
        #rooticare-range-hotkeys [data-role=filters] { margin-top:7px;display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
        #rooticare-range-hotkeys .rh-group { display:inline-flex;align-items:center;gap:4px;white-space:nowrap; }
        #rooticare-range-hotkeys .rh-source { width:100%;gap:6px; }
        #rooticare-range-hotkeys label { display:inline-flex;align-items:center;gap:3px;margin:0;padding:0;font:inherit;color:inherit;cursor:pointer; }
        #rooticare-range-hotkeys input[type=checkbox] { appearance:auto;position:static;float:none;width:12px;height:12px;min-height:0;margin:0;accent-color:#779b3a; }
        #rooticare-range-hotkeys select,#rooticare-range-hotkeys input[type=number] {
            appearance:auto;position:static;float:none;display:inline-block;width:39px;height:23px;min-height:0;
            margin:0;padding:1px 3px;border:1px solid #dce3d6;border-radius:4px;background:#fff;color:#374333;font:inherit; }
        #rooticare-range-hotkeys input[type=number] { width:51px; }
        #rooticare-range-hotkeys .rh-type { width:100%; }
        #rooticare-range-hotkeys [data-role=type-mode] { width:54px; }
        #rooticare-range-hotkeys input[data-role=type-list] { appearance:auto;position:static;float:none;display:inline-block;
            flex:1;min-width:0;height:23px;min-height:0;margin:0;padding:1px 5px;border:1px solid #dce3d6;border-radius:4px;
            background:#fff;color:#374333;font:inherit; }
        #rooticare-range-hotkeys :disabled { opacity:.45;cursor:default; }
        #rooticare-range-hotkeys button { position:static;float:none;width:20px;height:20px;min-height:0;margin:0;padding:0;
            border:0;border-radius:4px;background:transparent;color:#889180;font:18px/20px Arial;cursor:pointer; }
        #rooticare-range-hotkeys button:hover { background:#f0f3ec;color:#374333; }
        #rooticare-range-hotkeys :is(button,input,select):focus-visible { outline:2px solid #91ad68;outline-offset:1px; }
        #rooticare-range-hotkeys [data-role=help] { margin-top:6px;color:#7b8574;font-size:11px; }
        #rooticare-range-hotkeys [data-role=tabs] { margin-top:7px;display:flex;gap:2px;border-bottom:1px solid #dce3d6; }
        #rooticare-range-hotkeys [data-role=tabs] button { width:auto;height:24px;padding:0 10px;border-radius:5px 5px 0 0;
            margin-bottom:-1px;border:1px solid transparent;font:600 12px/22px Arial,"PingFang TC","Microsoft JhengHei",sans-serif;color:#889180; }
        #rooticare-range-hotkeys [data-role=tabs] button[aria-selected=true] { border-color:#dce3d6;border-bottom-color:var(--rh-bg);
            background:var(--rh-bg);color:#4f6b1a; }
        /* 每個分頁各用一種淺色底：篩選修改淺綠、填補整理淺藍、早搏判讀淺杏 */
        #rooticare-range-hotkeys { --rh-bg:#fff; background:var(--rh-bg); transition:background-color .15s; }
        #rooticare-range-hotkeys[data-tool=filter] { --rh-bg:#f3f8ec; }
        #rooticare-range-hotkeys[data-tool=fill] { --rh-bg:#edf4fb; }
        #rooticare-range-hotkeys[data-tool=ectopic] { --rh-bg:#fcf3ea; }
        #rooticare-range-hotkeys [data-tool=filter]:not([aria-selected=true]) { background:#f3f8ec99; }
        #rooticare-range-hotkeys [data-tool=fill]:not([aria-selected=true]) { background:#edf4fb99; }
        #rooticare-range-hotkeys [data-tool=ectopic]:not([aria-selected=true]) { background:#fcf3ea99; }
        #rooticare-range-hotkeys [data-role=fill] { margin-top:7px;color:#526047; }
        #rooticare-range-hotkeys [data-role=ectopic] { margin-top:7px;color:#526047; }
        #rooticare-range-hotkeys .rh-ectopic-options { margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#374333; }
        #rooticare-range-hotkeys.rh-minimized { padding:5px 9px; }
        #rooticare-range-hotkeys.rh-minimized [data-role=filters],
        #rooticare-range-hotkeys.rh-minimized [data-role=tabs],
        #rooticare-range-hotkeys.rh-minimized [data-role=fill],
        #rooticare-range-hotkeys.rh-minimized [data-role=ectopic],
        #rooticare-range-hotkeys.rh-minimized [data-role=af-option],
        #rooticare-range-hotkeys.rh-minimized [data-role=help] { display:none !important; }
        #rooticare-range-hotkeys [data-role=af-option] { margin-top:7px;color:#374333; }
        #rooticare-range-hotkeys [data-role=af-option] label { font-weight:600;color:#a0522d; }
        #rooticare-range-hotkeys [data-role=af-option] label.rh-af-only { margin-left:14px;font-weight:500; }
        #rooticare-range-hotkeys.rh-minimized [data-role=message] {
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;
        }
    `;
    document.head.appendChild(rangeStyle);
    document.body.appendChild(rangeHint);
    let rangeMessage;
    let rangeControls;
    let rangeMinimized = false;
    // 區間分頁：filter 篩選修改、fill 填補整理、ectopic 早搏判讀。只存在本次頁面執行期，重新整理後回到篩選修改。
    let rangeTool = 'filter';
    const RANGE_HELP = {
        filter: '在另一端按 Shift + 1→V／2→S／3→N／4→刪除，即套用篩選修改',
        fill: '在結尾之後按 Shift + 1→V／2→S／3→N，補上的標籤使用該類型',
        ectopic: '在另一端按 Shift + 1→V／2→S：判為早搏的改為該類型；Shift + 3→N：未判為早搏的改為 N'
    };
    function updateRangeTool() {
        if (!rangeControls) return;
        for (const tab of rangeHint.querySelectorAll('[data-tool]')) {
            tab.setAttribute('aria-selected', String(tab.dataset.tool === rangeTool));
        }
        const open = rangeMode?.first && !rangeBusy;
        // 分頁開啟時才套用該分頁顏色；結果提示維持白底。
        if (open) rangeHint.dataset.tool = rangeTool;
        else delete rangeHint.dataset.tool;
        rangeControls.style.display = open && rangeTool === 'filter' ? 'flex' : 'none';
        rangeHint.querySelector('[data-role="fill"]').style.display = open && rangeTool === 'fill' ? 'block' : 'none';
        rangeHint.querySelector('[data-role="ectopic"]').style.display = open && rangeTool === 'ectopic' ? 'block' : 'none';
        rangeHint.querySelector('[data-role="tabs"]').style.display = open ? 'flex' : 'none';
        rangeHint.querySelector('[data-role="af-option"]').style.display = open ? 'block' : 'none';
        const help = rangeHint.querySelector('[data-role="help"]');
        help.textContent = (isRangeAFOnly() ? '在另一端按 Shift + 1／2／3，只標為 AF、不修改標籤' : RANGE_HELP[rangeTool])
            + '。按 1／2／3 切換分頁';
        help.style.display = open ? 'block' : 'none';
    }
    function updateRangeMinimized() {
        rangeHint.classList.toggle('rh-minimized', rangeMinimized);
        const button = rangeHint.querySelector('[data-role="minimize"]');
        if (!button) return;
        button.textContent = rangeMinimized ? '+' : '−';
        button.title = rangeMinimized ? '展開' : '最小化';
        button.setAttribute('aria-label', button.title);
        button.setAttribute('aria-expanded', String(!rangeMinimized));
    }
    // 首次需要時才建立區間設定面板，保存節點供後續選取重用。
    // 上下限分別勾選才啟用；面板事件不向外傳遞，避免輸入數字時觸發網站分類快捷鍵。
    function ensureRangeControls() {
        if (rangeControls) return;
        rangeHint.innerHTML = `<div class="rh-head"><div data-role="message" role="status" aria-live="polite"></div>
                <button type="button" data-role="minimize" aria-label="最小化" title="最小化" aria-expanded="true">−</button>
                <button type="button" data-role="cancel" aria-label="取消區間選取" title="取消 · Esc">×</button></div>
            <div data-role="tabs" role="tablist">
                <button type="button" role="tab" data-tool="filter" title="快捷鍵 1">篩選修改</button>
                <button type="button" role="tab" data-tool="fill" title="快捷鍵 2">填補整理</button>
                <button type="button" role="tab" data-tool="ectopic" title="快捷鍵 3">早搏判讀</button></div>
            <div data-role="af-option"><label title="完成區間時一併標為 AF（需編輯模式）">
                <input type="checkbox" data-role="mark-af"> 同時標為 AF</label>
                <label class="rh-af-only" data-role="af-only-option" title="不修改標籤，只把區間標為 AF" style="display:none">
                <input type="checkbox" data-role="af-only"> 僅標為 AF</label></div>
            <div data-role="ectopic">依 RR 判斷提早出現的心搏（變動率超過門檻）；早搏後的代償間歇與恢復期不當作參考，
                避免恢復正常的心搏被連帶判為早搏。
                <div class="rh-ectopic-options">
                <span class="rh-group" title="只修改勾選的原標籤"><span>原標籤</span>
                <label><input type="checkbox" data-ectopic-source="N" checked> N</label>
                <label><input type="checkbox" data-ectopic-source="S" checked> S</label>
                <label><input type="checkbox" data-ectopic-source="V"> V</label></span>
                <span class="rh-group" title="（參考 RR − 目前 RR）÷目前 RR 超過此值判為早搏"><span>變動率 &gt;</span>
                <input type="number" data-role="ectopic-threshold" aria-label="早搏變動率門檻百分比" min="0.1" step="0.1" value="12"><span>%</span></span>
                </div></div>
            <div data-role="fill">以區間內第一顆與最後一顆標籤為錨點（兩顆不修改），依開頭那顆的 RR 平均補滿中間心搏；
                中間既有標籤靠近預期位置的保留原類型，多的刪除、缺的補上。</div>
            <div data-role="filters">
                <span class="rh-group" title="依此心搏與前一心搏的間隔計算 BPM，四捨五入後比較；勾選才啟用">
                <span>BPM</span>
                <label title="啟用下限"><input type="checkbox" data-role="bpm-min-enabled" aria-label="啟用 BPM 下限"> ≥</label>
                <input type="number" data-role="bpm-min" aria-label="BPM 下限" min="1" step="1" value="60">
                <label title="啟用上限"><input type="checkbox" data-role="bpm-max-enabled" aria-label="啟用 BPM 上限"> ≤</label>
                <input type="number" data-role="bpm-max" aria-label="BPM 上限" min="1" step="1" value="100"></span>
                <span class="rh-group" title="（前一 RR − 目前 RR）÷目前 RR；前兩個心搏不限標籤。所有啟用條件需同時符合。">
                <span>變動率</span>
                <label title="啟用下限"><input type="checkbox" data-role="variability-min-enabled" aria-label="啟用變動率下限"> ≥</label>
                <input type="number" data-role="variability-min" aria-label="變動率下限百分比" step="0.1" value="12"><span>%</span>
                <label title="啟用上限"><input type="checkbox" data-role="variability-max-enabled" aria-label="啟用變動率上限"> ≤</label>
                <input type="number" data-role="variability-max" aria-label="變動率上限百分比" step="0.1" value="12"><span>%</span></span>
                <span class="rh-group rh-source" title="只修改勾選的原標籤；所有啟用條件需同時符合"><span>原標籤</span>
                <label><input type="checkbox" data-source="N" checked> N</label>
                <label><input type="checkbox" data-source="S" checked> S</label>
                <label><input type="checkbox" data-source="V" checked> V</label></span>
                <span class="rh-group" title="前一個心搏（A 視為 S）的標籤需為勾選的類型；都不勾選表示不限"><span>前一個標籤類型為：</span>
                <label><input type="checkbox" data-previous="V"> V</label>
                <label><input type="checkbox" data-previous="S"> S</label>
                <label><input type="checkbox" data-previous="N"> N</label></span>
                <span class="rh-group" title="後一個心搏（A 視為 S）的標籤需為勾選的類型；都不勾選表示不限"><span>後一個標籤為：</span>
                <label><input type="checkbox" data-next="V"> V</label>
                <label><input type="checkbox" data-next="S"> S</label>
                <label><input type="checkbox" data-next="N"> N</label></span>
                <span class="rh-group rh-type" title="依心搏的形態分類（Morphology type）篩選；多個 type 以逗號分隔，例如 1,155；勾選才啟用">
                <label title="啟用 type 條件"><input type="checkbox" data-role="type-enabled" aria-label="啟用 type 條件"></label>
                <select data-role="type-mode" aria-label="type 條件"><option value="exclude">排除</option><option value="only">限於</option></select>
                <span>type</span><input type="text" data-role="type-list" aria-label="type 清單" placeholder="輸入 type 數字，多個以小逗號分隔" autocomplete="off"></span>
            </div><div data-role="help"></div>`;
        rangeMessage = rangeHint.querySelector('[data-role="message"]');
        rangeControls = rangeHint.querySelector('[data-role="filters"]');
        for (const tab of rangeHint.querySelectorAll('[data-tool]')) {
            tab.addEventListener('click', () => { rangeTool = tab.dataset.tool; updateRangeTool(); });
        }
        rangeHint.querySelector('[data-role="minimize"]').addEventListener('click', () => {
            rangeMinimized = !rangeMinimized;
            updateRangeMinimized();
        });
        updateRangeMinimized();
        rangeHint.querySelector('[data-role="cancel"]').addEventListener('click', cancelRange);
        for (const kind of ['bpm', 'variability']) for (const bound of ['min', 'max']) {
            const toggle = rangeHint.querySelector(`[data-role="${kind}-${bound}-enabled"]`);
            const update = () => { rangeHint.querySelector(`[data-role="${kind}-${bound}"]`).disabled = !toggle.checked; };
            toggle.addEventListener('change', update);
            update();
        }
        const typeToggle = rangeHint.querySelector('[data-role="type-enabled"]');
        const updateType = () => {
            for (const role of ['type-mode', 'type-list']) rangeHint.querySelector(`[data-role="${role}"]`).disabled = !typeToggle.checked;
        };
        typeToggle.addEventListener('change', updateType);
        updateType();
        // 勾選「同時標為 AF」時，篩選修改的原標籤自動取消 V（AF 區段通常只改 N／S）；使用者可再自行勾回。
        // 勾選後才顯示子選項「僅標為 AF」（預設不勾）；取消「同時標為 AF」時子選項一併取消並隱藏。
        const afOnlyOption = rangeHint.querySelector('[data-role="af-only-option"]');
        const afOnly = rangeHint.querySelector('[data-role="af-only"]');
        rangeHint.querySelector('[data-role="mark-af"]').addEventListener('change', event => {
            afOnlyOption.style.display = event.target.checked ? '' : 'none';
            if (!event.target.checked) afOnly.checked = false;
            if (event.target.checked) {
                const v = rangeHint.querySelector('[data-source="V"]');
                if (v) v.checked = false;
            }
            updateRangeTool();
        });
        afOnly.addEventListener('change', updateRangeTool);
        for (const name of ['mousedown', 'mouseup', 'click', 'keydown', 'keyup']) {
            rangeHint.addEventListener(name, e => e.stopPropagation());
        }
    }
    // 將面板轉為 BPM、變動率、來源標籤與 type 條件；未勾選的上下限以 null 表示，未勾選 type 時 types 為 null。
    // 變動率百分比除以 100 後參與計算；空白、無效數字、倒置上下限或未選來源皆拋出提示錯誤。
    function readRangeFilters() {
        const bounds = {};
        for (const bound of ['min', 'max']) {
            bounds[bound] = rangeHint.querySelector(`[data-role="bpm-${bound}-enabled"]`).checked
                ? Number(rangeHint.querySelector(`[data-role="bpm-${bound}"]`).value) : null;
            if (bounds[bound] !== null && (!Number.isFinite(bounds[bound]) || bounds[bound] <= 0))
                throw new Error(`請輸入大於 0 的 BPM ${bound === 'min' ? '下限' : '上限'}`);
        }
        if (bounds.min !== null && bounds.max !== null && bounds.min > bounds.max)
            throw new Error('BPM 下限不可大於上限');
        const variability = {};
        for (const bound of ['min', 'max']) {
            const input = rangeHint.querySelector(`[data-role="variability-${bound}"]`);
            variability[bound] = rangeHint.querySelector(`[data-role="variability-${bound}-enabled"]`).checked
                ? Number(input.value) / 100 : null;
            if (variability[bound] !== null && (!input.value.trim() || !Number.isFinite(variability[bound])))
                throw new Error('請輸入有效的變動率百分比');
        }
        if (variability.min !== null && variability.max !== null && variability.min > variability.max)
            throw new Error('變動率下限不可大於上限');
        variability.enabled = variability.min !== null || variability.max !== null;
        const sources = [...rangeHint.querySelectorAll('[data-source]:checked')].map(el => el.dataset.source);
        if (!sources.length) throw new Error('請至少勾選一種要修改的原標籤');
        // 前一個標籤：都不勾選時為 null（不限）。
        const previous = [...rangeHint.querySelectorAll('[data-previous]:checked')].map(el => el.dataset.previous);
        const next = [...rangeHint.querySelectorAll('[data-next]:checked')].map(el => el.dataset.next);
        let types = null;
        if (rangeHint.querySelector('[data-role="type-enabled"]')?.checked) {
            types = { mode: rangeHint.querySelector('[data-role="type-mode"]').value === 'only' ? 'only' : 'exclude',
                values: parseTypeList(rangeHint.querySelector('[data-role="type-list"]').value) };
        }
        return { enabled: bounds.min !== null || bounds.max !== null, ...bounds, variability, sources, types,
            previous: previous.length ? previous : null, next: next.length ? next : null };
    }
    // type 清單：「1,155」「{1, 155}」皆可，全形逗號、空白也可分隔；只接受非負整數。
    function parseTypeList(text) {
        const parts = String(text || '').replace(/[{}｛｝]/g, ' ').split(/[,，、\s]+/).filter(Boolean);
        if (!parts.length) throw new Error('請在 type 欄位輸入至少一個 type，例如 1,155');
        const invalid = parts.find(part => !/^\d+$/.test(part));
        if (invalid !== undefined) throw new Error(`type「${invalid}」不是有效的數字`);
        return [...new Set(parts.map(part => String(Number(part))))];
    }
    // 更新區間狀態文字；只有已選第一端點且未執行修改時，才顯示可操作的篩選欄位。
    function showRangeHint(text) {
        if (isDisabledPage()) { rangeHint.style.display = 'none'; return; }
        ensureRangeControls();
        rangeResultShown = false;
        rangeMessage.textContent = text;
        rangeMessage.title = text;
        updateRangeTool();
        rangeHint.style.display = 'block';
    }
    // 將滑鼠 X 座標換算成整份 ECG 的絕對取樣索引，包含目前時間窗、取樣率及通道位移。
    // 同時保存報告識別、Angular 控制器與未儲存陣列參照，用於第二端點及非同步完成後的一致性檢查。
    function getRangeContext(svg, clientX) {
        const angularAPI = window.angular;
        const scope = angularAPI?.element(svg).isolateScope();
        const info = scope?.posInfo;
        const rate = Number(info?.sampleRate || scope?.sampleRate);
        const seconds = Number(scope?.segSec);
        const start = Number(info?.idxRange?.[0]);
        const rect = svg.getBoundingClientRect();
        if (!scope || scope.eventDisabled || scope.invalidSwitch || !Number.isFinite(start) ||
            !(rate > 0) || !(seconds > 0) || !rect.width) throw new Error('無法讀取可編輯 ECG 的絕對索引');
        const shift = scope.threeChannel || scope.dialogSwitch ? Number(scope.shiftSec) : 0;
        if (!Number.isFinite(shift)) throw new Error('無法讀取 ECG 位移');
        const viewStart = start + shift * rate;
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        let parent = scope;
        while (parent && !parent.af) parent = parent.$parent;
        if (!parent?.af || !Array.isArray(scope.modifiedData)) throw new Error('無法讀取標籤修改資料');
        if (parent.af.loading?.modified || parent.af.labelEditing?.edit || parent.af.labelEditing?.pauseEdit)
            throw new Error('請先結束原生 R-type／Pause 模式或等待儲存完成');
        return { scope, parent, af: parent.af, index: Math.round(viewStart + fraction * rate * seconds),
            rate, viewStart, startTime: Number(scope.startTime) + shift,
            modifiedData: scope.modifiedData,
            record: [parent.af._vendorId, parent.af._idNumber, parent.af._measureId].join('|') };
    }
    // 以原始標籤加上未儲存修改後的有效分類，計算閉區間內需要變更的心搏。
    // A 正規化為 S 供篩選使用；BPM 與變動率由相鄰索引計算，缺前置心搏時不猜測。
    // 輸出沿用網站修改資料格式 [時間, 絕對索引, 目標分類, 原分類, 有效旗標]，保留最初分類供原生流程使用。
    function getRangeUpdates(effective, pending, data, first, start, end, tag, filters) {
        const normalize = type => type === 'A' ? 'S' : type;
        const beats = [...effective].filter(([index, type]) => Number.isFinite(index) && ['N', 'S', 'A', 'V'].includes(type))
            .sort((a, b) => a[0] - b[0]);
        const updates = [];
        for (let i = 0; i < beats.length; i++) {
            const [index, type] = beats[i];
            if (index < start || index > end || normalize(type) === tag || !filters.sources.includes(normalize(type))) continue;
            if (filters.types) {
                // 形態分類取自區間資料的 morphologyType；沒有分類的心搏（例如新增的標籤）不算在清單內。
                const morph = data.morphologyType?.[index];
                const listed = morph !== undefined && morph !== null && filters.types.values.includes(String(Number(morph)));
                if (filters.types.mode === 'only' ? !listed : listed) continue;
            }
            // 前一個標籤以修改前的標籤判斷；沒有前一心搏時不猜測。
            if (filters.previous && (!i || !filters.previous.includes(normalize(beats[i - 1][1])))) continue;
            // 後一個標籤同理；區間最後一顆之後沒有心搏時不修改。
            if (filters.next && (i === beats.length - 1 || !filters.next.includes(normalize(beats[i + 1][1])))) continue;
            if (filters.enabled) {
                if (!i) continue; // 無前一心搏時，不猜測 BPM。
                const interval = index - beats[i - 1][0];
                const bpm = Math.round(60 * first.rate / interval);
                if (!(interval > 0) || (filters.min !== null && bpm < filters.min) ||
                    (filters.max !== null && bpm > filters.max)) continue;
            }
            if (filters.variability?.enabled) {
                // 前兩搏不限標籤；變動率保留正負號、不取絕對值。
                if (i < 2) continue;
                const previousInterval = beats[i - 1][0] - beats[i - 2][0];
                const currentInterval = index - beats[i - 1][0];
                if (!(previousInterval > 0) || !(currentInterval > 0)) continue;
                const rate = (previousInterval - currentInterval) / currentInterval;
                if ((filters.variability.min !== null && rate < filters.variability.min) ||
                    (filters.variability.max !== null && rate > filters.variability.max)) continue;
            }
            const existing = pending.find(item => item[4] && item[1] === index);
            const original = existing ? existing[3] : data.anno[index] || type;
            const time = first.startTime + Math.floor((index - first.viewStart) / first.rate);
            updates.push([time, index, tag, original, 1]);
        }
        return updates;
    }
    // 由 cursor 往後讀取下一個有效心搏（N/S/A/V）寫入 effective，供「後一個標籤」條件使用；未儲存修改優先。
    // 網站的相鄰心搏 API：direction 1 為前一顆、0 為後一顆；只採用 cursor 之後的結果。回傳讀到的位置（沒有則為 null）。
    async function addFollowingBeat(manager, af, effective, pending, cursor) {
        for (let attempts = 0; attempts < 64; attempts++) {
            const response = await manager.Af.getAdjacentFilteredECGLabel(
                af._vendorId, af._idNumber, af._measureId, cursor, 0);
            const adjacent = response?.plain ? response.plain() : response;
            if (!adjacent || typeof adjacent !== 'object') throw new Error('無法讀取後一心搏');
            const entries = Object.entries(adjacent).map(([index, type]) => [Number(index), type])
                .filter(([index]) => Number.isFinite(index) && index > cursor).sort((a, b) => a[0] - b[0]);
            if (!entries.length) return null;
            const [index, type] = entries[0];
            const edit = pending.find(item => item[4] && item[1] === index);
            const label = edit ? edit[2] : type;
            effective.set(index, label);
            if (['N', 'S', 'A', 'V'].includes(label)) return index;
            cursor = index;
        }
        throw new Error('後一心搏連續刪除過多，無法確認後一個標籤');
    }
    // 由 cursor 往前讀取相鄰心搏寫入 effective，直到取得 requiredBeats 個有效心搏（N/S/A/V）；未儲存修改優先。
    async function addPrecedingBeats(manager, af, effective, pending, cursor, requiredBeats) {
        let precedingBeats = 0;
        for (let attempts = 0; attempts < 64; attempts++) {
            const adjacentResponse = await manager.Af.getAdjacentFilteredECGLabel(
                af._vendorId, af._idNumber, af._measureId, cursor, 1);
            const adjacent = adjacentResponse?.plain ? adjacentResponse.plain() : adjacentResponse;
            if (!adjacent || typeof adjacent !== 'object') throw new Error('無法讀取前一心搏以計算 BPM');
            const entries = Object.entries(adjacent).map(([index, type]) => [Number(index), type])
                .filter(([index]) => Number.isFinite(index) && index < cursor).sort((a, b) => b[0] - a[0]);
            if (!entries.length) break;
            const [index, type] = entries[0];
            const edit = pending.find(item => item[4] && item[1] === index);
            effective.set(index, edit ? edit[2] : type);
            if (['N', 'S', 'A', 'V'].includes(edit ? edit[2] : type)) precedingBeats++;
            if (precedingBeats >= requiredBeats) break;
            cursor = index;
            if (attempts === 63) throw new Error('前一心搏連續刪除過多，無法確認 BPM');
        }
    }
    // 填補整理：以 previous→a 的 RR 為目標，在錨點 a、b 之間排出心搏。
    // inner 為兩錨點之間的既有心搏 [索引, 類型]；靠近預期位置（±25% RR）的保留，其餘刪除，缺的平均補在保留的心搏之間。
    const FILL_VARIABILITY = 0.12;
    function planFill(a, b, previous, inner) {
        const targetRR = a - previous;
        const gap = b - a;
        if (!(targetRR > 0) || !(gap > 0)) throw new Error('無法計算開頭心搏的 RR');
        const count = Math.max(1, Math.round(gap / targetRR));
        const spacing = gap / count;
        const slots = [{ k: 0, index: a }];
        const kept = new Set();
        for (let k = 1; k < count; k++) {
            const expected = a + k * spacing;
            let best = null;
            for (const [index] of inner) {
                if (kept.has(index) || Math.abs(index - expected) > spacing * 0.25) continue;
                if (best === null || Math.abs(index - expected) < Math.abs(best - expected)) best = index;
            }
            if (best !== null) { kept.add(best); slots.push({ k, index: best }); }
        }
        slots.push({ k: count, index: b });
        const variability = (prevRR, rr) => (prevRR - rr) / rr;
        const beats = [previous, a];
        const add = [];
        for (let s = 1; s < slots.length; s++) {
            const from = slots[s - 1];
            const to = slots[s];
            const step = (to.index - from.index) / (to.k - from.k);
            for (let j = 1; j < to.k - from.k; j++) {
                const index = Math.round(from.index + j * step);
                add.push(index);
                beats.push(index);
            }
            beats.push(to.index);
        }
        let maxVariability = 0;
        for (let i = 2; i < beats.length; i++) {
            const value = Math.abs(variability(beats[i - 1] - beats[i - 2], beats[i] - beats[i - 1]));
            if (Number.isFinite(value)) maxVariability = Math.max(maxVariability, value);
        }
        return { targetRR, count, keep: [...kept], remove: inner.map(([index]) => index).filter(index => !kept.has(index)),
            add, maxVariability };
    }
    // 填補整理：區間內第一顆、最後一顆有效標籤為錨點且不修改；依開頭那顆的 RR 補滿、整理兩者之間的心搏。
    // 補上的標籤使用 tag；結果寫入未儲存修改，不自動儲存報告。
    async function applyFillRange(first, last, tag) {
        if (first.af !== last.af || first.record !== last.record || first.modifiedData !== last.modifiedData)
            throw new Error('兩點必須屬於同一份報告');
        if (first.rate !== last.rate) throw new Error('兩個視窗取樣率不同，請重新選取');
        const start = Math.min(first.index, last.index);
        const end = Math.max(first.index, last.index);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const af = first.af;
        const response = await manager.Af.getFilteredECGDataByIndexRange(
            af._vendorId, af._idNumber, af._measureId, start, end,
            first.startTime, af.record.ecgLeadMode, first.scope.channelSwitch || 1);
        const data = response?.plain ? response.plain() : response;
        if (!data?.anno || typeof data.anno !== 'object') throw new Error('區間標籤讀取失敗');
        if (data.sampleRate && Number(data.sampleRate) !== first.rate) throw new Error('區間取樣率不一致');
        const pending = first.modifiedData;
        const isBeat = type => ['N', 'S', 'A', 'V'].includes(type);
        const effective = new Map(Object.entries(data.anno).map(([index, type]) => [Number(index), type]));
        for (const item of pending) {
            if (item[4] && item[1] >= start && item[1] <= end) effective.set(item[1], item[2]);
        }
        const inRange = [...effective].filter(([index, type]) => Number.isFinite(index) && index >= start
            && index <= end && isBeat(type)).sort((x, y) => x[0] - y[0]);
        if (inRange.length < 2) throw new Error('區間內至少需要開頭與結尾兩顆標籤');
        const a = inRange[0][0];
        const b = inRange[inRange.length - 1][0];
        await addPrecedingBeats(manager, af, effective, pending, a, 1);
        if (isDisabledPage() || rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        for (const item of pending) if (item[4] && item[1] < start) effective.set(item[1], item[2]);
        const previous = [...effective].reduce((max, [index, type]) =>
            Number.isFinite(index) && index < a && isBeat(type) ? Math.max(max, index) : max, -Infinity);
        if (!Number.isFinite(previous)) throw new Error('找不到開頭前一顆心搏，無法計算 RR');
        const plan = planFill(a, b, previous, inRange.slice(1, -1));
        const target = new Map(plan.remove.map(index => [index, 'X']));
        for (const index of plan.add) target.set(index, tag);
        const updates = [];
        const touched = new Set(target.keys());
        for (const [index, type] of target) {
            const existing = pending.find(item => item[4] && item[1] === index);
            const original = existing ? existing[3] : data.anno[index] || 'X';
            if (original === type) continue; // 與原始資料相同：只撤銷未儲存修改。
            updates.push([first.startTime + Math.floor((index - first.viewStart) / first.rate), index, type, original, 1]);
        }
        first.parent.$apply(() => {
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && touched.has(pending[i][1])) pending.splice(i, 1);
            }
            pending.push(...updates);
        });
        return { added: plan.add.length, removed: plan.remove.length, targetRR: plan.targetRR,
            maxVariability: plan.maxVariability };
    }
    // ── 早搏判讀：依 RR 判斷區間內每顆心搏是否提早出現（早搏），再依結尾按鍵修改勾選的原標籤。
    // 變動率與 Isolated S 規則相同：（參考 RR − 目前 RR）/ 目前 RR，超過門檻（預設 12%）即為早搏。
    // 早搏後常有代償間歇（長 RR），之後可能再慢一拍才恢復；若拿這些長 RR 當參考，恢復正常的心搏
    // 也會被判為早搏並一路連鎖下去。因此參考 RR 另以「正常心律基準」限制：
    //   基準 = 最近 8 個乾淨 RR 的中位數；早搏本身、早搏後的間歇與再下一個 RR 都不算乾淨。
    //   前一個 RR 乾淨時，參考 = min(前一個 RR, 基準)：必須同時比前一拍與正常心律提早。
    //   前一顆是早搏（連發）或前一個 RR 落在早搏後的恢復期時，只與基準比較。
    const ECTOPIC_BASELINE_COUNT = 8;
    const ECTOPIC_BASELINE_LONG = 1.5; // 比基準長 1.5 倍以上的 RR（漏拍、雜訊）不納入基準
    const ectopicMedian = values => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = sorted.length >> 1;
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    // 備用基準：區間前後已是成串的 Bigeminy／Trigeminy 等（找不到乾淨 RR）時使用，依現有標籤推算正常 RR：
    //   1. 前後皆為 N 的 RR（Trigeminy 的 N→N）；
    //   2. 沒有時，用「N → 早搏… → N」整個週期平均到每一拍（Bigeminy：早搏 RR 加上代償間歇約為兩個正常 RR）。
    // 兩者都沒有（例如整段都是 SVT）時回傳 null，不判讀，避免把真正的早搏改掉。
    function ectopicFallbackBaseline(beats) {
        const isEctopic = type => type === 'V' || type === 'S';
        const nn = [];
        for (let i = 1; i < beats.length; i++) {
            if (!isEctopic(beats[i][1]) && !isEctopic(beats[i - 1][1])) nn.push(beats[i][0] - beats[i - 1][0]);
        }
        if (nn.length >= 2) return ectopicMedian(nn);
        const cycles = [];
        let lastNormal = -1;
        for (let i = 0; i < beats.length; i++) {
            if (isEctopic(beats[i][1])) continue;
            if (lastNormal >= 0 && i - lastNormal >= 2) cycles.push((beats[i][0] - beats[lastNormal][0]) / (i - lastNormal));
            lastNormal = i;
        }
        return cycles.length ? ectopicMedian(cycles) : null;
    }
    // trace（測試頁用）：傳入陣列時，逐顆記錄判讀時使用的基準、參考 RR 與變動率。
    function planEctopic(beats, start, end, sources, tag, threshold, trace = null) {
        const ectopic = [];
        const clean = []; // clean[i]：RR_i（第 i-1 顆到第 i 顆）可作為正常心律參考
        const baselineRR = [];
        const changes = new Map();
        let premature = 0, unknown = 0;
        const median = ectopicMedian;
        let fallback; // 需要時才計算
        for (let i = 0; i < beats.length; i++) {
            const [index, type] = beats[i];
            const rr = i > 0 ? index - beats[i - 1][0] : NaN;
            let baseline = baselineRR.length ? median(baselineRR.slice(-ECTOPIC_BASELINE_COUNT)) : null;
            if (baseline === null && index >= start) {
                if (fallback === undefined) fallback = ectopicFallbackBaseline(beats);
                baseline = fallback;
            }
            const judged = index >= start && index <= end && sources.includes(type);
            let isEctopic = type === 'V' || type === 'S';
            let reference = null, rate = null;
            if (judged) {
                if (rr > 0) {
                    const previousClean = i >= 2 && clean[i - 1] && !ectopic[i - 1];
                    const previousRR = i >= 2 ? beats[i - 1][0] - beats[i - 2][0] : NaN;
                    if (previousClean && previousRR > 0) reference = baseline === null ? previousRR : Math.min(previousRR, baseline);
                    else reference = baseline;
                }
                if (reference === null) {
                    unknown++; // 沒有可信的參考 RR：不修改，也不改變後續判斷用的類型
                } else {
                    rate = (reference - rr) / rr;
                    isEctopic = rate > threshold;
                    if (isEctopic) premature++;
                    const target = tag === 'N' ? (isEctopic ? null : 'N') : (isEctopic ? tag : null);
                    if (target && target !== type) changes.set(index, target);
                }
            }
            ectopic[i] = isEctopic;
            clean[i] = i > 0 && rr > 0 && !isEctopic && !ectopic[i - 1] && !(i >= 2 && ectopic[i - 2])
                && (baseline === null || rr < baseline * ECTOPIC_BASELINE_LONG);
            if (clean[i]) baselineRR.push(rr);
            trace?.push({ baseline, reference, rate, judged, ectopic: isEctopic, clean: clean[i] });
        }
        return { changes, premature, unknown };
    }
    function readEctopicOptions() {
        const sources = [...rangeHint.querySelectorAll('[data-ectopic-source]:checked')].map(el => el.dataset.ectopicSource);
        if (!sources.length) throw new Error('請至少勾選一種要修改的原標籤');
        const input = rangeHint.querySelector('[data-role="ectopic-threshold"]');
        const threshold = Number(input.value) / 100;
        if (!input.value.trim() || !Number.isFinite(threshold) || threshold <= 0) throw new Error('請輸入大於 0 的變動率門檻');
        return { sources, threshold };
    }
    async function applyEctopicRange(first, last, tag, options) {
        if (first.af !== last.af || first.record !== last.record || first.modifiedData !== last.modifiedData)
            throw new Error('兩點必須屬於同一份報告');
        if (first.rate !== last.rate) throw new Error('兩個視窗取樣率不同，請重新選取');
        const start = Math.min(first.index, last.index);
        const end = Math.max(first.index, last.index);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const af = first.af;
        const response = await manager.Af.getFilteredECGDataByIndexRange(
            af._vendorId, af._idNumber, af._measureId, start, end,
            first.startTime, af.record.ecgLeadMode, first.scope.channelSwitch || 1);
        const data = response?.plain ? response.plain() : response;
        if (!data?.anno || typeof data.anno !== 'object') throw new Error('區間標籤讀取失敗');
        if (data.sampleRate && Number(data.sampleRate) !== first.rate) throw new Error('區間取樣率不一致');
        const pending = first.modifiedData;
        const effective = new Map(Object.entries(data.anno).map(([index, type]) => [Number(index), type]));
        // 開頭前多讀幾顆心搏，建立正常心律基準。
        const firstIndex = [...effective.keys()].reduce((min, index) =>
            Number.isFinite(index) && index >= start ? Math.min(min, index) : min, Infinity);
        if (Number.isFinite(firstIndex)) await addPrecedingBeats(manager, af, effective, pending, firstIndex, ECTOPIC_BASELINE_COUNT + 2);
        if (isDisabledPage() || rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        for (const item of pending) if (item[4] && item[1] <= end) effective.set(item[1], item[2]);
        const beats = [...effective].filter(([index, type]) => Number.isFinite(index) && index <= end && ['N', 'S', 'A', 'V'].includes(type))
            .map(([index, type]) => [index, type === 'A' ? 'S' : type]).sort((a, b) => a[0] - b[0]);
        const plan = planEctopic(beats, start, end, options.sources, tag, options.threshold);
        const updates = [...plan.changes].map(([index, type]) => {
            const existing = pending.find(item => item[4] && item[1] === index);
            const original = existing ? existing[3] : data.anno[index] || type;
            return [first.startTime + Math.floor((index - first.viewStart) / first.rate), index, type, original, 1];
        });
        first.parent.$apply(() => {
            const indices = new Set(updates.map(item => item[1]));
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && indices.has(pending[i][1])) pending.splice(i, 1);
            }
            pending.push(...updates);
        });
        return { changed: updates.length, premature: plan.premature, unknown: plan.unknown };
    }
    // 核對兩端點屬於同一報告、同一修改陣列及相同取樣率，再讀取區間原始標籤。
    // 有間隔條件時額外取得前一至兩個有效心搏；套用前再次核對報告，最後於 Angular $apply 更新未儲存資料。
    async function applyIndexRange(first, last, tag, filters) {
        if (first.af !== last.af || first.record !== last.record || first.modifiedData !== last.modifiedData)
            throw new Error('兩點必須屬於同一份報告');
        if (first.rate !== last.rate) throw new Error('兩個視窗取樣率不同，請重新選取');
        const start = Math.min(first.index, last.index);
        const end = Math.max(first.index, last.index);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const af = first.af;
        const response = await manager.Af.getFilteredECGDataByIndexRange(
            af._vendorId, af._idNumber, af._measureId, start, end,
            first.startTime, af.record.ecgLeadMode, first.scope.channelSwitch || 1);
        const data = response?.plain ? response.plain() : response;
        if (!data?.anno || typeof data.anno !== 'object') throw new Error('區間標籤讀取失敗');
        if (data.sampleRate && Number(data.sampleRate) !== first.rate) throw new Error('區間取樣率不一致');
        const pending = first.modifiedData;
        const effective = new Map(Object.entries(data.anno).map(([index, type]) => [Number(index), type]));
        const needsIntervals = filters.enabled || filters.variability?.enabled || !!filters.previous;
        if (needsIntervals) {
            // 使用網站原生的相鄰心搏 API；不擴張 ECG 波形讀取範圍或改變 src 對應。
            const firstIndex = [...effective.keys()].reduce((min, index) =>
                Number.isFinite(index) && index >= start ? Math.min(min, index) : min, Infinity);
            if (Number.isFinite(firstIndex)) {
                await addPrecedingBeats(manager, af, effective, pending, firstIndex, filters.variability?.enabled ? 2 : 1);
            }
        }
        // 後一個標籤：區間最後一顆之後的心搏不在讀取範圍內，另外讀取一顆。
        let followingEnd = end;
        if (filters.next) {
            const lastIndex = [...effective.keys()].reduce((max, index) =>
                Number.isFinite(index) && index >= start && index <= end ? Math.max(max, index) : max, -Infinity);
            if (Number.isFinite(lastIndex)) {
                followingEnd = (await addFollowingBeat(manager, af, effective, pending, lastIndex)) ?? Infinity;
            }
        }
        // 所有非同步讀取完成後，再確認報告與未儲存資料仍一致。
        if (isDisabledPage() || rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        for (const item of pending) {
            // 結尾之後到後一顆心搏之間的未儲存修改（例如剛新增的標籤）也算在內。
            if (item[4] && item[1] <= followingEnd && (needsIntervals || item[1] >= start)) effective.set(item[1], item[2]);
        }
        const updates = getRangeUpdates(effective, pending, data, first, start, end, tag, filters);
        first.parent.$apply(() => {
            const indices = new Set(updates.map(item => item[1]));
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && indices.has(pending[i][1])) pending.splice(i, 1);
            }
            // 與原始資料相同（例如刪除尚未儲存的新增標籤）：只撤銷未儲存修改。
            pending.push(...updates.filter(item => item[2] !== item[3]));
        });
        return updates.length;
    }
    // 區間同時標為 AF：與網站 ECG 上的「AFib +」相同，依序以起點、終點呼叫 selectedNewAFEvent，
    // 由網站合併到 afEditing.data（與既有 AF 重疊的一併合併），尚未儲存。需在編輯模式。
    // 兩端點視為正常心律與 AF 的交界：直接以點擊位置作為 AF 起訖交給網站，不另外延伸。
    // AF 清單的 Start／End segment 預設為 AF 起訖前 10 秒，且伺服器會把 AF 結尾延到紀錄的整分格線再加 60 秒，
    // 只調 AF 範圍無法讓交界落在白色區塊；因此儲存後另外把該段 AF 的 Start／End segment 設在交界後
    // RANGE_AF_SEGMENT_SHIFT 秒（與在 AF 清單按 ◀ ▶ 調整相同，存在 eventRecordRange.af），交界落在白色區塊（前 10～2 秒）中央。
    const RANGE_AF_SEGMENT_SHIFT = 6;
    // 由絕對取樣索引換算時間：紀錄起點（dataRange[0]）＋索引÷取樣率。
    // 不用視窗的 startTime：心電圖視窗捲動後 startTime 已含 shiftSec，再加位移會晚 shiftSec 秒（20、30 秒不等）。
    function rangeIndexTime(ctx) {
        const origin = Number(ctx.af.record?.dataRange?.[0] ?? ctx.af.record?.startTimeInt);
        return origin + ctx.index / ctx.rate;
    }
    function markRangeAF(first, last) {
        const af = first.af;
        let host = first.parent;
        while (host && typeof host.selectedNewAFEvent !== 'function') host = host.$parent;
        if (!host || !af.afEditing) throw new Error('找不到網站的 AF 編輯功能');
        if (!af.ecgAnno?.editSwitch) throw new Error('需在編輯模式才能標為 AF');
        const times = [rangeIndexTime(first), rangeIndexTime(last)];
        if (!times.every(Number.isFinite)) throw new Error('無法換算區間時間');
        // 不超出紀錄的起訖時間。
        const recordStart = Number(af.record?.startTimeInt);
        const recordEnd = Number(af.record?.endTimeInt);
        const junctions = [Math.round(Math.min(...times)), Math.round(Math.max(...times))];
        let start = junctions[0];
        let end = junctions[1];
        if (Number.isFinite(recordStart)) start = Math.max(start, recordStart);
        if (Number.isFinite(recordEnd) && recordEnd > recordStart) end = Math.min(end, recordEnd);
        if (!(end > start)) throw new Error('區間太短');
        // 端點落在原有 AF 之中時，該端以原有 AF 為主：記下原本的起點／終點（儲存後用來找回同一段 AF）
        // 與原本自訂的 Start／End segment（儲存後還原，不移到點擊位置）。須在合併前記錄。
        const keepOriginal = (time, side) => {
            const range = (af.afEditing.data || []).find(item => Number(item?.start) <= time && Number(item?.end) >= time);
            if (!range) return null;
            const episode = listAFEpisodes(af).find(item => item.start <= time && item.end >= time);
            const saved = episode && af.eventRecordRange?.af?.[episode.start];
            const seg = Array.isArray(saved) && saved.length >= 3 ? Number(saved[side === 'start' ? 0 : 2]) : NaN;
            return { ref: Number(side === 'start' ? range.start : range.end), seg: Number.isFinite(seg) ? seg : null };
        };
        const keep = { start: keepOriginal(start, 'start'), end: keepOriginal(end, 'end') };
        host.$apply(() => {
            // 清掉進行到一半的 AFib + 選取，避免與這次的起點、終點混在一起；完成後也清空，下次點 AFib + 從頭開始。
            af.afEditing.selectedEvent = [];
            host.selectedNewAFEvent(start);
            host.selectedNewAFEvent(end);
            af.afEditing.selectedEvent = [];
        });
        queueAFSegments(af, start, end, junctions, keep);
        return [start, end];
    }
    // 儲存後設定 Start／End segment。
    // AF 清單的每段 AF 以伺服器算出的 60 秒區塊（tmsAFs）為準：起點可能被調到紀錄的整分格線、終點也會延長，
    // segment 位置要存在「AF 清單的那段 AF 的起點」（eventTypeStat.af 的 key）之下才會被使用。
    // 網站儲存 AF 後不會重算這些區塊，要重新載入紀錄後才有新的 key，因此待辦存在 localStorage（依紀錄），
    // 重新整理頁面後仍會完成。網站上傳 AF 時會先清掉新範圍內的 segment 位置，所以也要等 AF 已儲存才寫入。
    // 找 AF 清單中起點與這次 AF 起點相差 RANGE_AF_KEY_NEAR 秒內的那段調整 Start、終點相差 RANGE_AF_END_NEAR 秒內的調整 End；
    // 與既有 AF 合併而端點不是這次的，該端不調整；標記時端點已在原有 AF 之中的，該端還原原本的 segment（以原有 AF 為主）。
    // 放棄修改（AF 不再包含這段）或超過一天則取消。
    const AF_SEGMENT_STORE = 'rc-af-segment-jobs';
    const RANGE_AF_KEY_NEAR = 75;
    const RANGE_AF_END_NEAR = 150;
    function readAFSegmentJobs() {
        try { return JSON.parse(localStorage.getItem(AF_SEGMENT_STORE) || '[]').filter(job => job && Date.now() - job.since < 864e5); }
        catch (_) { return []; }
    }
    function writeAFSegmentJobs(jobs) {
        try { if (jobs.length) localStorage.setItem(AF_SEGMENT_STORE, JSON.stringify(jobs)); else localStorage.removeItem(AF_SEGMENT_STORE); }
        catch (_) {}
    }
    let afSegmentTimer = null;
    // AF 清單中的每段 AF（eventTypeStat.af：key 為起點，值為秒數）。
    function listAFEpisodes(af) {
        return Object.entries(af.eventTypeStat?.af || {}).map(([key, value]) => {
            const start = Number(key);
            return { start, end: start + Number([].concat(value)[0]) };
        }).filter(item => Number.isFinite(item.start) && item.end > item.start);
    }
    function queueAFSegments(af, start, end, junctions, keep = {}) {
        const jobs = readAFSegmentJobs();
        jobs.push({ measure: String(af._measureId), start, end, junctions,
            keepStart: keep.start || null, keepEnd: keep.end || null, since: Date.now() });
        writeAFSegmentJobs(jobs);
        startAFSegmentTimer();
    }
    function startAFSegmentTimer() {
        if (!afSegmentTimer && readAFSegmentJobs().length) afSegmentTimer = setInterval(checkAFSegments, 1000);
    }
    let afSegmentBusy = false;
    async function checkAFSegments() {
        if (afSegmentBusy) return;
        let jobs = readAFSegmentJobs();
        if (!jobs.length) { clearInterval(afSegmentTimer); afSegmentTimer = null; writeAFSegmentJobs([]); return; }
        const af = getPrintHost()?.af;
        if (!af?._measureId || af.loading?.record || af.loading?.modified || !af.afEditing || !af.eventRecordRange) return;
        const mine = jobs.filter(job => job.measure === String(af._measureId));
        if (!mine.length) return;
        afSegmentBusy = true;
        try {
            for (const job of mine) {
                const drop = () => { jobs = jobs.filter(other => other !== job); writeAFSegmentJobs(jobs); };
                const covers = range => Number(range?.start) <= job.start && Number(range?.end) >= job.end;
                if (!(af.afEditing.data || []).some(covers)) { drop(); continue; } // 放棄修改
                // 等 AF 已儲存、沒有其他未上傳的 AF 或 segment 修改。
                if (!(af.afEditing.ogData || []).some(covers)
                    || JSON.stringify(af.afEditing.ogData) !== JSON.stringify(af.afEditing.data)
                    || JSON.stringify(af.eventRecordRange) !== JSON.stringify(af.ogEventRecordRange)) continue;
                // AF 清單中的那段 AF：起點不晚於交界、終點不早於交界，且起點或終點靠近這次的 AF 起訖
                // （端點在原有 AF 之中的，改以原有 AF 的起點／終點比對）。
                const startRef = job.keepStart ? job.keepStart.ref : job.start;
                const endRef = job.keepEnd ? job.keepEnd.ref : job.end;
                const episodes = listAFEpisodes(af)
                    .filter(item => item.start <= job.junctions[0] && item.end >= job.junctions[1]);
                const episode = episodes.find(item => Math.abs(item.start - startRef) <= RANGE_AF_KEY_NEAR
                    || Math.abs(item.end - endRef) <= RANGE_AF_END_NEAR);
                if (!episode) {
                    // 新的 AF 區塊要重新載入紀錄後才有：提示一次。
                    if (!job.hinted) {
                        job.hinted = true;
                        writeAFSegmentJobs(jobs);
                        quickToast(null, '重新整理頁面後對準 AF segment');
                    }
                    continue;
                }
                const ownStart = !job.keepStart && Math.abs(episode.start - job.start) <= RANGE_AF_KEY_NEAR;
                const ownEnd = !job.keepEnd && Math.abs(episode.end - job.end) <= RANGE_AF_END_NEAR;
                const key = episode.start;
                // 其餘 segment 沿用網站預設（adujustEventRange：起點、中點、終點）。
                const saved = af.eventRecordRange.af?.[key];
                const current = Array.isArray(saved) && saved.length >= 3
                    ? [...saved] : [key, key + Math.ceil((episode.end - key) / 2), episode.end];
                if (ownStart) current[0] = job.junctions[0] + RANGE_AF_SEGMENT_SHIFT;
                else if (job.keepStart?.seg != null) current[0] = job.keepStart.seg;
                if (ownEnd) current[2] = job.junctions[1] + RANGE_AF_SEGMENT_SHIFT;
                else if (job.keepEnd?.seg != null) current[2] = job.keepEnd.seg;
                drop();
                // 兩端都以原有 AF 為主且 segment 沒有變動時，不必上傳。
                if (Array.isArray(saved) && JSON.stringify(saved) === JSON.stringify(current)) continue;
                if (!ownStart && !ownEnd && !Array.isArray(saved) && job.keepStart?.seg == null && job.keepEnd?.seg == null) continue;
                if (!af.eventRecordRange.af) af.eventRecordRange.af = {};
                af.eventRecordRange.af[key] = current;
                try {
                    await uploadSectionSelections(af);
                    getPrintHost()?.$applyAsync?.();
                    quickToast(null, '已對準 AF segment');
                } catch (error) {
                    quickToast(null, `AF segment 位置上傳失敗：${error?.message || error?.status || error}`, true);
                }
            }
        } finally {
            afSegmentBusy = false;
        }
    }
    // 頁面載入（或重新整理）後繼續未完成的待辦。
    setTimeout(startAFSegmentTimer, 3000);
    // 「同時標為 AF」與子選項「僅標為 AF」都勾選時，完成區間只標為 AF，不修改標籤。
    function isRangeAFOnly() {
        return !!(rangeHint.querySelector('[data-role="mark-af"]')?.checked
            && rangeHint.querySelector('[data-role="af-only"]')?.checked);
    }
    // 勾選「同時標為 AF」時標記，回傳附加在結果提示的文字；標記失敗不影響已完成的標籤修改。
    function markRangeAFNote(first, last, tag) {
        if (tag === 'X' || !rangeHint.querySelector('[data-role="mark-af"]')?.checked) return '';
        try {
            markRangeAF(first, last);
            return ' · 已標為 AF';
        } catch (error) {
            return ` · 未標為 AF：${error?.message || error}`;
        }
    }
    // 標記目前選取已取消；若資料仍在讀取，保留取消旗標讓非同步流程在寫入前中止。
    function cancelRange() {
        if (rangeMode) rangeMode.cancelled = true;
        if (!rangeBusy) rangeMode = null;
        if (!rangeBusy) rangeHint.style.display = 'none';
    }

    // RootiCare 站內切頁不一定重載腳本；每次操作仍檢查目前路徑。
    // 路由畫面更新時也收起尚未完成的區間面板。
    let lastPagePath = window.location?.pathname;
    // 站內路由改變時更新可用狀態與焦點樣式；進入 Morphology 時收起未完成的區間操作。
    function updatePageAvailability() {
        installZoomPersistence();
        const path = window.location?.pathname;
        if (style.sheet) style.sheet.disabled = isDisabledPage();
        if (path === lastPagePath) return;
        lastPagePath = path;
        if (isDisabledPage()) { cancelRange(); rangeHint.style.display = 'none'; }
    }
    updatePageAvailability();
    window.addEventListener('popstate', updatePageAvailability);
    window.addEventListener('hashchange', updatePageAvailability);
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(updatePageAvailability).observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener('blur', cancelRange);
    // 拖曳只預覽 DOM，放開後才以原生修改格式提交；不自動儲存報告。
    let labelDrag = null;
    let dragClickUntil = 0;
    const movedLabelSources = new WeakMap();
    // 原位仍有原始心搏資料；重新新增 N 時撤銷刪除，避免送出互相抵消的新增／刪除。
    function restoreMovedLabelSource(pending, index) {
        const position = pending.findIndex(item => item[4] && item[1] === index && item[2] === 'X');
        if (position < 0) return false;
        const original = pending[position][3];
        if (original === 'N') pending.splice(position, 1);
        else pending[position][2] = 'N';
        return true;
    }
    document.addEventListener('click', event => {
        if (event.button !== 0 || isDragModifier(event) || labelDrag || (event.isTrusted && Date.now() < dragClickUntil)
            || isDisabledPage()) return;
        const svg = event.target.closest?.('svg.ecgRMarker');
        if (!svg || event.target.closest?.('.annoText') || !svg.closest(TARGET_BLOCK_SELECTOR)) return;
        try {
            const context = getRangeContext(svg, event.clientX);
            const sources = movedLabelSources.get(context.modifiedData);
            const original = context.scope.annoData.find(beat => Math.abs(beat.index - context.index) <= 10);
            if (!original || !sources?.has(original.index)
                || !context.modifiedData.some(item => item[4] && item[1] === original.index && item[2] === 'X')) return;
            event.preventDefault(); event.stopImmediatePropagation();
            context.parent.$apply(() => restoreMovedLabelSource(context.modifiedData, original.index));
        } catch (_) { /* 不可編輯時沿用原生禁用狀態。 */ }
    }, true);
    function previewDragIntervals(drag) {
        const width = Number(drag.svg.getAttribute('width'));
        const pixelsPerSample = width / (drag.first.rate * Number(drag.first.scope.segSec));
        for (const item of drag.intervals) {
            const from = item.side === 'left' ? item.neighbor : drag.index;
            const to = item.side === 'left' ? drag.index : item.neighbor;
            const interval = to - from;
            if (!(interval > 0)) continue;
            item.text.nodeValue = String(Math.floor(interval / drag.first.rate * 1000));
            if (item.bpm) item.bpm.textContent = String(Math.round(60 * drag.first.rate / interval));
            // 父 text 的總長度包含下方 tspan；兩列須分別量寬，再共用同一中心。
            const rrWidth = item.node.getSubStringLength(0, item.text.nodeValue.length);
            const bpmWidth = item.bpm ? item.bpm.getComputedTextLength() : 0;
            const margin = Math.max(rrWidth, bpmWidth) / 2 + 1;
            const center = Math.max(margin, Math.min(width - margin,
                ((from + to) / 2 - drag.first.viewStart) * pixelsPerSample));
            item.node.setAttribute('px', center);
            item.node.setAttribute('x', center - rrWidth / 2);
            if (item.bpm) item.bpm.setAttribute('x', center - bpmWidth / 2);
        }
    }
    function finishLabelDrag(commit = false) {
        const drag = labelDrag;
        if (!drag) return;
        labelDrag = null;
        hideAlignmentGuide();
        dragClickUntil = Date.now() + 400;
        drag.label.setAttribute('x', drag.originalX);
        drag.label.textContent = drag.originalText;
        drag.label.style.fill = drag.originalFill;
        for (const item of drag.intervals) {
            item.text.nodeValue = item.originalText;
            item.node.setAttribute('x', item.x);
            item.node.setAttribute('px', item.px);
            if (item.bpm) {
                item.bpm.textContent = item.originalBpm;
                item.bpm.setAttribute('x', item.bpmX);
            }
        }
        // 位置沒變且類型也沒變（或取消）時不送出修改。
        if (!commit || (drag.index === drag.first.index && drag.type === drag.originalType)) return;
        try {
            const current = getRangeContext(drag.svg, drag.lastX);
            if (!drag.svg.isConnected || isDisabledPage() || current.scope !== drag.first.scope
                || current.record !== drag.first.record || current.viewStart !== drag.first.viewStart
                || current.rate !== drag.first.rate || current.modifiedData !== drag.first.modifiedData
                || JSON.stringify(current.modifiedData) !== drag.pendingSnapshot) return;
            const pending = current.modifiedData;
            const source = pending.find(item => item[4] && item[1] === drag.first.index);
            const original = source ? source[3] : drag.originalType;
            const destination = pending.find(item => item[4] && item[1] === drag.index);
            const destinationOriginal = destination ? destination[3]
                : current.scope.annoData.find(item => item.index === drag.index)?.type || 'X';
            const edit = (index, type, originalType) => [current.startTime
                + Math.floor((index - current.viewStart) / current.rate), index, type, originalType, 1];
            // 拖曳中只按了數字鍵、位置沒變：只改類型（改回原始類型時移除這筆修改）。
            if (drag.index === drag.first.index) {
                current.parent.$apply(() => {
                    for (let i = pending.length - 1; i >= 0; i--) {
                        if (pending[i][4] && pending[i][1] === drag.index) pending.splice(i, 1);
                    }
                    if (drag.type !== original) pending.push(edit(drag.index, drag.type, original));
                });
                return;
            }
            current.parent.$apply(() => {
                for (let i = pending.length - 1; i >= 0; i--) {
                    if (pending[i][4] && [drag.first.index, drag.index].includes(pending[i][1])) pending.splice(i, 1);
                }
                pending.push(edit(drag.first.index, 'X', original), edit(drag.index, drag.type, destinationOriginal));
                let sources = movedLabelSources.get(pending);
                if (!sources) { sources = new Set(); movedLabelSources.set(pending, sources); }
                sources.add(drag.first.index);
            });
        } catch (error) {
            console.warn('[RootiCare 標籤位置微調] 已取消', error);
        }
    }
    // Alt 拖曳的標籤列：按在標籤列上就是該列；按在心電圖波形上（包含事件清單卡片上覆蓋波形的 graphy-cover）
    // 則依位置找到同一區塊的標籤列，x 需落在標籤列範圍內。不在 ECG 區塊上回傳 null。
    function dragMarkerAt(event) {
        const direct = event.target?.closest?.('svg.ecgRMarker');
        if (direct) return direct.closest(TARGET_BLOCK_SELECTOR) ? direct : null;
        for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
            if (element.closest?.('.rc-review-bar, .rc-quick-toast')) return null;
            const block = element.closest?.(TARGET_BLOCK_SELECTOR);
            if (!block) continue;
            const marker = block.querySelector('svg.ecgRMarker');
            const row = marker?.getBoundingClientRect();
            return row && row.width > 0 && event.clientX >= row.left && event.clientX <= row.right ? marker : null;
        }
        return null;
    }
    // 標籤列中水平距離游標最近、可拖曳（N / A / S / V）的標籤。
    function findNearestDraggableLabel(svg, clientX) {
        let nearest = null;
        let nearestDistance = Infinity;
        for (const label of svg.querySelectorAll('.annoText')) {
            const beat = label.__data__;
            if (!Number.isInteger(beat?.index) || !['N', 'A', 'S', 'V'].includes(beat.type)) continue;
            const bounds = label.getBoundingClientRect();
            if (!(bounds.width > 0)) continue;
            const distance = Math.abs(bounds.left + bounds.width / 2 - clientX);
            if (distance < nearestDistance) { nearest = label; nearestDistance = distance; }
        }
        return nearest;
    }
    document.addEventListener('pointerdown', event => {
        // 在波形上按 Alt 也比照標籤列：拖曳最近的標籤，並攔下網站對波形的點擊（例如 Pause 清單切換排除類型）。
        const marker = isDragModifier(event) ? dragMarkerAt(event) : null;
        if (event.button === 0 && isDragModifier(event) && marker && !isDisabledPage()) {
            event.preventDefault(); event.stopImmediatePropagation();
            dragClickUntil = Date.now() + 400;
        }
        if (event.button !== 0 || !isDragModifier(event) || event.shiftKey || event.ctrlKey || event.metaKey
            || isDisabledPage() || rangeBusy || labelDrag) return;
        // 按在標籤上就拖曳該標籤；按在標籤列空白處則吸過最近的標籤，直接移到游標位置後可繼續拖曳。
        let label = event.target.closest?.('.annoText');
        if (!label && marker) label = findNearestDraggableLabel(marker, event.clientX);
        const svg = label?.closest('svg.ecgRMarker');
        if (!svg || !label.closest(TARGET_BLOCK_SELECTOR)) return;
        // Alt 點擊不送入原生循環分類，即使目前標籤不可編輯也不變更分類。
        event.preventDefault(); event.stopImmediatePropagation();
        dragClickUntil = Date.now() + 400;
        try {
            const first = getRangeContext(svg, event.clientX);
            const beat = label.__data__;
            if (!Number.isInteger(beat?.index) || !['N', 'A', 'S', 'V'].includes(beat.type)) return;
            first.index = beat.index;
            const effective = new Map(first.scope.annoData.map(item => [item.index, item.type]));
            for (const item of first.modifiedData) if (item[4]) effective.set(item[1], item[2]);
            const neighbors = [...effective].filter(([, type]) => ['N', 'A', 'S', 'V'].includes(type))
                .map(([index]) => index).sort((a, b) => a - b);
            const position = neighbors.indexOf(beat.index);
            if (position < 0) return;
            const labelMargin = (label.getComputedTextLength() / 2 + 1)
                / Number(svg.getAttribute('width')) * first.rate * Number(first.scope.segSec);
            const previous = neighbors[position - 1] ?? (Number(first.scope.idxAdjust?.[0]) > 0
                ? beat.index - Number(first.scope.idxAdjust[0]) : null);
            const next = neighbors[position + 1] ?? (Number(first.scope.idxAdjust?.[1]) > 0
                ? beat.index + Number(first.scope.idxAdjust[1]) : null);
            const durationNodes = [...svg.querySelectorAll('.annoDuration')]
                .filter(node => typeof node.__data__ === 'number').sort((a, b) => a.__data__ - b.__data__);
            const rightNode = durationNodes.find(node => node.__data__ > beat.index);
            const intervals = durationNodes.flatMap(node => {
                const side = node.__data__ === beat.index ? 'left' : node === rightNode ? 'right' : null;
                const neighbor = side === 'left' ? previous : next;
                const text = [...node.childNodes].find(child => child.nodeType === 3);
                if (!side || neighbor == null || !text || !text.nodeValue.trim()) return [];
                const bpm = node.querySelector('tspan');
                return [{ node, side, neighbor, text, bpm, originalText: text.nodeValue,
                    originalBpm: bpm?.textContent, x: node.getAttribute('x'), px: node.getAttribute('px'),
                    bpmX: bpm?.getAttribute('x') }];
            });
            labelDrag = { label, svg, first, type: beat.type, originalType: beat.type, pointerId: event.pointerId,
                originalText: label.textContent, originalFill: label.style.fill,
                intervals,
                startX: event.clientX, lastX: event.clientX, originalX: label.getAttribute('x'), index: beat.index,
                pendingSnapshot: JSON.stringify(first.modifiedData),
                min: Math.max(Math.ceil(first.viewStart + labelMargin), (neighbors[position - 1] ?? -Infinity) + 1),
                max: Math.min(Math.floor(first.viewStart + first.rate * Number(first.scope.segSec) - labelMargin),
                    (neighbors[position + 1] ?? Infinity) - 1) };
            updateLabelDragPosition(event);
        } catch (_) { /* 原生禁用或資料尚未就緒時不開始拖曳。 */ }
    }, true);
    document.addEventListener('pointermove', event => {
        const drag = labelDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault(); event.stopImmediatePropagation();
        // Alt 只需在開始時按住；之後放開 Alt 仍可繼續拖曳（方便拖曳中按數字鍵），放開滑鼠才結束。
        if (!(event.buttons & 1) || !drag.label.isConnected || isDisabledPage()) {
            finishLabelDrag(); return;
        }
        updateLabelDragPosition(event);
    }, true);
    function updateLabelDragPosition(event) {
        const drag = labelDrag;
        if (!drag) return;
        const bounds = drag.svg.getBoundingClientRect();
        if (!(bounds.width > 0) || drag.min > drag.max) { finishLabelDrag(); return; }
        const samplesPerPixel = drag.first.rate * Number(drag.first.scope.segSec) / bounds.width;
        drag.index = Math.max(drag.min, Math.min(drag.max,
            Math.round(drag.first.viewStart + (event.clientX - bounds.left) * samplesPerPixel)));
        drag.lastX = event.clientX;
        const scale = Number(drag.svg.getAttribute('width')) / bounds.width;
        const centerX = (drag.index - drag.first.viewStart) / samplesPerPixel * scale;
        drag.label.setAttribute('x', centerX - drag.label.getComputedTextLength() / 2);
        previewDragIntervals(drag);
        guideMarker = drag.svg;
        guideMouseX = bounds.left + (drag.index - drag.first.viewStart) / samplesPerPixel;
        guideMouseY = event.clientY;
        if (guideFrame !== null) cancelAnimationFrame(guideFrame);
        drawAlignmentGuide();
    }
    document.addEventListener('pointerup', event => {
        if (!labelDrag || event.pointerId !== labelDrag.pointerId) return;
        event.preventDefault(); event.stopImmediatePropagation();
        finishLabelDrag(event.button === 0);
    }, true);
    for (const name of ['mousedown', 'mouseup', 'click', 'dblclick']) {
        document.addEventListener(name, event => {
            const altOnMarker = isDragModifier(event) && event.button === 0 && !isDisabledPage() && dragMarkerAt(event);
            // 拖曳放開後只吞掉滑鼠實際產生的那一次點擊；數字鍵模擬的點擊（isTrusted 為 false）不受影響，
            // 拖完可以立刻按 1／2／3 修改。
            const afterDrag = event.isTrusted && event.button === 0 && Date.now() < dragClickUntil;
            if (altOnMarker || labelDrag || afterDrag) {
                event.preventDefault(); event.stopImmediatePropagation();
                if (afterDrag && name === 'click') dragClickUntil = 0;
            }
        }, true);
    }
    // 拖曳中：1／2／3 把這顆標籤改為 V／S／N（以實體按鍵判斷，按住 Alt 也可），放開滑鼠時連同新位置一起送出；Esc 取消。
    const DRAG_TYPE_COLORS = { V: '#e2231a', S: '#1f6fd1', N: '#555' };
    function setLabelDragType(drag, type) {
        drag.type = type;
        drag.label.textContent = type;
        // 顏色沿用同一列中相同類型的標籤，沒有時用預設色；放開後網站會依實際修改重畫。
        const sample = [...drag.svg.querySelectorAll('.annoText')]
            .find(node => node !== drag.label && node.__data__?.type === type);
        drag.label.style.fill = sample ? getComputedStyle(sample).fill : DRAG_TYPE_COLORS[type];
    }
    document.addEventListener('keydown', event => {
        if (!labelDrag) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Escape') { finishLabelDrag(); return; }
        const digit = /^(?:Digit|Numpad)([123])$/.exec(event.code || '')?.[1];
        if (digit && !event.repeat) setLabelDragType(labelDrag, { '1': 'V', '2': 'S', '3': 'N' }[digit]);
    }, true);
    document.addEventListener('pointercancel', () => finishLabelDrag(), true);
    // 拖曳中不開啟右鍵選單。
    document.addEventListener('contextmenu', event => {
        if (isDisabledPage()) return;
        if (labelDrag) {
            event.preventDefault();
        }
    }, true);
    window.addEventListener('blur', () => finishLabelDrag());
    // 第一次快捷鍵記錄端點，第二次讀取篩選條件並套用區間；目標分類以第二次按鍵為準。
    // 執行中鎖住區間操作；完成或失敗後顯示結果，並延遲收起提示，不自動儲存報告。
    async function selectRangePoint(tag) {
        let failed = false;
        const block = getActiveBlockUnderMouse();
        const svg = block?.querySelector('.annoGroup')?.closest('svg');
        if (!svg) {
            showRangeHint('請在 ECG 上按 Shift + 1／2／3／4 選取端點');
            return;
        }
        try {
            const context = getRangeContext(svg, currentMousePos.x);
            if (!rangeMode?.first) {
                rangeMode = { tag, first: context };
                showRangeHint('區間修改 · 已選第一端點');
                return;
            }
            const mode = rangeMode;
            // 僅標為 AF：不修改標籤，以 Shift + 1／2／3 完成區間後直接標為 AF。
            if (isRangeAFOnly()) {
                if (tag === 'X') {
                    showRangeHint('僅標為 AF 時請按 Shift + 1／2／3 完成區間');
                    return;
                }
                rangeBusy = true;
                rangeMode = null;
                try {
                    markRangeAF(mode.first, context);
                    showRangeHint('已標為 AF（未修改標籤） · 尚未儲存');
                } catch (error) {
                    failed = true;
                    showRangeHint(`未標為 AF：${error?.message || error}`);
                }
                return;
            }
            // Shift+4（刪除）只用於篩選修改；其他分頁保留第一端點，改按 Shift+1／2／3。
            if (tag === 'X' && rangeTool !== 'filter') {
                showRangeHint('Shift + 4 刪除只能用於篩選修改，請改按 Shift + 1／2／3 或切換分頁');
                return;
            }
            if (rangeTool === 'ectopic') {
                let options;
                try { options = readEctopicOptions(); }
                catch (error) { showRangeHint(error.message); return; }
                mode.tag = tag;
                rangeBusy = true;
                showRangeHint(`正在判讀早搏 → ${tag}…`);
                const result = await applyEctopicRange(mode.first, context, tag, options);
                rangeMode = null;
                const afNote = markRangeAFNote(mode.first, context, tag);
                const notes = [`判為早搏 ${result.premature} 顆`];
                if (result.unknown) notes.push(`${result.unknown} 顆缺少參考 RR，未判讀`);
                showRangeHint((result.changed ? `已修改 ${result.changed} 個標籤 → ${tag}` : '沒有需要變更的標籤')
                    + ` · ${notes.join(' · ')}` + afNote + (result.changed || afNote.includes('已標為') ? ' · 尚未儲存' : ''));
                return;
            }
            if (rangeTool === 'fill') {
                mode.tag = tag;
                rangeBusy = true;
                showRangeHint(`正在填補整理 → ${tag}…`);
                const result = await applyFillRange(mode.first, context, tag);
                rangeMode = null;
                const afNote = markRangeAFNote(mode.first, context, tag);
                const notes = [`RR ${Math.round(result.targetRR / mode.first.rate * 1000)} ms`];
                if (result.maxVariability > FILL_VARIABILITY) notes.push(`最大變動率 ${(result.maxVariability * 100).toFixed(1)}%，超過 12%`);
                showRangeHint(result.added || result.removed
                    ? `已補 ${result.added} 顆（${tag}）、刪除 ${result.removed} 顆 · ${notes.join(' · ')}${afNote} · 尚未儲存`
                    : `兩錨點之間已符合，不需修改 · ${notes.join(' · ')}${afNote}` + (afNote.includes('已標為') ? ' · 尚未儲存' : ''));
                return;
            }
            let filters;
            try { filters = readRangeFilters(); }
            catch (error) { showRangeHint(error.message); return; }
            mode.tag = tag;
            rangeBusy = true;
            const action = tag === 'X' ? '刪除' : `→ ${tag}`;
            showRangeHint(`正在篩選區間標籤 ${action}…`);
            const count = await applyIndexRange(mode.first, context, tag, filters);
            rangeMode = null;
            const afNote = markRangeAFNote(mode.first, context, tag);
            showRangeHint((!count ? '沒有符合條件且需要變更的標籤'
                : tag === 'X' ? `已刪除 ${count} 個標籤` : `已修改 ${count} 個標籤 → ${tag}`)
                + afNote + (count || afNote.includes('已標為') ? ' · 尚未儲存' : ''));
        } catch (error) {
            failed = true;
            const detail = error?.message || (error?.status ? `資料讀取失敗（HTTP ${error.status}）` : '區間修改失敗，請重新選取');
            showRangeHint(detail);
            rangeMode = null;
        } finally {
            if (rangeBusy) {
                rangeBusy = false;
                if (!rangeMode) rangeResultShown = true;
                setTimeout(() => { if (!rangeMode && !rangeBusy) rangeHint.style.display = 'none'; }, failed ? 15000 : 3500);
            }
        }
    }

    // 以樣式規則隱藏 AF 圖示，網站重繪後新產生的圖示也一併隱藏；再按一次或重新整理頁面後恢復。
    // 告知「ECG 變動率縮圖標記器」：本腳本存在，可在 AF 頁面以 B 恢復顯示，MP 縮圖的 B 可與這裡連動（隱藏 AF 頁面的圖示）。
    // 沒有這個標記時，縮圖標記器只隱藏自己的縮圖圖示，不影響 AF 頁面。
    document.documentElement.dataset.rcAfIconToggle = '1';
    function toggleAFIcons() {
        const existing = document.getElementById('rc-hide-af-icon');
        if (existing) { existing.remove(); return; }
        const style = document.createElement('style');
        style.id = 'rc-hide-af-icon';
        style.textContent = 'image.af-icon, image[*|href*="icon_AFibMark"] { display: none !important; }';
        document.head.appendChild(style);
    }

    // ── V：顯示隱藏的原始心搏 ──
    // 機器原本標的 S／V（分類紀錄的 posSVEB／posPVC）若沒有被刪除，卻沒有出現在畫面上（例如旁邊又新增了一顆，
    // 網站只顯示其中一顆），伺服器分類時仍可能算進去，造成 Triplet／SVE run 等子分類錯誤。
    // 按 V 以紫色在標籤列標出這些心搏（波形上加紫色虛線），點一下加入「刪除」的未儲存修改，再點一下取消；
    // 只寫入未儲存修改（與網站刪除標籤相同），原始資料不變，按 Save 後才生效。原本為 N 的心搏網站沒有提供，不顯示。
    const HIDDEN_BEAT_COLOR = '#8e24aa';
    const hiddenBeatStyle = document.createElement('style');
    hiddenBeatStyle.textContent = `
        .rc-hidden-beat rect { fill:${HIDDEN_BEAT_COLOR}; cursor:pointer; vector-effect:non-scaling-stroke; }
        .rc-hidden-beat text { fill:#fff; font-weight:700; text-anchor:middle; dominant-baseline:central;
            font-family:Arial, sans-serif; pointer-events:none; user-select:none; }
        .rc-hidden-beat.is-pending rect { fill:#fff; stroke:${HIDDEN_BEAT_COLOR}; stroke-width:1.5; stroke-dasharray:3 2; }
        .rc-hidden-beat.is-pending text { fill:${HIDDEN_BEAT_COLOR}; text-decoration:line-through; }
        .rc-hidden-beat-line { stroke:${HIDDEN_BEAT_COLOR}; stroke-width:1.5; stroke-dasharray:4 3; pointer-events:none;
            vector-effect:non-scaling-stroke; }
        .rc-hidden-beat-line.is-pending { stroke-opacity:.35; }
    `;
    document.head.appendChild(hiddenBeatStyle);
    let hiddenBeatsOn = false;
    let hiddenBeatFrame = null;
    // 已儲存的標籤修改（annoResult），依紀錄快取；開啟時與 Save 完成後重新讀取。
    const hiddenSavedEdits = new Map();
    const hiddenRawCache = new WeakMap();
    let hiddenLastSaving = false;
    function hiddenRecordKey(af) {
        return [af?._vendorId, af?._idNumber, af?._measureId].join('|');
    }
    function loadHiddenSavedEdits(af, force = false) {
        const key = hiddenRecordKey(af);
        let entry = hiddenSavedEdits.get(key);
        if (entry && !force) return entry;
        entry = { edits: null, error: null };
        hiddenSavedEdits.set(key, entry);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        manager.Af.getAnnoModifiedData(af._vendorId, af._idNumber, af._measureId).then(response => {
            const list = response?.plain ? response.plain() : response;
            entry.edits = new Map((Array.isArray(list) ? list : []).filter(item => item?.[4])
                .map(item => [Number(item[1]), item]));
        }).catch(error => { entry.error = error; entry.edits = new Map(); })
            .finally(() => { if (hiddenSavedEdits.get(key) === entry) scheduleHiddenBeats(); });
        return entry;
    }
    // 機器原始的 S／V 位置（排序後快取）；分類紀錄沒有原始 N 的位置。
    function getHiddenRawBeats(af) {
        const record = af?.tmsline?.tagsRecord || af?.tmsline?.ogTagsRecord;
        if (!record) return [];
        const cached = hiddenRawCache.get(record);
        if (cached && cached.sveb === record.posSVEB && cached.pvc === record.posPVC) return cached.beats;
        const beats = [
            ...(Array.isArray(record.posSVEB) ? record.posSVEB : []).map(index => [Number(index), 'S']),
            ...(Array.isArray(record.posPVC) ? record.posPVC : []).map(index => [Number(index), 'V']),
        ].filter(([index]) => Number.isFinite(index)).sort((a, b) => a[0] - b[0]);
        hiddenRawCache.set(record, { sveb: record.posSVEB, pvc: record.posPVC, beats });
        return beats;
    }
    // 標籤列的可視範圍與目前畫面上的心搏；不可編輯或資料不完整時回傳 null。
    function getHiddenBeatView(svg) {
        const scope = window.angular?.element(svg).isolateScope();
        const info = scope?.posInfo;
        const rate = Number(info?.sampleRate || scope?.sampleRate);
        const seconds = Number(scope?.segSec);
        const start = Number(info?.idxRange?.[0]);
        const width = Number(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
        if (!scope || !Number.isFinite(start) || !(rate > 0) || !(seconds > 0) || !(width > 0)) return null;
        const shift = scope.threeChannel || scope.dialogSwitch ? Number(scope.shiftSec) || 0 : 0;
        let parent = scope;
        while (parent && !parent.af) parent = parent.$parent;
        if (!parent?.af || !Array.isArray(scope.annoData)) return null;
        const viewStart = start + shift * rate;
        // 修改資料的時間與網站相同：scope.startTime 已是位移後畫面起點的時間，不再加 shift。
        return { scope, parent, af: parent.af, rate, width, viewStart, viewEnd: viewStart + rate * seconds,
            startTime: Number(scope.startTime),
            modifiedData: Array.isArray(scope.modifiedData) ? scope.modifiedData : null };
    }
    // 找出可視範圍內的隱藏原始心搏：未出現在畫面上、也沒有被（已儲存的修改）刪除。
    // 未儲存修改把它改為刪除時標為 pending（虛線、刪除線），再點一下可取消。
    function findHiddenBeats(view, savedEdits) {
        const shown = new Set(view.scope.annoData.filter(beat => ['N', 'S', 'A', 'V'].includes(beat?.type))
            .map(beat => Number(beat.index)));
        const pending = new Map((view.modifiedData || []).filter(item => item?.[4]).map(item => [Number(item[1]), item]));
        const beats = getHiddenRawBeats(view.af);
        let low = 0, high = beats.length;
        while (low < high) { const mid = (low + high) >> 1; if (beats[mid][0] < view.viewStart) low = mid + 1; else high = mid; }
        const hidden = [];
        for (let i = low; i < beats.length && beats[i][0] <= view.viewEnd; i++) {
            const [index, rawType] = beats[i];
            const saved = savedEdits.get(index);
            if (saved && saved[2] === 'X') continue;
            const edit = pending.get(index);
            const isPending = edit?.[2] === 'X';
            if (shown.has(index) && !isPending) continue;
            const type = saved && ['N', 'S', 'A', 'V'].includes(saved[2]) ? saved[2] : rawType;
            // 原分類沿用已儲存修改記錄的原始標籤；原始 S 在標註資料中為 A。
            const original = saved?.[3] && saved[3] !== 'X' ? saved[3] : rawType === 'S' ? 'A' : rawType;
            hidden.push({ index, type: type === 'A' ? 'S' : type, original, pending: isPending });
        }
        return hidden;
    }
    function scheduleHiddenBeats() {
        if (hiddenBeatFrame !== null) return;
        hiddenBeatFrame = requestAnimationFrame(() => { hiddenBeatFrame = null; drawHiddenBeats(); });
    }
    function clearHiddenBeats() {
        document.querySelectorAll('.rc-hidden-beats').forEach(node => node.remove());
    }
    // 對應的波形 SVG：標籤列之後的 div.ecgWave（主波形）。
    function getHiddenBeatWaveSvg(svg) {
        let wave = svg.nextElementSibling;
        while (wave && !wave.matches('div.ecgWave')) wave = wave.nextElementSibling;
        return wave?.querySelector('svg') || null;
    }
    // 紫色標記畫在波形最上方（不蓋住標籤列上的標籤，兩者可同時看到），並以紫色虛線貫穿波形；
    // 找不到波形 SVG 時才畫在標籤列上。
    function drawHiddenBeats() {
        if (!hiddenBeatsOn || isDisabledPage() || !window.angular) { clearHiddenBeats(); return; }
        const markers = [...document.querySelectorAll('svg.ecgRMarker')].filter(svg => svg.closest(TARGET_BLOCK_SELECTOR));
        const owners = new Set(markers.map(svg => svg.dataset.rcHiddenOwner).filter(Boolean));
        for (const node of document.querySelectorAll('.rc-hidden-beats')) if (!owners.has(node.dataset.owner)) node.remove();
        for (const svg of markers) {
            if (!svg.dataset.rcHiddenOwner) svg.dataset.rcHiddenOwner = String(Math.random()).slice(2);
            const owner = svg.dataset.rcHiddenOwner;
            const existing = document.querySelector(`.rc-hidden-beats[data-owner="${owner}"]`);
            const view = getHiddenBeatView(svg);
            if (!view) { existing?.remove(); continue; }
            // Save 完成（af.loading.modified 由 true 變回 false）後重新讀取已儲存的修改。
            const saving = !!view.af.loading?.modified;
            if (hiddenLastSaving && !saving) hiddenSavedEdits.clear();
            hiddenLastSaving = saving;
            const entry = loadHiddenSavedEdits(view.af);
            if (!entry.edits) continue; // 讀取完成後會再畫一次。
            const hidden = findHiddenBeats(view, entry.edits);
            const waveSvg = getHiddenBeatWaveSvg(svg);
            const host = waveSvg || svg;
            const markerBox = svg.getBoundingClientRect();
            const hostBox = host.getBoundingClientRect();
            const signature = [view.viewStart, view.width, markerBox.width, hostBox.width, hostBox.height,
                ...hidden.map(beat => `${beat.index}${beat.type}${beat.pending ? 'x' : ''}`)].join(',');
            if (existing?.dataset.signature === signature && existing.parentNode === host && host.lastElementChild === existing) continue;
            existing?.remove();
            const matrix = host.getScreenCTM?.();
            if (!hidden.length || !matrix || !(markerBox.width > 0)) continue;
            // 以螢幕座標換算到所在 SVG 的座標（波形 SVG 與標籤列的座標系不一定相同）。
            const inverse = matrix.inverse();
            const point = host.createSVGPoint();
            const toLocal = (x, y) => { point.x = x; point.y = y; return point.matrixTransform(inverse); };
            const unit = toLocal(hostBox.left + 1, hostBox.top).x - toLocal(hostBox.left, hostBox.top).x || 1;
            const size = 15 * unit;
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'rc-hidden-beats');
            group.dataset.signature = signature;
            group.dataset.owner = owner;
            for (const beat of hidden) {
                const screenX = markerBox.left + (beat.index - view.viewStart) / (view.viewEnd - view.viewStart) * markerBox.width;
                const top = toLocal(screenX, hostBox.top);
                const bottom = toLocal(screenX, hostBox.bottom);
                const item = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                item.setAttribute('class', `rc-hidden-beat${beat.pending ? ' is-pending' : ''}`);
                item.dataset.index = String(beat.index);
                item.dataset.original = beat.original;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('class', `rc-hidden-beat-line${beat.pending ? ' is-pending' : ''}`);
                line.setAttribute('x1', String(top.x));
                line.setAttribute('x2', String(top.x));
                line.setAttribute('y1', String(top.y + size + unit));
                line.setAttribute('y2', String(bottom.y));
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', String(top.x - size / 2));
                rect.setAttribute('y', String(top.y + unit));
                rect.setAttribute('width', String(size));
                rect.setAttribute('height', String(size));
                rect.setAttribute('rx', String(3 * unit));
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', String(top.x));
                text.setAttribute('y', String(top.y + unit + size / 2));
                text.style.fontSize = `${11 * unit}px`;
                text.textContent = beat.type;
                const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                title.textContent = beat.pending
                    ? `隱藏的原始 ${beat.type}（位置 ${beat.index}）：已加入刪除（未儲存），點一下取消`
                    : `隱藏的原始 ${beat.type}（位置 ${beat.index}）：畫面上看不到，但伺服器分類時仍會計入；點一下加入刪除`;
                item.append(line, rect, text, title);
                group.appendChild(item);
            }
            host.appendChild(group);
        }
    }
    function toggleHiddenBeats() {
        hiddenBeatsOn = !hiddenBeatsOn;
        if (!hiddenBeatsOn) { clearHiddenBeats(); quickToast(null, '已關閉隱藏心搏顯示'); return; }
        hiddenSavedEdits.clear();
        scheduleHiddenBeats();
        // 讀取已儲存的修改後回報目前畫面上的數量。
        setTimeout(function report(tries = 0) {
            if (!hiddenBeatsOn) return;
            const markers = [...document.querySelectorAll('svg.ecgRMarker')].filter(svg => svg.closest(TARGET_BLOCK_SELECTOR));
            const views = markers.map(getHiddenBeatView).filter(Boolean);
            if (!views.length) { quickToast(null, '隱藏心搏顯示已開啟（目前畫面上沒有可編輯的心電圖）'); return; }
            const entries = views.map(view => loadHiddenSavedEdits(view.af));
            if (entries.some(entry => !entry.edits)) { if (tries < 40) setTimeout(() => report(tries + 1), 250); return; }
            if (entries.some(entry => entry.error)) { quickToast(null, '讀取已儲存的標籤修改失敗，隱藏心搏可能不完整', true); return; }
            const count = views.reduce((sum, view, i) => sum + findHiddenBeats(view, entries[i].edits).length, 0);
            quickToast(null, count ? `紫色標出 ${count} 顆隱藏的原始心搏；點一下加入刪除，按 Save 後再 Group`
                : '目前畫面上沒有隱藏的原始心搏（再按 V 關閉）');
        }, 0);
    }
    // 點紫色標籤：加入或取消「刪除」的未儲存修改。在 window 捕獲階段處理，不讓網站與其他標註功能收到這次點擊。
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick']) {
        window.addEventListener(type, event => {
            const item = event.target?.closest?.('.rc-hidden-beat');
            if (!item) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (type !== 'click' || event.button !== 0) return;
            const owner = item.closest('.rc-hidden-beats')?.dataset.owner;
            const svg = owner && [...document.querySelectorAll('svg.ecgRMarker')].find(marker => marker.dataset.rcHiddenOwner === owner);
            const view = svg && getHiddenBeatView(svg);
            const index = Number(item.dataset.index);
            if (!view?.modifiedData || !Number.isFinite(index)) return;
            if (view.af.loading?.modified || view.af.labelEditing?.edit || view.af.labelEditing?.pauseEdit) {
                quickToast(item, '請先結束原生 R-type／Pause 模式或等待儲存完成', true);
                return;
            }
            const pending = view.modifiedData;
            view.parent.$apply(() => {
                const position = pending.findIndex(entry => entry?.[4] && Number(entry[1]) === index);
                if (position >= 0 && pending[position][2] === 'X') {
                    pending.splice(position, 1);
                } else {
                    if (position >= 0) pending.splice(position, 1);
                    pending.push([view.startTime + Math.floor((index - view.viewStart) / view.rate), index, 'X',
                        item.dataset.original || 'S', 1]);
                }
            });
            scheduleHiddenBeats();
        }, true);
    }
    new MutationObserver(() => { if (hiddenBeatsOn) scheduleHiddenBeats(); })
        .observe(document.body, { childList: true, subtree: true });

    /**
     * 分派標註、區間選取與縮放快捷鍵。
     */
    // 所有匹配的 RootiCare 頁面皆攔截 Alt，包括輸入欄、面板與 Morphology。
    document.addEventListener('keyup', (e) => {
        if (e.key !== 'Alt') return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
    document.addEventListener('keydown', async function(e) {
        if (e.key === 'Alt') {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        if (isDisabledPage()) { cancelRange(); rangeHint.style.display = 'none'; return; }
        // 提示可能沒有建立區間（例如無效端點）；Esc 也須能在輸入欄聚焦時收起。
        // 結果提示顯示中不攔截 Esc，讓網頁原本的 Esc 功能照常運作，提示則等計時自動收起。
        if (e.key === 'Escape' && !rangeMode && rangeResultShown && !rangeHint.contains(e.target)) return;
        if (e.key === 'Escape' && (rangeMode || rangeHint.style.display !== 'none')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelRange();
            rangeHint.style.display = 'none';
            return;
        }
        if (rangeHint.contains(e.target)) {
            if (e.key === 'Escape') { e.preventDefault(); cancelRange(); }
            return;
        }
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;

        // B 切換隱藏／顯示 AF 圖示；以實體按鍵位置判斷，輸入法不影響。
        if (e.code === 'KeyB' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.repeat) toggleAFIcons();
            return;
        }
        // V 切換顯示隱藏的原始心搏（紫色）；不攔截 Ctrl／⌘+V 等組合鍵。
        if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.repeat) toggleHiddenBeats();
            return;
        }

        // 區間面板開啟（已選第一端點）時，1／2／3 不標註，改為切換分頁；Shift+1/2/3 仍用來選第二端點。
        const tabDigit = /^(?:Digit|Numpad)([123])$/.exec(e.code || '')?.[1];
        if (tabDigit && rangeMode?.first && !rangeBusy && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.repeat) {
                rangeTool = ['filter', 'fill', 'ectopic'][tabDigit - 1];
                updateRangeTool();
            }
            return;
        }

        const key = e.key.toLowerCase();
        const isAltPressed = e.altKey;
        // Mac 的 Option+數字會輸出 ¡ ™ £ 等符號，改以實體按鍵位置判斷數字鍵。
        const labelKey = /^Digit([1-4])$/.exec(e.code || '')?.[1] || key;
        // W / S 縮放只處理無修飾鍵的按鍵，保留 Ctrl+S 等瀏覽器快捷鍵。
        if (['w', 's'].includes(key) && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) return;
        // Shift + 數字的 e.key 會變成 ! @ # 等符號，改以實體按鍵位置判斷（含數字鍵盤）。
        const rangeDigit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code || '')?.[1];
        if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && rangeDigit) {
            // 區間端點與一般數字標註鍵使用相同的滑鼠容器限制。
            if (!getActiveBlockUnderMouse()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!rangeBusy && !e.repeat) {
                await selectRangePoint({ '1': 'V', '2': 'S', '3': 'N', '4': 'X' }[rangeDigit]);
            }
            return;
        }
        // A / D 以實體按鍵位置判斷（大小寫、輸入法不影響）；選印清單開啟時交給選印清單切換上一張／下一張。
        const halfStep = !review && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.isComposing
            ? { KeyA: -1, KeyD: 1 }[e.code] : undefined;
        const movesECG = !!halfStep || ['q', 'e', '<', '>', ',', '.', 'arrowleft', 'arrowright', 'w', 's', 'arrowup', 'arrowdown'].includes(key);
        if (rangeBusy && movesECG) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        // Q / E 與 W / S 一樣不依賴滑鼠位置：畫面上有 ECG 區塊（例如總覽心電圖）即可切換時間。
        if ((key === 'q' || key === 'e') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
            && !e.isComposing && (rangeMode || document.querySelector('.fixed-board') || hasVisibleECGBlock())) {
            e.preventDefault();
            e.stopImmediatePropagation();
            installZoomPersistence();
            triggerOriginalKey(key === 'q' ? 37 : 39, key === 'q' ? 'ArrowLeft' : 'ArrowRight');
            return;
        }
        if (halfStep && halfStepECG(halfStep)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        if (rangeMode && movesECG) {
            // 切換 ECG 視窗時保留區間端點的絕對取樣索引。
            // 保留原生導覽操作；W / S 仍轉換為腳本的縮放快捷鍵。
            if (key === 'w' || key === 's') {
                e.preventDefault();
                e.stopImmediatePropagation();
                triggerOriginalKey(key === 'w' ? 38 : 40, key === 'w' ? 'ArrowUp' : 'ArrowDown');
            }
            return;
        }
        // 區間選取中（已選第一端點）只放行 Alt + 1／2／3 與 Alt 拖曳，其他標註鍵不處理；套用中一律不處理。
        if (rangeBusy) return;
        if (rangeMode && !(isAltPressed && !e.ctrlKey && !e.metaKey && ['1', '2', '3'].includes(labelKey))) return;

        // 按住期間由滑鼠移動接手；鍵盤連發不再重複處理。
        if (!e.ctrlKey && !e.metaKey && (labelKey === '4' || (isAltPressed && ['1', '2', '3'].includes(labelKey)))) {
            if (e.repeat && heldSweep?.key === labelKey) { e.preventDefault(); e.stopImmediatePropagation(); return; }
            heldSweep = { key: labelKey, code: e.code, tag: { '1': 'V', '2': 'S', '3': 'N', '4': '' }[labelKey], alt: labelKey !== '4',
                last: { x: currentMousePos.x, y: currentMousePos.y } };
        }

        // 高度縮放不依賴滑鼠位置；數字標註鍵仍限制在下方的 ECG 容器內。
        if (key === 'w' || key === 's') {
            if (document.querySelector('.fixed-board') || document.querySelector(TARGET_BLOCK_SELECTOR)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                key === 'w' ? triggerOriginalKey(38, 'ArrowUp') : triggerOriginalKey(40, 'ArrowDown');
            }
            return;
        }

        const activeBlock = getActiveBlockUnderMouse();
        if (!activeBlock) return;

        // Ctrl / ⌘ + 數字保留給瀏覽器（如切換分頁），不視為標註鍵。
        if (['1', '2', '3', '4'].includes(labelKey) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const labelPoint = toLabelRowPoint(currentMousePos, activeBlock);
            const targetUnderMouse = getElementAtPoint(labelPoint.x, labelPoint.y);
            const isOnLabel = targetUnderMouse && targetUnderMouse.classList.contains('annoText');

            const keyMap = { '1': 'V', '2': 'S', '3': 'N', '4': '' };
            const targetTag = keyMap[labelKey];

            if (isAltPressed && labelKey !== '4') {
                if (!isOnLabel) return;
                await processCommand(targetTag);
                return;
            }

            await processCommand(targetTag);
        }

    }, true);

    // HR Min／HR Max／HR Max sinus 清單：每張心電圖上方加入排除按鈕。
    // 點擊後移除排序在其後、起始時間相差 ±1 分鐘內的心電圖並重新分頁；只換掉清單的分頁資料，
    // 不修改網站原本的清單資料，重新開啟清單或按「還原」即恢復。以容器與 ng 屬性辨識，不依賴語系文字。
    const HR_LIST_TYPES = ['minHR', 'maxHR', 'maxSinus'];
    const HR_EXCLUDE_SECONDS = 60;
    const HR_CARD_SELECTOR = '[ng-repeat^="currentData in af.eventDialog.currentData"]';
    function getHRListContext(element) {
        const dialog = element?.closest?.('#af-hr-dialog');
        if (!dialog || !window.angular) return null;
        let scope;
        try { scope = window.angular.element(dialog).scope(); } catch (_) { return null; }
        const eventDialog = scope?.af?.eventDialog;
        const type = eventDialog?.dscp?.type;
        if (!HR_LIST_TYPES.includes(type) || !Array.isArray(eventDialog.pageData)) return null;
        let host = scope;
        while (host && !Object.prototype.hasOwnProperty.call(host, 'pageChanged')) host = host.$parent;
        if (typeof host?.pageChanged !== 'function') return null;
        return { dialog, eventDialog, type, host, af: scope.af };
    }
    // focusTime：重新分頁後停在包含這張心電圖（或排在它前面最近一張）的頁面。
    function applyHRPages(context, items, focusTime = null) {
        const { eventDialog, type, host } = context;
        const pagination = eventDialog.pagination;
        const perPage = Number(pagination.itemsPerPage) || 6;
        const pages = [];
        for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
        let focusPage = null;
        if (focusTime !== null) {
            const index = items.findIndex(value => toEventTime(value) === focusTime);
            if (index >= 0) focusPage = Math.floor(index / perPage) + 1;
        }
        host.$apply(() => {
            eventDialog.pageData = pages;
            pagination.totalItems = items.length;
            pagination.currentPage = Math.min(Math.max(1, focusPage ?? pagination.currentPage), Math.max(1, pages.length));
            eventDialog.indexAdjust = (pagination.currentPage - 1) * perPage;
            host.pageChanged(type);
        });
        hrExclusion.pages = eventDialog.pageData;
    }
    // 排除紀錄：依按下順序保存錨點心電圖的起始時間。網站把清單換回完整資料時（例如選印後）自動重新套用；
    // 只有關閉清單、切換清單類型或按「還原」才清空。
    const hrExclusion = { type: null, anchors: [], pages: null, focusTime: null };
    function resetHRExclusion() {
        hrExclusion.type = null;
        hrExclusion.anchors = [];
        hrExclusion.pages = null;
        hrExclusion.focusTime = null;
    }
    // Max HR sinus 的 AF 時段排除開關：預設關閉，開啟後保留到重新整理頁面。
    let hrAFExcludeOn = false;
    // 網站的 Max HR sinus 清單直接複製 Max HR 清單，會包含 AF 期間的心電圖。
    // AF 時段取自時間軸的 tmsAFs（已含 AF 修改，每筆代表該秒起 60 秒），
    // 再加上 AF 編輯中尚未儲存的區段，合併成不重疊的區段。10 秒心電圖與任一區段重疊即排除。
    const HR_STRIP_SECONDS = 10;
    const AF_BLOCK_SECONDS = 60;
    function mergeRanges(ranges) {
        const sorted = ranges.filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
            .sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const [start, end] of sorted) {
            const last = merged[merged.length - 1];
            if (last && start <= last[1]) last[1] = Math.max(last[1], end);
            else merged.push([start, end]);
        }
        return merged;
    }
    function getAFRanges(af) {
        const ranges = [];
        const blocks = af?.tmsline?.tagsRecord?.tmsAFs;
        if (Array.isArray(blocks)) {
            for (const value of blocks) {
                const start = Number(value);
                ranges.push([start, start + AF_BLOCK_SECONDS]);
            }
        }
        const edited = af?.afEditing?.data;
        if (Array.isArray(edited)) {
            for (const range of edited) ranges.push([Number(range?.start), Number(range?.end)]);
        }
        return mergeRanges(ranges);
    }
    function excludeAFItems(items, afRanges) {
        if (!afRanges.length) return items;
        return items.filter(value => {
            const start = toEventTime(value);
            if (start === null) return true;
            // 找第一個結束時間晚於心電圖起點的區段，再看它是否早於心電圖終點開始。
            let low = 0, high = afRanges.length;
            while (low < high) {
                const mid = (low + high) >> 1;
                if (afRanges[mid][1] <= start) low = mid + 1; else high = mid;
            }
            return !(low < afRanges.length && afRanges[low][0] < start + HR_STRIP_SECONDS);
        });
    }
    function getHRAFRanges(context) {
        return context.type === 'maxSinus' && hrAFExcludeOn ? getAFRanges(context.af) : [];
    }
    // Max HR sinus 的「排除高於 Max HR」開關：預設關閉，開啟後保留到重新整理頁面。
    // 上限讀取 Max HR 方塊目前的數值（含手動修改）；每張心電圖的平均 HR 取自網站 Max HR 清單的 [時間, HR]。
    let hrAboveMaxExcludeOn = false;
    function getMaxHRLimit(af) {
        const value = Number(af?.record?.maxHR?.record);
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    // 網站各 HR 清單的 [時間, 平均 HR]；同一時間以第一筆為準（與未排除時卡片顯示的相同）。
    const HR_VALUE_LISTS = { minHR: ['slowAvgHR'], maxHR: ['fastAvgHR'], maxSinus: ['maxSinusHR', 'fastAvgHR'] };
    function getHRValueMap(af, type = 'maxSinus') {
        const map = new Map();
        for (const key of HR_VALUE_LISTS[type] || []) {
            const list = af?.maxMinAvgHR?.[key];
            if (!Array.isArray(list)) continue;
            for (const entry of list) {
                const time = Number(Array.isArray(entry) ? entry[0] : NaN);
                const hr = Number(Array.isArray(entry) ? entry[1] : NaN);
                if (Number.isFinite(time) && Number.isFinite(hr) && !map.has(time)) map.set(time, hr);
            }
        }
        return map;
    }
    // 平均 HR 高於上限的心電圖排除（等於上限保留）；讀不到 HR 的保留。
    function excludeAboveHR(items, limit, hrByTime) {
        if (limit === null) return items;
        return items.filter(value => {
            const hr = hrByTime.get(toEventTime(value));
            return hr === undefined || hr <= limit;
        });
    }
    function getHRAboveLimit(context) {
        return context.type === 'maxSinus' && hrAboveMaxExcludeOn ? getMaxHRLimit(context.af) : null;
    }
    // Max HR sinus 的「排除含 V／S」開關：預設關閉，開啟後保留到重新整理頁面。
    // 網站時間軸的 V／S 時間（tmsPVC、VEBAPos 等）要 Group 後才更新，會留著已改為 N 的舊標籤，
    // 因此開啟時逐張向伺服器讀取 10 秒心電圖的標籤（最多同時 QUICK_FETCH_CONCURRENCY 張，結果快取），
    // 並套用未儲存的標籤修改。起點起 10 秒內含任一 V 或 S（A 視為 S）即排除；讀取失敗的保留。
    let hrEctopicExcludeOn = false;
    const ectopicStripCache = new Map(); // `${measureId}|${時間}` → 心電圖資料（失敗為 null）
    const ectopicCheck = { running: false, done: 0, total: 0 };
    function ectopicStripKey(af, time) {
        return `${af?._measureId}|${time}`;
    }
    function stripHasEctopic(data, modifiedData, start) {
        return effectiveEventBeats(data, modifiedData, start)
            .some(beat => beat.type !== 'N' && beat.offset >= 0 && beat.offset < HR_STRIP_SECONDS);
    }
    // 已確認含 V／S 的心電圖時間；尚未讀取的不列入（保留），並在背景開始讀取。
    function getHREctopicSet(context) {
        if (context.type !== 'maxSinus' || !hrEctopicExcludeOn) return null;
        const all = getHRSourceItems(context) || [];
        const found = new Set();
        const missing = [];
        for (const value of all) {
            const time = toEventTime(value);
            if (time === null) continue;
            const key = ectopicStripKey(context.af, time);
            if (!ectopicStripCache.has(key)) { missing.push(time); continue; }
            const data = ectopicStripCache.get(key);
            if (data && stripHasEctopic(data, context.af.ecgAnno?.modifiedData, time)) found.add(time);
        }
        if (missing.length) checkEctopicStrips(context.af, missing);
        return found;
    }
    async function checkEctopicStrips(af, times) {
        if (ectopicCheck.running) return;
        const pending = [...new Set(times)];
        ectopicCheck.running = true;
        ectopicCheck.done = 0;
        ectopicCheck.total = pending.length;
        scheduleHRList();
        try {
            await runLimited(pending, QUICK_FETCH_CONCURRENCY, async time => {
                let data = null;
                try { data = await fetchEventECG(af, time, 0, HR_STRIP_SECONDS); } catch (_) { /* 讀取失敗的保留 */ }
                ectopicStripCache.set(ectopicStripKey(af, time), data);
            }, done => { ectopicCheck.done = done; scheduleHRList(); });
        } finally {
            ectopicCheck.running = false;
        }
        // 讀完後依目前清單重新套用排除。
        const dialog = document.querySelector('#af-hr-dialog');
        const context = dialog && isHRDialogShown(dialog) ? getHRListContext(dialog) : null;
        if (context && hrEctopicExcludeOn) reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        scheduleHRList();
    }
    function excludeEctopicItems(items, ectopicSet) {
        if (!ectopicSet?.size) return items;
        return items.filter(value => !ectopicSet.has(toEventTime(value)));
    }
    function isHRFilterActive(context) {
        return hrExclusion.anchors.length > 0 || getHRAFRanges(context).length > 0 || getHRAboveLimit(context) !== null
            || (getHREctopicSet(context)?.size || 0) > 0;
    }
    // 依序套用每個錨點：移除排序在錨點之後、起始時間相差 ±1 分鐘內的心電圖。
    function filterHRItems(items, anchors) {
        let kept = items;
        for (const anchor of anchors) {
            const position = kept.findIndex(value => toEventTime(value) === anchor);
            if (position < 0) continue;
            kept = kept.filter((value, index) => index <= position || Math.abs(toEventTime(value) - anchor) > HR_EXCLUDE_SECONDS);
        }
        return kept;
    }
    function getHRSourceItems(context) {
        const source = context.eventDialog[context.type];
        return Array.isArray(source?.data) ? source.data.flat() : null;
    }
    function currentHRFocusTime(eventDialog) {
        const page = eventDialog.pageData[(Number(eventDialog.pagination?.currentPage) || 1) - 1];
        return toEventTime(Array.isArray(page) ? page[0] : page);
    }
    // 依序排除 AF 時段、高於 Max HR、含 V／S，最後套用 ±1 分錨點；保留各階段結果供標題列計數。
    function getHRFilteredItems(context, all) {
        const afKept = excludeAFItems(all, getHRAFRanges(context));
        const belowMax = excludeAboveHR(afKept, getHRAboveLimit(context), getHRValueMap(context.af));
        const sinus = excludeEctopicItems(belowMax, getHREctopicSet(context));
        return { afKept, belowMax, sinus, kept: hrExclusion.anchors.length ? filterHRItems(sinus, hrExclusion.anchors) : sinus };
    }
    function reapplyHRExclusion(context, focusTime) {
        const all = getHRSourceItems(context);
        if (!all) return;
        applyHRPages(context, getHRFilteredItems(context, all).kept, focusTime);
    }
    const hrStyle = document.createElement('style');
    hrStyle.textContent = `
        .rc-hr-exclude { display:inline-flex; align-items:center; gap:4px; margin-left:10px; padding:0 10px 0 8px;
            height:20px; border:1px solid #f0b4ae; border-radius:10px; background:#fff5f4; color:#c0392b;
            font-family:inherit; font-weight:600; font-size:11px; line-height:18px; letter-spacing:.3px; cursor:pointer; vertical-align:middle;
            box-shadow:0 1px 2px rgba(192,57,43,.12); transition:background .15s, color .15s, border-color .15s, box-shadow .15s; }
        .rc-hr-exclude .rc-hr-icon { font-size:12px; line-height:1; }
        .rc-hr-exclude:hover { background:#c0392b; border-color:#c0392b; color:#fff; box-shadow:0 2px 5px rgba(192,57,43,.3); }
        .rc-hr-exclude:active { transform:translateY(1px); }
        .rc-hr-exclude:focus-visible { outline:2px solid rgba(192,57,43,.45); outline-offset:1px; }
        .rc-hr-exclude.is-done { background:#eef1f3; border-color:#cfd6db; color:#6b7780; box-shadow:none; }
        .rc-hr-exclude.is-done .rc-hr-icon { color:#3c9a5f; }
        .rc-hr-exclude.is-done:hover { background:#fff; border-color:#9aa5ad; color:#4a555d; box-shadow:0 1px 3px rgba(0,0,0,.15); }
        .rc-hr-exclude.is-done:hover .rc-hr-icon { color:#c0392b; }
        .rc-hr-restore { display:none; align-items:center; gap:6px; height:22px; padding:0 10px 0 4px; border:0;
            border-radius:11px; background:rgba(255,255,255,.95); color:#4f6b1a; font-family:inherit; font-weight:600; font-size:12px; line-height:22px;
            cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.18); transition:background .15s, box-shadow .15s; }
        .rc-hr-restore.is-visible { display:inline-flex; }
        .rc-hr-restore:hover { background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.25); }
        .rc-hr-af { display:none; align-items:center; gap:5px; height:22px; margin-right:6px; padding:0 4px 0 9px; border:1px solid #cfd6db;
            border-radius:11px; background:rgba(255,255,255,.95); color:#6b7780; font-family:inherit; font-weight:600; font-size:12px;
            line-height:20px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.18); transition:background .15s, box-shadow .15s; }
        .rc-hr-af:not(.is-on) { padding-right:10px; }
        .rc-hr-af.is-visible { display:inline-flex; }
        .rc-hr-af.is-on { border-color:#f0b4ae; color:#c0392b; }
        .rc-hr-af:hover { background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.25); }
        .rc-hr-af .rc-hr-count, .rc-hr-restore .rc-hr-count { min-width:18px; height:16px; padding:0 5px; border-radius:8px; background:#c0392b;
            color:#fff; font-size:11px; line-height:16px; text-align:center; }
    `;
    document.head.appendChild(hrStyle);
    function getHRCardTime(card) {
        try { return toEventTime(window.angular.element(card).scope()?.currentData?.startTime); } catch (_) { return null; }
    }
    // 未排除時套用排除；已排除（反灰）時再按一次取消這張的排除，其他排除保持不變。
    function toggleHRExclusion(card) {
        const context = getHRListContext(card);
        const time = getHRCardTime(card);
        if (!context || time === null) return;
        if (hrExclusion.type !== context.type) resetHRExclusion();
        hrExclusion.type = context.type;
        const index = hrExclusion.anchors.indexOf(time);
        if (index >= 0) hrExclusion.anchors.splice(index, 1);
        else hrExclusion.anchors.push(time);
        reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        decorateHRList();
    }
    function restoreHRItems(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        const focusTime = currentHRFocusTime(context.eventDialog);
        hrExclusion.anchors = [];
        reapplyHRExclusion(context, focusTime);
        decorateHRList();
    }
    function toggleHRAFExclusion(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        hrExclusion.type = context.type;
        hrAFExcludeOn = !hrAFExcludeOn;
        reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        decorateHRList();
    }
    function toggleHRAboveMaxExclusion(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        hrExclusion.type = context.type;
        hrAboveMaxExcludeOn = !hrAboveMaxExcludeOn;
        reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        decorateHRList();
    }
    function toggleHREctopicExclusion(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        hrExclusion.type = context.type;
        hrEctopicExcludeOn = !hrEctopicExcludeOn;
        // 每次開啟都重新讀取，反映上次之後已儲存的標籤修改。
        if (hrEctopicExcludeOn && !ectopicCheck.running) ectopicStripCache.clear();
        reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        decorateHRList();
    }
    function setExcludeButtonState(button, done) {
        if (button.classList.contains('is-done') === done && button.childElementCount) return;
        button.classList.toggle('is-done', done);
        button.innerHTML = done
            ? '<span class="rc-hr-icon">✓</span>已排除 ±1 分'
            : '<span class="rc-hr-icon">⊘</span>排除 ±1 分';
        button.title = done ? '已移除排序在後、±1 分鐘內的心電圖；再按一次取消這張的排除'
            : '移除排序在後、與此心電圖相差 ±1 分鐘內的心電圖';
        button.setAttribute('aria-pressed', String(done));
    }
    function isHRDialogShown(dialog) {
        return !!dialog?.isConnected && dialog.getClientRects().length > 0;
    }
    // 清單關閉通常只改 class / style，沒有節點增減；監看清單與其祖先的屬性，關閉時清空排除紀錄。
    let watchedHRDialog = null;
    const hrDialogObserver = new MutationObserver(scheduleHRList);
    function watchHRDialog(dialog) {
        if (watchedHRDialog === dialog) return;
        hrDialogObserver.disconnect();
        watchedHRDialog = dialog;
        for (let node = dialog; node && node !== document.body; node = node.parentElement) {
            hrDialogObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
        }
    }
    // 網站若持續把清單換回去，短時間內重套太多次就放棄，避免無限循環。
    const hrReapplyTimes = [];
    function decorateHRList() {
        if (isDisabledPage()) return;
        const dialog = document.querySelector('#af-hr-dialog');
        if (dialog) watchHRDialog(dialog);
        if (!isHRDialogShown(dialog)) { resetHRExclusion(); return; }
        const context = getHRListContext(dialog);
        if (!context) return;
        const { eventDialog } = context;
        if (hrExclusion.type !== context.type) resetHRExclusion();
        hrExclusion.type = context.type;
        const filtering = isHRFilterActive(context);
        if (filtering || hrExclusion.pages) {
            if (eventDialog.pageData !== hrExclusion.pages) {
                const now = Date.now();
                while (hrReapplyTimes.length && now - hrReapplyTimes[0] > 2000) hrReapplyTimes.shift();
                if (hrReapplyTimes.length >= 8) {
                    resetHRExclusion();
                    hrAFExcludeOn = false;
                    hrAboveMaxExcludeOn = false;
                    hrEctopicExcludeOn = false;
                    return;
                }
                hrReapplyTimes.push(now);
                // 網站換回完整清單（例如選印後）：重新套用排除，並停在原本看的心電圖所在頁。
                // 沒有任何排除時不再接手，交還網站自己的分頁。
                if (filtering) {
                    reapplyHRExclusion(context, hrExclusion.focusTime ?? currentHRFocusTime(eventDialog));
                    return; // 重新分頁會觸發下一次更新。
                }
                hrExclusion.pages = null;
            }
            hrExclusion.focusTime = currentHRFocusTime(eventDialog);
        }
        const anchors = new Set(hrExclusion.anchors);
        // 網站卡片的「HR:」依清單位置讀取（maxMinAvgHR.*[indexAdjust + $index]），排除後位置對不上；
        // 清單由腳本重新分頁時，改依心電圖時間顯示正確的 HR，並隱藏網站的數值。
        const filteredPages = !!hrExclusion.pages && eventDialog.pageData === hrExclusion.pages;
        const cardHR = filteredPages ? getHRValueMap(context.af, context.type) : null;
        for (const card of dialog.querySelectorAll(HR_CARD_SELECTOR)) {
            const header = card.querySelector('.event-blk-header');
            if (!header) continue;
            const siteHR = header.querySelector('.event-infor-blk .stat-result b');
            let fixedHR = header.querySelector('.rc-hr-true');
            const hr = cardHR?.get(getHRCardTime(card));
            if (siteHR && hr !== undefined) {
                if (!fixedHR || fixedHR.previousElementSibling !== siteHR) {
                    fixedHR?.remove();
                    fixedHR = document.createElement('b');
                    fixedHR.className = 'rc-hr-true';
                    siteHR.after(fixedHR);
                }
                const text = `${hr}bpm`;
                if (fixedHR.textContent !== text) fixedHR.textContent = text;
                siteHR.style.display = 'none';
            } else {
                fixedHR?.remove();
                if (siteHR?.style.display) siteHR.style.display = '';
            }
            let button = header.querySelector('.rc-hr-exclude');
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'rc-hr-exclude';
                button.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    toggleHRExclusion(card);
                });
                header.appendChild(button);
            }
            // ng-repeat 以 $index 追蹤，換頁時卡片節點會沿用，因此每次依目前資料更新狀態。
            setExcludeButtonState(button, anchors.has(getHRCardTime(card)));
        }
        // 標題列：AF 時段排除開關（僅 Max HR sinus）、±1 分排除數量與還原按鈕。
        const all = getHRSourceItems(context) || [];
        const { afKept, belowMax, sinus, kept } = getHRFilteredItems(context, all);
        const excluded = hrExclusion.anchors.length ? Math.max(0, sinus.length - kept.length) : 0;
        const toolbar = dialog.querySelector('.data-tool-blk .float-left');
        let afToggle = dialog.querySelector('.rc-hr-af:not(.rc-hr-above-max):not(.rc-hr-ectopic)');
        if (!afToggle && toolbar) {
            afToggle = document.createElement('button');
            afToggle.type = 'button';
            afToggle.className = 'rc-hr-af';
            afToggle.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                toggleHRAFExclusion(dialog);
            });
            toolbar.appendChild(afToggle);
        }
        if (afToggle) {
            const hasAF = context.type === 'maxSinus' && getAFRanges(context.af).length > 0;
            const on = hasAF && hrAFExcludeOn;
            const html = on
                ? `<span class="rc-hr-icon">⊘</span>已排除 AF 時段<span class="rc-hr-count">${all.length - afKept.length}</span>`
                : '<span class="rc-hr-icon">○</span>排除 AF 時段';
            if (afToggle.innerHTML !== html) afToggle.innerHTML = html;
            afToggle.title = on ? '已排除與 AF 時段重疊的心電圖；按下關閉' : '按下排除與 AF 時段重疊的心電圖';
            afToggle.setAttribute('aria-pressed', String(on));
            afToggle.classList.toggle('is-on', on);
            afToggle.classList.toggle('is-visible', hasAF);
        }
        // 排除高於 Max HR：與 AF 開關同樣式，只在 Max HR sinus 清單且讀得到 Max HR 時顯示。
        let maxToggle = dialog.querySelector('.rc-hr-above-max');
        if (!maxToggle && toolbar) {
            maxToggle = document.createElement('button');
            maxToggle.type = 'button';
            maxToggle.className = 'rc-hr-af rc-hr-above-max';
            maxToggle.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                toggleHRAboveMaxExclusion(dialog);
            });
            (afToggle?.nextSibling ? toolbar.insertBefore(maxToggle, afToggle.nextSibling) : toolbar.appendChild(maxToggle));
        }
        if (maxToggle) {
            const limit = context.type === 'maxSinus' ? getMaxHRLimit(context.af) : null;
            const on = limit !== null && hrAboveMaxExcludeOn;
            const html = on
                ? `<span class="rc-hr-icon">⊘</span>已排除高於 Max HR ${limit}<span class="rc-hr-count">${afKept.length - belowMax.length}</span>`
                : `<span class="rc-hr-icon">○</span>排除高於 Max HR${limit !== null ? ` ${limit}` : ''}`;
            if (maxToggle.innerHTML !== html) maxToggle.innerHTML = html;
            maxToggle.title = on ? `已排除平均 HR 高於 Max HR（${limit} bpm）的心電圖；按下關閉`
                : '按下排除平均 HR 高於 Max HR 的心電圖';
            maxToggle.setAttribute('aria-pressed', String(on));
            maxToggle.classList.toggle('is-on', on);
            maxToggle.classList.toggle('is-visible', limit !== null);
        }
        // 排除含 V／S：與其他開關同樣式，只在 Max HR sinus 清單且有 V／S 資料時顯示。
        let ectopicToggle = dialog.querySelector('.rc-hr-ectopic');
        if (!ectopicToggle && toolbar) {
            ectopicToggle = document.createElement('button');
            ectopicToggle.type = 'button';
            ectopicToggle.className = 'rc-hr-af rc-hr-ectopic';
            ectopicToggle.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                toggleHREctopicExclusion(dialog);
            });
            const after = maxToggle || afToggle;
            (after?.nextSibling ? toolbar.insertBefore(ectopicToggle, after.nextSibling) : toolbar.appendChild(ectopicToggle));
        }
        if (ectopicToggle) {
            const visible = context.type === 'maxSinus';
            const on = visible && hrEctopicExcludeOn;
            const checking = on && ectopicCheck.running;
            const html = checking
                ? `<span class="rc-hr-icon">⋯</span>檢查 V／S 中 ${ectopicCheck.done}/${ectopicCheck.total}`
                : on ? `<span class="rc-hr-icon">⊘</span>已排除含 V／S<span class="rc-hr-count">${belowMax.length - sinus.length}</span>`
                    : '<span class="rc-hr-icon">○</span>排除含 V／S';
            if (ectopicToggle.innerHTML !== html) ectopicToggle.innerHTML = html;
            ectopicToggle.title = on ? '已排除 10 秒內有 V 或 S 標籤的心電圖（含未儲存的標籤修改）；按下關閉'
                : '按下排除 10 秒內有 V 或 S 標籤的心電圖（逐張讀取標籤，含未儲存的修改）';
            ectopicToggle.setAttribute('aria-pressed', String(on));
            ectopicToggle.classList.toggle('is-on', on);
            ectopicToggle.classList.toggle('is-visible', visible);
        }
        let restore = dialog.querySelector('.rc-hr-restore');
        if (!restore && toolbar) {
            restore = document.createElement('button');
            restore.type = 'button';
            restore.className = 'rc-hr-restore';
            restore.title = '恢復完整清單';
            restore.innerHTML = '<span class="rc-hr-count"></span>還原';
            restore.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                restoreHRItems(dialog);
            });
            toolbar.appendChild(restore);
        }
        if (restore) {
            const count = restore.querySelector('.rc-hr-count');
            const label = `已排除 ${excluded}`;
            if (count.textContent !== label) count.textContent = label;
            restore.classList.toggle('is-visible', excluded > 0);
        }
    }
    let hrListPending = false;
    function scheduleHRList() {
        if (hrListPending) return;
        hrListPending = true;
        requestAnimationFrame(() => { hrListPending = false; decorateHRList(); });
    }
    new MutationObserver(scheduleHRList).observe(document.body, { childList: true, subtree: true });

    // AF 事件清單編輯模式：mid segment 下拉選單旁加入 ◀ ▶，依選單順序切換上一個／下一個時段。
    // 透過 change 事件交給網站原本的 adjustAFTime 處理（網站會延遲 500 毫秒再載入心電圖）。
    const AF_SEGMENT_SELECT = 'select[ng-model="af.adjustAF[$index]"]';
    const afStepStyle = document.createElement('style');
    afStepStyle.textContent = `
        .rc-af-step { display:inline-flex; align-items:center; gap:2px; margin:0 0 5px -6px; vertical-align:middle; white-space:nowrap; }
        .rc-af-step button { width:22px; height:25px; padding:0; border:1px solid #767676; border-radius:3px; background:#fff;
            color:#5b7d1a; font-family:inherit; font-size:10px; line-height:23px; cursor:pointer; }
        .rc-af-step button:hover:not(:disabled) { background:#8fb43a; border-color:#8fb43a; color:#fff; }
        .rc-af-step button:disabled { color:#c4c4c4; border-color:#d6d6d6; cursor:default; }
        .rc-af-step .rc-af-pos { color:#848484; font-size:11px; text-align:center; }
    `;
    document.head.appendChild(afStepStyle);
    function stepAFSegment(select, delta) {
        const index = select.selectedIndex + delta;
        if (!select.isConnected || index < 0 || index >= select.options.length) return;
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function createAFStep() {
        const nav = document.createElement('span');
        nav.className = 'rc-af-step';
        nav.innerHTML = '<button type="button" data-step="-1" title="上一個時段">◀</button>'
            + '<span class="rc-af-pos"></span><button type="button" data-step="1" title="下一個時段">▶</button>';
        nav.addEventListener('click', event => {
            const button = event.target.closest('button[data-step]');
            if (!button) return;
            event.preventDefault(); event.stopPropagation();
            // ng-if 重建選單時按鈕列會留在原位，因此每次點擊都找緊鄰在前的選單。
            const select = nav.previousElementSibling;
            if (select?.matches(AF_SEGMENT_SELECT)) stepAFSegment(select, Number(button.dataset.step));
        });
        return nav;
    }
    function decorateAFSegmentSelects() {
        // 選單被移除後留下的按鈕列一併清除。
        for (const nav of document.querySelectorAll('.rc-af-step')) {
            if (!nav.previousElementSibling?.matches(AF_SEGMENT_SELECT)) nav.remove();
        }
        if (isDisabledPage()) return;
        for (const select of document.querySelectorAll(AF_SEGMENT_SELECT)) {
            let nav = select.nextElementSibling;
            if (!nav?.classList.contains('rc-af-step')) {
                nav = createAFStep();
                select.after(nav);
            }
            const index = select.selectedIndex;
            const total = select.options.length;
            const [prev, next] = nav.querySelectorAll('button');
            prev.disabled = index <= 0;
            next.disabled = index < 0 || index >= total - 1;
            const label = total ? `${index + 1}/${total}` : '';
            const pos = nav.querySelector('.rc-af-pos');
            if (pos.textContent !== label) pos.textContent = label;
        }
    }
    let afStepPending = false;
    function scheduleAFStep() {
        if (afStepPending) return;
        afStepPending = true;
        requestAnimationFrame(() => { afStepPending = false; decorateAFSegmentSelects(); });
    }
    new MutationObserver(scheduleAFStep).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('change', event => {
        if (event.target?.matches?.(AF_SEGMENT_SELECT)) scheduleAFStep();
    }, true);

    // Tachy／Brady 事件清單：在網站的 invert（全部）按鈕前加入單頁 Invert，樣式沿用 Pause 清單的單頁 Invert。
    // 網站點一張心電圖會依序切換狀態（Tachy：none → artifact → psvt → vt；Brady：none ↔ artifact），
    // 這裡只在 none 與 artifact 之間切換：本頁有未修改的就全改為 artifact，全部已是 artifact 時改回 none；
    // 手動設為 psvt／vt 的不變。每張的處理與網站點擊相同（取消該張選印、寫入未儲存修改）。
    const PAGE_INVERT_TYPES = ['tachy', 'brady'];
    function getPageInvertScope(dialog) {
        let scope;
        try { scope = window.angular?.element(dialog).scope?.(); } catch (_) { return null; }
        const af = scope?.af;
        if (!af || !PAGE_INVERT_TYPES.includes(af.eventDialog?.dscp?.type)) return null;
        if (typeof scope.setEventOperationSelected !== 'function' || typeof scope.selectPrintedEvent !== 'function') return null;
        return scope;
    }
    function invertEventPage(dialog) {
        const scope = getPageInvertScope(dialog);
        const items = scope?.af.eventDialog.currentData;
        if (!scope || !scope.af.editingSwitch || scope.af.loading?.ecg || !Array.isArray(items) || !items.length) return;
        const stateOf = item => item.selectedType || 'none';
        const toArtifact = items.some(item => stateOf(item) === 'none');
        const [from, to] = toArtifact ? ['none', 'artifact'] : ['artifact', 'none'];
        scope.$apply(() => {
            scope.af.ecgEnlargedChart.psSwitch = false;
            for (const item of items) {
                if (stateOf(item) !== from) continue;
                item.selectedEvent = false;
                scope.selectPrintedEvent(item);
                item.selectedType = to;
                item.chkDisabled = to !== 'none';
                scope.setEventOperationSelected(item);
            }
        });
    }
    function decorateEventPageInvert() {
        for (const button of document.querySelectorAll('.rc-page-invert')) {
            const dialog = button.closest('#af-event-dialog');
            if (isDisabledPage() || !dialog || !getPageInvertScope(dialog)
                || !button.nextElementSibling?.matches('[ng-click="pausesubOperation()"]')) button.remove();
        }
        if (isDisabledPage()) return;
        for (const all of document.querySelectorAll('#af-event-dialog .tool-btns > [ng-click="pausesubOperation()"]')) {
            const dialog = all.closest('#af-event-dialog');
            if (!getPageInvertScope(dialog)) continue;
            let button = all.previousElementSibling;
            if (!button?.classList.contains('rc-page-invert')) {
                button = document.createElement('div');
                button.className = 'tool-btn invertselect-btn rc-page-invert';
                button.title = '單頁 Invert：本頁未修改的改為 artifact；本頁已全部是 artifact 時改回未修改（psvt／vt 不變）';
                button.innerHTML = '<div class="invertselect-page-icon"></div><span class="smaller-font-size-11">Invert</span>';
                button.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    invertEventPage(button.closest('#af-event-dialog'));
                });
                all.before(button);
            }
            // 與網站的 invert 按鈕同時顯示（編輯模式、非 iPad 列印）。
            const hidden = all.classList.contains('ng-hide');
            if (button.classList.contains('ng-hide') !== hidden) button.classList.toggle('ng-hide', hidden);
        }
    }
    let pageInvertPending = false;
    function schedulePageInvert() {
        if (pageInvertPending) return;
        pageInvertPending = true;
        requestAnimationFrame(() => { pageInvertPending = false; decorateEventPageInvert(); });
    }
    new MutationObserver(schedulePageInvert).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // Spéc.（specifics）清單：網站沒有 invert 按鈕，這裡在放大鏡前加入「Invert」（本頁）與「Invert all」（整個清單），
    // 功能是取消星星（Ajouter aux spécificités）。每張都走網站點星星的 selectSpecificEvent：
    // 同時移除備註文字與選印，寫入未儲存修改，按 Save 才會儲存（編輯模式）。
    // 取消後若星星與選印都沒有再變動，再按一次同一個按鈕會把剛剛取消的星星、備註與選印加回來。
    function getSpecificListScope(dialog) {
        let scope;
        try { scope = window.angular?.element(dialog).scope?.(); } catch (_) { return null; }
        if (scope?.af?.eventDialog?.dscp?.type !== 'specifics' || typeof scope.selectSpecificEvent !== 'function') return null;
        return scope;
    }
    // 網站備註存放的位置不明，因此取消前把星星、選印與清單相關資料做快照，
    // 還原時只把「取消星星」與「重新加星星」改動到的欄位改回快照的值（陣列、物件就地更新，保留網站的參照）。
    const SNAPSHOT_SKIP = Symbol('skip');
    const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
    function snapshotValue(value, depth = 0, seen = new WeakSet()) {
        if (value === null || typeof value !== 'object') return typeof value === 'function' ? SNAPSHOT_SKIP : value;
        if (depth > 8 || seen.has(value)) return SNAPSHOT_SKIP;
        if (Array.isArray(value)) {
            // 心電圖波形等大型數值陣列與星星、備註、選印無關，不做快照。
            if (value.length > 5000) return SNAPSHOT_SKIP;
            seen.add(value);
            const copy = value.map(item => snapshotValue(item, depth + 1, seen));
            seen.delete(value);
            return copy;
        }
        if (!isPlainObject(value)) return SNAPSHOT_SKIP;
        seen.add(value);
        const copy = {};
        for (const key of Object.keys(value)) {
            if (key.startsWith('$$')) continue;
            copy[key] = snapshotValue(value[key], depth + 1, seen);
        }
        seen.delete(value);
        return copy;
    }
    const isLeafArray = value => value.every(item => item === null || typeof item !== 'object');
    // 找出 a、b 兩份快照中不同的路徑；只含數值的陣列整個當成一個值比較。
    function diffSnapshots(a, b, path = [], out = []) {
        if (a === SNAPSHOT_SKIP || b === SNAPSHOT_SKIP) return out;
        if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && !(isLeafArray(a) && isLeafArray(b))) {
            a.forEach((item, index) => diffSnapshots(item, b[index], [...path, index], out));
        } else if (isPlainObject(a) && isPlainObject(b)) {
            for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diffSnapshots(a[key], b[key], [...path, key], out);
        } else if (JSON.stringify(a) !== JSON.stringify(b)) {
            out.push(path);
        }
        return out;
    }
    const readPath = (root, path) => path.reduce((value, key) => value?.[key], root);
    function cloneSnapshot(value) {
        if (Array.isArray(value)) return value.map(cloneSnapshot);
        if (!isPlainObject(value)) return value === SNAPSHOT_SKIP ? undefined : value;
        const copy = {};
        for (const [key, item] of Object.entries(value)) if (item !== SNAPSHOT_SKIP) copy[key] = cloneSnapshot(item);
        return copy;
    }
    function restoreSnapshotValue(target, snapshot) {
        // 就地更新：陣列與物件保留原本的參照，網站其他地方綁定的資料才會一起更新。
        if (Array.isArray(target) && Array.isArray(snapshot)) {
            const items = snapshot.map((item, index) => item === SNAPSHOT_SKIP ? target[index] : cloneSnapshot(item));
            target.splice(0, target.length, ...items);
            return target;
        }
        if (isPlainObject(target) && isPlainObject(snapshot)) {
            for (const key of Object.keys(target)) if (!key.startsWith('$$') && !(key in snapshot)) delete target[key];
            for (const [key, value] of Object.entries(snapshot)) {
                if (value !== SNAPSHOT_SKIP) target[key] = restoreSnapshotValue(target[key], value);
            }
            return target;
        }
        return cloneSnapshot(snapshot);
    }
    function restorePaths(root, before, paths) {
        // 先處理較短的路徑；已被上層一併還原的子路徑跳過。
        const done = [];
        for (const path of [...paths].sort((a, b) => a.length - b.length)) {
            if (!path.length || done.some(prefix => prefix.every((key, index) => path[index] === key))) continue;
            const parent = readPath(root, path.slice(0, -1));
            const key = path[path.length - 1];
            if (!parent || typeof parent !== 'object') continue;
            let value = before;
            for (const step of path) value = value === undefined || value === SNAPSHOT_SKIP ? undefined : value?.[step];
            if (value === SNAPSHOT_SKIP) continue;
            if (value === undefined) delete parent[key];
            else parent[key] = restoreSnapshotValue(parent[key], value);
            done.push(path);
        }
    }
    function specificSnapshotRoot(af) {
        return {
            specificEvents: af.specificEvents,
            selectedEvents: af.printDialog?.selectedEvents,
            specifics: af.eventDialog?.specifics,
            currentData: af.eventDialog?.currentData,
        };
    }
    // 判斷取消後是否有其他變動：比對星星與選印。
    function specificSignature(af) {
        const tms = [...(af.specificEvents?.modifiedData?.tms || [])].map(Number).sort((a, b) => a - b);
        return JSON.stringify([tms, snapshotValue(af.printDialog?.selectedEvents)]);
    }
    const specificPageTimes = af => (af.eventDialog.currentData || []).map(toEventTime).join(',');
    // 已取消、可還原的紀錄（後進先出）：先按本頁再按全部時，可依序還原。
    const specificUndoStack = [];
    function unstarSpecificList(dialog, all, anchor) {
        const scope = getSpecificListScope(dialog);
        const af = scope?.af;
        const tms = af?.specificEvents?.modifiedData?.tms;
        if (!scope || !af.editingSwitch || af.loading?.ecg || !Array.isArray(tms)) return;
        const top = specificUndoStack[specificUndoStack.length - 1];
        if (top && (top.af !== af || top.signature !== specificSignature(af))) specificUndoStack.length = 0;
        const last = specificUndoStack[specificUndoStack.length - 1];
        if (last && last.all === all && (all || last.pageTimes === specificPageTimes(af))) {
            specificUndoStack.pop();
            restoreSpecificList(scope, last, anchor);
            return;
        }
        const starred = time => af.specificEvents.modifiedData.tms.includes(time);
        const pageItems = (af.eventDialog.currentData || []).filter(item => {
            const time = toEventTime(item);
            return time !== null && starred(time);
        });
        const otherTimes = all ? [...new Set((af.eventDialog.specifics?.data || []).flat().map(toEventTime))]
            .filter(time => time !== null && starred(time) && !pageItems.some(item => toEventTime(item) === time)) : [];
        if (!pageItems.length && !otherTimes.length) return;
        const before = snapshotValue(specificSnapshotRoot(af));
        const pageTimes = specificPageTimes(af);
        scope.$apply(() => {
            // 本頁：傳入心電圖物件，網站會一併更新選印勾選狀態；星星圖示由 isSpecific 決定。
            for (const item of pageItems) {
                scope.selectSpecificEvent(item);
                item.isSpecific = false;
            }
            // 其他頁：只取消這個清單裡的時間，傳入時間數值（網站同樣支援）。
            for (const time of otherTimes) scope.selectSpecificEvent(time);
        });
        const after = snapshotValue(specificSnapshotRoot(af));
        specificUndoStack.push({
            af, all, pageTimes, before, after,
            pageTimesRemoved: pageItems.map(toEventTime), otherTimes,
            signature: specificSignature(af),
        });
        quickToast(anchor, `已取消 ${pageItems.length + otherTimes.length} 個星星，再按一次可加回星星、備註與選印`);
    }
    function restoreSpecificList(scope, record, anchor) {
        const af = scope.af;
        const times = [...record.pageTimesRemoved, ...record.otherTimes];
        scope.$apply(() => {
            // 先以網站點星星的方式加回（寫入未儲存修改），再把備註、選印等改回取消前的值。
            for (const time of times) {
                if (af.specificEvents.modifiedData.tms.includes(time)) continue;
                const item = (af.eventDialog.currentData || []).find(entry => toEventTime(entry) === time);
                scope.selectSpecificEvent(item || time);
            }
            const restarred = snapshotValue(specificSnapshotRoot(af));
            const paths = [...diffSnapshots(record.before, record.after), ...diffSnapshots(record.after, restarred)];
            restorePaths(specificSnapshotRoot(af), record.before, paths);
            for (const item of af.eventDialog.currentData || []) {
                if (times.includes(toEventTime(item))) item.isSpecific = true;
            }
        });
        quickToast(anchor, `已加回 ${times.length} 個星星（含備註與選印）`);
    }
    const SPECIFIC_BUTTONS = [
        { all: false, icon: 'invertselect-page-icon', text: 'Invert', title: '單頁 Invert：取消本頁所有星星（連同備註與選印），再按一次加回' },
        { all: true, icon: 'invertselect-icon', text: 'Invert all', title: 'Invert all：取消整個 Spéc. 清單的所有星星（連同備註與選印），再按一次加回' },
    ];
    function decorateSpecificInvert() {
        for (const button of document.querySelectorAll('.rc-specific-invert')) {
            const dialog = button.closest('#af-event-dialog');
            if (isDisabledPage() || !dialog || !getSpecificListScope(dialog)) button.remove();
        }
        if (isDisabledPage()) return;
        for (const zoom of document.querySelectorAll('#af-event-dialog .tool-btns > .zoom-btn')) {
            const dialog = zoom.closest('#af-event-dialog');
            const scope = getSpecificListScope(dialog);
            if (!scope) continue;
            // 與網站其他清單的 invert 按鈕相同：編輯模式、非 iPad 列印才顯示。
            let hidden = !scope.af.editingSwitch;
            try { hidden ||= !!scope.isiPad_inPrint?.(); } catch (_) { /* 沿用編輯模式判斷 */ }
            for (const spec of SPECIFIC_BUTTONS) {
                let button = dialog.querySelector(`.rc-specific-invert[data-all="${spec.all}"]`);
                if (!button) {
                    button = document.createElement('div');
                    button.className = 'tool-btn invertselect-btn rc-specific-invert';
                    button.dataset.all = String(spec.all);
                    button.title = spec.title;
                    button.innerHTML = `<div class="${spec.icon}"></div><span class="smaller-font-size-11">${spec.text}</span>`;
                    button.addEventListener('click', event => {
                        event.preventDefault(); event.stopPropagation();
                        unstarSpecificList(button.closest('#af-event-dialog'), spec.all, button);
                    });
                    zoom.before(button);
                }
                if (button.classList.contains('ng-hide') !== hidden) button.classList.toggle('ng-hide', hidden);
            }
        }
    }
    let specificInvertPending = false;
    function scheduleSpecificInvert() {
        if (specificInvertPending) return;
        specificInvertPending = true;
        requestAnimationFrame(() => { specificInvertPending = false; decorateSpecificInvert(); });
    }
    new MutationObserver(scheduleSpecificInvert).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // 時間輸入框：聚焦且內容是完整時間時，W／↑ 加 2 秒、S／↓ 減 2 秒（可按住連續調整）。
    // 依網站的日期格式解析（另接受輸入框提示的「日期, 時間」寫法），以原本的寫法寫回，
    // 再送出 input 事件交給網站原本的 ng-change 處理。
    const TIME_STEP_SECONDS = 2;
    const DEFAULT_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
    function getTimeFormats(input) {
        let site = DEFAULT_TIME_FORMAT;
        try {
            const format = window.angular?.element(input).scope()?.getAdjustFormat?.(DEFAULT_TIME_FORMAT);
            if (typeof format === 'string' && format) site = format;
        } catch (_) { /* 沒有網站格式時改用預設 */ }
        const formats = [site, site.replace(' ', ', ')];
        // 提示文字本身是時間格式（例如 DD/MM/YYYY, HH:mm:ss）時一併接受。
        if (/^[DMY/.\-, ]+HH:mm:ss$/.test(input.placeholder || '')) formats.push(input.placeholder);
        return [...new Set(formats)];
    }
    function stepTimeText(value, formats, seconds) {
        const moment = window.moment;
        if (typeof moment?.utc !== 'function') return null;
        for (const format of formats) {
            const time = moment.utc(String(value).trim(), format, true);
            if (time.isValid()) return time.add(seconds, 'seconds').format(format);
        }
        return null;
    }
    window.addEventListener('keydown', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'text' || !input.hasAttribute('ng-model')) return;
        if (isDisabledPage() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
        const key = event.key;
        const direction = key === 'ArrowUp' || key === 'w' || key === 'W' ? 1
            : key === 'ArrowDown' || key === 's' || key === 'S' ? -1 : 0;
        if (!direction) return;
        const next = stepTimeText(input.value, getTimeFormats(input), direction * TIME_STEP_SECONDS);
        if (next === null) return; // 不是完整時間（例如正在輸入）時保留原本按鍵行為。
        event.preventDefault();
        event.stopImmediatePropagation();
        const { selectionStart, selectionEnd } = input;
        input.value = next;
        if (selectionStart !== null) input.setSelectionRange(selectionStart, selectionEnd);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);

    // 聚焦時間輸入框時，在框下方顯示快捷鍵提示 3 秒；失焦或捲動時收起。
    // 時間輸入框：內容是完整時間，或提示文字是時間格式（例如空白的 HR 清單時間框）。
    const TIME_HINT_MS = 3000;
    const TIME_FORMAT_PLACEHOLDER = /^[DMY/.\-, ]+HH:mm:ss$/;
    const timeHintStyle = document.createElement('style');
    timeHintStyle.textContent = `
        .rc-time-hint { position:fixed; z-index:100000; padding:3px 8px; border:1px solid #dcdcdc; border-radius:4px; background:#fff;
            color:#888; font-size:11px; line-height:16px; white-space:nowrap; pointer-events:none; box-shadow:0 1px 3px rgba(0,0,0,.08);
            opacity:0; transition:opacity .15s; }
        .rc-time-hint.is-visible { opacity:1; }
        .rc-time-hint kbd { display:inline-block; min-width:12px; margin:0 1px; padding:0 3px; border:1px solid #d6d6d6; border-radius:3px;
            background:#f6f6f6; color:#666; font-family:inherit; font-size:10px; line-height:13px; text-align:center; }
    `;
    document.head.appendChild(timeHintStyle);
    const timeHint = document.createElement('div');
    timeHint.className = 'rc-time-hint';
    timeHint.innerHTML = `<kbd>W</kbd><kbd>↑</kbd> 加 ${TIME_STEP_SECONDS} 秒　<kbd>S</kbd><kbd>↓</kbd> 減 ${TIME_STEP_SECONDS} 秒`;
    let timeHintTimer = null;
    function isTimeInput(input) {
        if (!(input instanceof HTMLInputElement) || input.type !== 'text' || !input.hasAttribute('ng-model')) return false;
        return TIME_FORMAT_PLACEHOLDER.test(input.placeholder || '')
            || stepTimeText(input.value, getTimeFormats(input), 0) !== null;
    }
    function hideTimeHint() {
        clearTimeout(timeHintTimer);
        timeHintTimer = null;
        timeHint.classList.remove('is-visible');
    }
    function showTimeHint(input) {
        if (!timeHint.isConnected) document.body.appendChild(timeHint);
        const rect = input.getBoundingClientRect();
        const height = timeHint.offsetHeight || 24;
        // 預設在框下方，下方空間不足時改到上方。
        const top = rect.bottom + 6 + height > window.innerHeight ? rect.top - 6 - height : rect.bottom + 6;
        const left = Math.min(Math.max(4, rect.left), window.innerWidth - timeHint.offsetWidth - 4);
        timeHint.style.top = `${Math.round(top)}px`;
        timeHint.style.left = `${Math.round(left)}px`;
        timeHint.classList.add('is-visible');
        clearTimeout(timeHintTimer);
        timeHintTimer = setTimeout(hideTimeHint, TIME_HINT_MS);
    }
    document.addEventListener('focusin', event => {
        if (!isDisabledPage() && isTimeInput(event.target)) showTimeHint(event.target);
    }, true);
    document.addEventListener('focusout', event => {
        if (event.target instanceof HTMLInputElement) hideTimeHint();
    }, true);
    window.addEventListener('scroll', () => { if (timeHintTimer) hideTimeHint(); }, { capture: true, passive: true });

    // HR 清單時間框：貼上或修改時間後，網站會把清單第一筆換成該時間；
    // 等這張心電圖與標籤載入完成，再以「ECG 變動率自動標註器」相同算法
    // （心搏 BPM 平均，排除灰色背景區段）四捨五入填入旁邊的 HR 欄。
    const HR_TIME_INPUT = 'input[ng-model="af.hrUpdate.tms"]';
    const HR_VALUE_INPUT = 'input[ng-model="af.hrUpdate.hr"]';
    const HR_TMS_KEYS = { minHR: 'minTms', maxHR: 'maxTms', maxSinus: 'maxSinusTms' };
    const HR_FILL_TIMEOUT_MS = 8000;
    const HR_FILL_POLL_MS = 200;
    let hrFillJob = 0;
    function getHRListTarget(input) {
        try {
            const scope = window.angular.element(input).scope();
            const key = HR_TMS_KEYS[scope?.af?.eventDialog?.dscp?.type];
            const value = Number(scope?.af?.tmsline?.ogTagsRecord?.[key]?.[0]);
            return Number.isFinite(value) ? value : null;
        } catch (_) { return null; }
    }
    // 卡片內可讀的心搏 BPM（排除間隔過長的文字），以及灰色背景的水平範圍。
    function readCardBeats(card) {
        const block = card.querySelector('svg.ecgRMarker')?.parentElement;
        if (!block) return null;
        const gray = [...block.querySelectorAll('.ecgMask rect.mask')]
            .filter(mask => Number(mask.getAttribute('opacity') ?? getComputedStyle(mask).opacity) > 0)
            .map(mask => mask.getBoundingClientRect())
            .filter(rect => rect.width > 0)
            .map(rect => [rect.left, rect.right]);
        const beats = [];
        for (const text of card.querySelectorAll('.annoGroup text.annoDuration')) {
            const interval = Number((text.childNodes[0]?.textContent || '').match(/\d+/)?.[0]);
            const hr = Number(text.querySelector('tspan')?.textContent.match(/\d+/)?.[0]);
            if (!Number.isFinite(interval) || interval >= 10000 || !Number.isFinite(hr)) continue;
            const rect = text.getBoundingClientRect();
            beats.push({ hr, center: rect.left + rect.width / 2 });
        }
        return { gray, beats };
    }
    function averageWhiteBPM({ gray, beats }) {
        const rates = beats.filter(({ center }) => !gray.some(([left, right]) => center >= left && center < right))
            .map(({ hr }) => hr);
        return rates.length ? rates.reduce((sum, hr) => sum + hr, 0) / rates.length : null;
    }
    function findHRCard(dialog, time) {
        return [...dialog.querySelectorAll(HR_CARD_SELECTOR)].find(card => getHRCardTime(card) === time) || null;
    }
    // 標籤內容連續兩次相同才計算，避免讀到換頁前沿用節點的舊標籤。
    function fillHRFromCard(input, target) {
        const job = ++hrFillJob;
        const started = Date.now();
        let lastSignature = null;
        const poll = () => {
            if (job !== hrFillJob || !input.isConnected) return;
            if (Date.now() - started > HR_FILL_TIMEOUT_MS) return;
            const dialog = input.closest('#af-hr-dialog');
            const card = dialog && findHRCard(dialog, target);
            const data = card && readCardBeats(card);
            const loaded = data?.beats.length
                && window.angular.element(card).scope()?.currentData?.ecgData?.length;
            const signature = loaded ? data.beats.map(beat => `${beat.hr}@${Math.round(beat.center)}`).join(',') : null;
            if (!signature || signature !== lastSignature) {
                lastSignature = signature;
                setTimeout(poll, HR_FILL_POLL_MS);
                return;
            }
            const average = averageWhiteBPM(data);
            const hrInput = dialog.querySelector(HR_VALUE_INPUT);
            if (average === null || !hrInput) return;
            hrInput.value = String(Math.round(average));
            hrInput.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setTimeout(poll, HR_FILL_POLL_MS);
    }
    // 捕獲階段先記下修改前的時間，網站處理完後清單第一筆有變才計算（時間無效或超出範圍時網站不會更新）。
    document.addEventListener('input', event => {
        const input = event.target;
        if (isDisabledPage() || !input?.matches?.(HR_TIME_INPUT)) return;
        const before = getHRListTarget(input);
        setTimeout(() => {
            const target = getHRListTarget(input);
            if (target !== null && target !== before) fillHRFromCard(input, target);
        }, 0);
    }, true);

    // 事件清單頁碼拉條：在選印的綠色／橘色（強制選印）垂直線下方加入頁碼按鈕，點擊即跳到該頁，右側顯示選印數量。
    // 直接讀取網站拉條（svg.paginationEventBar）綁定的分頁資料與選印清單，不依賴語系文字。
    const PRINT_LINK_SPACE = 4; // 拉條下緣到圓點列的連接線高度，需與 .rc-print-jumps 的 top 相同
    const printBarStyle = document.createElement('style');
    printBarStyle.textContent = `
        .rc-print-panel { position:relative; height:0; overflow:visible; }
        .rc-print-links { position:absolute; left:0; overflow:visible; pointer-events:none; }
        .rc-print-link { fill:none; stroke:#8fb43a; stroke-width:1; stroke-linecap:round; opacity:.75;
            transition:stroke .12s, stroke-width .12s, opacity .12s; }
        .rc-print-link.is-current, .rc-print-link.is-hot { stroke:#5b7d1a; stroke-width:1.6; opacity:1; }
        .rc-print-jumps { position:relative; top:4px; width:100%; height:14px; }
        .rc-print-jump { position:absolute; top:50%; box-sizing:border-box; width:11px; height:11px; margin:0; padding:0;
            transform:translate(-50%, -50%); border:2px solid #8fb43a; border-radius:50%; background:#fff; color:#fff;
            font-family:inherit; font-weight:700; font-size:8px; line-height:7px; text-align:center; cursor:pointer;
            transition:transform .12s, background .12s, border-color .12s; }
        .rc-print-jump.has-count { width:14px; height:14px; background:#8fb43a; line-height:10px; }
        .rc-print-jump:hover { z-index:1; transform:translate(-50%, -50%) scale(1.35); background:#5b7d1a; border-color:#5b7d1a; }
        .rc-print-jump.is-current { background:#5b7d1a; border-color:#5b7d1a; box-shadow:0 0 0 2px rgba(91,125,26,.28); }
        .rc-print-link.is-forced { stroke:#d88f3f; }
        .rc-print-link.is-forced.is-current, .rc-print-link.is-forced.is-hot { stroke:#b5701f; }
        .rc-print-jump.is-forced, .rc-print-jump.has-forced { border-color:#d88f3f; }
        .rc-print-jump.is-forced.has-count { background:#d88f3f; }
        .rc-print-jump.is-forced:hover, .rc-print-jump.is-forced.is-current { background:#b5701f; border-color:#b5701f; }
        .rc-print-jump.is-forced.is-current { box-shadow:0 0 0 2px rgba(216,143,63,.35); }
        .rc-print-summary { border:0; background:#5b7d1a; color:#fff; cursor:default; }
    `;
    document.head.appendChild(printBarStyle);
    // 分頁資料可能是時間、[時間, …] 或含 startTime 的物件；Event Tag 清單為 { tagTime, dataTime }，
    // 網站選印記錄的是 dataTime（沒有時用 tagTime）。
    function toEventTime(value) {
        if (Array.isArray(value)) value = value[0];
        if (value && typeof value === 'object') value = value.startTime ?? value.dataTime ?? value.tagTime ?? value.tms ?? value.time;
        const time = Number(value);
        return Number.isFinite(time) ? time : null;
    }
    // 橘色強制選印：網站的拉條只在開啟清單時把 preselectedEvents 算一次，之後排除或取消排除不會更新；
    // 心電圖上的橘色選印圖示（checkPrintEvent）則即時讀取 printDialog.selectedEvents 的這些欄位。
    const FORCED_PRINT_KEYS = {
        vtTmsArr: ['longestVTTms', 'fastestAvgVTTms'],
        svtTmsArr: ['longestSVTTms', 'fastestAvgSVTTms'],
        pauseTmsArr: ['longestAsleepPause', 'longestAwakePause'],
        afTmsArr: ['longestAfTms', 'avgFastestAfTms', 'af10SecFastestTms'],
        // Isolated 清單：網站把 Couplet 等子分類的選印也畫成橘色，但那不是強制選印，不計入。
        pvcTmsArr: [],
        svebTmsArr: [],
    };
    // 依目前清單類型即時取得強制選印；不支援的清單回傳 null，改用拉條的 preselectedEvents。
    // key：選印欄位（printedEventType），預設為目前開著的清單；所有選印清單會指定各清單自己的欄位。
    function getLiveForcedEvents(af, key = af?.eventDialog?.dscp?.printedEventType) {
        const keys = FORCED_PRINT_KEYS[key];
        const selected = af?.printDialog?.selectedEvents;
        if (!keys || !selected) return null;
        return keys.flatMap(key => Array.isArray(selected[key]) ? selected[key] : []);
    }
    // 選印分兩種：綠色（events 與 section）與橘色強制選印（forcedEvents，預設為拉條的 preselectedEvents）。
    // 同一張兩邊都有時算一張，以橘色為準。
    function getPrintPages(scope, forcedEvents = scope?.preselectedEvents) {
        const pages = Array.isArray(scope?.pageData) ? scope.pageData : [];
        const list = value => Array.isArray(value) ? value : [];
        const forced = new Set(list(forcedEvents).map(toEventTime).filter(time => time !== null));
        const selected = new Set([...list(scope?.events), ...list(scope?.section)]
            .map(toEventTime).filter(time => time !== null));
        const events = [...new Set([...selected, ...forced])];
        if (!pages.length || !events.length) return { groups: [], total: events.length, forced: forced.size, missing: [] };
        const pageByTime = new Map();
        pages.forEach((page, index) => {
            for (const value of Array.isArray(page) ? page : [page]) {
                const time = toEventTime(value);
                if (time !== null && !pageByTime.has(time)) pageByTime.set(time, index + 1);
            }
        });
        const groups = new Map();
        // missing：有選印紀錄但已不在這個清單的心電圖（例如改成 Couplet 後重新 Group，從 Isolated 清單移走）。
        const missing = [];
        for (const time of events) {
            const page = pageByTime.get(time);
            if (!page) { missing.push(time); continue; }
            if (!groups.has(page)) groups.set(page, { page, times: [], forced: 0 });
            const group = groups.get(page);
            group.times.push(time);
            if (forced.has(time)) group.forced++;
        }
        return { groups: [...groups.values()].sort((a, b) => a.page - b.page),
            total: events.length - missing.length, forced: [...forced].filter(time => pageByTime.has(time)).length,
            pageCount: pages.length, missing };
    }
    // 已不在清單中的綠色選印：網站的 Group 不會移除原清單的選印紀錄，
    // 這些心電圖仍會計入報告，但清單上看不到也無法取消。只回傳可用網站取消選印處理的部分。
    // 只在拉條的頁面資料就是目前清單的完整資料時判斷，避免切換清單或載入中把別的清單當成「不在清單」。
    // Manual／Unclassified 清單（openUnclassifiedList，例如 modifiedS）與 Isolated 共用同一組選印紀錄，
    // 但只列出部分心電圖，不能把不在其中的選印當成「已不在清單」。
    // Event Tag 清單（tags）也不自動取消：標籤可能被篩選或另外管理，不依清單內容判斷。
    const ORPHAN_SKIP_TYPE = /^(modified|unclassified|tags$)/i;
    function getOrphanPrints(bar, af, missing, pages) {
        if (!missing?.length || !af?.printDialog?.selectedEvents || !window.angular) return null;
        const key = af.eventDialog?.dscp?.printedEventType;
        const type = af.eventDialog?.dscp?.type;
        if (typeof type !== 'string' || ORPHAN_SKIP_TYPE.test(type)) return null;
        const selected = af.printDialog.selectedEvents[key];
        const source = af.eventDialog?.[type];
        if (!Array.isArray(selected) || !Array.isArray(source?.data) || !Array.isArray(pages)) return null;
        const listTimes = source.data.flat().map(toEventTime).filter(time => time !== null);
        const pageTimes = pages.flatMap(page => Array.isArray(page) ? page : [page]).map(toEventTime).filter(time => time !== null);
        if (!listTimes.length || listTimes.length !== Number(source.itemsLength) || pageTimes.length !== listTimes.length) return null;
        const inList = new Set(listTimes);
        if (pageTimes.some(time => !inList.has(time))) return null;
        let host;
        try { host = window.angular.element(bar).scope(); } catch (_) { return null; }
        while (host && typeof host.selectPrintedEvent !== 'function') host = host.$parent;
        if (!host) return null;
        // 改過標籤、尚未重新 Group 的心搏只在 Manual 清單（af.unclassifiedGroup）裡，
        // 不在 Isolated 等清單中；這些選印（例如 MP 按 5 選印）仍有效，不能取消。
        const manual = af.unclassifiedGroup || {};
        for (const value of [manual.veb, manual.sveb].flatMap(list => Array.isArray(list) ? list : [])) {
            const time = toEventTime(value);
            if (time !== null) inList.add(time);
        }
        // 共用同一組選印紀錄的其他清單（例如 Pause 2-3／3-4／4-5／≥5 秒與 Pause、Isolated 與 4／5 顆 S）
        // 中的心電圖也算在清單中，避免開啟子清單時取消其他清單的選印。
        for (const [name, other] of Object.entries(af.eventDialog || {})) {
            if (name === type || other?.printedEventType !== key || !Array.isArray(other.data)) continue;
            for (const value of other.data.flat()) {
                const time = toEventTime(value);
                if (time !== null) inList.add(time);
            }
        }
        const lost = new Set(missing.filter(time => !inList.has(time)));
        const times = [...new Set(selected.map(toEventTime).filter(time => time !== null && lost.has(time)))].sort((a, b) => a - b);
        return times.length ? { times, host, af, key, type, signature: `${af._measureId}|${key}|${times.join(',')}` } : null;
    }
    // 自動取消不在清單中的選印：同一批連續 1.5 秒都偵測到才處理，處理後以提示訊息告知，不跳確認視窗。
    const ORPHAN_STABLE_MS = 1500;
    const orphanState = { signature: null, since: 0, busy: false };
    function autoClearOrphanPrints(orphans, anchor) {
        if (!orphans || orphanState.busy || review?.grouping) {
            if (!orphans) orphanState.signature = null;
            return;
        }
        if (orphanState.signature !== orphans.signature) {
            orphanState.signature = orphans.signature;
            orphanState.since = Date.now();
            setTimeout(schedulePrintBars, ORPHAN_STABLE_MS + 100);
            return;
        }
        if (Date.now() - orphanState.since < ORPHAN_STABLE_MS) return;
        orphanState.busy = true;
        orphanState.signature = null;
        clearOrphanPrints(orphans, anchor).finally(() => { orphanState.busy = false; schedulePrintBars(); });
    }
    async function clearOrphanPrints(orphans, anchor) {
        const { times, host, af, key, type } = orphans;
        try {
            // 與網站點擊取消選印相同；取消前確認仍是同一個清單。
            if (af.eventDialog?.dscp?.printedEventType !== key || af.eventDialog?.dscp?.type !== type) return;
            host.$apply(() => { for (const time of times) host.selectPrintedEvent({ startTime: time, selectedEvent: false }); });
            await uploadPrintSelections(af);
            const list = times.slice(0, 3).map(time => formatQuickTime({ host }, time)).join('、') + (times.length > 3 ? ' 等' : '');
            quickToast(anchor?.isConnected ? anchor : null, `已自動取消 ${times.length} 張已不在清單中的選印（${list}）`);
        } catch (error) {
            quickToast(anchor?.isConnected ? anchor : null, `取消不在清單中的選印失敗：${error?.message || error}`, true);
        }
    }
    // 只排一列：依綠線位置（已由左到右排序）回傳每個圓點的中心 x。
    // 會重疊的圓點合併成一組，以組內綠線的平均位置為中心左右攤開；每次合併都先限制在拉條寬度內，
    // 再與前一組比較，避免被邊界推回後又疊到相鄰的組。整列比拉條寬時置中。
    function layoutPrintDots(targets, barWidth) {
        const gap = Math.max(15, Math.min(18, barWidth / Math.max(1, targets.length)));
        const place = cluster => {
            const width = cluster.count * gap;
            const ideal = cluster.sum / cluster.count - width / 2;
            cluster.left = width > barWidth ? (barWidth - width) / 2 : Math.min(Math.max(ideal, 0), barWidth - width);
        };
        const clusters = [];
        targets.forEach((target, index) => {
            let cluster = { first: index, count: 1, sum: target };
            place(cluster);
            while (clusters.length) {
                const previous = clusters[clusters.length - 1];
                if (previous.left + previous.count * gap <= cluster.left + 0.01) break;
                clusters.pop();
                cluster = { first: previous.first, count: previous.count + cluster.count, sum: previous.sum + cluster.sum };
                place(cluster);
            }
            clusters.push(cluster);
        });
        const positions = [];
        for (const cluster of clusters) {
            for (let i = 0; i < cluster.count; i++) positions[cluster.first + i] = cluster.left + gap * (i + 0.5);
        }
        return positions;
    }
    // 與網站拉條（paginationEventBar）相同的頁面標記中心：超過 3 頁時兩端各留 10px（trackWidth 20 的一半），
    // 標記寬度取頁距與可用寬度 1/10 的較小者；只有 1 頁時標記從左端開始。
    function estimatePrintMark(page, pageCount, barWidth) {
        const track = pageCount <= 3 ? 0 : 20;
        const usable = barWidth - track;
        if (pageCount <= 1) return usable / 20;
        const step = usable / (pageCount - 1);
        return track / 2 + (page - 1) * step;
    }
    function jumpToPage(range, page) {
        const input = range.querySelector('input[type="range"]');
        if (!input) return;
        input.value = String(page);
        // 交給網站的 ng-model 與 ng-change 處理換頁，與拖曳拉條相同。
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function decoratePrintBars() {
        if (isDisabledPage() || !window.angular) return;
        if (review && !review.multi && !review.anchor.isConnected && !review.grouping) closePrintReview();
        decorateAllPrintButton();
        syncReviewPrints();
        recheckReviewCards();
        decorateReviewDialog();
        drawTagPrintWindows(); // 網站重畫心電圖後補回選印範圍框
        for (const bar of document.querySelectorAll('.pagination-range svg.paginationEventBar')) {
            const range = bar.closest('.pagination-range');
            let scope;
            try { scope = window.angular.element(bar).isolateScope(); } catch (_) { continue; }
            if (!scope) continue;
            watchPrintRange(range);
            let liveForced = null;
            let printAF = null;
            try {
                let parent = window.angular.element(bar).scope();
                while (parent && !parent.af) parent = parent.$parent;
                printAF = parent?.af || null;
                liveForced = getLiveForcedEvents(printAF);
            } catch (_) {}
            const { groups, total, forced, pageCount, missing } = liveForced ? getPrintPages(scope, liveForced) : getPrintPages(scope);
            autoClearOrphanPrints(getOrphanPrints(bar, printAF, missing, scope.pageData), range);
            const current = Number(scope.pageIndex);
            const barWidth = bar.getBoundingClientRect().width;
            // 拉條暫時隱藏或尚未排版時不計算，避免圓點列以錯誤的位置畫出；顯示後由 ResizeObserver 觸發重畫。
            if (!range.offsetWidth || !barWidth) continue;
            // V / S 事件清單另外顯示「快速選印」，沒有選印時也保留按鈕列；Pause、Event Tag 只有選印清單。
            const quick = getQuickContext(bar, true);
            trackCancelledPrints(quick); // 記下使用者取消的選印，快速選印時略過
            const keepPanel = total > 0 || (!!quick && !quick.config.reviewOnly);
            const signature = JSON.stringify([groups, total, current, Math.round(barWidth), quick?.type || '']);
            const existing = range.nextElementSibling?.classList.contains('rc-print-panel') ? range.nextElementSibling : null;
            // 換頁或選印時版面可能短暫變動，圓點列沒對齊拉條就整列重畫。
            const aligned = !existing || Math.abs(existing.getBoundingClientRect().left - range.getBoundingClientRect().left) < 1;
            if (range.dataset.rcPrintSignature === signature && !!existing === keepPanel && aligned) {
                updatePrintActions(existing, quick, total, forced);
                continue;
            }
            range.dataset.rcPrintSignature = signature;

            // 拉條容器為 overflow:hidden，圓點與數量放在緊接其後、同寬置中的獨立列。
            let panel = range.nextElementSibling?.classList.contains('rc-print-panel') ? range.nextElementSibling : null;
            if (!keepPanel) { panel?.remove(); continue; }
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'rc-print-panel';
                panel.innerHTML = '<svg class="rc-print-links" aria-hidden="true"></svg>'
                    + '<div class="rc-print-actions"><button type="button" class="rc-print-summary"></button>'
                    + '<button type="button" class="rc-quick-print"></button></div><div class="rc-print-jumps"></div>';
                range.after(panel);
            }
            const rangeStyle = getComputedStyle(range);
            panel.style.width = `${range.offsetWidth}px`;
            panel.style.marginLeft = rangeStyle.marginLeft;
            panel.style.marginRight = rangeStyle.marginRight;
            // 依實際位置校正，拉條以 auto 邊距或父層置中時也能對齊。
            const offset = range.getBoundingClientRect().left - panel.getBoundingClientRect().left;
            if (Math.abs(offset) >= 0.5) panel.style.marginLeft = `${(parseFloat(panel.style.marginLeft) || 0) + offset}px`;
            // 這一列高度為 0，畫在拉條下邊距的空白裡，不推動下方心電圖；負邊距貼齊拉條，再補回同樣的間距。
            const rangeGap = parseFloat(rangeStyle.marginBottom) || 0;
            panel.style.marginTop = `${-rangeGap}px`;
            panel.style.marginBottom = `${rangeGap}px`;
            panel.style.setProperty('--rc-range-height', `${range.offsetHeight}px`);
            updatePrintActions(panel, quick, total, forced);

            // 標記位置：優先對齊網站畫出的標記中心，找不到相近的標記時依拉條的頁序公式換算。
            // 即時讀取強制選印時，網站的橘色標記可能已過期，只對齊綠色標記。
            const scale = barWidth / (Number(bar.getAttribute('width')) || barWidth);
            const markXs = [...bar.querySelectorAll(liveForced ? 'rect.mark-up' : 'rect.mark-up, rect.pre-mark-up')]
                .map(rect => (Number(rect.getAttribute('x')) + (Number(rect.getAttribute('width')) || 0) / 2) * scale)
                .filter(Number.isFinite);
            const items = groups.map(({ page, times, forced }) => {
                const estimate = estimatePrintMark(page, pageCount, barWidth);
                const nearest = markXs.reduce((best, value) =>
                    Math.abs(value - estimate) < Math.abs(best - estimate) ? value : best, Infinity);
                return { page, times, forced, target: Math.abs(nearest - estimate) <= 8 ? nearest : estimate };
            });
            layoutPrintDots(items.map(item => item.target), barWidth)
                .forEach((x, index) => { items[index].x = x; });

            // 細曲線從拉條上的綠線底部連到下方圓點。
            const barGap = Math.max(0, range.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom);
            const links = panel.querySelector('.rc-print-links');
            const linkHeight = barGap + PRINT_LINK_SPACE;
            links.setAttribute('width', String(barWidth));
            links.setAttribute('height', String(linkHeight));
            links.style.top = `${-barGap}px`;
            links.innerHTML = '';
            const strip = panel.querySelector('.rc-print-jumps');
            strip.textContent = '';
            for (const { page, times, forced, target, x } of items) {
                // 全部強制選印為橘色；同頁混有綠色時為綠底橘框。
                const tone = !forced ? '' : forced === times.length ? ' is-forced' : ' has-forced';
                const link = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                link.setAttribute('d', `M${target} 0 C${target} ${linkHeight * 0.55} ${x} ${linkHeight * 0.45} ${x} ${linkHeight}`);
                link.setAttribute('class', 'rc-print-link' + (forced ? ' is-forced' : '') + (page === current ? ' is-current' : ''));
                links.appendChild(link);

                const button = document.createElement('button');
                button.type = 'button';
                // 小圓點：同頁多張時顯示張數，頁碼放在滑鼠提示中。
                button.className = 'rc-print-jump' + (times.length > 1 ? ' has-count' : '') + tone
                    + (page === current ? ' is-current' : '');
                button.textContent = times.length > 1 ? String(times.length) : '';
                button.title = `第 ${page} 頁・選印 ${times.length} 張` + (forced ? `（強制 ${forced}）` : '');
                button.setAttribute('aria-label', button.title);
                button.style.left = `${x}px`;
                button.addEventListener('mouseenter', () => link.classList.add('is-hot'));
                button.addEventListener('mouseleave', () => link.classList.remove('is-hot'));
                button.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    jumpToPage(range, page);
                });
                strip.appendChild(button);
            }
        }
    }
    let printBarPending = false;
    function schedulePrintBars() {
        if (printBarPending) return;
        printBarPending = true;
        requestAnimationFrame(() => { printBarPending = false; decoratePrintBars(); });
    }
    // 拉條或其父層尺寸改變（例如由隱藏變為顯示）時不一定有節點增減，另以 ResizeObserver 觸發重畫。
    const printRangeResize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedulePrintBars) : null;
    const watchedPrintRanges = new WeakSet();
    function watchPrintRange(range) {
        if (!printRangeResize || watchedPrintRanges.has(range)) return;
        watchedPrintRanges.add(range);
        printRangeResize.observe(range);
        if (range.parentElement) printRangeResize.observe(range.parentElement);
    }
    new MutationObserver(schedulePrintBars).observe(document.body, { childList: true, subtree: true });
    // 排除或取消排除只改心電圖選印圖示的 class，沒有節點增減；圖示變色時也重畫圓點。
    new MutationObserver(records => {
        if (records.some(record => record.target.classList?.contains('tag-label'))) schedulePrintBars();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    window.addEventListener('resize', schedulePrintBars);

    // ── 快速選印 ──────────────────────────────────────────
    // V / S 事件清單：「快速選印」依規則補足選印張數（使用者選印與橘色強制選印都計入）；
    // 「選印 N 張」開啟選印清單，逐張檢視前後 30 秒心電圖，可取消選印或換一張。
    // 規則：把紀錄時間均分成目標張數的時段，每段選排序最前的一張；各張相隔至少 1 分鐘。
    const QUICK_FEW = count => count > 300 ? 4 : 3;
    const QUICK_PRINT_TYPES = {
        V_isolated: { kind: 'isolated', beat: 'V', name: 'VEB Isolated', target: () => 8 },
        couplets: { kind: 'average', beat: 'V', beats: 2, name: 'VEB Couplet', target: QUICK_FEW },
        triplets: { kind: 'average', beat: 'V', beats: 3, name: 'VEB Triplet', target: QUICK_FEW },
        bigemini: { kind: 'pattern', beat: 'V', name: 'VEB Bigeminy', every: 2, target: QUICK_FEW, spread: false },
        trigemini: { kind: 'pattern', beat: 'V', name: 'VEB Trigeminy', every: 3, target: QUICK_FEW, spread: false },
        vt: { kind: 'run', beat: 'V', name: 'VT', target: () => 6 },
        S_isolated: { kind: 'isolated', beat: 'S', name: 'SVEB Isolated', target: () => 8 },
        sveb2s: { kind: 'average', beat: 'S', beats: 2, name: 'SVEB Couplet', target: QUICK_FEW },
        sveb3s: { kind: 'average', beat: 'S', beats: 3, name: 'SVEB Triplet', target: QUICK_FEW },
        S_bigemini: { kind: 'pattern', beat: 'S', name: 'SVEB Bigeminy', every: 2, target: QUICK_FEW, spread: false },
        S_trigemini: { kind: 'pattern', beat: 'S', name: 'SVEB Trigeminy', every: 3, target: QUICK_FEW, spread: false },
        sve: { kind: 'run', beat: 'S', name: 'SVE run', target: QUICK_FEW },
        psvt: { kind: 'run', beat: 'S', name: 'SVT', target: () => 6 },
    };
    // 只提供選印清單（檢視、取消選印），沒有快速選印、換一個、加選與 Group 的清單。
    // tag：Event Tag 清單的項目為 { tagTime, dataTime }，以網站的 openEventTagDialog 開啟心電圖。
    const REVIEW_ONLY_TYPES = {
        pause: { reviewOnly: true, name: 'Pause' },
        pause23: { reviewOnly: true, name: 'Pause 2-3 sec' },
        pause34: { reviewOnly: true, name: 'Pause 3-4 sec' },
        pause45: { reviewOnly: true, name: 'Pause 4-5 sec' },
        pause5: { reviewOnly: true, name: 'Pause ≥5 sec' },
        tags: { reviewOnly: true, tag: true, name: 'Event Tag' },
    };
    // 只在「所有選印清單」中出現的清單（各清單本身維持網站原本的操作）。
    // fixed：報告固定印出的心電圖（Min／Max HR、Max HR Sinus、Longest R-R），不是選印，只能檢視與修改標籤；
    // 回傳該張的時間（沒有時為 0）與卡片說明。
    const ALL_PRINT_ONLY_TYPES = {
        minHR: { reviewOnly: true, name: 'Min. HR', fixed: af => af.record?.minHR?.time,
            info: af => `${af.record?.minHR?.record ?? '--'} bpm` },
        maxHR: { reviewOnly: true, name: 'Max. HR', fixed: af => af.record?.maxHR?.time,
            info: af => `${af.record?.maxHR?.record ?? '--'} bpm` },
        maxSinus: { reviewOnly: true, name: 'Max. HR Sinus', fixed: af => af.record?.maxSinusHR?.time,
            info: af => `${af.record?.maxSinusHR?.record ?? '--'} bpm` },
        rr: { reviewOnly: true, name: 'Longest R-R', fixed: af => af.record?.longestRR?.[0],
            info: af => `${af.record?.longestRRSec ?? '--'} secs` },
        tachy: { reviewOnly: true, recordTimes: true, name: 'Tachycardia' },
        brady: { reviewOnly: true, recordTimes: true, name: 'Bradycardia' },
    };
    // 所有選印清單的分頁順序（與報告相同，Min／Max HR、Longest R-R 在前）；Pause 2-3 sec 等子清單與 Pause 共用選印，只列 Pause。
    const ALL_PRINT_LIST_TYPES = ['minHR', 'maxHR', 'maxSinus', 'rr', 'V_isolated', 'couplets', 'triplets', 'bigemini', 'trigemini', 'vt',
        'S_isolated', 'sveb2s', 'sveb3s', 'S_bigemini', 'S_trigemini', 'sve', 'psvt', 'pause', 'tags', 'tachy', 'brady'];
    // 主畫面的 AF scope（有 selectPrintedEvent、openDialog 等網站函式的那一層）。
    function getPrintHost() {
        const element = document.querySelector('[ng-controller="RootiCareDashboardAFCtrl"]');
        if (!element || !window.angular) return null;
        let scope;
        try { scope = window.angular.element(element).scope(); } catch (_) { return null; }
        while (scope && (typeof scope.selectPrintedEvent !== 'function' || !scope.af)) scope = scope.$parent;
        return scope || null;
    }
    // 不經過事件清單、直接以清單類型建立的 ctx（detached），供所有選印清單使用。
    function getListContext(type) {
        const host = getPrintHost();
        const af = host?.af;
        const dialog = af?.eventDialog;
        const config = QUICK_PRINT_TYPES[type] || REVIEW_ONLY_TYPES[type] || ALL_PRINT_ONLY_TYPES[type];
        const key = dialog?.[type]?.printedEventType;
        if (!config || (!key && !config.fixed) || !af.printDialog?.selectedEvents) return null;
        const sectionHost = typeof host.selectSectionEvent === 'function' ? host : null;
        return { af, host, sectionHost, dialog, type, config, key, detached: true };
    }
    // 各清單目前的選印張數（綠色、藍色、橘色強制選印合計）。
    function getAllPrintCounts() {
        const counts = new Map();
        for (const type of ALL_PRINT_LIST_TYPES) {
            const ctx = getListContext(type);
            if (ctx) counts.set(type, getQuickPrinted(ctx).all.length);
        }
        return counts;
    }
    const QUICK_MIN_GAP = 60; // 選印心電圖之間至少相隔（秒）
    const QUICK_REJECT_NEAR = 30; // 淘汰過的心電圖前後這麼多秒內不再選（秒）
    const QUICK_S_VARIABILITY = 0.12; // Isolated S 的變動率需超過此值
    const QUICK_SECTION_TYPES = ['sve', 'psvt']; // 這些清單的長事件改用藍色選印
    const QUICK_SECTION_SECONDS = 30; // 事件超過此秒數時改用藍色選印
    const QUICK_RUN_GAP = 1.2; // 連發相鄰早搏的最大間隔（秒）
    const QUICK_EVENT_AFTER = 6; // 事件心電圖涵蓋事件時間後 6 秒（顯示起點前 4 秒）
    const QUICK_FETCH_CONCURRENCY = 6;

    function lowerBound(values, value) {
        let low = 0, high = values.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (values[middle] < value) low = middle + 1; else high = middle;
        }
        return low;
    }
    // 每分鐘平均心率：points 為 [{ time, data }]（網站心率趨勢圖的 avgHR），回傳以時間查詢的函式。
    function makeMinuteHR(points) {
        const sorted = points.map(point => ({ time: Number(point?.time), hr: Number(point?.data) }))
            .filter(point => Number.isFinite(point.time) && point.hr > 0).sort((a, b) => a.time - b.time);
        const times = sorted.map(point => point.time);
        return time => {
            const index = lowerBound(times, time + 1) - 1;
            return index >= 0 && time - times[index] < 60 ? sorted[index].hr : 0;
        };
    }
    // 事件的第一顆早搏：事件時間（到秒）起、事件心電圖範圍內的第一顆；找不到回傳 -1。
    function findEventBeat(list, time) {
        const index = lowerBound(list.times, time);
        return index < list.times.length && list.times[index] - time <= QUICK_EVENT_AFTER ? index : -1;
    }
    // 連發：自錨點起相鄰間隔不超過 QUICK_RUN_GAP 的早搏位置；maxBeats 限制 Couplet／Triplet 的心搏數。
    function runFrom(list, anchor, sampleRate, maxBeats = Infinity) {
        const gap = QUICK_RUN_GAP * sampleRate;
        let last = anchor;
        while (last + 1 < list.positions.length && last - anchor + 1 < maxBeats
            && list.positions[last + 1] - list.positions[last] <= gap) last++;
        return list.positions.slice(anchor, last + 1);
    }
    // 二聯律／三聯律：早搏間隔與第一個間隔相差 30% 內（且不超過 4 秒）視為同一段，回傳早搏數。
    function patternFrom(list, anchor, sampleRate) {
        const positions = list.positions;
        if (anchor + 1 >= positions.length) return 1;
        const first = positions[anchor + 1] - positions[anchor];
        if (!(first > 0) || first > 4 * sampleRate) return 1;
        let count = 1;
        for (let i = anchor; i + 1 < positions.length; i++) {
            const gap = positions[i + 1] - positions[i];
            if (gap < first * 0.7 || gap > first * 1.3) break;
            count++;
        }
        return count;
    }
    function averageBPM(intervals, sampleRate) {
        const rates = intervals.filter(rr => rr > 0).map(rr => 60 * sampleRate / rr);
        return rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
    }
    // 排序：score 逐項由大到小，相同時較早的在前。
    function compareQuickScore(a, b) {
        for (let i = 0; i < Math.max(a.score.length, b.score.length); i++) {
            const diff = (b.score[i] || 0) - (a.score[i] || 0);
            if (diff) return diff;
        }
        return a.time - b.time;
    }
    // 分段的位置：place 為清單事件依時間排序的名次比例（0～1），各段事件數相同，與頁碼拉條的位置一致；
    // 沒有 place 時依紀錄時間 [start, end] 換算。
    function makeRankPlace(times) {
        const sorted = [...new Set(times)].sort((a, b) => a - b);
        return { count: sorted.length, position: time => sorted.length ? lowerBound(sorted, time) / sorted.length : 0 };
    }
    // 均分選印：依位置切成 target 段，已選印的佔掉所在段，依排序在空的段各選一張；
    // 且與其他選印至少相隔半段，避免兩張落在相鄰兩段的交界而擠在一起。
    // 張數不足時段數再對半細分（2 倍、4 倍…）重複同樣的選法，細分到每段不到一個事件（或比 minGap 短）仍不足時，
    // 才從全部依排序補足。所有選印相隔至少 minGap 秒。
    // 分數全為 0（找不到早搏或沒有心率資料）的只在最後補足時使用。
    // spread 為 false（Bigeminy／Trigeminy）時不分段，直接依排序選（仍相隔 minGap 秒）。
    function pickQuickPrints({ candidates, existing, target, start, end, place = null, minGap = QUICK_MIN_GAP,
        need = target - existing.length, spread = true }) {
        if (need <= 0 || target <= 0) return [];
        const span = Math.max(1, end - start);
        const position = place ? place.position : time => (time - start) / span;
        const taken = [...existing];
        const ok = time => taken.every(other => Math.abs(other - time) >= minGap);
        const ranked = [...candidates].sort(compareQuickScore);
        const chosen = [];
        for (let bins = target; spread && chosen.length < need; bins *= 2) {
            const bin = time => Math.min(bins - 1, Math.max(0, Math.floor(position(time) * bins)));
            const apart = time => taken.every(other => Math.abs(position(other) - position(time)) >= 0.5 / bins);
            const occupied = new Set(taken.map(bin));
            for (const { time, score } of ranked) {
                if (chosen.length >= need) break;
                if (!score.some(value => value > 0)) continue;
                if (chosen.includes(time) || occupied.has(bin(time)) || !ok(time) || !apart(time)) continue;
                chosen.push(time); taken.push(time); occupied.add(bin(time));
            }
            if (place ? bins >= place.count : span / bins <= minGap) break;
        }
        for (const { time } of ranked) {
            if (chosen.length >= need) break;
            if (!chosen.includes(time) && ok(time)) { chosen.push(time); taken.push(time); }
        }
        return chosen;
    }
    // 換一張：優先在被換掉那張的時段內選排序最前的，沒有時依均分規則選一張；不分時段時直接依排序選。
    function pickQuickReplacement({ candidates, existing, removed, target, start, end, place = null, minGap = QUICK_MIN_GAP, spread = true }) {
        const span = Math.max(1, end - start);
        const position = place ? place.position : time => (time - start) / span;
        const bin = time => Math.min(target - 1, Math.max(0, Math.floor(position(time) * target)));
        const ok = time => existing.every(other => Math.abs(other - time) >= minGap);
        const pool = candidates.filter(({ time }) => time !== removed);
        if (!spread) return pickQuickPrints({ candidates: pool, existing, target, start, end, place, minGap, need: 1, spread })[0] ?? null;
        const same = [...pool].sort(compareQuickScore)
            .find(({ time, score }) => score.some(value => value > 0) && bin(time) === bin(removed) && ok(time));
        if (same) return same.time;
        return pickQuickPrints({ candidates: pool, existing, target, start, end, place, minGap, need: 1 })[0] ?? null;
    }

    // 目前清單的網站資料；不是支援的清單時回傳 null。review 為 true 時也接受只有選印清單的清單（REVIEW_ONLY_TYPES）。
    function getQuickContext(element, review = false) {
        if (!window.angular || !element) return null;
        let scope;
        try { scope = window.angular.element(element).scope(); } catch (_) { return null; }
        let host = scope;
        while (host && typeof host.selectPrintedEvent !== 'function') host = host.$parent;
        let sectionHost = scope;
        while (sectionHost && typeof sectionHost.selectSectionEvent !== 'function') sectionHost = sectionHost.$parent;
        let owner = scope;
        while (owner && !owner.af) owner = owner.$parent;
        const af = owner?.af;
        const dialog = af?.eventDialog;
        const type = dialog?.dscp?.type;
        const config = QUICK_PRINT_TYPES[type] || (review ? REVIEW_ONLY_TYPES[type] : null);
        const key = dialog?.dscp?.printedEventType;
        if (!config || !host || !key || !af.printDialog?.selectedEvents) return null;
        return { af, host, sectionHost, dialog, type, config, key };
    }
    // 報告固定印出的那一張（ALL_PRINT_ONLY_TYPES 的 fixed）；沒有時為空。
    function getFixedTimes(ctx) {
        const time = toEventTime(ctx.config.fixed(ctx.af));
        return time > 0 ? [time] : [];
    }
    function getQuickTimes(ctx) {
        if (ctx.config.fixed) return getFixedTimes(ctx);
        const source = ctx.dialog[ctx.type];
        let values = Array.isArray(source?.data) ? source.data.flat() : [];
        // Tachy／Brady 的清單資料在開啟清單時才由 record[type].tms 建立；沒開過時直接讀紀錄。
        if (!values.length && ctx.config.recordTimes) values = Array.isArray(ctx.af.record?.[ctx.type]?.tms) ? ctx.af.record[ctx.type].tms : [];
        return [...new Set(values.map(toEventTime).filter(time => time !== null))];
    }
    // 網站目前的事件清單狀態（dscp、currentData、section）是否就是這個 ctx 的清單。
    // 所有選印清單（ctx.detached）可能在沒開清單或開著其他清單時操作，這時不能用那些狀態。
    const isListCurrent = ctx => !ctx.detached || ctx.dialog.dscp?.type === ctx.type;
    const listCurrentData = ctx => isListCurrent(ctx) && Array.isArray(ctx.dialog.currentData) ? ctx.dialog.currentData : [];
    // 清單中已選印（使用者綠色、藍色區段選印）與強制選印（橘色）的時間。
    function getQuickPrinted(ctx, times = getQuickTimes(ctx)) {
        // 報告固定印出的：一律印出，與橘色強制選印一樣無法取消或替換。
        if (ctx.config.fixed) {
            const fixed = getFixedTimes(ctx);
            return { selected: new Set(), section: new Set(), forced: new Set(fixed), all: fixed };
        }
        const inList = new Set(times);
        const pick = values => new Set((Array.isArray(values) ? values : []).map(toEventTime)
            .filter(time => time !== null && inList.has(time)));
        const forced = pick(getLiveForcedEvents(ctx.af, ctx.key));
        const selected = pick(ctx.af.printDialog.selectedEvents[ctx.key]);
        const section = pick(getSectionTimes(ctx));
        return { selected, section, forced, all: [...new Set([...selected, ...section, ...forced])].sort((a, b) => a - b) };
    }
    // 藍色選印（區段選印）的事件時間：清單上的勾選（eventDialog.section）與網站保存的區段範圍（eventRecordRange）。
    function getSectionTimes(ctx) {
        const list = isListCurrent(ctx) && Array.isArray(ctx.dialog.section) ? ctx.dialog.section : [];
        const ranges = ctx.af.eventRecordRange?.[ctx.type];
        return [...list, ...(ranges && typeof ranges === 'object' ? Object.keys(ranges) : [])];
    }
    // 目前頁面上被標為 Artifact 等排除的心電圖（未儲存前仍在清單中），不納入快速選印。
    function getQuickExcluded(ctx) {
        const items = listCurrentData(ctx);
        return new Set(items.filter(item => item?.selectedType && item.selectedType !== 'none')
            .map(item => toEventTime(item.startTime)).filter(time => time !== null));
    }
    // 分段依據：清單事件依時間排序的名次（place）；start／end 只在沒有事件時作為後備。
    function getQuickRange(ctx, times) {
        const start = Number(ctx.af.record?.startTimeInt);
        const end = Number(ctx.af.record?.endTimeInt);
        const place = makeRankPlace(times);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) return { start, end, place };
        return { start: Math.min(...times), end: Math.max(...times) + 1, place };
    }
    function getQuickSampleRate(af) {
        return Number(af.ecgChart?.sampleRate) || 250;
    }
    // 早搏時間與位置：tagsRecord 的時間清單會被網站依檢視條件刪減，與位置清單不再一一對應；
    // 優先使用原始紀錄（ogTagsRecord），兩份清單長度一致才採用。
    function getBeatList(af, beat) {
        for (const record of [af.tmsline?.ogTagsRecord, af.tmsline?.tagsRecord]) {
            const times = (beat === 'V' ? record?.tmsPVC : record?.tmsSVEB) || [];
            const positions = (beat === 'V' ? record?.posPVC : record?.posSVEB) || [];
            if (times.length && times.length === positions.length) {
                const pairs = times.map((time, i) => [Number(time), Number(positions[i])]).sort((a, b) => a[1] - b[1]);
                return { times: pairs.map(pair => pair[0]), positions: pairs.map(pair => pair[1]) };
            }
        }
        return { times: [], positions: [] };
    }
    function getMinuteHRPoints(af) {
        const charts = Array.isArray(af.hrChart?.hr) ? af.hrChart.hr : [];
        return charts.flatMap(chart => Array.isArray(chart?.data?.avgHR) ? chart.data.avgHR : []);
    }
    // 早搏前一顆心搏的位置（Couplet／Triplet 第一顆的 RR）；同一份紀錄沿用結果。
    const quickPreviousBeat = new Map();
    async function fetchPreviousBeat(af, position) {
        const key = `${af._measureId}|${position}`;
        if (quickPreviousBeat.has(key)) return quickPreviousBeat.get(key);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        let cursor = position, found = null;
        for (let attempt = 0; attempt < 4 && found === null; attempt++) {
            const response = await manager.Af.getAdjacentFilteredECGLabel(af._vendorId, af._idNumber, af._measureId, cursor, 1);
            const data = response?.plain ? response.plain() : response;
            const entries = Object.entries(data && typeof data === 'object' ? data : {})
                .map(([index, type]) => [Number(index), type])
                .filter(([index]) => Number.isFinite(index) && index < cursor).sort((a, b) => b[0] - a[0]);
            if (!entries.length) break;
            const [index, type] = entries[0];
            if (['N', 'S', 'A', 'V'].includes(type)) found = index; else cursor = index;
        }
        quickPreviousBeat.set(key, found);
        return found;
    }
    async function runLimited(items, limit, worker, onProgress) {
        const results = new Array(items.length);
        let next = 0, done = 0;
        const run = async () => {
            while (next < items.length) {
                const index = next++;
                results[index] = await worker(items[index]);
                done++;
                onProgress?.(done, items.length);
            }
        };
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
        return results;
    }
    // ── 標籤驗證：使用者可能改過標籤，清單資料要儲存並重新分類後才會更新 ──
    const QUICK_RUN_MIN = 4; // VT／SVE run／SVT：至少 4 顆連續早搏（3 顆為 Triplet）
    // 套用未儲存的標籤修改（af.ecgAnno.modifiedData：[時間, 索引, 新標籤, 原標籤, 1]，新標籤空白或 X 為刪除），
    // 回傳 [{ offset, type }]：offset 為相對事件時間的秒數，A 視為 S，只保留 N／S／V 心搏。
    function effectiveEventBeats(data, modifiedData, eventTime) {
        const sampleRate = Number(data.sampleRate) || 250;
        const fromIndex = Number(data.fromIndex) || 0;
        const endIndex = fromIndex + (Array.isArray(data.ecg) ? data.ecg.length : 0);
        const fromTime = Number(data.fromTimestamp);
        const labels = new Map(Object.entries(data.anno || {}).map(([index, type]) => [Number(index), type]));
        for (const item of Array.isArray(modifiedData) ? modifiedData : []) {
            const index = Number(item?.[1]);
            if (item?.[4] && index >= fromIndex && index <= endIndex) labels.set(index, item[2]);
        }
        return [...labels].filter(([index, type]) => Number.isFinite(index) && ['N', 'S', 'A', 'V'].includes(type))
            .sort((a, b) => a[0] - b[0])
            .map(([index, type]) => ({ offset: fromTime + (index - fromIndex) / sampleRate - eventTime, type: type === 'A' ? 'S' : type }));
    }
    // 依清單類型檢查事件時間附近（-1～+2 秒）的早搏是否仍符合：
    // Isolated 單顆；Couplet／Triplet 剛好 2／3 顆連續；VT／SVE run／SVT 至少 4 顆連續；
    // Bigeminy／Trigeminy 為單顆早搏，與前或後一顆早搏之間剛好隔 1／2 顆正常心搏。
    // Bigeminy／Trigeminy 一輪可能比 3 秒長（心率慢時），事件時間會落在兩顆早搏之間的正常心搏上，
    // 因此前後各放寬到一整輪（every × 中位 RR），並由離事件時間最近的早搏開始檢查。
    function checkEventPattern(beats, config) {
        const ectopic = config.beat;
        const isEctopic = index => beats[index]?.type === ectopic;
        let before = 1, after = 2;
        if (config.kind === 'pattern') {
            const cycle = (config.every || 2) * median(beats.slice(1).map((beat, i) => beat.offset - beats[i].offset));
            if (cycle > 0) { before = Math.max(before, cycle); after = Math.max(after, cycle); }
        }
        const anchors = beats.map((_, i) => i).filter(i => isEctopic(i) && beats[i].offset >= -before && beats[i].offset <= after)
            .sort((a, b) => Math.abs(beats[a].offset) - Math.abs(beats[b].offset));
        if (!anchors.length) return { ok: false, reason: `事件時間附近沒有 ${ectopic} 標籤` };
        let found = 0;
        let variabilityReason = null;
        for (const anchor of anchors) {
            let first = anchor, last = anchor;
            while (first > 0 && isEctopic(first - 1)) first--;
            while (last < beats.length - 1 && isEctopic(last + 1)) last++;
            const length = last - first + 1;
            found = Math.max(found, length);
            // Isolated S：變動率需超過 12%，與「ECG 變動率自動標註器」相同算法：
            // （前一個間隔 − 進入這顆 S 的間隔）/ 進入這顆 S 的間隔，保留正負號。
            if (config.kind === 'isolated' && length === 1 && ectopic === 'S') {
                const before = beats[anchor - 1], earlier = beats[anchor - 2];
                const previousRR = before && earlier ? before.offset - earlier.offset : NaN;
                const rr = before ? beats[anchor].offset - before.offset : NaN;
                const rate = (previousRR - rr) / rr;
                if (!(previousRR > 0) || !(rr > 0)) { variabilityReason = 'S 前心搏不足，無法計算變動率'; continue; }
                if (!(rate > QUICK_S_VARIABILITY)) {
                    variabilityReason = `變動率 ${(rate * 100).toFixed(1)}%，未超過 ${QUICK_S_VARIABILITY * 100}%`;
                    continue;
                }
            }
            // Isolated S：前兩顆依序是 V、N（V → N → S）時仍符合，但標為次要，候選不足時才選。
            if (config.kind === 'isolated' && length === 1) {
                return { ok: true, lowPriority: ectopic === 'S' && beats[anchor - 1]?.type === 'N' && beats[anchor - 2]?.type === 'V' };
            }
            if (config.kind === 'average' && length === config.beats) return { ok: true };
            if (config.kind === 'run' && length >= QUICK_RUN_MIN) return { ok: true };
            if (config.kind === 'pattern' && length === 1) {
                const gap = config.every - 1;
                let next = last + 1;
                while (next < beats.length && !isEctopic(next)) next++;
                let previous = first - 1;
                while (previous >= 0 && !isEctopic(previous)) previous--;
                const afterOk = next < beats.length && next - last - 1 === gap && !isEctopic(next + 1);
                const beforeOk = previous >= 0 && first - previous - 1 === gap && !isEctopic(previous - 1);
                if (afterOk || beforeOk) return { ok: true };
            }
        }
        if (variabilityReason) return { ok: false, reason: `標籤已不符合 ${config.name}（${variabilityReason}）` };
        const expected = { isolated: `單顆 ${ectopic}`, average: `${config.beats} 顆連續 ${ectopic}`,
            run: `${QUICK_RUN_MIN} 顆以上連續 ${ectopic}`, pattern: `${ectopic} 之間隔 ${(config.every || 2) - 1} 顆正常心搏` }[config.kind];
        return { ok: false, reason: `標籤已不符合 ${config.name}（需${expected}，目前 ${found} 顆連續 ${ectopic}）` };
    }
    // 讀取事件心電圖（事件時間前 4 秒至後 6 秒）並驗證；讀取失敗時視為不符合，不選這張。
    async function validateQuickTime(ctx, time) {
        try {
            const data = await fetchEventECG(ctx.af, time, THUMB_BEFORE, THUMB_AFTER);
            return checkEventPattern(effectiveEventBeats(data, ctx.af.ecgAnno?.modifiedData, time), ctx.config);
        } catch (error) {
            return { ok: false, reason: `心電圖讀取失敗：${error?.message || error?.status || error}` };
        }
    }
    // 依 pick(pool, existing, need) 選出後逐張驗證，不符合的剔除再選，直到選滿或沒有候選。
    // 驗證標為次要的（Isolated S 的 V → N → S）先保留，其他候選都用完仍不足時，才依原本選出的順序補上。
    async function pickValidated(ctx, candidates, existing, need, pick, onProgress) {
        let pool = [...candidates];
        const valid = [];
        const skipped = [];
        const lowPriority = [];
        while (valid.length < need) {
            const picks = pick(pool, [...existing, ...valid], need - valid.length);
            if (!picks.length) break;
            onProgress?.(valid.length + skipped.length + lowPriority.length, picks.length);
            const results = await runLimited(picks, 4, time => validateQuickTime(ctx, time));
            picks.forEach((time, i) => (!results[i].ok ? skipped : results[i].lowPriority ? lowPriority : valid).push(time));
            const used = new Set([...valid, ...skipped, ...lowPriority]);
            pool = pool.filter(candidate => !used.has(candidate.time));
        }
        let usedLow = 0;
        for (const time of lowPriority) {
            if (valid.length >= need) break;
            if ([...existing, ...valid].every(other => Math.abs(other - time) >= QUICK_MIN_GAP)) { valid.push(time); usedLow++; }
        }
        return { valid, skipped, lowPriority: usedLow };
    }

    // 網站的事件統計（eventTypeStat）：[秒數, 最快 HR, 平均 HR, 最慢 HR, 心搏數]；事件清單卡片顯示的 beats 即第 5 項。
    function getEventStat(af, type, time) {
        const row = af.eventTypeStat?.[type]?.[time];
        if (!Array.isArray(row) || row.length < 5) return null;
        const beats = Number(row[4]);
        const avgHR = Number(row[2]);
        const seconds = Number(row[0]);
        return { beats: beats > 0 ? beats : null, avgHR: avgHR > 0 ? avgHR : null, seconds: seconds > 0 ? seconds : null };
    }
    // SVE run／SVT 事件超過 30 秒時，改用藍色選印（區段選印）。
    function needsSectionPrint(af, type, time) {
        if (!QUICK_SECTION_TYPES.includes(type)) return false;
        return (getEventStat(af, type, time)?.seconds ?? 0) > QUICK_SECTION_SECONDS;
    }
    // 每張心電圖的排序依據與說明：
    // Isolated：該分鐘平均心率；Couplet／Triplet：各心搏 BPM 平均；
    // VT／SVT／SVE run：心搏數多者優先，其次平均 BPM；Bigeminy／Trigeminy：早搏數多者優先，其次該分鐘平均心率。
    async function computeQuickScores(ctx, times, onProgress) {
        const { af, config } = ctx;
        const sampleRate = getQuickSampleRate(af);
        const minuteHR = makeMinuteHR(getMinuteHRPoints(af));
        if (config.kind === 'isolated') {
            return times.map(time => {
                const hr = minuteHR(time);
                return { time, score: [hr], info: hr ? `該分鐘平均 ${hr} bpm` : '無心率資料' };
            });
        }
        const list = getBeatList(af, config.beat);
        if (config.kind !== 'average') {
            return times.map(time => {
                const anchor = findEventBeat(list, time);
                const stat = getEventStat(af, ctx.type, time);
                if (anchor < 0 && !stat?.beats) return { time, score: [0, 0], info: '找不到早搏' };
                if (config.kind === 'pattern') {
                    const count = stat?.beats ?? patternFrom(list, anchor, sampleRate);
                    const hr = minuteHR(time);
                    return { time, score: [count, hr], info: `${count} beats` + (hr ? `・該分鐘平均 ${hr} bpm` : '') };
                }
                const beats = anchor >= 0 ? runFrom(list, anchor, sampleRate) : [];
                const count = stat?.beats ?? beats.length;
                const bpm = stat?.avgHR ?? averageBPM(beats.slice(1).map((pos, i) => pos - beats[i]), sampleRate);
                return { time, score: [count, bpm], info: `${count} beats` + (bpm ? `・平均 ${Math.round(bpm)} bpm` : '') };
            });
        }
        return runLimited(times, QUICK_FETCH_CONCURRENCY, async time => {
            const anchor = findEventBeat(list, time);
            if (anchor < 0) return { time, score: [0], info: '找不到早搏' };
            const beats = runFrom(list, anchor, sampleRate, config.beats);
            const intervals = beats.slice(1).map((pos, i) => pos - beats[i]);
            let previous = null;
            try { previous = await fetchPreviousBeat(af, beats[0]); } catch (_) {}
            if (previous !== null) intervals.unshift(beats[0] - previous);
            const bpm = averageBPM(intervals, sampleRate);
            return { time, score: [bpm], info: bpm ? `平均 ${Math.round(bpm)} bpm` : '無法計算 BPM' };
        }, onProgress);
    }
    // 透過網站的選印函式加入／移除（與點擊印表機圖示相同），並同步目前頁面的勾選狀態。
    // 網站只改記憶體中的選印，關閉事件清單時才上傳（postPDFSelectedEvents）；Group 前需先上傳。
    // SVE run／SVT 超過 30 秒的改用藍色選印（與勾選藍色印表機相同，網站會一併取消綠色選印）；
    // 取消時依目前是哪一種選印移除。回傳是否為藍色選印。
    function setQuickPrint(ctx, time, on) {
        // 以 toEventTime 比對，Event Tag 的項目（dataTime／tagTime）也能同步勾選狀態。
        const items = listCurrentData(ctx).filter(item => item && toEventTime(item) === time);
        const inSection = getSectionTimes(ctx).some(value => toEventTime(value) === time);
        const section = !!ctx.sectionHost && (on ? needsSectionPrint(ctx.af, ctx.type, time) : inSection);
        if (ctx.detached) scheduleDetachedUpload(ctx.af);
        ctx.host.$apply(() => withListScope(ctx, () => {
            if (section) {
                const target = items[0] || { startTime: time };
                target.isPrintSection = on;
                ctx.sectionHost.selectSectionEvent(target);
                if (!on && ctx.af.eventRecordRange?.[ctx.type]) delete ctx.af.eventRecordRange[ctx.type][time];
                for (const item of items) { item.isPrintSection = on; item.selectedEvent = false; }
                return;
            }
            ctx.host.selectPrintedEvent({ startTime: time, selectedEvent: on });
            for (const item of items) item.selectedEvent = on;
        }));
        return section;
    }
    // 網站的 selectPrintedEvent／selectSectionEvent 依 eventDialog.dscp（目前開著的清單）決定寫到哪個選印欄位。
    // 所有選印清單操作其他清單的選印時，暫時把 dscp 與 section 換成該清單的，執行完立即還原。
    function withListScope(ctx, action) {
        if (isListCurrent(ctx)) return action();
        const dialog = ctx.dialog;
        if (!dialog.dscp) dialog.dscp = {};
        const dscp = dialog.dscp;
        const saved = { hasType: 'type' in dscp, type: dscp.type, hasKey: 'printedEventType' in dscp, key: dscp.printedEventType,
            hasSection: 'section' in dialog, section: dialog.section };
        dscp.type = ctx.type;
        dscp.printedEventType = ctx.key;
        dialog.section = getSectionTimes(ctx).map(Number);
        try {
            return action();
        } finally {
            if (saved.hasType) dscp.type = saved.type; else delete dscp.type;
            if (saved.hasKey) dscp.printedEventType = saved.key; else delete dscp.printedEventType;
            if (saved.hasSection) dialog.section = saved.section; else delete dialog.section;
        }
    }
    // 網站在關閉事件清單時才上傳選印；所有選印清單沒有經過事件清單，改動後稍等一下自行上傳（關閉選印清單時立即上傳）。
    // 事件清單開著時交給網站關閉清單時上傳，避免與清單中的操作交錯。
    let detachedUploadTimer = null;
    let detachedUploadAF = null;
    function scheduleDetachedUpload(af) {
        detachedUploadAF = af;
        clearTimeout(detachedUploadTimer);
        detachedUploadTimer = setTimeout(flushDetachedUpload, 1500);
    }
    async function flushDetachedUpload() {
        clearTimeout(detachedUploadTimer);
        detachedUploadTimer = null;
        const af = detachedUploadAF;
        if (!af) return;
        if (document.querySelector('.ngdialog.event-dialog')) { detachedUploadTimer = setTimeout(flushDetachedUpload, 3000); return; }
        detachedUploadAF = null;
        try {
            await uploadPrintSelections(af);
            await uploadSectionSelections(af);
        } catch (error) {
            quickToast(null, `選印上傳失敗：${error?.message || error?.status || error}`, true);
        }
    }
    // 換掉的心電圖在本次頁面執行期不再被選回。
    const quickRejected = new Map();
    function getQuickRejected(ctx) {
        const key = `${ctx.af._measureId}|${ctx.type}`;
        if (!quickRejected.has(key)) quickRejected.set(key, new Set());
        return quickRejected.get(key);
    }
    // 使用者取消的選印：清單開著時比對前後的選印（綠色與藍色），消失但心電圖仍在同一清單中的，
    // 不論是在網站上點印表機圖示、選印清單的「取消選印」或其他方式取消，都記為淘汰。
    // 心電圖已不在清單中的（Group 後重新分類到其他子項目、S↔V 改標後重新分類、不在清單中的選印被自動取消）不算。
    // 使用者之後又自己選印回來的，從淘汰中移除。只保留到重新整理頁面。
    const quickPrintSnapshots = new Map();
    function trackCancelledPrints(ctx) {
        if (!ctx || ctx.config.reviewOnly) return;
        const key = `${ctx.af._measureId}|${ctx.type}`;
        const times = getQuickTimes(ctx);
        const inList = new Set(times);
        const { selected, section } = getQuickPrinted(ctx, times);
        const current = new Set([...selected, ...section]);
        const previous = quickPrintSnapshots.get(key);
        quickPrintSnapshots.set(key, current);
        if (!previous) return;
        const rejected = getQuickRejected(ctx);
        for (const time of previous) if (!current.has(time) && inList.has(time)) rejected.add(time);
        for (const time of current) if (!previous.has(time)) rejected.delete(time);
    }
    // candidates：一般候選；fallback：候選不足時才用，依序為與淘汰過的相隔 30 秒內的、淘汰過的本身。
    async function getQuickCandidates(ctx, onProgress) {
        const times = getQuickTimes(ctx);
        const printed = new Set(getQuickPrinted(ctx, times).all);
        const excluded = getQuickExcluded(ctx);
        // 淘汰過的（換掉或取消選印的）不再選回，與它相隔 30 秒內的也不選（同一段心律，畫面幾乎相同）。
        const rejectedSet = getQuickRejected(ctx);
        const rejected = [...rejectedSet];
        const nearRejected = time => rejected.some(other => Math.abs(other - time) <= QUICK_REJECT_NEAR);
        const open = times.filter(time => !printed.has(time) && !excluded.has(time));
        const pool = open.filter(time => !nearRejected(time));
        const fallback = [open.filter(time => nearRejected(time) && !rejectedSet.has(time)), open.filter(time => rejectedSet.has(time))];
        return { times, candidates: await computeQuickScores(ctx, pool, onProgress), fallback };
    }

    const quickState = { busy: false, progress: '' };
    const quickStyle = document.createElement('style');
    quickStyle.textContent = `
        .rc-print-actions { position:absolute; left:calc(100% + 10px); top:calc(var(--rc-range-height, 20px) / -2);
            transform:translateY(-50%); display:flex; align-items:center; gap:6px; white-space:nowrap; z-index:1; }
        .rc-print-actions button { height:20px; padding:0 9px; border-radius:10px; font-family:inherit; font-weight:600;
            font-size:11px; line-height:18px; white-space:nowrap; }
        .rc-print-actions button[hidden] { display:none; }
        .rc-print-summary.is-link { cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,.18); }
        .rc-print-summary.is-link:hover { background:#46620f; box-shadow:0 2px 5px rgba(0,0,0,.25); }
        .rc-quick-print { border:1px solid #8fb43a; background:#fff; color:#5b7d1a; cursor:pointer;
            box-shadow:0 1px 2px rgba(0,0,0,.12); transition:background .15s, color .15s; }
        .rc-quick-print:hover:not(:disabled) { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        .rc-quick-print:disabled { cursor:progress; opacity:.75; }
        .rc-quick-toast { position:fixed; z-index:100001; max-width:420px; padding:6px 12px; border-radius:6px;
            background:rgba(40,52,20,.94); color:#fff; font-size:12px; line-height:1.5; pointer-events:none;
            box-shadow:0 3px 10px rgba(0,0,0,.25); transition:opacity .25s; }
        .rc-quick-toast.is-error { background:rgba(150,40,30,.95); }
    `;
    document.head.appendChild(quickStyle);

    let quickToastElement = null;
    function quickToast(anchor, message, isError = false) {
        if (!quickToastElement) {
            quickToastElement = document.createElement('div');
            quickToastElement.className = 'rc-quick-toast';
            document.body.appendChild(quickToastElement);
            // 訊息顯示期間接著點擊或按鍵（例如開啟選印清單）時立即收起，不擋住新開的畫面（例如選印清單的標籤列）。
            // 在 document 的捕獲階段處理，會早於按鈕或快捷鍵的處理函式，同一次操作產生的新訊息不會被收掉；
            // 不設最短顯示時間，否則快速連點時剛出現的訊息要點兩下才收得掉。
            const dismiss = () => {
                const toast = quickToastElement;
                if (toast.style.opacity !== '1') return;
                clearTimeout(toast.rcTimer);
                toast.style.opacity = '0';
            };
            document.addEventListener('pointerdown', dismiss, true);
            document.addEventListener('keydown', dismiss, true);
        }
        const toast = quickToastElement;
        toast.textContent = message;
        toast.classList.toggle('is-error', isError);
        // 預設顯示在按鈕下方；下方空間不夠（例如畫面底部的選印清單）時改在上方，並限制在畫面內。
        const rect = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
        const width = toast.offsetWidth;
        const height = toast.offsetHeight;
        toast.style.left = `${Math.max(8, Math.min((rect?.left ?? 16), window.innerWidth - width - 8))}px`;
        let top = rect ? rect.bottom + 8 : 16;
        if (rect && top + height > window.innerHeight - 8) top = rect.top - height - 8;
        top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
        // 選印清單（畫面底部的面板）開著時，訊息不可蓋到清單（標籤列、心電圖）：改放在按鈕上方，仍會重疊時放在清單上緣之上。
        const bar = review?.bar?.isConnected && !(anchor && review.bar.contains(anchor)) ? review.bar.getBoundingClientRect() : null;
        if (bar && bar.height && top + height > bar.top - 4) {
            const above = rect ? rect.top - height - 8 : -1;
            top = above >= 8 && above + height <= bar.top - 4 ? above : Math.max(8, bar.top - height - 8);
        }
        toast.style.top = `${top}px`;
        toast.style.opacity = '1';
        clearTimeout(toast.rcTimer);
        toast.rcTimer = setTimeout(() => { toast.style.opacity = '0'; }, isError ? 5000 : 3500);
    }

    async function runQuickPrint(button) {
        const ctx = getQuickContext(button);
        if (!ctx || quickState.busy) return;
        quickState.busy = true;
        quickState.progress = '';
        schedulePrintBars();
        try {
            const times = getQuickTimes(ctx);
            const printed = getQuickPrinted(ctx, times);
            const existing = printed.all;
            const target = ctx.config.target(times.length);
            // 橘色強制選印同樣檢查：SVE run／SVT 超過 30 秒、還不是藍色選印的，改為藍色選印（強制選印紀錄保留）。
            const forcedLong = ctx.sectionHost ? [...printed.forced]
                .filter(time => !printed.section.has(time) && needsSectionPrint(ctx.af, ctx.type, time)) : [];
            const forcedSectioned = forcedLong.filter(time => setQuickPrint(ctx, time, true)).length;
            const forcedText = forcedSectioned
                ? `強制選印 ${forcedSectioned} 張超過 ${QUICK_SECTION_SECONDS} 秒，已改為藍色選印；` : '';
            if (existing.length >= target) {
                quickToast(button, forcedText + `${ctx.config.name} 已選印 ${existing.length} 張，已達 ${target} 張`);
                if (forcedSectioned) refreshPrintReview();
                return;
            }
            const { candidates, fallback } = await getQuickCandidates(ctx, (done, total) => {
                quickState.progress = `${done}/${total}`;
                schedulePrintBars();
            });
            // 計算期間清單被關閉或切換時放棄。
            if (getQuickContext(button)?.type !== ctx.type) {
                if (forcedSectioned) quickToast(null, forcedText.replace(/；$/, ''));
                return;
            }
            const now = getQuickPrinted(ctx, times).all;
            const range = getQuickRange(ctx, times);
            // 選出後逐張讀取心電圖、套用未儲存的標籤修改，驗證仍符合此清單類型；不符合的換下一張。
            const pickRound = (pool, already) => pickValidated(ctx, pool, [...now, ...already], target - now.length - already.length,
                (list, existing, need) => pickQuickPrints({ candidates: list, existing, target, ...range, need,
                    spread: ctx.config.spread !== false }),
                done => { quickState.progress = `驗證 ${done}`; schedulePrintBars(); });
            const { valid: chosen, skipped, lowPriority } = await pickRound(candidates, []);
            // 一般候選不足時，才依序使用與取消過的相隔 30 秒內的、取消過的本身。
            let reused = 0;
            for (const tier of fallback) {
                if (now.length + chosen.length >= target || !tier.length) continue;
                if (getQuickContext(button)?.type !== ctx.type) return;
                const scored = await computeQuickScores(ctx, tier);
                const extra = await pickRound(scored, chosen);
                chosen.push(...extra.valid);
                skipped.push(...extra.skipped);
                reused += extra.valid.length;
            }
            if (getQuickContext(button)?.type !== ctx.type) return;
            const sectioned = chosen.filter(time => setQuickPrint(ctx, time, true)).length;
            const total = now.length + chosen.length;
            const skippedText = (skipped.length ? `（略過 ${skipped.length} 張標籤已不符合的）` : '')
                + (lowPriority ? `（候選不足，其中 ${lowPriority} 張前兩顆為 V、N）` : '')
                + (reused ? `（候選不足，其中 ${reused} 張為之前取消過的或其前後 30 秒內的）` : '');
            const sectionText = sectioned ? `（其中 ${sectioned} 張超過 ${QUICK_SECTION_SECONDS} 秒，使用藍色選印）` : '';
            quickToast(button, forcedText + (chosen.length
                ? `已快速選印 ${chosen.length} 張，${ctx.config.name} 共 ${total}／${target} 張` + (total < target ? '（符合條件的心電圖不足）' : '') + sectionText + skippedText
                : `沒有符合條件的心電圖可選印（需相隔 1 分鐘以上）` + skippedText), !chosen.length && !forcedSectioned);
            refreshPrintReview();
        } catch (error) {
            quickToast(button, `快速選印失敗：${error?.message || error}`, true);
        } finally {
            quickState.busy = false;
            quickState.progress = '';
            schedulePrintBars();
        }
    }

    // 「選印 N 張」與「快速選印」按鈕；只在支援的清單顯示快速選印，選印清單也只在支援的清單可開啟。
    function updatePrintActions(panel, quick, total, forced) {
        const actions = panel?.querySelector('.rc-print-actions');
        if (!actions) return;
        const summary = actions.querySelector('.rc-print-summary');
        const button = actions.querySelector('.rc-quick-print');
        if (!actions.dataset.rcBound) {
            actions.dataset.rcBound = '1';
            summary.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                if (getQuickContext(summary, true)) openPrintReview(summary);
            });
            button.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                runQuickPrint(button);
            });
        }
        const summaryText = forced ? `選印 ${total} 張（強制 ${forced}）` : `選印 ${total} 張`;
        if (summary.textContent !== summaryText) summary.textContent = summaryText;
        summary.hidden = !total;
        summary.classList.toggle('is-link', !!quick);
        summary.title = !quick ? '' : quick.config.reviewOnly ? '開啟選印清單：逐張檢視心電圖，可修改標籤或取消選印'
            : '開啟選印清單：逐張檢視心電圖，可修改標籤、取消選印或換一張';
        const showQuick = !!quick && !quick.config.reviewOnly;
        button.hidden = !showQuick;
        if (showQuick) {
            const text = quickState.busy ? (quickState.progress ? `計算中 ${quickState.progress}` : '選印中…') : '⚡ 快速選印';
            if (button.textContent !== text) button.textContent = text;
            button.disabled = quickState.busy;
            const target = quick.config.target(getQuickTimes(quick).length);
            button.title = `依規則補足 ${quick.config.name} 選印到 ${target} 張（已選印與橘色強制選印都計入）`;
        }
    }

    // ── 選印清單：上方為網站的心電圖視窗（與點擊心電圖時間相同，可改標籤並 Save），下方為選印縮圖列 ──
    // A／D 切換上一張／下一張選印；Q/E、←/→ 維持原本的移動時間。
    const THUMB_BEFORE = 4; // 縮圖顯示事件心電圖範圍：事件時間前 4 秒
    const THUMB_AFTER = 6; // 至後 6 秒
    let review = null;
    const reviewStyle = document.createElement('style');
    reviewStyle.textContent = `
        .rc-review-bar { position:fixed; left:0; right:0; bottom:0; z-index:100000; display:flex; flex-direction:column;
            overflow:hidden; border-radius:15px 15px 0 0; background:#fff; box-shadow:0 -4px 16px rgba(0,0,0,.28); outline:none; }
        .rc-review-head { display:flex; align-items:center; gap:12px; height:30px; padding:0 10px 0 16px; background:#add149;
            color:#fff; font-weight:600; font-size:13px; white-space:nowrap; }
        .rc-review-title { flex:0 0 auto; }
        .rc-review-hint { flex:1; overflow:hidden; text-overflow:ellipsis; font-weight:400; font-size:11px; opacity:.95; }
        .rc-review-close { width:24px; height:24px; border:0; border-radius:50%; background:transparent; color:#fff;
            font-size:20px; line-height:22px; cursor:pointer; }
        .rc-review-close:hover { background:rgba(255,255,255,.25); }
        .rc-review-add { height:22px; padding:0 10px; border:1px solid #fff; border-radius:11px; background:#fff; color:#5b7d1a;
            font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
        .rc-review-add:hover:not(:disabled) { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        .rc-review-add:disabled { cursor:progress; opacity:.7; }
        .rc-review-strip { position:relative; }
        .rc-review-list { position:relative; display:flex; gap:10px; overflow-x:auto; padding:8px 12px 4px; scroll-behavior:smooth;
            scrollbar-width:auto; scrollbar-color:#8fb43a #eef3e2; }
        .rc-review-list::-webkit-scrollbar { height:12px; }
        .rc-review-list::-webkit-scrollbar-track { background:#eef3e2; border-radius:6px; }
        .rc-review-list::-webkit-scrollbar-thumb { background:#8fb43a; border:2px solid #eef3e2; border-radius:6px; }
        .rc-review-list::-webkit-scrollbar-thumb:hover { background:#5b7d1a; }
        .rc-review-scroll { position:absolute; top:50%; z-index:1; display:none; width:30px; height:56px; margin-top:-34px;
            border:0; background:rgba(91,125,26,.85); color:#fff; font-size:16px; cursor:pointer;
            box-shadow:0 2px 6px rgba(0,0,0,.25); }
        .rc-review-scroll.is-visible { display:block; }
        .rc-review-scroll:hover { background:#46620f; }
        .rc-review-scroll.is-prev { left:0; border-radius:0 8px 8px 0; }
        .rc-review-scroll.is-next { right:0; border-radius:8px 0 0 8px; }
        .rc-review-count { flex:0 0 auto; padding:0 8px; border-radius:9px; background:rgba(255,255,255,.25);
            font-size:12px; line-height:18px; }
        .rc-review-empty { padding:18px; color:#777; }
        .rc-review-card { flex:0 0 auto; width:250px; box-sizing:border-box; padding:4px 6px 6px; border:2px solid #dcdcdc;
            border-radius:6px; background:#fff; cursor:pointer; transition:border-color .12s, box-shadow .12s; }
        .rc-review-card:hover { border-color:#a9c56a; }
        .rc-review-card.is-active { border-color:#5b7d1a; background:#f6faee; box-shadow:0 0 0 2px rgba(91,125,26,.25); }
        .rc-review-card.is-new { animation:rc-review-flash 1.6s ease-out; }
        @keyframes rc-review-flash { from { background:#fff1c9; } }
        .rc-review-card-head { display:flex; align-items:center; gap:6px; font-size:12px; }
        .rc-review-time { color:#1a3fb8; font-weight:600; }
        .rc-review-tag { padding:0 6px; border-radius:8px; background:#d88f3f; color:#fff; font-size:10px; line-height:16px; }
        .rc-review-tag.is-section { background:#2c6aa0; }
        .rc-review-tag.is-both { background:linear-gradient(90deg, #d88f3f 0 50%, #2c6aa0 50% 100%); }
        .rc-review-card.is-both { border-color:#c9b9d9; }
        .rc-review-card.is-section { border-color:#bcd6ee; }
        .rc-review-card.is-section.is-active { border-color:#2c6aa0; background:#f2f7fc; box-shadow:0 0 0 2px rgba(44,106,160,.25); }
        .rc-review-card.is-invalid { border-color:#e3a39b; background:#fff7f6; }
        .rc-review-card.is-invalid.is-active { border-color:#c0392b; box-shadow:0 0 0 2px rgba(192,57,43,.25); }
        .rc-review-warn { overflow:hidden; color:#c0392b; font-size:11px; font-weight:600; white-space:nowrap; text-overflow:ellipsis; }
        .rc-review-info { height:15px; overflow:hidden; color:#666; font-size:11px; white-space:nowrap; text-overflow:ellipsis; }
        .rc-review-thumb { height:64px; color:#999; font-size:11px; line-height:64px; text-align:center; }
        .rc-review-thumb svg { display:block; }
        .rc-review-actions { display:flex; gap:6px; margin-top:4px; }
        .rc-review-btn { flex:1; height:22px; padding:0 8px; border:1px solid #c9c9c9; border-radius:11px; background:#fff;
            color:#444; font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; }
        .rc-review-btn:hover:not(:disabled) { border-color:#5b7d1a; background:#5b7d1a; color:#fff; }
        .rc-review-btn.is-cancel:hover:not(:disabled) { border-color:#c0392b; background:#c0392b; }
        .rc-review-btn.is-cancel { border-color:#f1c4bf; background:#fdf1ef; color:#b03a2e; }
        .rc-review-btn.is-swap { border-color:#bcd6ee; background:#eef5fc; color:#2c6aa0; }
        .rc-review-btn.is-swap:hover:not(:disabled) { border-color:#2c6aa0; background:#2c6aa0; color:#fff; }
        .rc-review-btn:disabled { cursor:not-allowed; opacity:.45; }
        /* 眼睛：縮圖改顯示報告中波形下方 30 秒縮圖的範圍 */
        .rc-review-eye { height:22px; padding:0 8px; border:1px solid #fff; border-radius:11px; background:transparent; color:#fff;
            font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; opacity:.75; }
        .rc-review-eye:hover { opacity:1; }
        .rc-review-eye[aria-pressed="true"] { background:#fff; color:#5b7d1a; opacity:1; }
        .rc-review-bar.is-context .rc-review-card { width:380px; }
        .rc-review-bar.is-review-only :is(.rc-review-add, .rc-review-group, .rc-review-btn.is-swap) { display:none; }
        /* 選印清單開著時，心電圖視窗底部留出清單的高度 */
        body.rc-review-open :is(.ngdialog.ecg-dialog, .ngdialog.section-dialog) { padding-bottom:var(--rc-review-h, 0px) !important; }
        /* 網站的 X 是透明底白字，下半落在白色視窗上、右緣被圓角切掉：選印清單開著時加上綠底並往內移，整顆看得到 */
        /* 標題列只有 20px 高，Save／Discard 與 X（約 6～33px）下半落在白色視窗上看不見：加高到 38px 包住整列按鈕 */
        body.rc-review-open :is(.ngdialog.ecg-dialog, .ngdialog.section-dialog) .content-title-bg { min-height:38px; box-sizing:border-box; }
        body.rc-review-open :is(.ngdialog.ecg-dialog, .ngdialog.section-dialog) .content-title-bg .close-btn {
            background:#add149; margin-right:10px; box-shadow:0 0 0 2px #fff; }
        /* 所有選印清單：清單分頁、沒有 Group */
        .rc-review-bar.is-multi .rc-review-group { display:none; }
        .rc-review-bar.is-multi .rc-review-hint { flex:0 1 auto; min-width:0; }
        .rc-review-bar.is-multi .rc-review-head { height:auto; min-height:30px; }
        .rc-review-tabs { display:flex; flex:1 1 auto; gap:4px; min-width:0; overflow-x:auto; padding:3px 0; scrollbar-width:thin; }
        .rc-review-tab { flex:0 0 auto; height:22px; padding:0 9px; border:1px solid rgba(255,255,255,.7); border-radius:11px;
            background:transparent; color:#fff; font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
        .rc-review-tab:hover { background:rgba(255,255,255,.25); }
        .rc-review-tab.is-current { background:#fff; border-color:#fff; color:#5b7d1a; }
        /* 主畫面 Print Report 左邊的「選印」按鈕（印表機圖示 right:10px＋margin 15px；24 小時心電圖圖示在 right:80px） */
        /* 綠底白圖的圓形按鈕（34px，比 25px 的灰色印表機圖示大），與兩側圖示垂直置中 */
        .rc-all-print { position:absolute; top:0; right:60px; z-index:1; box-sizing:border-box; width:34px; height:34px; margin:10.5px 0;
            padding:0; border:0; border-radius:50%; background:#8fb43a; color:#fff; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 2px 6px rgba(91,125,26,.45); transition:transform .12s, background .12s, box-shadow .12s; }
        .rc-all-print:hover { transform:scale(1.1); background:#5b7d1a; box-shadow:0 3px 10px rgba(91,125,26,.55); }
        .rc-all-print.is-open { background:#5b7d1a; box-shadow:0 0 0 3px rgba(143,180,58,.45); }
        .rc-all-print svg { display:block; pointer-events:none; }
        .rc-all-print-count { position:absolute; top:-6px; right:-7px; min-width:17px; height:17px; box-sizing:border-box; padding:0 4px;
            border:2px solid #fff; border-radius:9px; background:#d88f3f; color:#fff; font-size:10px; font-weight:700; line-height:13px;
            text-align:center; pointer-events:none; }
    `;
    document.head.appendChild(reviewStyle);

    function closePrintReview() {
        if (!review) return;
        if (review.onResize) window.removeEventListener('resize', review.onResize);
        clearTimeout(review.staleTimer);
        clearTimeout(review.syncTimer);
        review.bar.remove();
        document.body.classList.remove('rc-review-open');
        const multi = review.multi;
        const multiAF = review.ctx.af;
        review = null;
        // 關閉時一律上傳（內容沒變就不上傳）：心電圖視窗的 ◀ ▶ 等網站操作改的選印範圍也一併送出。
        if (multi) { detachedUploadAF = multiAF; flushDetachedUpload(); }
        decorateReviewDialog();
        schedulePrintBars();
    }
    // focusTime：開啟後顯示這張選印（仍在清單中時），否則顯示第一張。
    // multi：所有選印清單（主畫面 Print Report 旁的「選印」），ctx 為目前分頁的清單，上方可切換各清單。
    function openPrintReview(anchor, focusTime = null, ctx = getQuickContext(anchor, true), multi = false) {
        if (!ctx) return;
        closePrintReview();
        const bar = document.createElement('div');
        // Pause、Event Tag 只能檢視與取消選印：隱藏加選、Group、換一個。所有選印清單沒有 Group。
        bar.className = 'rc-review-bar' + (ctx.config.reviewOnly ? ' is-review-only' : '') + (multi ? ' is-multi' : '');
        bar.tabIndex = -1;
        bar.innerHTML = '<div class="rc-review-head"><span class="rc-review-title"></span>'
            + (multi ? '<span class="rc-review-tabs"></span>' : '')
            + '<span class="rc-review-count"></span>'
            + '<span class="rc-review-hint"></span>'
            + '<button type="button" class="rc-review-eye" aria-pressed="false" title="縮圖顯示報告中波形下方的 30 秒縮圖範圍（綠色為印出的 8 秒）">👁 列印範圍</button>'
            + '<button type="button" class="rc-review-add" title="依快速選印的規則再多選一張（時段分散、相隔 1 分鐘以上）">＋ 加選一個</button>'
            + '<button type="button" class="rc-review-group" title="儲存標籤修改後執行 Group All，重新分類事件並重整清單">Group</button>'
            + '<button type="button" class="rc-review-close" title="關閉選印清單" aria-label="關閉">×</button></div>'
            + '<div class="rc-review-strip"><button type="button" class="rc-review-scroll is-prev" title="往前捲動" aria-label="往前捲動">◀</button>'
            + '<div class="rc-review-list"></div>'
            + '<button type="button" class="rc-review-scroll is-next" title="往後捲動" aria-label="往後捲動">▶</button></div>';
        review = { bar, ctx, anchor, multi, cards: new Map(), items: [], active: null, switching: false, busy: false,
            staleCards: new Set(), staleTimer: null, labelIndices: null };
        bar.querySelector('.rc-review-close').addEventListener('click', closePrintReview);
        bar.querySelector('.rc-review-add').addEventListener('click', addReviewPrint);
        bar.querySelector('.rc-review-eye').addEventListener('click', () => setReviewContext(!reviewContextOn));
        bar.classList.toggle('is-context', reviewContextOn);
        bar.querySelector('.rc-review-eye').setAttribute('aria-pressed', String(reviewContextOn));
        bar.querySelector('.rc-review-group').addEventListener('click', groupReview);
        // 縮圖超出畫面時：下方捲軸、滑鼠滾輪左右捲動、兩側 ◀ ▶ 一次捲動約一個畫面寬。
        const list = bar.querySelector('.rc-review-list');
        list.addEventListener('wheel', event => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || list.scrollWidth <= list.clientWidth) return;
            event.preventDefault();
            list.scrollLeft += event.deltaY;
        }, { passive: false });
        list.addEventListener('scroll', updateReviewScroll, { passive: true });
        for (const button of bar.querySelectorAll('.rc-review-scroll')) {
            button.addEventListener('click', () => {
                const direction = button.classList.contains('is-prev') ? -1 : 1;
                list.scrollBy({ left: direction * Math.max(200, list.clientWidth * 0.8), behavior: 'smooth' });
            });
        }
        review.onResize = () => { updateReviewScroll(); updateReviewSpace(); };
        window.addEventListener('resize', review.onResize);
        document.body.appendChild(bar);
        document.body.classList.add('rc-review-open');
        updateReviewSpace();
        refreshPrintReview();
        if (review.items.length) showReviewTime(review.items.includes(focusTime) ? focusTime : review.items[0]);
    }
    // 所有選印清單：從第一個有選印的清單開始；都沒有選印時只提示。
    function openAllPrintReview(button) {
        if (review?.multi) { closePrintReview(); return; }
        const counts = getAllPrintCounts();
        if (!counts.size) { quickToast(button, '紀錄尚未載入完成，請稍後再試', true); return; }
        const type = ALL_PRINT_LIST_TYPES.find(name => counts.get(name) > 0);
        if (!type) { quickToast(button, '目前沒有任何選印的心電圖', true); return; }
        openPrintReview(button, null, getListContext(type), true);
    }
    // 切換所有選印清單的分頁；focus 為 'first'、'last' 或要顯示的時間。
    function switchReviewList(type, focus = 'first') {
        if (!review?.multi || review.busy || review.grouping) return;
        const ctx = getListContext(type);
        if (!ctx) return;
        if (review.ctx.type !== type || review.ctx.af !== ctx.af) {
            for (const card of review.cards.values()) card.remove();
            review.cards.clear();
            review.staleCards.clear();
            review.items = [];
            review.active = null;
            review.labelSignature = undefined;
            review.ctx = ctx;
            review.bar.classList.toggle('is-review-only', !!ctx.config.reviewOnly);
            review.bar.querySelector('.rc-review-list').scrollLeft = 0;
        }
        refreshPrintReview();
        if (!review?.items.length) return;
        const time = focus === 'last' ? review.items[review.items.length - 1]
            : review.items.includes(focus) ? focus : review.items[0];
        showReviewTime(time);
    }
    // 依分頁順序往前（-1）或往後（1）找下一個有選印的清單。
    function adjacentReviewList(delta) {
        if (!review?.multi) return null;
        const counts = getAllPrintCounts();
        const index = ALL_PRINT_LIST_TYPES.indexOf(review.ctx.type);
        for (let i = index + delta; i >= 0 && i < ALL_PRINT_LIST_TYPES.length; i += delta) {
            if (counts.get(ALL_PRINT_LIST_TYPES[i]) > 0) return ALL_PRINT_LIST_TYPES[i];
        }
        return null;
    }
    // 主畫面 Print Report（印表機圖示）左邊的「選印」按鈕：開啟所有選印清單，右上角顯示選印總張數。
    // 張數最多每 500 毫秒重算一次。
    const allPrintButtonState = { at: 0, total: null, timer: null };
    function decorateAllPrintButton() {
        const printer = document.querySelector('.print-dialog-bnt.icon-printer');
        let button = document.querySelector('.rc-all-print');
        if (!printer || printer.classList.contains('ng-hide') || !printer.parentElement) { button?.remove(); return; }
        if (!button || button.parentElement !== printer.parentElement) {
            button?.remove();
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'rc-all-print';
            // 圖示：清單（打勾的心電圖列）；比旁邊灰色的 Print Report 圖示大、綠底白圖，較顯眼。
            button.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor"'
                + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                + '<path d="M3.5 6.5l1.5 1.5 2.5-3"/><path d="M3.5 13l1.5 1.5 2.5-3"/><path d="M3.5 19.5l1.5 1.5 2.5-3"/>'
                + '<path d="M10.5 7h2l1-2 1.5 4 1-2h4.5"/><path d="M10.5 13.5h2l1-2 1.5 4 1-2h4.5"/><path d="M10.5 20h10"/></svg>'
                + '<span class="rc-all-print-count" hidden></span>';
            button.setAttribute('aria-label', '所有選印');
            button.title = '開啟所有選印清單：Min／Max HR、Longest R-R 及 V、S、Pause、Event Tag、Tachy／Brady 的選印集中檢視，可修改標籤、取消選印或換一個';
            button.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                openAllPrintReview(button);
            });
            printer.parentElement.insertBefore(button, printer);
            allPrintButtonState.at = 0;
        }
        button.classList.toggle('is-open', !!review?.multi);
        const now = Date.now();
        if (now - allPrintButtonState.at < 500) {
            if (!allPrintButtonState.timer) {
                allPrintButtonState.timer = setTimeout(() => { allPrintButtonState.timer = null; schedulePrintBars(); }, 520);
            }
            return;
        }
        allPrintButtonState.at = now;
        let total = 0;
        for (const count of getAllPrintCounts().values()) total += count;
        const badge = button.querySelector('.rc-all-print-count');
        const text = String(total);
        if (badge.textContent !== text) badge.textContent = text;
        badge.hidden = !total;
    }
    // 分頁：有選印的清單與目前這個清單，顯示名稱與張數。
    function renderReviewTabs(counts) {
        const holder = review?.bar.querySelector('.rc-review-tabs');
        if (!holder) return;
        const types = ALL_PRINT_LIST_TYPES.filter(type => counts.get(type) > 0 || type === review.ctx.type);
        const signature = JSON.stringify([review.ctx.type, types.map(type => [type, counts.get(type) || 0])]);
        if (holder.dataset.signature === signature) return;
        holder.dataset.signature = signature;
        holder.textContent = '';
        for (const type of types) {
            const config = QUICK_PRINT_TYPES[type] || REVIEW_ONLY_TYPES[type] || ALL_PRINT_ONLY_TYPES[type];
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'rc-review-tab' + (type === review.ctx.type ? ' is-current' : '');
            tab.textContent = `${config.name} ${counts.get(type) || 0}`;
            tab.title = `切換到 ${config.name} 的選印`;
            tab.addEventListener('click', () => switchReviewList(type));
            holder.appendChild(tab);
        }
    }
    // 心電圖視窗在選印清單上方保留空間（--rc-review-h），視窗底部不被清單蓋住，也不必捲動而把標題列（含 X）捲出畫面。
    function updateReviewSpace() {
        if (!review) return;
        document.documentElement.style.setProperty('--rc-review-h', `${review.bar.offsetHeight}px`);
    }
    // 網站心電圖視窗的 X：視窗真的關閉後（有未儲存修改時網站會先確認），選印清單一併關閉。
    document.addEventListener('click', event => {
        if (!review || !event.target.closest?.('.close-btn')) return;
        if (!event.target.closest(REVIEW_POPUP_SELECTOR)) return;
        const current = review;
        waitFor(() => !document.querySelector(REVIEW_POPUP_SELECTOR), 60000).then(closed => {
            if (closed && review === current && !review.switching && !review.grouping) closePrintReview();
        });
    }, true);
    // Event Tag 心電圖視窗的儲存：網站原本只存標籤、Spéc. 與 HR（saveCurrentModifiedData），
    // 改為與 Event Tag 清單的 Save 相同（saveAnnoModified，不跳確認）：一併存選印範圍、備註、刪除的虛擬標籤、
    // 標籤列編輯、Pause 心搏、AF 紀錄等。視窗的 Save、Ctrl+S、按 X 後選 Yes 都呼叫這個函式，在函式本身替換。
    // 視窗中改過 HR 時（清單的 Save 不存 HR）與其他心電圖視窗維持網站原本的儲存。
    const tagSaveFunctions = new WeakSet();
    function installTagSave() {
        const element = document.querySelector('[ng-controller="RootiCareDashboardAFCtrl"]');
        if (!element || !window.angular) return;
        let scope;
        try { scope = window.angular.element(element).scope(); } catch (_) { return; }
        while (scope && !Object.prototype.hasOwnProperty.call(scope, 'saveCurrentModifiedData')) scope = scope.$parent;
        const original = scope?.saveCurrentModifiedData;
        if (typeof original !== 'function' || tagSaveFunctions.has(original) || typeof scope.saveAnnoModified !== 'function') return;
        // 有未儲存的 AF 修改（例如區間「同時標為 AF」或 AFib +）時同樣改用 saveAnnoModified，否則 AF 不會上傳。
        function saveTagDialog(...args) {
            const af = scope.af;
            const tagDialog = af?.eventDialog?.printInfo?.dialogType === 'tags' && !!document.querySelector('.ngdialog.ecg-dialog');
            let afPending = false;
            try { afPending = typeof scope.checkAFRecordModified === 'function' && !scope.checkAFRecordModified(); } catch (_) {}
            if (!(tagDialog || afPending) || af?.dialogChart?.hrModified) return original.apply(this, args);
            return scope.saveAnnoModified(args[0]);
        }
        tagSaveFunctions.add(saveTagDialog);
        scope.saveCurrentModifiedData = saveTagDialog;
    }
    for (const type of ['mousedown', 'keydown']) document.addEventListener(type, installTagSave, true);
    // ◀ ▶ 只在該方向還有縮圖時顯示。
    function updateReviewScroll() {
        if (!review) return;
        const list = review.bar.querySelector('.rc-review-list');
        const max = list.scrollWidth - list.clientWidth;
        review.bar.querySelector('.rc-review-scroll.is-prev').classList.toggle('is-visible', list.scrollLeft > 4);
        review.bar.querySelector('.rc-review-scroll.is-next').classList.toggle('is-visible', list.scrollLeft < max - 4);
    }
    function updateReviewCount() {
        if (!review) return;
        const index = review.items.indexOf(review.active);
        const text = review.items.length ? `第 ${index >= 0 ? index + 1 : '–'}／${review.items.length} 張` : '';
        const node = review.bar.querySelector('.rc-review-count');
        if (node.textContent !== text) node.textContent = text;
        node.hidden = !text;
    }
    function reviewPrintSignature(forced, section, all) {
        return JSON.stringify([all, [...forced].sort((a, b) => a - b), [...section].sort((a, b) => a - b)]);
    }
    // 選印清單開著時，在網站上點印表機圖示選印或取消（或其他方式改變選印），清單跟著更新。
    // 由頁面變動觸發，只在選印（綠色、橘色、藍色）有變化時才重整；腳本自己操作中（busy、Group）時不處理。
    function syncReviewPrints() {
        if (!review || review.busy || review.grouping) return;
        const ctx = review.ctx;
        if (review.multi) {
            // 頁面變動很頻繁，所有選印清單最多每 300 毫秒比對一次（含其他分頁的張數）。
            const now = Date.now();
            if (now - (review.syncedAt || 0) < 300) {
                if (!review.syncTimer) review.syncTimer = setTimeout(() => { if (review) review.syncTimer = null; syncReviewPrints(); }, 320);
                return;
            }
            review.syncedAt = now;
            if (getPrintHost()?.af !== ctx.af) { closePrintReview(); return; }
            const { forced, section, all } = getQuickPrinted(ctx);
            const counts = getAllPrintCounts();
            if (reviewPrintSignature(forced, section, all) !== review.printSignature) refreshPrintReview(counts);
            else renderReviewTabs(counts);
            return;
        }
        if (!ctx.dialog || ctx.dialog.dscp?.type !== ctx.type) return;
        const { forced, section, all } = getQuickPrinted(ctx);
        if (reviewPrintSignature(forced, section, all) !== review.printSignature) refreshPrintReview();
    }
    function refreshPrintReview(counts = null) {
        if (!review) return;
        const { ctx, bar, cards } = review;
        if (review.multi) {
            // 所有選印清單不依附事件清單；換了紀錄（或 Group 後重新載入）時關閉。
            if (getPrintHost()?.af !== ctx.af) { closePrintReview(); return; }
        } else if (!ctx.dialog || ctx.dialog.dscp?.type !== ctx.type || !review.anchor.isConnected) { closePrintReview(); return; }
        const times = getQuickTimes(ctx);
        const { forced, section, all } = getQuickPrinted(ctx, times);
        review.items = all;
        review.section = section;
        review.printSignature = reviewPrintSignature(forced, section, all);
        if (review.multi) renderReviewTabs(counts || getAllPrintCounts());
        const title = review.multi ? '所有選印' : `選印清單・${ctx.config.name}`;
        const titleNode = bar.querySelector('.rc-review-title');
        if (titleNode.textContent !== title) titleNode.textContent = title;
        const hint = (review.multi ? 'A／D 切換上一張／下一張選印（到頭尾時換到前後清單）；' : 'A／D 切換上一張／下一張選印；')
            + 'Q/E、←/→ 移動時間。'
            + (section.size ? '藍色選印開啟區段選印視窗（Start／Mid／End 三段）。' : '')
            + (ctx.af.editingSwitch ? '' : '目前不是編輯模式，無法修改標籤。');
        const hintNode = bar.querySelector('.rc-review-hint');
        if (hintNode.textContent !== hint) hintNode.textContent = hint;
        const list = bar.querySelector('.rc-review-list');
        for (const [time, card] of cards) if (!all.includes(time)) { card.remove(); cards.delete(time); }
        if (!all.includes(review.active)) review.active = null;
        let previous = null;
        for (const time of all) {
            let card = cards.get(time);
            if (!card) { card = createReviewCard(time); cards.set(time, card); }
            const isForced = forced.has(time);
            // 強制選印同時也是藍色選印（例如超過 30 秒的最長 SVT）時，另外標示「強制＋藍色」。
            const isBoth = isForced && section.has(time);
            card.classList.toggle('is-forced', isForced);
            card.classList.toggle('is-both', isBoth);
            card.classList.toggle('is-active', time === review.active);
            const forcedTag = card.querySelector('.rc-review-tag.is-forced-tag');
            forcedTag.hidden = !isForced || isBoth;
            const forcedText = ctx.config.fixed ? '報告固定' : '強制選印';
            if (forcedTag.textContent !== forcedText) forcedTag.textContent = forcedText;
            card.querySelector('.rc-review-tag.is-both').hidden = !isBoth;
            const isSection = !isForced && section.has(time);
            card.classList.toggle('is-section', isSection);
            card.querySelector('.rc-review-tag.is-section').hidden = !isSection;
            for (const button of card.querySelectorAll('.rc-review-btn')) {
                button.disabled = isForced || review.busy;
                button.title = !isForced ? '' : ctx.config.fixed ? '報告固定印出的心電圖，無法在此取消'
                    : '橘色強制選印由網站決定，無法在此取消或替換';
            }
            const expected = previous ? previous.nextElementSibling : list.firstElementChild;
            if (expected !== card) list.insertBefore(card, expected);
            previous = card;
            // 加入清單後才載入，縮圖寬度才量得到。
            if (!card.dataset.rcLoaded) {
                card.dataset.rcLoaded = '1';
                loadReviewThumb(card, time);
                loadReviewInfo(card, time);
            }
        }
        let empty = list.querySelector('.rc-review-empty');
        if (!all.length && !empty) {
            empty = document.createElement('div');
            empty.className = 'rc-review-empty';
            empty.textContent = '目前沒有選印的心電圖';
            list.appendChild(empty);
        } else if (all.length && empty) empty.remove();
        const group = bar.querySelector('.rc-review-group');
        if (!review.grouping) group.disabled = review.busy;
        updateReviewCount();
        decorateReviewDialog();
        requestAnimationFrame(() => { updateReviewScroll(); updateReviewSpace(); });
    }
    function createReviewCard(time) {
        const card = document.createElement('div');
        card.className = 'rc-review-card';
        card.dataset.time = String(time);
        card.innerHTML = '<div class="rc-review-card-head"><span class="rc-review-time"></span>'
            + '<span class="rc-review-tag is-forced-tag" hidden>強制選印</span>'
            + '<span class="rc-review-tag is-both" hidden title="網站的強制選印，同時也是藍色區段選印（報告印出 Start／Mid／End 三段）">強制＋藍色</span>'
            + '<span class="rc-review-tag is-section" hidden title="區段選印：報告印出 Start／Mid／End 三段，點選卡片開啟區段選印視窗">藍色選印</span></div>'
            + '<div class="rc-review-info"></div><div class="rc-review-warn" hidden></div><div class="rc-review-thumb">載入中…</div>'
            + '<div class="rc-review-actions"><button type="button" class="rc-review-btn is-cancel">取消選印</button>'
            + '<button type="button" class="rc-review-btn is-swap">換一個</button></div>';
        card.querySelector('.rc-review-time').textContent = formatQuickTime(review.ctx, time);
        card.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            showReviewTime(time);
        });
        card.querySelector('.is-cancel').addEventListener('click', event => cancelReviewPrint(time, event.currentTarget));
        card.querySelector('.is-swap').addEventListener('click', event => swapReviewPrint(time, event.currentTarget));
        return card;
    }
    function formatQuickTime(ctx, time) {
        try {
            const text = ctx.host.tmsFormat?.(time, 'DD/MM/YYYY, HH:mm:ss');
            if (text) return text;
        } catch (_) {}
        return new Date(time * 1000).toLocaleString();
    }
    async function loadReviewInfo(card, time) {
        const ctx = review?.ctx;
        if (ctx?.config.info) { card.querySelector('.rc-review-info').textContent = ctx.config.info(ctx.af); return; }
        if (!ctx || ctx.config.reviewOnly) return;
        try {
            const [score] = await computeQuickScores(ctx, [time]);
            if (card.isConnected && score?.info) card.querySelector('.rc-review-info').textContent = score.info;
        } catch (_) {}
    }
    function setReviewActive(time) {
        if (!review) return;
        review.active = time;
        for (const [other, card] of review.cards) card.classList.toggle('is-active', other === time);
        // 只捲動縮圖列本身，讓目前這張完整顯示。
        const card = review.cards.get(time);
        const list = review.bar.querySelector('.rc-review-list');
        if (card) {
            const left = card.offsetLeft; // 縮圖列為 position:relative，offsetLeft 即在列中的位置
            if (left < list.scrollLeft + 8) list.scrollTo({ left: left - 40, behavior: 'smooth' });
            else if (left + card.offsetWidth > list.scrollLeft + list.clientWidth - 8) {
                list.scrollTo({ left: left + card.offsetWidth - list.clientWidth + 40, behavior: 'smooth' });
            }
        }
        updateReviewCount();
        decorateReviewDialog();
    }
    function waitFor(check, timeout) {
        return new Promise(resolve => {
            const started = Date.now();
            const tick = () => {
                if (check() || Date.now() - started > timeout) resolve(check());
                else requestAnimationFrame(tick);
            };
            tick();
        });
    }
    // 在上方開啟網站的心電圖視窗（與點擊心電圖時間相同）。切換時只關閉視窗、不放棄修改（同網站關閉時選 No），
    // 未儲存的標籤修改會保留，可多張改完後一併按 Save。
    // 藍色選印改開網站的區段選印視窗（Start／Mid／End 三段，與點擊清單上的時間相同）；plain 為 true 時一律開一般心電圖視窗。
    const REVIEW_POPUP_SELECTOR = '.ngdialog.ecg-dialog, .ngdialog.section-dialog';
    async function showReviewTime(time, plain = false) {
        if (!review || review.switching) return;
        const { ctx } = review;
        const section = !plain && !!review.section?.has(time);
        const popupOpen = () => !!document.querySelector(REVIEW_POPUP_SELECTOR);
        const expectedOpen = () => !!document.querySelector(section ? '.ngdialog.section-dialog' : '.ngdialog.ecg-dialog');
        if (expectedOpen() && review.active === time) return;
        review.switching = true;
        setReviewActive(time);
        try {
            if (popupOpen()) {
                ctx.host.$apply(() => ctx.host.closeDialog());
                await waitFor(() => !popupOpen(), 1500);
            }
            if (!review || review.ctx !== ctx) return;
            if (section && ctx.sectionHost?.openSectionPrintDialog) {
                const items = listCurrentData(ctx);
                const item = items.find(entry => toEventTime(entry?.startTime) === time);
                const target = item?.isPrintSection ? item : { ...(item || {}), startTime: time, isPrintSection: true };
                ctx.sectionHost.$apply(() => ctx.sectionHost.openSectionPrintDialog(target, ctx.type));
            } else if (ctx.config.tag && typeof ctx.host.openEventTagDialog === 'function') {
                // Event Tag：與點擊清單上的心電圖相同。不在目前頁面的項目沒有 timeRange，依網站格式補上（起點後 10 秒）。
                const loaded = listCurrentData(ctx).find(entry => toEventTime(entry) === time);
                const raw = loaded || (ctx.dialog[ctx.type]?.data || []).flat().find(entry => toEventTime(entry) === time)
                    || { tagTime: time, dataTime: time };
                const start = toEventTime(raw);
                const item = Array.isArray(raw.timeRange) && raw.timeRange.length ? raw : { ...raw, timeRange: [start, start + 10] };
                ctx.host.$apply(() => ctx.host.openEventTagDialog(item, ctx.af.dataDuration || 60));
            } else {
                ctx.host.$apply(() => ctx.host.openDialog(time, ctx.af.dataDuration || 60));
            }
            await waitFor(expectedOpen, 3000);
            // 開啟後回到視窗頂端，標題列與 X 一定看得到。
            const popup = document.querySelector(REVIEW_POPUP_SELECTOR);
            if (popup) popup.scrollTop = 0;
        } catch (error) {
            quickToast(review?.bar, `無法開啟心電圖：${error?.message || error}`, true);
        } finally {
            if (review) review.switching = false;
        }
    }
    function moveReview(delta) {
        if (!review) return;
        const index = review.items.indexOf(review.active);
        // 所有選印清單：已在這個清單的頭尾（或清單已空）時換到前後有選印的清單。
        const atEnd = !review.items.length || (index >= 0 && (delta > 0 ? index === review.items.length - 1 : index === 0));
        if (atEnd) {
            const type = review.multi && !review.switching ? adjacentReviewList(delta) : null;
            if (type) switchReviewList(type, delta > 0 ? 'first' : 'last');
            return;
        }
        const next = index < 0 ? (delta > 0 ? 0 : review.items.length - 1)
            : Math.min(review.items.length - 1, Math.max(0, index + delta));
        showReviewTime(review.items[next]);
    }
    // A／D：選印清單開啟時切換上一張／下一張選印，不論滑鼠位置；Q/E、←/→ 維持原本的移動時間。
    // 以實體按鍵位置判斷（輸入法或大小寫不影響），輸入欄聚焦時不處理。
    window.addEventListener('keydown', event => {
        if (!review || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
        if (event.code !== 'KeyA' && event.code !== 'KeyD') return;
        const active = document.activeElement;
        if (active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat || !review.switching) moveReview(event.code === 'KeyA' ? -1 : 1);
    }, true);
    // Esc：網站關閉心電圖視窗時，下方的選印清單一併關閉（不攔截，網站原本的 Esc 照常作用）。
    // 拖曳標籤、區間選取中的 Esc 只取消那些操作；Group 進行中不關閉。
    window.addEventListener('keydown', event => {
        if (!review || event.key !== 'Escape' || event.isComposing || review.grouping) return;
        if (labelDrag || rangeMode || rangeHint.style.display !== 'none') return;
        event.rcReviewClosed = true; // 捲動檢視的 Esc 據此不再回到分頁
        closePrintReview();
    }, true);

    // 縮圖：事件心電圖範圍（前 4 秒至後 6 秒）一列，上方標出心搏類型；依序載入，最多同時 3 張。
    // 眼睛（列印範圍）開啟時改顯示報告中波形下方的 30 秒縮圖範圍，綠色為印出的 8 秒；只保留到重新整理頁面。
    const PRINT_CONTEXT_BEFORE = 11; // 網站列印：下方縮圖從印出的 8 秒前 11 秒開始，共 30 秒
    const PRINT_CONTEXT_SECONDS = 30;
    const PRINT_SHOWN_SECONDS = 8;
    let reviewContextOn = false;
    // 報告中印出的 8 秒的起點：一般清單為事件前 3 秒（事件心電圖前 4 秒起，印出第 1～9 秒），
    // Pause 為事件前 4 秒（印出第 0～8 秒），Event Tag 為選印範圍的起點；藍色區段選印的版面不同，回傳 null。
    function reviewPrintStart(ctx, time) {
        if (review?.section?.has(time)) return null;
        // 網站列印（getPrintHrData）：Min／Max HR、Max HR Sinus 有 10 秒平均心率時印出該時間起 8 秒，否則與一般事件相同；
        // Longest R-R 與一般事件相同（前 3 秒起 8 秒）。下方 30 秒縮圖同樣從印出範圍前 11 秒開始。
        if (ctx.config.fixed && ctx.type !== 'rr' && ctx.af.record?.hasAvgHRIn10s) return time;
        if (ctx.config.tag) return getTagPrintWindow(ctx.af, time).start;
        if (/^pause/.test(ctx.type)) return time - 4;
        return time - 3;
    }
    function cardUsesContext(time) {
        return reviewContextOn && !!review && reviewPrintStart(review.ctx, time) !== null;
    }
    // 依目前模式畫出已讀到的資料；沒有資料時回傳 false。
    function showReviewThumb(card, time, modifiedData) {
        const thumb = card.querySelector('.rc-review-thumb');
        if (cardUsesContext(time)) {
            if (!card.rcContext) return false;
            renderReviewThumb(thumb, card.rcContext, time, modifiedData,
                { labels: false, highlight: [PRINT_CONTEXT_BEFORE, PRINT_CONTEXT_BEFORE + PRINT_SHOWN_SECONDS] });
        } else {
            if (!card.rcData) return false;
            renderReviewThumb(thumb, card.rcData, time, modifiedData);
        }
        return true;
    }
    const thumbQueue = [];
    let thumbLoading = 0;
    function loadReviewThumb(card, time) {
        thumbQueue.push({ card, time });
        pumpThumbQueue();
    }
    // 資料已過期（Save 後、Event Tag 選印時間改變）時清掉兩種縮圖資料再重新讀取。
    function reloadReviewThumb(card, time) {
        card.rcData = null;
        card.rcContext = null;
        loadReviewThumb(card, time);
    }
    function pumpThumbQueue() {
        while (thumbLoading < 3 && thumbQueue.length) {
            const { card, time } = thumbQueue.shift();
            if (review?.cards.get(time) !== card) continue;
            const context = cardUsesContext(time);
            if (showReviewThumb(card, time)) { checkReviewCard(card, time); continue; }
            thumbLoading++;
            let before = THUMB_BEFORE, after = THUMB_AFTER;
            if (context) {
                const start = reviewPrintStart(review.ctx, time) - PRINT_CONTEXT_BEFORE;
                before = time - start;
                after = start + PRINT_CONTEXT_SECONDS - time;
            } else if (review.ctx.config.tag) {
                // Event Tag 的縮圖顯示目前的 10 秒選印範圍；其他清單顯示事件前 4 秒至後 6 秒。
                const start = getTagPrintWindow(review.ctx.af, time).start;
                before = time - start;
                after = start + TAG_PRINT_SECONDS - time;
            }
            fetchReviewECG(time, before, after).then(data => {
                if (review?.cards.get(time) !== card) return;
                if (context) card.rcContext = data; else card.rcData = data;
                showReviewThumb(card, time);
                checkReviewCard(card, time);
            }).catch(error => {
                const thumb = card.querySelector('.rc-review-thumb');
                if (thumb) thumb.textContent = `載入失敗：${error?.message || error?.status || error}`;
            }).finally(() => { thumbLoading--; pumpThumbQueue(); });
        }
    }
    function setReviewContext(on) {
        reviewContextOn = on;
        if (!review) return;
        review.bar.classList.toggle('is-context', on);
        review.bar.querySelector('.rc-review-eye').setAttribute('aria-pressed', String(on));
        // 卡片變寬後才重畫，縮圖寬度才量得到；沒有資料的排隊讀取。
        for (const [time, card] of review.cards) {
            if (!showReviewThumb(card, time)) {
                const thumb = card.querySelector('.rc-review-thumb');
                if (thumb) thumb.textContent = '載入中…';
                loadReviewThumb(card, time);
            }
        }
        requestAnimationFrame(updateReviewScroll);
        if (review.active !== null) setReviewActive(review.active);
    }
    // 網站讀取事件心電圖時使用的固定取樣率（125／250／500／1000 中最接近者）。
    function requestSampleRate(sampleRate) {
        return [125, 250, 500, 1000].reduce((best, value) =>
            Math.abs(value - sampleRate) < Math.abs(best - sampleRate) ? value : best, 250);
    }
    async function fetchReviewECG(time, before, after) {
        return fetchEventECG(review.ctx.af, time, before, after);
    }
    async function fetchEventECG(af, time, before, after) {
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const response = await manager.Af.getFilteredECGDataByTms(af._vendorId, af._idNumber, af._measureId,
            time - before, time + after, requestSampleRate(getQuickSampleRate(af)), time, false, false);
        const data = response?.plain ? response.plain() : response;
        if (!Array.isArray(data?.ecg) || !data.ecg.length) throw new Error('沒有心電圖資料');
        return data;
    }
    function median(values) {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        return sorted.length ? sorted[sorted.length >> 1] : 0;
    }
    // 縮圖的心搏標籤：伺服器資料加上未儲存的標籤修改（[時間, 索引, 新標籤, 原標籤, 1]），與上方心電圖視窗一致。
    // 回傳 { labels: Map(索引 → 標籤), edited: Set(改過的索引) }；新標籤空白或 X（刪除）不顯示。
    function thumbLabels(data, modifiedData) {
        const fromIndex = Number(data.fromIndex) || 0;
        const endIndex = fromIndex + (Array.isArray(data.ecg) ? data.ecg.length : 0);
        const labels = new Map(Object.entries(data.anno || {}).map(([index, type]) => [Number(index), type]));
        const edited = new Set();
        for (const item of Array.isArray(modifiedData) ? modifiedData : []) {
            const index = Number(item?.[1]);
            if (!item?.[4] || !(index >= fromIndex && index <= endIndex)) continue;
            labels.set(index, item[2]);
            edited.add(index);
        }
        return { labels, edited };
    }
    let thumbGradientSeq = 0; // 每張縮圖的漸層 id 不重複
    // options.highlight：[開始秒, 結束秒]（自資料起點），以列印縮圖相同的淡綠色標示；options.labels 為 false 時不畫標籤。
    function renderReviewThumb(container, data, eventTime, modifiedData = review?.ctx.af.ecgAnno?.modifiedData, options = {}) {
        if (!container) return;
        if (modifiedData === undefined) modifiedData = review?.ctx.af.ecgAnno?.modifiedData;
        const width = Math.max(120, container.clientWidth || 234);
        const height = 64;
        const labelHeight = 13;
        const sampleRate = Number(data.sampleRate) || 250;
        const fromIndex = Number(data.fromIndex) || 0;
        const ecg = data.ecg;
        const seconds = ecg.length / sampleRate;
        const pxPerSec = width / Math.max(1, seconds);
        const waveHeight = height - labelHeight;
        const values = ecg.map(Number);
        const baseline = median(values);
        // 振幅依這張的範圍縮放（至少 1.2 mV 高），讓縮圖都看得清楚。
        const span = Math.max(1.2, 2 * Math.max(...values.map(value => Math.abs(value - baseline)).filter(Number.isFinite), 0));
        const pxPerMV = waveHeight / span;
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        const add = (tag, attrs, text) => {
            const node = document.createElementNS(ns, tag);
            for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
            if (text !== undefined) node.textContent = text;
            svg.appendChild(node);
            return node;
        };
        add('rect', { x: 0, y: labelHeight, width, height: waveHeight, fill: '#fff', stroke: '#ccc' });
        let grid = '';
        for (let s = 0.2; s < seconds; s += 0.2) grid += `M${(s * pxPerSec).toFixed(1)} ${labelHeight}V${height}`;
        add('path', { d: grid, stroke: '#eee', 'stroke-width': 0.6, fill: 'none' });
        if (options.highlight) {
            const [from, to] = options.highlight;
            add('rect', { x: from * pxPerSec, y: labelHeight, width: Math.max(0, (to - from) * pxPerSec), height: waveHeight,
                fill: 'rgba(173,209,73,.41)' });
        }
        let d = '';
        values.forEach((value, i) => {
            if (!Number.isFinite(value)) return;
            const x = i / sampleRate * pxPerSec;
            const y = Math.min(height, Math.max(labelHeight, labelHeight + waveHeight / 2 - (value - baseline) * pxPerMV));
            d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        const { labels, edited } = thumbLabels(data, modifiedData);
        // 與網站心電圖相同：每顆心搏在其位置放一個漸層色標（V 紅、S／A 藍、其他深灰），相鄰心搏之間漸變。
        const waveColor = type => type === 'V' ? 'red' : type === 'S' || type === 'A' ? '#0568F7' : '#262626';
        const gradientId = `rc-thumb-grad-${++thumbGradientSeq}`;
        const defs = add('defs', {});
        const gradient = document.createElementNS(ns, 'linearGradient');
        for (const [key, value] of Object.entries({ id: gradientId, gradientUnits: 'userSpaceOnUse', x1: 0, x2: width, y1: 0, y2: 0 })) {
            gradient.setAttribute(key, String(value));
        }
        const stops = [...labels].filter(([index, type]) => Number.isFinite(index) && type && type !== 'X')
            .map(([index, type]) => [(index - fromIndex) / sampleRate * pxPerSec / width, type])
            .filter(([offset]) => offset >= 0 && offset <= 1).sort((a, b) => a[0] - b[0]);
        for (const [offset, type] of stops.length ? stops : [[1, 'N']]) {
            const stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', String(offset));
            stop.setAttribute('stop-color', waveColor(type));
            gradient.appendChild(stop);
        }
        defs.appendChild(gradient);
        add('path', { d, stroke: `url(#${gradientId})`, 'stroke-width': 0.9, fill: 'none', 'stroke-linejoin': 'round' });
        const color = type => type === 'V' ? '#d0021b' : type === 'S' || type === 'A' ? '#2a6fdb' : '#888';
        // 30 秒的列印範圍與報告的縮圖相同，不畫標籤（太密），心搏類型由波形顏色表示。
        for (const [index, type] of options.labels === false ? [] : labels) {
            if (!['N', 'S', 'A', 'V'].includes(type) || !Number.isFinite(index)) continue;
            const x = (index - fromIndex) / sampleRate * pxPerSec;
            if (x < 0 || x > width) continue;
            // 尚未儲存的修改：標籤底下加淡黃底，與已儲存的區分。
            if (edited.has(index)) add('rect', { x: x - 5, y: 1, width: 10, height: 11, rx: 2, fill: '#fff1c9' });
            // 與網站標籤列相同，A 顯示為 S。
            add('text', { x, y: 10, 'font-size': 9, 'text-anchor': 'middle', fill: color(type), 'font-weight': type === 'N' ? 400 : 700 },
                type === 'A' ? 'S' : type);
        }
        container.textContent = '';
        container.appendChild(svg);
    }
    // 選印清單的卡片：依縮圖的心電圖與目前未儲存的標籤修改，標示已不符合清單類型的選印。
    function checkReviewCard(card, time) {
        // 一般縮圖或 30 秒列印範圍的資料都涵蓋事件前後，哪一份有就用哪一份。
        const data = card.rcData || card.rcContext;
        if (!review || !data || review.ctx.config.reviewOnly) return; // Pause、Event Tag 沒有心搏型態規則
        const result = checkEventPattern(effectiveEventBeats(data, review.ctx.af.ecgAnno?.modifiedData, time), review.ctx.config);
        card.classList.toggle('is-invalid', !result.ok);
        const warn = card.querySelector('.rc-review-warn');
        const text = result.ok ? '' : `⚠ ${result.reason}`;
        if (warn.textContent !== text) warn.textContent = text;
        warn.hidden = result.ok;
        card.title = result.ok ? '' : result.reason;
    }
    // 標籤修改後重新檢查並重畫縮圖的標籤（由頁面變動觸發，只在修改內容改變時才重算）。
    // 修改從未儲存清單中消失（按了 Save 或放棄修改）時，縮圖裡的伺服器資料已過期，儲存完成後重新讀取。
    function recheckReviewCards() {
        if (!review) return;
        const pending = review.ctx.af.ecgAnno?.modifiedData || [];
        const signature = JSON.stringify(pending);
        if (signature === review.labelSignature) return;
        review.labelSignature = signature;
        const current = new Set(pending.filter(item => item?.[4]).map(item => Number(item[1])));
        const removed = [...(review.labelIndices || [])].filter(index => !current.has(index));
        review.labelIndices = current;
        const covers = data => {
            const fromIndex = Number(data.fromIndex) || 0;
            const endIndex = fromIndex + (Array.isArray(data.ecg) ? data.ecg.length : 0);
            return removed.some(index => index >= fromIndex && index <= endIndex);
        };
        for (const [time, card] of review.cards) {
            const datasets = [card.rcData, card.rcContext].filter(Boolean);
            if (!datasets.length) continue;
            if (removed.length && datasets.some(covers)) { review.staleCards.add(card); continue; }
            if (review.staleCards.has(card)) continue; // 等重新讀取，避免先閃回舊標籤
            showReviewThumb(card, time, pending);
            checkReviewCard(card, time);
        }
        if (review.staleCards.size) scheduleStaleThumbs();
    }
    // 等網站儲存完成（af.loading.modified 結束）再重新讀取過期的縮圖。
    function scheduleStaleThumbs() {
        if (!review || review.staleTimer) return;
        const ctx = review.ctx;
        review.staleTimer = setTimeout(function retry() {
            if (!review || review.ctx !== ctx) return;
            if (ctx.af.loading?.modified) { review.staleTimer = setTimeout(retry, 300); return; }
            review.staleTimer = null;
            for (const card of review.staleCards) {
                const time = Number(card.dataset.time);
                if (review.cards.get(time) === card) reloadReviewThumb(card, time);
            }
            review.staleCards.clear();
        }, 800);
    }
    function setReviewBusy(busy) {
        if (!review) return;
        review.busy = busy;
        refreshPrintReview();
    }
    // 取消選印：目前顯示的是這張時，改顯示相鄰的下一張（沒有則上一張）。
    // button 為按下的按鈕（縮圖卡片或心電圖視窗上的），用來顯示提示。
    function cancelReviewPrint(time, button) {
        if (!review || review.busy) return;
        const items = review.items;
        const index = items.indexOf(time);
        const neighbor = review.active === time ? (items[index + 1] ?? items[index - 1] ?? null) : null;
        const anchor = review.cards.get(neighbor ?? time) || review.bar;
        try {
            setQuickPrint(review.ctx, time, false);
            getQuickRejected(review.ctx).add(time); // 取消的也算淘汰，之後快速選印、換一個、加選不再選回
            quickToast(button?.isConnected ? button : anchor, `已取消選印 ${formatQuickTime(review.ctx, time)}`);
        } catch (error) {
            quickToast(button?.isConnected ? button : anchor, `取消選印失敗：${error?.message || error}`, true);
            return;
        }
        refreshPrintReview();
        if (neighbor !== null) showReviewTime(neighbor);
        else if (review?.multi && !review.items.length) {
            // 這個清單的選印都取消了：換到下一個（沒有則上一個）有選印的清單。
            const type = adjacentReviewList(1) || adjacentReviewList(-1);
            if (type) switchReviewList(type);
        }
    }
    async function swapReviewPrint(time, button) {
        if (!review || review.busy) return;
        const ctx = review.ctx;
        setReviewBusy(true);
        button.textContent = '尋找中…';
        try {
            getQuickRejected(ctx).add(time);
            const { times, candidates } = await getQuickCandidates(ctx, (done, total) => { button.textContent = `${done}/${total}`; });
            if (!review || review.ctx !== ctx) return;
            const existing = getQuickPrinted(ctx, times).all.filter(other => other !== time);
            const range = getQuickRange(ctx, times);
            button.textContent = '驗證中…';
            const { valid: [replacement = null], skipped, lowPriority } = await pickValidated(ctx, candidates, existing, 1,
                (pool, others) => [pickQuickReplacement({ candidates: pool, existing: others, removed: time,
                    target: ctx.config.target(times.length), ...range, spread: ctx.config.spread !== false })].filter(value => value !== null));
            if (!review || review.ctx !== ctx) return;
            if (replacement === null) {
                getQuickRejected(ctx).delete(time);
                quickToast(button, '沒有其他符合條件的心電圖（需與其他選印相隔 1 分鐘以上，且不選淘汰過的及其前後 30 秒）'
                    + (skipped.length ? `；${skipped.length} 張標籤已不符合` : ''), true);
                return;
            }
            setQuickPrint(ctx, time, false);
            const replacedSection = setQuickPrint(ctx, replacement, true);
            review.busy = false;
            refreshPrintReview();
            const added = review?.cards.get(replacement);
            added?.classList.add('is-new');
            quickToast(added?.querySelector('.is-swap') || review?.bar, `已換成 ${formatQuickTime(ctx, replacement)}` + (replacedSection ? '（超過 30 秒，藍色選印）' : '')
                + (lowPriority ? '（沒有其他候選，使用前兩顆為 V、N 的 S）' : ''));
            showReviewTime(replacement);
        } catch (error) {
            quickToast(button, `換一個失敗：${error?.message || error}`, true);
        } finally {
            if (button.isConnected) button.textContent = '換一個';
            setReviewBusy(false);
        }
    }

    // 加選一個：不受目標張數限制，依同樣的規則再選一張；時段數取目前張數 + 1，選在空出的時段中排序最前的。
    async function addReviewPrint() {
        if (!review || review.busy) return;
        const ctx = review.ctx;
        const button = review.bar.querySelector('.rc-review-add');
        setReviewBusy(true);
        button.disabled = true;
        button.textContent = '尋找中…';
        try {
            const { times, candidates } = await getQuickCandidates(ctx, (done, total) => { button.textContent = `尋找中 ${done}/${total}`; });
            if (!review || review.ctx !== ctx) return;
            const existing = getQuickPrinted(ctx, times).all;
            const range = getQuickRange(ctx, times);
            const target = Math.max(ctx.config.target(times.length), existing.length + 1);
            button.textContent = '驗證中…';
            const { valid: [added], skipped } = await pickValidated(ctx, candidates, existing, 1,
                (pool, others) => pickQuickPrints({ candidates: pool, existing: others, need: 1, target, ...range,
                    spread: ctx.config.spread !== false }));
            if (!review || review.ctx !== ctx) return;
            if (added === undefined) {
                quickToast(button, '沒有其他符合條件的心電圖（需與其他選印相隔 1 分鐘以上）'
                    + (skipped.length ? `；${skipped.length} 張標籤已不符合` : ''), true);
                return;
            }
            const addedSection = setQuickPrint(ctx, added, true);
            review.busy = false;
            refreshPrintReview();
            const card = review?.cards.get(added);
            card?.classList.add('is-new');
            quickToast(card || button, `已加選 ${formatQuickTime(ctx, added)}` + (addedSection ? '（超過 30 秒，藍色選印）' : ''));
            showReviewTime(added);
        } catch (error) {
            quickToast(button, `加選失敗：${error?.message || error}`, true);
        } finally {
            if (button.isConnected) { button.textContent = '＋ 加選一個'; button.disabled = false; }
            setReviewBusy(false);
        }
    }

    // 選印清單開啟時，在網站心電圖視窗的「Mesurer／Imprimer」旁加入「取消選印」「換一個」，作用於目前顯示的選印。
    const reviewDialogStyle = document.createElement('style');
    reviewDialogStyle.textContent = `
        .rc-review-dialog-actions { display:inline-flex; align-items:center; gap:6px; margin-right:10px; vertical-align:top; height:44px; }
        .rc-review-dialog-actions .rc-review-btn { flex:0 0 auto; height:26px; padding:0 12px; border-radius:13px; font-size:12px; }
        .rc-review-group { height:22px; padding:0 10px; border:1px solid #fff; border-radius:11px; background:transparent; color:#fff;
            font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
        .rc-review-group:hover:not(:disabled) { background:#fff; color:#5b7d1a; }
        .rc-review-group:disabled { cursor:progress; opacity:.7; }
        .rc-review-btn.is-eye { border-color:#cfe0a8; background:#f6faee; color:#5b7d1a; }
        .rc-review-btn.is-eye[aria-pressed="true"] { border-color:#5b7d1a; background:#5b7d1a; color:#fff; }
        /* 心電圖視窗上的列印範圍：虛線為報告下方 30 秒縮圖的範圍，實線為印出的 8 秒 */
        .rc-printrange { pointer-events:none; }
        .rc-printrange.is-context { fill:none; stroke:#5b7d1a; stroke-width:1.5; stroke-dasharray:6 4; }
        .rc-printrange.is-main { fill:rgba(173,209,73,.08); stroke:#5b7d1a; stroke-width:1.5; }
    `;
    document.head.appendChild(reviewDialogStyle);
    // 心電圖視窗的「👁 列印範圍」：與縮圖的眼睛分開，預設關閉，開啟後保持到重新整理頁面。
    let reviewDialogRangeOn = false;
    function drawReviewPrintRange() {
        const dialog = getReviewECGDialog();
        const existing = document.querySelectorAll('.rc-printrange');
        let scope = null;
        try { scope = dialog && window.angular?.element(dialog).scope(); } catch (_) {}
        while (scope && !scope.af) scope = scope.$parent;
        const af = scope?.af;
        const time = Number(af?.eventDialog?.printInfo?.dataTms);
        const trend = af?.ECGTrendDialog;
        const range = Array.isArray(trend?.timeRange) ? trend.timeRange.map(Number) : [];
        const printStart = review && reviewDialogRangeOn && review.items.includes(time) && range.length === 2
            && Number.isFinite(Number(trend.startTime)) ? reviewPrintStart(review.ctx, time) : null;
        if (printStart === null) { existing.forEach(node => node.remove()); return; }
        const boxes = [['context', printStart - PRINT_CONTEXT_BEFORE, PRINT_CONTEXT_SECONDS]];
        // Event Tag 的印出範圍已有橘色選印框，只加 30 秒的範圍。
        if (!review.ctx.config.tag) boxes.push(['main', printStart, PRINT_SHOWN_SECONDS]);
        const strips = getTagPrintStrips({ dialog, range, viewStart: Number(trend.startTime) });
        for (const node of existing) if (!strips.some(strip => strip.svg.contains(node))) node.remove();
        for (const strip of strips) {
            const width = Number(strip.svg.getAttribute('width')) || strip.svg.getBoundingClientRect().width;
            const height = Number(strip.svg.getAttribute('height')) || strip.svg.getBoundingClientRect().height;
            const scale = width / strip.seconds;
            for (const [kind, start, seconds] of boxes) {
                let rect = strip.svg.querySelector(`:scope > rect.rc-printrange.is-${kind}`);
                if (!rect) {
                    rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('class', `rc-printrange is-${kind}`);
                    strip.svg.appendChild(rect);
                }
                // 範圍的邊剛好落在波形邊緣時往內縮 1px，虛線才看得到，不會被誤認為範圍還延伸到畫面外；
                // 真的超出畫面時維持原樣（該側沒有邊線）。
                let x0 = (start - strip.from) * scale;
                let x1 = x0 + seconds * scale;
                if (Math.abs(x0) <= 1.5) x0 = 1;
                if (Math.abs(x1 - width) <= 1.5) x1 = width - 1;
                rect.setAttribute('x', String(x0));
                rect.setAttribute('y', '1');
                rect.setAttribute('width', String(Math.max(0, x1 - x0)));
                rect.setAttribute('height', String(Math.max(0, height - 2)));
            }
        }
    }
    function getReviewECGDialog() {
        return document.querySelector('.ngdialog.ecg-dialog #af-ecg-dialog-v2');
    }
    function decorateReviewDialog() {
        drawReviewPrintRange();
        let actions = document.querySelector('.rc-review-dialog-actions');
        const time = review?.active ?? null;
        const tools = (getReviewECGDialog() || document.querySelector('.ngdialog.section-dialog #af-section-dialog'))
            ?.querySelector('.dialog-content .tool-btns');
        if (!review || time === null || !review.items.includes(time) || !tools) { actions?.remove(); return; }
        if (!actions || actions.parentElement !== tools) {
            actions?.remove();
            actions = document.createElement('div');
            actions.className = 'rc-review-dialog-actions';
            actions.innerHTML = '<button type="button" class="rc-review-btn is-eye" aria-pressed="false"'
                + ' title="在心電圖上標出報告的列印範圍：實線為印出的 8 秒，虛線為下方 30 秒縮圖的範圍">👁 列印範圍</button>'
                + '<button type="button" class="rc-review-btn is-cancel">取消選印</button>'
                + '<button type="button" class="rc-review-btn is-swap">換一個</button>';
            actions.querySelector('.is-eye').addEventListener('click', () => {
                reviewDialogRangeOn = !reviewDialogRangeOn;
                decorateReviewDialog();
            });
            // 按下時才讀取目前顯示的選印，切換到其他張後也作用在正確的心電圖上。
            actions.querySelector('.is-cancel').addEventListener('click', event => {
                if (review?.active != null) cancelReviewPrint(review.active, event.currentTarget);
            });
            actions.querySelector('.is-swap').addEventListener('click', event => {
                if (review?.active != null) swapReviewPrint(review.active, event.currentTarget);
            });
            tools.prepend(actions);
        }
        actions.querySelector('.is-swap').hidden = !!review.ctx.config.reviewOnly;
        // 列印範圍只用在一般心電圖視窗；藍色區段選印的報告版面不同，不顯示。
        const eye = actions.querySelector('.is-eye');
        eye.hidden = !getReviewECGDialog() || reviewPrintStart(review.ctx, time) === null;
        eye.setAttribute('aria-pressed', String(reviewDialogRangeOn));
        const forced = !!review.cards.get(time)?.classList.contains('is-forced');
        for (const button of actions.querySelectorAll('button:not(.is-eye)')) {
            button.disabled = forced || review.busy || review.grouping;
            button.title = !forced ? '' : review.ctx.config.fixed ? '報告固定印出的心電圖，無法在此取消'
                : '橘色強制選印由網站決定，無法在此取消或替換';
        }
    }

    // ── 捲動檢視：Min／Max HR、Max HR sinus、Longest R-R 清單 ──
    // 清單標題列加入「☰ 捲動檢視」：把網站清單改成一頁（所有心電圖）、一欄，由第一張起往下連續排列。
    // 卡片仍是網站自己畫的，心電圖維持原本的寬高（格線為正方形，是判讀依據，不可拉寬），標籤編輯、選印與星號勾選框都與原本相同；
    // 標題列加上燈號與分數，右側多出的空間放評分欄（各條件的通過／扣分明細）；
    // 每張依 SCROLL_CRITERIA 打分數（綠：滿分、黃：有扣分、紅：零分），右側 Minimap 列出所有燈號，點一下跳到該張。
    // 清單內容取自目前的分頁資料（eventDialog.pageData），「排除 ±1 分」等排除後的結果也一併反映。
    const SCROLL_EVENT_PER_PAGE = 100; // VEB／SVEB 清單捲動檢視的每頁張數
    const SCROLL_VIEW_TYPES = {
        minHR: { name: 'Min HR', before: 0, after: 10, white: [0, 8], printed: af => af.record?.minAvgHR?.[0] },
        maxHR: { name: 'Max HR', before: 0, after: 10, white: [0, 8], printed: af => af.record?.maxAvgHR?.[0] },
        maxSinus: { name: 'Max HR sinus', before: 0, after: 10, white: [0, 8], printed: af => af.record?.maxSinusAvgHR?.[0] },
        // Longest R-R：心電圖為事件前 4 秒至後 6 秒，頭尾各 1 秒為灰色（報告印出中間 8 秒）。
        rr: { name: 'Longest R-R', before: 4, after: 6, white: [1, 9], printed: af => af.record?.longestRR?.[0] },
        // VEB／SVEB 清單（af-event-dialog）：只提供捲動檢視，不評分（score: false）。
        // 張數可達數千張，網站會替同一頁每張卡片讀取並畫出心電圖，全部放在同一頁會讓頁面停住；
        // 因此每頁 SCROLL_EVENT_PER_PAGE 張，由網站的頁碼列換頁。選印由每張卡片的勾選框判斷（Minimap 的「印」）。
        ...Object.fromEntries([
            ['V_isolated', 'VEB Isolated'], ['couplets', 'VEB Couplet'], ['triplets', 'VEB Triplet'],
            ['bigemini', 'VEB Bigeminy'], ['trigemini', 'VEB Trigeminy'], ['vt', 'VT'],
            ['S_isolated', 'SVEB Isolated'], ['sveb2s', 'SVEB Couplet'], ['sveb3s', 'SVEB Triplet'],
            ['S_bigemini', 'SVEB Bigeminy'], ['S_trigemini', 'SVEB Trigeminy'], ['sve', 'SVE run'], ['psvt', 'SVT'],
            // Tachycardia、Bradycardia、Pause（含 2–3、3–4、4–5、≥5 秒）：同樣不評分；可按住左鍵在心電圖上拖曳快速消除（見 SWIPE_TYPES）。
            ['tachy', 'Tachycardia'], ['brady', 'Bradycardia'], ['pause', 'Pause'], ['pause23', 'Pause 2–3 s'],
            ['pause34', 'Pause 3–4 s'], ['pause45', 'Pause 4–5 s'], ['pause5', 'Pause ≥5 s'],
        ].map(([type, name]) => [type, { name, score: false, perPage: SCROLL_EVENT_PER_PAGE,
            // VEB／SVEB 清單另有「僅選印」篩選（Tachy／Brady／Pause 沒有）。
            printFilter: !/^(tachy|brady|pause)/.test(type) }])),
    };
    const SCROLL_DIALOG_IDS = ['af-hr-dialog', 'af-rr-dialog', 'af-event-dialog'];
    const SCROLL_ALL_PER_PAGE = 100000; // 捲動檢視時的每頁張數（全部放在同一頁）
    const SCROLL_MIN_HEIGHT = 320; // 卡片捲動區的最小高度（原本清單很短時）
    const SCROLL_LIVE_MARGIN = '1200px 0px'; // 捲動區上下這個範圍內的卡片才參與網站的更新（其餘暫停，見 suspendScrollCard）
    const SCROLL_TOP_OFFSET = 48; // Minimap 面板的上緣（清單標題列下方）
    const SCROLL_MAP_WIDTH = 88; // 右側 Minimap 面板寬度
    const SCROLL_MAP_CELL_MAX = 22; // Minimap 每個燈號（含間距）最高的像素
    const SCROLL_MAP_CELL_MIN = 8; // 最低的像素（燈號 6px＋間距 2px）；放不下時 Minimap 跟著清單捲動
    const SCROLL_MAP_GUTTER = 22; // 左側編號刻度的寬度
    const SCROLL_MAP_TICK_STEPS = [5, 10, 20, 50, 100]; // 刻度間隔的候選（張），取標示間距至少 28px 的最小者
    const SCROLL_EVEN_STEPS = [[0.15, 0], [0.3, 20], [0.5, 40]]; // RR 與中位數最多相差的比例上限 → 扣分；超過最後一級扣 60
    const SCROLL_SPREAD_BINS = 4; // 標籤分布：白色區段平均分成幾段
    // 評分條件：check 回傳 { penalty: 扣分（0～100）, note: 說明 }；總分 = 100 − 扣分合計（最低 0）。
    // 新增條件時加入此陣列即可；types 省略表示所有清單都適用。
    // check 的參數：beats 為白色區段（報告印出的 8 秒）內的心搏 [{ offset, type }]（offset 為自心電圖起點的秒數，A 視為 S），
    // all 為整張心電圖的心搏，white 為白色區段 [開始秒, 結束秒]，start 為心電圖起點時間，duration 為長度（秒），另有 config、af、type。
    const SCROLL_CRITERIA = [
        { id: 'even', name: 'BPM 速度', types: ['minHR', 'maxHR', 'maxSinus'], check: scoreEvenRate },
        // Longest R-R 的目的是找出最長的 R-R（暫停），速度本來就不平均，改看暫停本身是否完整、清楚地印在報告上。
        { id: 'pause', name: '暫停完整', types: ['rr'], check: scorePauseInWhite },
        { id: 'pauseAt', name: '暫停位置', types: ['rr'], check: scorePauseAtEvent },
        { id: 'pauseContext', name: '前後心搏', types: ['rr'], check: scorePauseContext },
        { id: 'spread', name: '標籤分布', types: ['minHR', 'maxHR', 'maxSinus'], check: scoreLabelSpread },
        { id: 'avgBPM', name: '平均 BPM', types: ['minHR', 'maxHR', 'maxSinus'], check: scoreAverageBPM },
        { id: 'plausible', name: '合理心率', types: ['minHR', 'maxHR', 'maxSinus'], check: scorePlausibleRate },
        { id: 'sinusVS', name: 'V／S 標籤', types: ['maxSinus'], check: scoreSinusEctopic },
        { id: 'sinusAF', name: 'AF 時段', types: ['maxSinus'], check: scoreSinusAF },
        { id: 'noise', name: '雜訊', check: scoreNoise },
        { id: 'pauseNoise', name: '暫停雜訊', types: ['rr'], check: scorePauseNoise },
    ];
    function scrollIntervals(beats) {
        const intervals = [];
        for (let i = 1; i < beats.length; i++) intervals.push(beats[i].offset - beats[i - 1].offset);
        return intervals.filter(value => value > 0);
    }
    // BPM 是否平均：相鄰 RR 與中位 RR 最多相差的比例（Min／Max HR、Max HR sinus）。
    function scoreEvenRate({ beats }) {
        const intervals = scrollIntervals(beats);
        if (intervals.length < 2) return { penalty: 50, note: '心搏標籤不足，無法判斷速度' };
        const middle = median(intervals);
        const deviation = Math.max(...intervals.map(value => Math.abs(value - middle) / middle));
        const rates = intervals.map(value => 60 / value);
        const range = `${Math.round(Math.min(...rates))}–${Math.round(Math.max(...rates))} bpm`;
        const step = SCROLL_EVEN_STEPS.find(([limit]) => deviation <= limit);
        const penalty = step ? step[1] : 60;
        return penalty ? { penalty, note: `速度不平均：RR 最多相差 ${Math.round(deviation * 100)}%（${range}）` }
            : { penalty: 0, note: `速度平均（${range}）` };
    }
    // 標籤是否集中：白色區段內有一段超過 2 倍中位 RR 沒有標籤（可能漏標或雜訊），或某一段的標籤數超過平均的 2 倍。
    function scoreLabelSpread({ beats, white }) {
        const [from, to] = white;
        if (beats.length < 3) return { penalty: 50, note: '白色區段內的心搏標籤少於 3 顆' };
        const at = value => (value - from).toFixed(1);
        const middle = median(scrollIntervals(beats)) || 1;
        const gaps = [[from, beats[0].offset], ...beats.slice(1).map((beat, i) => [beats[i].offset, beat.offset]),
            [beats[beats.length - 1].offset, to]];
        const widest = gaps.reduce((best, gap) => gap[1] - gap[0] > best[1] - best[0] ? gap : best);
        const notes = [];
        let penalty = 0;
        if (widest[1] - widest[0] > Math.max(2 * middle, 1.2)) {
            penalty += 40;
            notes.push(`第 ${at(widest[0])}–${at(widest[1])} 秒沒有標籤`);
        }
        const bins = new Array(SCROLL_SPREAD_BINS).fill(0);
        const size = (to - from) / bins.length;
        for (const beat of beats) bins[Math.min(bins.length - 1, Math.max(0, Math.floor((beat.offset - from) / size)))]++;
        const peak = bins.indexOf(Math.max(...bins));
        if (beats.length >= bins.length && bins[peak] >= 2 * beats.length / bins.length) {
            penalty += 30;
            notes.push(`標籤集中在第 ${at(from + peak * size)}–${at(from + (peak + 1) * size)} 秒`);
        }
        return penalty ? { penalty, note: notes.join('；') } : { penalty: 0, note: '標籤分布平均' };
    }
    // Longest R-R：整張心電圖（含灰色區段）中最長的 R-R，{ gap, from, to }（秒，自心電圖起點）。
    const SCROLL_PAUSE_EVENT_SLACK = 1; // 事件時間可比暫停起點早的秒數（清單時間以整秒記錄）
    const SCROLL_PAUSE_CONTEXT = 2; // 暫停前、後在白色區段內至少要有的心搏數
    // 節律規則（例如心搏都約 1.45 秒）時多段 R-R 幾乎一樣長，只差幾毫秒的那段可能剛好跨到灰色區段；
    // 與最長者相差在 SCROLL_PAUSE_TIE（或 3%）內的都視為同樣最長，優先取位於事件時間（event，秒）的那段。
    const SCROLL_PAUSE_TIE = 0.05; // 視為同樣最長的差距下限（秒）
    function longestInterval(all, event = null) {
        const intervals = [];
        for (let i = 1; i < all.length; i++) {
            const gap = all[i].offset - all[i - 1].offset;
            if (gap > 0) intervals.push({ gap, from: all[i - 1].offset, to: all[i].offset });
        }
        if (!intervals.length) return null;
        const best = intervals.reduce((top, interval) => interval.gap > top.gap ? interval : top);
        if (event === null) return best;
        const tie = Math.max(SCROLL_PAUSE_TIE, best.gap * 0.03);
        return intervals.find(interval => interval.gap >= best.gap - tie
            && event >= interval.from - SCROLL_PAUSE_EVENT_SLACK && event <= interval.to) || best;
    }
    const pauseText = pause => `${Math.round(pause.gap * 1000)} ms（第 ${pause.from.toFixed(1)}–${pause.to.toFixed(1)} 秒）`;
    // 暫停兩端的心搏都要在報告印出的白色區段內，報告上才看得到完整的暫停；沒有 R-R 即零分。
    function scorePauseInWhite({ all, white, config }) {
        const pause = longestInterval(all, config.before);
        if (!pause) return { penalty: 100, note: '心搏標籤不足，找不到 R-R' };
        const [from, to] = white;
        return pause.from >= from && pause.to <= to ? { penalty: 0, note: `最長 R-R ${pauseText(pause)}完整印在白色區段內` }
            : { penalty: 60, note: `最長 R-R ${pauseText(pause)}超出白色區段，報告上看不到完整的暫停` };
    }
    // 清單的事件時間應落在最長的 R-R 上（與最長者幾乎一樣長的也算），否則畫面中最長的那段不是清單記錄的暫停（例如標籤被改過）。
    function scorePauseAtEvent({ all, config }) {
        const pause = longestInterval(all, config.before);
        if (!pause) return { penalty: 0, note: '找不到 R-R' };
        const event = config.before;
        return event >= pause.from - SCROLL_PAUSE_EVENT_SLACK && event <= pause.to
            ? { penalty: 0, note: '最長 R-R 位於事件時間' }
            : { penalty: 40, note: `最長 R-R 在第 ${pause.from.toFixed(1)}–${pause.to.toFixed(1)} 秒，不在事件時間（第 ${event} 秒）` };
    }
    // 暫停前後各至少 2 顆心搏印在白色區段內，才看得出暫停前後的節律。
    function scorePauseContext({ all, white, config }) {
        const pause = longestInterval(all, config.before);
        if (!pause) return { penalty: 0, note: '找不到 R-R' };
        const [from, to] = white;
        const before = all.filter(beat => beat.offset >= from && beat.offset <= pause.from).length;
        const after = all.filter(beat => beat.offset >= pause.to && beat.offset <= to).length;
        return before >= SCROLL_PAUSE_CONTEXT && after >= SCROLL_PAUSE_CONTEXT
            ? { penalty: 0, note: `暫停前 ${before} 顆、後 ${after} 顆` }
            : { penalty: 20, note: `白色區段內暫停前 ${before} 顆、後 ${after} 顆（各需 ${SCROLL_PAUSE_CONTEXT} 顆）` };
    }
    // Max HR sinus：報告印出的白色區段內有 V 或 S 標籤（含未儲存的修改）即零分；灰色區段不會印出，不列入。
    function scoreSinusEctopic({ beats }) {
        const v = beats.filter(beat => beat.type === 'V').length;
        const s = beats.filter(beat => beat.type === 'S').length;
        if (!v && !s) return { penalty: 0, note: '白色區段內沒有 V／S 標籤' };
        return { penalty: 100, note: `含 ${[v ? `V×${v}` : '', s ? `S×${s}` : ''].filter(Boolean).join(' ')}` };
    }
    // Max HR sinus：與 AF 時段（含未儲存的 AF 編輯）重疊即零分。
    function scoreSinusAF({ af, start, duration }) {
        const end = start + duration;
        return getAFRanges(af).some(([from, to]) => from < end && to > start)
            ? { penalty: 100, note: '與 AF 時段重疊' } : { penalty: 0, note: '不在 AF 時段' };
    }
    // 實際平均 BPM：與「變動率自動標註器」按住 ` 的平均相同，取白色區段內每段 R-R 的 BPM（四捨五入成整數，與標籤相同）平均；
    // R-R 標籤畫在兩顆心搏中間，因此以 R-R 中點是否落在白色區段判斷。
    const SCROLL_AVG_TOLERANCE = 10; // 與清單 HR 相差在 ±10 BPM 內為允許範圍
    const SCROLL_AVG_PENALTY = 40; // 超出允許範圍的扣分
    function scrollAverageBPM(all, white) {
        const [from, to] = white;
        const rates = [];
        for (let i = 1; i < all.length; i++) {
            const gap = all[i].offset - all[i - 1].offset;
            const middle = (all[i].offset + all[i - 1].offset) / 2;
            if (gap > 0 && middle >= from && middle < to) rates.push(Math.round(60 / gap));
        }
        return rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : null;
    }
    function formatBPM(value) {
        return value.toFixed(1).replace(/\.0$/, '');
    }
    // 實際平均 BPM 與清單（卡片右上角 HR）相差超過 ±10 即扣分；讀不到清單 HR 或沒有 R-R 時不扣分（只顯示）。
    function scoreAverageBPM({ avgBPM, listedHR }) {
        if (avgBPM === null) return { penalty: 0, note: '白色區段內沒有 R-R，無法計算平均' };
        if (!(listedHR > 0)) return { penalty: 0, note: `實際平均 ${formatBPM(avgBPM)} bpm（讀不到清單 HR）` };
        const diff = avgBPM - listedHR;
        const note = `實際平均 ${formatBPM(avgBPM)} bpm，清單 ${listedHR} bpm（差 ${diff >= 0 ? '+' : '−'}${formatBPM(Math.abs(diff))}）`;
        return Math.abs(diff) <= SCROLL_AVG_TOLERANCE ? { penalty: 0, note }
            : { penalty: SCROLL_AVG_PENALTY, note: `${note}，超出 ±${SCROLL_AVG_TOLERANCE}` };
    }
    // 合理心率：其他條件都是相對比較（RR 與中位數、與清單 HR），整段都漏標時（例如每 3 秒才一個標籤、平均 19 bpm）仍會滿分；
    // 因此另以絕對範圍檢查：平均心率超出 30～220 bpm，或白色區段內有單一 R-R 超過 2.5 秒（約 24 bpm）或短於 0.27 秒（約 220 bpm），
    // 多半是漏標、重複標註或雜訊。R-R 與平均 BPM 相同，以中點落在白色區段內者為準。
    const SCROLL_RATE_RANGE = [30, 220]; // 平均心率的合理範圍（bpm）
    const SCROLL_RR_RANGE = [0.27, 2.5]; // 單一 R-R 的合理範圍（秒）
    function scorePlausibleRate({ all, white, avgBPM }) {
        if (avgBPM === null) return { penalty: 0, note: '沒有 R-R，無法判斷' };
        const [from, to] = white;
        const gaps = [];
        for (let i = 1; i < all.length; i++) {
            const gap = all[i].offset - all[i - 1].offset;
            const middle = (all[i].offset + all[i - 1].offset) / 2;
            if (gap > 0 && middle >= from && middle < to) gaps.push(gap);
        }
        const notes = [];
        let penalty = 0;
        if (avgBPM < SCROLL_RATE_RANGE[0] || avgBPM > SCROLL_RATE_RANGE[1]) {
            penalty += 60;
            notes.push(`平均 ${formatBPM(avgBPM)} bpm 超出 ${SCROLL_RATE_RANGE[0]}–${SCROLL_RATE_RANGE[1]}，可能漏標或雜訊`);
        }
        const longest = Math.max(...gaps);
        const shortest = Math.min(...gaps);
        if (longest > SCROLL_RR_RANGE[1]) {
            penalty += 40;
            notes.push(`有 R-R 長達 ${longest.toFixed(2)} 秒（可能漏標或暫停）`);
        }
        if (shortest < SCROLL_RR_RANGE[0]) {
            penalty += 40;
            notes.push(`有 R-R 僅 ${Math.round(shortest * 1000)} ms（可能重複標註）`);
        }
        return penalty ? { penalty, note: notes.join('；') } : { penalty: 0, note: '心率與 R-R 都在合理範圍' };
    }
    // 雜訊：白色區段每 0.2 秒一格，符合其一即為雜訊格。回傳 [{ from, to, big }]（秒，自心電圖起點）。
    // · 振幅過大：格內峰對峰超過 5 mV，且為這張各格峰對峰中位數的 6 倍以上（雜訊爆發常達 7～20 mV）。
    //   不用「超出卡片畫面」判斷：寬大的 QRS（VT、早搏）本來就常超出畫面，會被誤判。
    // · 密集震盪：格內有 8 次以上超過 0.15 mV 的轉向。正常心電圖（含 120 bpm 以上、QRS 較大者）一格最多約 6 次。
    const SCROLL_NOISE_WINDOW = 0.2; // 每格秒數
    const SCROLL_NOISE_BIG = 5; // 振幅過大的峰對峰下限（mV）
    const SCROLL_NOISE_BIG_RATIO = 6; // 振幅過大須為各格峰對峰中位數的倍數
    const SCROLL_NOISE_SWING = 0.15; // 算作一次轉向的最小振幅（mV）
    const SCROLL_NOISE_TURNS = 8; // 一格內轉向達此次數即為雜訊
    const SCROLL_NOISE_STEPS = [[2.5, 60], [1, 40], [0.4, 20]]; // 雜訊秒數達此值 → 扣分（取第一個符合的）
    const SCROLL_PAUSE_NOISE_PENALTY = 40; // 最長 R-R 內或兩端有雜訊的扣分
    function scrollNoiseWindows(data, start, white) {
        const values = Array.isArray(data?.ecg) ? data.ecg.map(Number) : [];
        const sampleRate = Number(data?.sampleRate) || 250;
        const fromTime = Number(data?.fromTimestamp);
        if (!values.length || !Number.isFinite(fromTime)) return [];
        const index = second => Math.max(0, Math.min(values.length, Math.round((start + second - fromTime) * sampleRate)));
        const step = Math.max(1, Math.round(SCROLL_NOISE_WINDOW * sampleRate));
        const end = index(white[1]);
        const cells = [];
        for (let a = index(white[0]); a < end; a += step) {
            const b = Math.min(end, a + step);
            let turns = 0, dir = 0, top = values[a], bottom = values[a], high = -Infinity, low = Infinity;
            for (let i = a; i < b; i++) {
                const value = values[i];
                if (!Number.isFinite(value)) continue;
                if (value > high) high = value;
                if (value < low) low = value;
                if (dir !== -1) {
                    if (value > top) top = value;
                    if (top - value > SCROLL_NOISE_SWING) { turns++; dir = -1; bottom = value; }
                }
                if (dir !== 1) {
                    if (value < bottom) bottom = value;
                    if (value - bottom > SCROLL_NOISE_SWING) { turns++; dir = 1; top = value; }
                }
            }
            const from = fromTime + a / sampleRate - start;
            cells.push({ from, to: from + (b - a) / sampleRate, span: high > low ? high - low : 0, turns });
        }
        const spans = cells.map(cell => cell.span).sort((x, y) => x - y);
        const bigLimit = Math.max(SCROLL_NOISE_BIG, SCROLL_NOISE_BIG_RATIO * (spans[spans.length >> 1] || 0));
        return cells.filter(cell => cell.span > bigLimit || cell.turns >= SCROLL_NOISE_TURNS)
            .map(cell => ({ from: cell.from, to: cell.to, big: cell.span > bigLimit }));
    }
    function scoreNoise({ noise }) {
        const seconds = noise.length * SCROLL_NOISE_WINDOW;
        const step = SCROLL_NOISE_STEPS.find(([limit]) => seconds >= limit - 1e-6);
        if (!step) return { penalty: 0, note: seconds ? `雜訊約 ${seconds.toFixed(1)} 秒（未達扣分）` : '白色區段內沒有明顯雜訊' };
        const big = noise.filter(window => window.big).length * SCROLL_NOISE_WINDOW;
        const parts = [big ? `振幅過大 ${big.toFixed(1)} 秒` : '', seconds > big + 1e-6 ? `密集震盪 ${(seconds - big).toFixed(1)} 秒` : '']
            .filter(Boolean).join('、');
        return { penalty: step[1], note: `白色區段內雜訊約 ${seconds.toFixed(1)} 秒（${parts}）` };
    }
    // Longest R-R：最長的 R-R 內或兩端（±0.1 秒）有雜訊時，暫停可能是雜訊造成的（例如飽和後的平線），或心搏被雜訊蓋住而漏標。
    function scorePauseNoise({ all, noise, config }) {
        const pause = longestInterval(all, config.before);
        if (!pause) return { penalty: 0, note: '找不到 R-R' };
        const hit = noise.some(window => window.to > pause.from - 0.1 && window.from < pause.to + 0.1);
        return hit ? { penalty: SCROLL_PAUSE_NOISE_PENALTY, note: `最長 R-R（第 ${pause.from.toFixed(1)}–${pause.to.toFixed(1)} 秒）內或兩端有雜訊，暫停可能不可靠` }
            : { penalty: 0, note: '最長 R-R 內沒有雜訊' };
    }
    function scoreScrollItem(view, item) {
        const { config, type, af } = view.ctx;
        const start = item.time - config.before;
        const duration = config.before + config.after;
        const all = effectiveEventBeats(item.data, af.ecgAnno?.modifiedData, start)
            .filter(beat => beat.offset >= 0 && beat.offset < duration);
        const [from, to] = config.white;
        const beats = all.filter(beat => beat.offset >= from && beat.offset <= to);
        const avgBPM = scrollAverageBPM(all, config.white);
        const listedHR = HR_VALUE_LISTS[type] ? getHRValueMap(af, type).get(item.time) ?? null : null;
        let noise = [];
        try { noise = scrollNoiseWindows(item.data, start, config.white); } catch (_) { noise = []; }
        const input = { beats, all, white: config.white, start, duration, config, af, type, avgBPM, listedHR, noise };
        const results = SCROLL_CRITERIA.filter(criterion => !criterion.types || criterion.types.includes(type))
            .map(criterion => {
                let outcome;
                try { outcome = criterion.check(input) || { penalty: 0 }; } catch (_) { outcome = { penalty: 0, note: '無法判斷' }; }
                return { id: criterion.id, name: criterion.name, penalty: Math.max(0, Number(outcome.penalty) || 0), note: outcome.note || '' };
            });
        const score = Math.max(0, 100 - results.reduce((sum, result) => sum + result.penalty, 0));
        return { score, results, light: score >= 100 ? 'green' : score > 0 ? 'yellow' : 'red', avgBPM, listedHR };
    }

    const scrollStyle = document.createElement('style');
    scrollStyle.textContent = `
        .rc-scroll-open { display:inline-flex; align-items:center; gap:5px; height:22px; margin:0 6px; padding:0 10px; border:1px solid #8fb43a;
            border-radius:11px; background:#f4f9e8; color:#4f6b1a; font-family:inherit; font-weight:600; font-size:12px; line-height:20px;
            cursor:pointer; vertical-align:middle; box-shadow:0 1px 3px rgba(0,0,0,.12); transition:background .15s, color .15s; }
        .rc-scroll-open:hover, .rc-scroll-open.is-on { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        /* 捲動檢視：網站清單改為單頁、一欄，卡片放在固定高度的捲動區內（高度與原本的清單相同），標題列與工具列不會捲走；
           Minimap 固定在畫面右側，清單右邊留出它的寬度。頁碼列、頁數拉條與選印圓點不需要；捲動區上緣移到 VEB／Misura 下方（見 openScrollView）；
           捲軸位置預先保留，心電圖寬度不會因出現捲軸而被切掉 */
        .ngdialog.rc-scroll-mode .ngdialog-content { padding-right:${SCROLL_MAP_WIDTH + 16}px !important; box-sizing:border-box; }
        .ngdialog.rc-scroll-mode .content-blk { box-sizing:border-box; padding:3px 4px 0 3px;
            overflow-x:hidden !important; overflow-y:auto !important; scrollbar-gutter:stable; overscroll-behavior:contain; border-radius:6px;
            box-shadow:inset 0 0 0 1px #e1e6d6; scrollbar-width:thin; scrollbar-color:#8fb43a #eef3e2; }
        .ngdialog.rc-scroll-mode .content-blk > .ecg-blk { display:flex !important; align-items:stretch; gap:12px; width:auto !important;
            scroll-margin-top:3px; border-radius:6px; transition:box-shadow .12s; }
        .ngdialog.rc-scroll-mode .content-blk > .ecg-blk > .ecg-wave { flex:0 0 auto; margin:0 !important; }
        /* 心電圖外框（centerRect 的 1px 外框線）壓在邊界上，外側半條被 svg 與 div.ecgWave（overflow:hidden）裁掉，
           縮放成某些比例時剩下的半條會被捨去而看不到右側邊框：外框多保留 1px，其餘超出的內容仍照常裁切 */
        .ngdialog.rc-scroll-mode .content-blk > .ecg-blk .ecgWave { overflow:clip !important; overflow-clip-margin:1px; }
        .ngdialog.rc-scroll-mode .content-blk > .ecg-blk .ecgWave > svg { overflow:visible; }
        .rc-scroll-side { display:flex; flex:1 1 auto; flex-direction:column; gap:5px; min-width:220px; max-width:560px; margin:4px 4px 4px 0;
            padding:8px 10px; box-sizing:border-box; overflow-y:auto; scrollbar-width:thin; border:1px solid #e1e6d6;
            border-left:4px solid #c4c9cc; border-radius:6px; background:#fafbf7; color:#4a555d; font-size:12px; line-height:1.35; }
        .rc-scroll-side.is-green { border-left-color:#3c9a5f; }
        .rc-scroll-side.is-yellow { border-left-color:#e0a526; }
        .rc-scroll-side.is-red { border-left-color:#c0392b; }
        .rc-scroll-side-head { display:flex; align-items:center; gap:8px; }
        .rc-scroll-side-head .rc-scroll-dot { width:14px; height:14px; }
        .rc-scroll-side-score { font-size:16px; font-weight:700; color:#333; }
        .rc-scroll-side-state { color:#7d8873; font-size:11px; }
        /* 實際平均 BPM（Min／Max HR、Max HR sinus）：與清單 HR 相差超出允許範圍時轉紅 */
        .rc-scroll-side-bpm { padding:0 7px; border-radius:9px; background:#eef3e2; color:#4f6b1a; font-size:12px; font-weight:700;
            line-height:18px; white-space:nowrap; }
        .rc-scroll-side-bpm:empty { display:none; }
        .rc-scroll-side-bpm.is-off { background:#fbe3e0; color:#a8321f; }
        /* 扣分的條件：每行一項，依扣分由多到少 */
        .rc-scroll-side-list { margin:0; padding:0; list-style:none; }
        .rc-scroll-side-list li { display:flex; align-items:baseline; gap:6px; padding:1px 0; }
        .rc-scroll-side-list .rc-side-icon { flex:0 0 12px; font-weight:700; text-align:center; }
        .rc-scroll-side-list .rc-side-name { flex:0 0 auto; font-weight:600; }
        .rc-scroll-side-list .rc-side-note { flex:1 1 auto; min-width:0; overflow:hidden; color:#6b7780; text-overflow:ellipsis; white-space:nowrap; }
        .rc-scroll-side-list .rc-side-penalty { flex:0 0 auto; font-weight:700; }
        .rc-scroll-side-list li.is-minus .rc-side-icon, .rc-scroll-side-list li.is-minus .rc-side-penalty { color:#b07d0e; }
        .rc-scroll-side-list li.is-zero .rc-side-icon, .rc-scroll-side-list li.is-zero .rc-side-penalty { color:#c0392b; }
        /* 通過的條件：縮成一排可換行的小標籤，條件增加時也不佔空間（滑過看說明） */
        .rc-scroll-side-pass { display:flex; flex-wrap:wrap; gap:4px; }
        .rc-scroll-side-pass span { padding:0 7px; border-radius:9px; background:#e3f3e8; color:#2d7a4a; font-size:11px; font-weight:600;
            line-height:18px; white-space:nowrap; cursor:default; }
        .ngdialog.rc-scroll-mode .content-blk > .ecg-blk.rc-scroll-active { box-shadow:0 0 0 3px rgba(91,125,26,.55); }
        /* HR／R-R 清單全部一頁，頁數拉條與選印圓點不需要；VEB／SVEB 分頁捲動保留拉條、選印圓點（點擊跳到該頁的選印）、
           「選印 N 張」（選印清單）與「快速選印」 */
        .ngdialog.rc-scroll-mode:not(.rc-scroll-paged) :is(pagination-event-bar, .pagination-range, .rc-print-panel, .rc-print-links, .rc-print-jumps, .rc-print-actions) { display:none !important; }
        .ngdialog.rc-scroll-mode:not(.rc-scroll-paged) ul.pagination { display:none !important; }
        /* VEB／SVEB 清單分頁捲動（每頁 SCROLL_EVENT_PER_PAGE 張）：保留上方頁碼列換頁，下方的頁碼列不需要 */
        .ngdialog.rc-scroll-mode.rc-scroll-paged .content-blk ~ .pagination-blk { display:none !important; }
        /* 不評分的清單：Minimap 為灰色，已選印的改為綠色 */
        .rc-scroll-map-cell.is-plain.is-printed { background:#8fb43a; }
        .rc-scroll-panel.is-plain .rc-scroll-next { display:none; }
        .rc-scroll-badge { display:inline-flex; align-items:center; gap:5px; max-width:52%; margin:0 8px; padding:0 8px 0 4px; height:18px;
            border-radius:9px; background:#eef0f1; color:#6b7780; font-size:11px; font-weight:600; line-height:18px; vertical-align:middle;
            white-space:nowrap; overflow:hidden; }
        .rc-scroll-badge.is-green { background:#e3f3e8; color:#2d7a4a; }
        .rc-scroll-badge.is-yellow { background:#fbf0d4; color:#8a6410; }
        .rc-scroll-badge.is-red { background:#fbe3e0; color:#a8321f; }
        .rc-scroll-dot { display:inline-block; flex:0 0 auto; width:12px; height:12px; border-radius:50%; background:#c4c9cc;
            box-shadow:inset 0 0 0 1px rgba(0,0,0,.12); }
        .is-green > .rc-scroll-dot, .rc-scroll-dot.is-green { background:#3c9a5f; }
        .is-yellow > .rc-scroll-dot, .rc-scroll-dot.is-yellow { background:#e0a526; }
        .is-red > .rc-scroll-dot, .rc-scroll-dot.is-red { background:#c0392b; }
        .rc-scroll-panel { position:fixed; top:${SCROLL_TOP_OFFSET}px; right:10px; bottom:10px; z-index:10001; width:${SCROLL_MAP_WIDTH}px;
            display:flex; flex-direction:column; gap:6px; padding:6px; box-sizing:border-box; border-radius:8px; background:#f3f5ee;
            box-shadow:0 2px 10px rgba(0,0,0,.22); font-size:11px; color:#4a555d; }
        .rc-scroll-counts { display:flex; flex-direction:column; gap:2px; font-weight:600; }
        .rc-scroll-counts > span { display:flex; align-items:center; gap:5px; }
        .rc-scroll-next, .rc-scroll-exit { height:22px; padding:0; border:1px solid #8fb43a; border-radius:11px; background:#fff; color:#4f6b1a;
            font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; }
        .rc-scroll-next:hover, .rc-scroll-exit:hover { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        /* 回到頂端、放大 ECG（Minimap 上方） */
        .rc-scroll-tools { display:flex; flex-direction:column; gap:4px; }
        .rc-scroll-tools button { height:22px; padding:0; border:1px solid #b9c6a0; border-radius:11px; background:#fff; color:#4f6b1a;
            font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; }
        .rc-scroll-tools button:hover, .rc-scroll-tools button.is-on { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        /* 放大 ECG：隱藏評分欄與網站的心電圖（標題列保留），改顯示拉寬到填滿卡片、高度不變的同一張心電圖（見 updateScrollZoom） */
        .ngdialog.rc-scroll-mode.rc-scroll-zoomed .content-blk > .ecg-blk > .rc-scroll-side { display:none !important; }
        .ngdialog.rc-scroll-mode.rc-scroll-zoomed .content-blk > .ecg-blk > .ecg-wave { flex:1 1 auto; width:auto !important; min-width:0; }
        .ngdialog.rc-scroll-mode.rc-scroll-zoomed .content-blk > .ecg-blk > .ecg-wave > .ecg-graphy-blk { display:none !important; }
        /* 選印範圍：隱藏評分欄與網站的心電圖（標題列保留），改顯示 30 秒的範圍（見 renderScrollContext） */
        .ngdialog.rc-scroll-mode.rc-scroll-context .content-blk > .ecg-blk > .rc-scroll-side { display:none !important; }
        .ngdialog.rc-scroll-mode.rc-scroll-context .content-blk > .ecg-blk > .ecg-wave { flex:1 1 auto; width:auto !important; min-width:0; }
        .ngdialog.rc-scroll-mode.rc-scroll-context .content-blk > .ecg-blk > .ecg-wave > .ecg-graphy-blk { display:none !important; }
        .rc-scroll-ctx, .rc-scroll-wide { position:relative; margin:2px 0 6px; }
        :is(.rc-scroll-ctx, .rc-scroll-wide) > .ecg-individual-blk { position:relative; }
        .rc-scroll-wide-clip { position:relative; overflow:hidden; }
        .rc-scroll-wide-inner { position:relative; }
        .rc-scroll-ctx-print { position:absolute; background:rgba(173,209,73,.08); pointer-events:none; z-index:3; }
        .rc-scroll-ctx-cover { position:absolute; left:0; right:0; z-index:4; }
        /* 選印的卡片標題列上的「換一個」（與快速選印相同的規則換成另一張） */
        .rc-scroll-swap { height:18px; margin:0 6px; padding:0 9px; border:1px solid #8fb43a; border-radius:9px; background:#f4f9e8; color:#4f6b1a;
            font-family:inherit; font-size:11px; font-weight:600; line-height:16px; vertical-align:middle; cursor:pointer; }
        .rc-scroll-swap:hover:not(:disabled) { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        .rc-scroll-swap:disabled { cursor:progress; opacity:.75; }
        .rc-scroll-swap[hidden] { display:none; }
        /* 最近一次新增的選印：卡片黃框、出現時閃一下，時間旁「新選印」；Minimap 黃框並標「新」 */
        .ngdialog.rc-scroll-mode .content-blk > .ecg-blk.rc-scroll-new { box-shadow:0 0 0 3px #f0b400; animation:rc-scroll-new-flash 1.2s ease-in-out 2; }
        @keyframes rc-scroll-new-flash { 50% { box-shadow:0 0 0 6px rgba(240,180,0,.45); background:rgba(255,236,170,.45); } }
        .rc-scroll-newbadge { margin:0 4px; padding:0 7px; border-radius:9px; background:#f0b400; color:#fff; font-size:11px; font-weight:700;
            line-height:18px; vertical-align:middle; }
        .rc-scroll-newbadge[hidden] { display:none; }
        .rc-scroll-map-cell.is-new { box-shadow:inset 0 0 0 2px #f0b400; color:#fff6d6; }
        .rc-scroll-ctx[data-state]::before { content:attr(data-state); position:absolute; left:10px; top:24px; color:#7d8873; font-size:12px; }
        .rc-scroll-map { position:relative; flex:1 1 auto; min-height:0; overflow:hidden; border-radius:5px; background:#e6eadf;
            box-shadow:inset 0 0 0 1px #d3d9c6; cursor:pointer; user-select:none; touch-action:none; }
        .rc-scroll-map-track { position:absolute; top:0; left:0; right:0; will-change:transform; }
        .rc-scroll-map-tick { position:absolute; left:0; width:${SCROLL_MAP_GUTTER - 4}px; height:0; border-top:1px solid #c6cdb8;
            pointer-events:none; }
        .rc-scroll-map-tick span { position:absolute; right:0; top:-6px; padding-right:1px; background:#e6eadf; color:#7d8873;
            font-size:9px; font-weight:600; line-height:11px; }
        .rc-scroll-map-cell { position:absolute; left:${SCROLL_MAP_GUTTER}px; right:4px; box-sizing:border-box; display:flex; align-items:center;
            justify-content:space-between; padding:0 3px; border-radius:3px; background:#c4c9cc; color:#fff; font-size:9px; font-weight:700;
            line-height:1; overflow:hidden; transition:filter .1s; }
        .rc-scroll-map-cell.is-green { background:#3c9a5f; }
        .rc-scroll-map-cell.is-yellow { background:#e0a526; }
        .rc-scroll-map-cell.is-red { background:#c0392b; }
        .rc-scroll-map-cell.is-printed { box-shadow:inset 3px 0 0 #1f3d05; }
        .rc-scroll-map-cell .rc-map-star { color:#ffe066; text-shadow:0 0 2px rgba(0,0,0,.6); }
        /* 燈號太小放不下文字時，星號改為右側的金色圓點 */
        .rc-scroll-map-cell.is-small.is-starred::after { content:''; position:absolute; top:50%; right:2px; width:4px; height:4px; margin-top:-2px;
            border-radius:50%; background:#ffe066; box-shadow:0 0 0 1px rgba(0,0,0,.35); }
        .rc-scroll-map-cell.is-active { left:${SCROLL_MAP_GUTTER - 3}px; right:1px; outline:2px solid #1a3fb8; outline-offset:0; z-index:1; }
        .rc-scroll-map-cell:hover { filter:brightness(1.15); }
        .rc-scroll-map-view { position:absolute; left:${SCROLL_MAP_GUTTER - 4}px; right:0; z-index:2; box-sizing:border-box;
            border:1px solid rgba(26,63,184,.6); border-radius:4px; background:rgba(26,63,184,.10); pointer-events:none; }
    `;
    document.head.appendChild(scrollStyle);

    // 捲動檢視的狀態：ctx 為清單、saved 為進入前的分頁設定；items 依網站卡片順序（currentData 的索引），
    // 同一時間的心電圖資料與評分共用 entries（以時間為鍵）。
    let scrollView = null;
    function getScrollListContext(dialog = null) {
        if (!window.angular) return null;
        const dialogs = dialog ? [dialog] : SCROLL_DIALOG_IDS.map(id => document.getElementById(id));
        for (const element of dialogs) {
            if (!isHRDialogShown(element)) continue;
            let scope;
            try { scope = window.angular.element(element).scope(); } catch (_) { continue; }
            const af = scope?.af;
            const ed = af?.eventDialog;
            const type = ed?.dscp?.type;
            const config = SCROLL_VIEW_TYPES[type];
            if (!config || !Array.isArray(ed.pageData)) continue;
            let host = scope;
            while (host && !Object.prototype.hasOwnProperty.call(host, 'pageChanged')) host = host.$parent;
            if (typeof host?.pageChanged !== 'function') continue;
            return { dialog: element, root: element.closest('.ngdialog'), scope, af, ed, type, config, host };
        }
        return null;
    }
    function scrollModSignature(af) {
        const list = af.ecgAnno?.modifiedData;
        const count = Array.isArray(list) ? list.length : 0;
        return `${count}|${count ? JSON.stringify(list[count - 1]) : ''}|${JSON.stringify(getAFRanges(af))}`;
    }
    // 效能：網站每張卡片的心電圖都監看同一份未儲存修改（af.ecgAnno.modifiedData），改一個標籤時所有卡片都會重畫標籤層；
    // 分頁時只有 6 張，捲動檢視時有數百張，每次修改會卡住數秒。因此只讓捲動區附近的卡片參與網站的更新（Angular digest）：
    // 離開這個範圍的卡片把整個 scope 樹的 $$watchers 暫時移開，回到範圍內時放回，網站隨即補畫一次最新的標籤。
    function walkScope(scope, visit) {
        visit(scope);
        for (let child = scope.$$childHead; child; child = child.$$nextSibling) walkScope(child, visit);
    }
    function suspendScrollCard(card) {
        const scope = window.angular.element(card).scope();
        if (!scope || scope.$$rcSuspended) return false;
        walkScope(scope, node => {
            if (node.$$rcSuspended) return;
            node.$$rcSuspended = node.$$watchers || [];
            node.$$watchers = [];
        });
        return true;
    }
    function resumeScrollCard(card) {
        const scope = window.angular.element(card).scope();
        if (!scope?.$$rcSuspended) return false;
        walkScope(scope, node => {
            const saved = node.$$rcSuspended;
            if (!saved) return;
            // 暫停期間新加入的監看（通常沒有）放在前面，與 Angular 新增監看的順序相同。
            if (node.$$watchers?.length) saved.unshift(...node.$$watchers);
            node.$$watchers = saved;
            delete node.$$rcSuspended;
        });
        return true;
    }
    function resumeAllScrollCards(view) {
        for (const card of getScrollCards(view)) resumeScrollCard(card);
    }
    function observeScrollCards(view, cards) {
        for (const card of cards) {
            if (view.observedCards.has(card)) continue;
            view.observedCards.add(card);
            view.liveObserver.observe(card);
        }
    }
    function getScrollCards(view) {
        return [...view.ctx.dialog.querySelectorAll(HR_CARD_SELECTOR)];
    }
    function scrollCardData(card) {
        try { return window.angular.element(card).scope()?.currentData || null; } catch (_) { return null; }
    }
    // 換頁：分頁資料 pages、目前頁碼 page，交給網站的 pageChanged 重新建立卡片並讀取心電圖。
    // 「排除 ±1 分」等排除中的清單（hrExclusion.pages）一併換成新的分頁，避免被當成網站換回完整清單而重新套用。
    // 先清空卡片再換頁：網站以 $index 沿用卡片，灰色遮罩（ecgMask）只在卡片建立時依寬度畫一次，沿用的卡片會留著舊寬度。
    // keepCards：卡片寬度不變時（捲動檢視中重新合併成一頁）沿用卡片，只換資料；
    // 數百張卡片全部重建會讓畫面卡住約 1～2 秒（例如每次選印後網站重新分頁）。
    function setScrollPages(ctx, pages, perPage, page, keepCards = false) {
        const { ed, host, type } = ctx;
        const replaced = hrExclusion.pages === ed.pageData;
        // 分兩次套用：網站的頁碼元件在總張數改變的同一次更新中，會以舊的總頁數把頁碼夾回 1，因此先換總張數、再設頁碼。
        host.$apply(() => {
            if (!keepCards) ed.currentData = [];
            ed.pageData = pages;
            ed.pagination.itemsPerPage = perPage;
            ed.pagination.totalItems = pages.reduce((sum, list) => sum + list.length, 0);
        });
        host.$apply(() => {
            ed.pagination.currentPage = page;
            ed.indexAdjust = (page - 1) * perPage;
            host.pageChanged(type);
        });
        if (replaced) hrExclusion.pages = ed.pageData;
    }
    function splitScrollPages(flat, perPage) {
        const pages = [];
        for (let i = 0; i < flat.length; i += perPage) pages.push(flat.slice(i, i + perPage));
        return pages.length ? pages : [[]];
    }
    function openScrollView(ctx) {
        if (scrollView) closeScrollView();
        if (!ctx.root) return;
        const pagination = ctx.ed.pagination;
        const flat = ctx.ed.pageData.flat();
        const perPage = Number(pagination.itemsPerPage) || 6;
        // scrollPer：捲動檢視的每頁張數（HR／R-R 全部一頁；VEB／SVEB 每頁 SCROLL_EVENT_PER_PAGE 張）；active 為目前這頁內的索引。
        const scrollPer = ctx.config.perPage || SCROLL_ALL_PER_PAGE;
        const absolute = Math.max(0, (Number(pagination.currentPage) - 1) * perPage);
        const startPage = Math.floor(absolute / scrollPer) + 1;
        const view = { ctx, saved: { perPage }, entries: new Map(), active: absolute - (startPage - 1) * scrollPer,
            scored: ctx.config.score !== false, perPage: scrollPer, page: startPage,
            panel: null, map: null, mapView: null, cells: [], count: 0, modSignature: scrollModSignature(ctx.af), timer: null, loadJob: null,
            modItems: (Array.isArray(ctx.af.ecgAnno?.modifiedData) ? ctx.af.ecgAnno.modifiedData : []).map(item => JSON.stringify(item)) };
        scrollView = view;
        // 捲動區高度：使整個清單視窗與原本分頁時一樣高（先量原本的高度，改版後再補上差距）。
        const content = view.content = ctx.dialog.querySelector('.content-blk');
        if (!content) { scrollView = null; return; }
        const dialogBox = ctx.root.querySelector('.ngdialog-content') || ctx.dialog;
        const originalDialog = dialogBox.offsetHeight;
        const originalContent = content.offsetHeight;
        // 先改成一欄再換頁：網站依卡片當時的寬度畫心電圖。
        ctx.root.classList.add('rc-scroll-mode');
        ctx.root.classList.toggle('rc-scroll-paged', scrollPer < SCROLL_ALL_PER_PAGE);
        alignScrollTop(view, false);
        content.style.height = `${Math.max(SCROLL_MIN_HEIGHT, originalContent)}px`;
        const adjusted = Math.max(SCROLL_MIN_HEIGHT, content.offsetHeight + originalDialog - dialogBox.offsetHeight);
        content.style.height = `${adjusted}px`;
        ctx.root.scrollTop = 0;
        setScrollPages(ctx, splitScrollPages(flat, scrollPer), scrollPer, startPage);
        const panel = view.panel = document.createElement('div');
        panel.className = 'rc-scroll-panel' + (view.scored ? '' : ' is-plain');
        panel.innerHTML = '<div class="rc-scroll-counts"></div>'
            + '<button type="button" class="rc-scroll-next" title="跳到下一張綠燈">▼ 綠燈</button>'
            + '<div class="rc-scroll-tools"><button type="button" class="rc-scroll-top" title="回到這頁第一張">▲ 頂端</button>'
            + '<button type="button" class="rc-scroll-zoom"></button><button type="button" class="rc-scroll-range"></button>'
            + '<button type="button" class="rc-scroll-printonly" hidden>僅選印</button></div>'
            + '<div class="rc-scroll-map" title="點燈號跳到該張心電圖；點空白處或拖曳可捲動"></div>'
            + '<button type="button" class="rc-scroll-exit" title="回到分頁顯示（Esc）">返回分頁</button>';
        view.map = panel.querySelector('.rc-scroll-map');
        panel.querySelector('.rc-scroll-next').addEventListener('click', () => jumpNextGreen(view));
        panel.querySelector('.rc-scroll-top').addEventListener('click', () => setScrollActive(view, 0, true));
        panel.querySelector('.rc-scroll-zoom').addEventListener('click', () => toggleScrollMode(view, 'zoom'));
        panel.querySelector('.rc-scroll-range').addEventListener('click', () => toggleScrollMode(view, 'context'));
        const printOnly = panel.querySelector('.rc-scroll-printonly');
        printOnly.hidden = !ctx.config.printFilter;
        printOnly.title = '只顯示選印的心電圖（綠色選印、橘色強制選印、藍色選印），再按一次顯示全部';
        printOnly.addEventListener('click', () => toggleScrollPrintFilter(view));
        setScrollMode(view, lastScrollMode);
        panel.querySelector('.rc-scroll-exit').addEventListener('click', () => closeScrollView());
        installScrollMapDrag(view);
        ctx.root.appendChild(panel);
        view.onScroll = () => {
            updateScrollMapView(view);
            // 選印範圍：捲到的卡片才讀取、畫出（每個畫面更新一次）。
            if (view.mode && !view.contextFrame) {
                view.contextFrame = requestAnimationFrame(() => { view.contextFrame = 0; updateScrollZoom(view); updateScrollContext(view); });
            }
        };
        // Minimap 的高度會隨上方計數文字變動，大小改變時重新排列燈號，避免超出面板。
        view.mapObserver = new ResizeObserver(() => layoutScrollMap(view));
        view.mapObserver.observe(view.map);
        view.onResize = () => layoutScrollMap(view);
        content.addEventListener('scroll', view.onScroll, { passive: true });
        window.addEventListener('resize', view.onResize);
        // 滑鼠按在卡片上即設為目前這張（藍框）。
        view.onPointer = event => {
            const card = event.target.closest?.(HR_CARD_SELECTOR);
            if (card) setScrollActive(view, getScrollCards(view).indexOf(card), false);
        };
        ctx.root.addEventListener('mousedown', view.onPointer, true);
        // 點拉條下方的選印圓點（VEB／SVEB）：網站換到該頁後，捲到該頁第一張選印的心電圖（見 tickScrollView）。
        view.onPrintJump = event => {
            if (event.target.closest?.('.rc-print-jump')) view.printJump = { at: performance.now() };
        };
        ctx.root.addEventListener('click', view.onPrintJump, true);
        view.observedCards = new WeakSet();
        view.liveObserver = new IntersectionObserver(entries => {
            let resumed = false;
            for (const entry of entries) {
                if (entry.isIntersecting) resumed = resumeScrollCard(entry.target) || resumed;
                else suspendScrollCard(entry.target);
            }
            // 放回監看後跑一次網站的更新，補畫暫停期間的標籤修改與尚未畫出的心電圖。
            if (resumed) view.ctx.host.$applyAsync();
        }, { root: content, rootMargin: SCROLL_LIVE_MARGIN });
        // 沿用卡片（選印時不重新處理心電圖）只用於 HR／R-R 清單：VEB／SVEB 清單網站讀取心電圖與判斷選印的方式不同，
        // 而且每頁只有 SCROLL_EVENT_PER_PAGE 張，交給網站處理。
        if (view.scored) installScrollReuse(view);
        view.timer = setInterval(() => tickScrollView(view), 600);
        tickScrollView(view);
        requestAnimationFrame(() => scrollToCard(view, view.active, 'auto'));
        decorateScrollButtons();
    }
    // 選印（selectHR）或重新分頁（pageChanged）時，網站會替目前這頁的每張卡片建立新資料，0.5 秒後再逐張重新處理心電圖；
    // 分頁時只有 6 張，捲動檢視一頁有數百張，每次選印都會卡住。卡片的時間都沒變、心電圖也都已載入時，
    // 沿用原本的卡片資料並取消網站的重新處理，只依網站相同的規則（setSelectedPrintEvent）更新選印勾選。
    // 清空後重建（setScrollPages 未指定 keepCards、rebuildScrollCards）時原本的卡片資料是空的，照常交給網站處理。
    function installScrollReuse(view) {
        const wrap = name => {
            let owner = view.ctx.host;
            while (owner && !Object.prototype.hasOwnProperty.call(owner, name)) owner = owner.$parent;
            const original = owner?.[name];
            if (typeof original !== 'function') return null;
            const wrapper = function (...args) {
                const before = scrollView === view ? view.ctx.ed.currentData : null;
                const result = original.apply(this, args);
                if (before && scrollView === view) reuseScrollCards(view, before);
                return result;
            };
            owner[name] = wrapper;
            return () => { if (owner[name] === wrapper) owner[name] = original; };
        };
        view.unwrap = ['selectHR', 'pageChanged'].map(wrap).filter(Boolean);
    }
    // 與網站 setSelectedPrintEvent 相同：依 af.printDialog.selectedEvents[printedEventType] 判斷是否已選印。
    function isSitePrintSelected(af, item, printedType) {
        const list = af.printDialog?.selectedEvents?.[printedType];
        if (!Array.isArray(list) || !list.length) return false;
        let time = 0;
        if (item.dataTmsRange) time = item.dataTmsRange[0];
        if (item.tagTime) time = item.tagTime;
        if (item.startTime) time = item.startTime;
        if (item.dataTime) time = item.dataTime;
        return list.indexOf(time) >= 0;
    }
    function reuseScrollCards(view, before) {
        const { ed, af, scope } = view.ctx;
        const next = ed.currentData;
        const timer = scope?.rooticare?.timer;
        if (!timer || !Array.isArray(before) || !before.length || !Array.isArray(next) || next === before) return;
        const pool = new Map();
        for (const item of before) {
            if (!Array.isArray(item?.ecgData) || !item.ecgData.length) return; // 還有心電圖沒載入完：交給網站處理
            const key = String(item.startTime);
            if (!pool.has(key)) pool.set(key, []);
            pool.get(key).push(item);
        }
        const reused = [];
        for (const item of next) {
            const old = pool.get(String(item?.startTime))?.shift();
            if (!old) return; // 有新的心電圖：交給網站處理
            reused.push(old);
        }
        clearTimeout(timer.ecgWave);
        const printedType = ed.dscp?.printedEventType;
        for (const item of reused) item.selectedEvent = isSitePrintSelected(af, item, printedType);
        ed.currentData = reused;
    }
    // 回到分頁：依原本每頁張數重新分頁，停在目前這張所在的頁。清單已關閉時只還原每頁張數（網站各清單共用分頁設定）。
    function closeScrollView() {
        const view = scrollView;
        if (!view) return;
        scrollView = null;
        clearInterval(view.timer);
        for (const restore of view.unwrap || []) restore();
        view.mapObserver?.disconnect();
        view.liveObserver?.disconnect();
        resumeAllScrollCards(view);
        const { ctx } = view;
        view.content.removeEventListener('scroll', view.onScroll);
        view.content.style.height = '';
        view.content.style.marginTop = '';
        ctx.root.removeEventListener('mousedown', view.onPointer, true);
        ctx.root.removeEventListener('click', view.onPrintJump, true);
        window.removeEventListener('resize', view.onResize);
        view.panel.remove();
        ctx.root.classList.remove('rc-scroll-mode', 'rc-scroll-paged', 'rc-scroll-zoomed', 'rc-scroll-context');
        for (const box of ctx.dialog.querySelectorAll('.rc-scroll-ctx, .rc-scroll-wide')) clearScrollContextBox(box);
        for (const node of ctx.dialog.querySelectorAll('.rc-scroll-badge, .rc-scroll-side, .rc-scroll-ctx, .rc-scroll-wide')) node.remove();
        for (const node of ctx.dialog.querySelectorAll('.rc-scroll-active')) node.classList.remove('rc-scroll-active');
        const perPage = view.saved.perPage;
        if (isHRDialogShown(ctx.dialog) && ctx.ed.dscp?.type === ctx.type && Array.isArray(ctx.ed.pageData)) {
            // 僅選印篩選中：回到分頁時還原完整清單。
            const flat = view.printOnly && view.fullFlat ? view.fullFlat : ctx.ed.pageData.flat();
            const pages = splitScrollPages(flat, perPage);
            const absolute = (Math.max(1, Number(ctx.ed.pagination?.currentPage) || 1) - 1) * view.perPage + view.active;
            const page = Math.min(Math.max(1, Math.floor(absolute / perPage) + 1), pages.length);
            setScrollPages(ctx, pages, perPage, page);
            ctx.root.scrollTop = 0;
        } else if ([SCROLL_ALL_PER_PAGE, view.perPage].includes(Number(ctx.ed.pagination?.itemsPerPage))) {
            ctx.ed.pagination.itemsPerPage = perPage;
        }
        decorateScrollButtons();
    }
    // 依網站目前的卡片更新：讀取並評分每個時間的心電圖、卡片上的燈號與 Minimap。
    function tickScrollView(view) {
        if (scrollView !== view) return;
        const ctx = getScrollListContext(view.ctx.dialog);
        if (!ctx || ctx.type !== view.ctx.type || ctx.root !== view.ctx.root) { closeScrollView(); return; }
        view.ctx = ctx;
        // 網站或排除功能把清單換回多頁（例如選印後重新分頁）時，再合併成一頁；卡片寬度不變，沿用卡片只換資料。
        const sitePer = Number(ctx.ed.pagination.itemsPerPage);
        if (view.perPage >= SCROLL_ALL_PER_PAGE) {
            if (ctx.ed.pageData.length > 1 || sitePer !== SCROLL_ALL_PER_PAGE) {
                setScrollPages(ctx, [ctx.ed.pageData.flat()], SCROLL_ALL_PER_PAGE, 1, true);
            }
        } else if (sitePer !== view.perPage || ctx.ed.pageData.some(page => Array.isArray(page) && page.length > view.perPage)) {
            // 分頁捲動（VEB／SVEB）：網站以別的每頁張數重新分頁時，換回 SCROLL_EVENT_PER_PAGE 張一頁，停在原本那頁第一張所在的頁。
            const flat = ctx.ed.pageData.flat();
            const first = (Math.max(1, Number(ctx.ed.pagination.currentPage) || 1) - 1) * (sitePer > 0 ? sitePer : view.perPage);
            const pages = splitScrollPages(flat, view.perPage);
            setScrollPages(ctx, pages, view.perPage, Math.min(pages.length, Math.floor(first / view.perPage) + 1));
        }
        // 僅選印篩選中，網站重新建立了完整的清單（例如重新 Group）：以新的清單再篩選一次。
        if (view.printOnly && ctx.ed.pageData !== view.filterPages) {
            const flat = ctx.ed.pageData.flat();
            if (flat.length > view.filterCount) { view.fullFlat = flat; applyScrollPrintFilter(view); }
            else view.filterPages = ctx.ed.pageData;
        }
        // 換頁（上方頁碼列）：回到這頁的第一張。
        const page = Math.max(1, Number(ctx.ed.pagination.currentPage) || 1);
        if (page !== view.page) {
            view.page = page;
            view.active = 0;
            view.content.scrollTop = 0;
        }
        alignScrollTop(view);
        updateScrollZoom(view);
        // 網頁縮放（視窗寬度改變）時網站依新寬度重畫心電圖，但灰色遮罩（ecgMask）只在卡片建立時畫一次，
        // 留著舊寬度會與心電圖錯位、蓋到右側評分欄：心電圖寬度改變時重建所有卡片。
        const ecgWidth = Number(ctx.af.ecgChart?.width) || 0;
        if (view.ecgWidth && ecgWidth && ecgWidth !== view.ecgWidth) rebuildScrollCards(view);
        view.ecgWidth = ecgWidth;
        const signature = scrollModSignature(ctx.af);
        if (view.scored && signature !== view.modSignature) {
            view.modSignature = signature;
            noteSavedScrollMods(view, ctx.af.ecgAnno?.modifiedData);
            for (const entry of view.entries.values()) if (entry.status === 'ready') entry.result = scoreScrollItem(view, entry);
        }
        const cards = getScrollCards(view);
        if (cards.length !== view.count) {
            view.count = cards.length;
            view.active = Math.min(view.active, Math.max(0, cards.length - 1));
            buildScrollMap(view);
        }
        observeScrollCards(view, cards);
        refreshScrollPrintSets(view);
        // 僅選印中有新的選印而重新篩選：卡片換新，下一輪再處理。
        if (trackScrollNewPrints(view)) { setTimeout(() => tickScrollView(view), 50); return; }
        // 換一個之後：等換上的那張出現在卡片中再捲過去（換頁後網站重建卡片，最多等 4 秒）。
        if (view.itemJump) {
            if (performance.now() - view.itemJump.at > 4000) view.itemJump = null;
            else {
                const index = cards.findIndex(card => toEventTime(scrollCardData(card)?.startTime) === view.itemJump.time);
                if (index >= 0) { view.itemJump = null; setScrollActive(view, index, true); }
            }
        }
        // 選印圓點跳頁後：網站約 0.5 秒後才標上各張的選印勾選，等到出現選印的卡片再捲過去（最多等 4 秒）。
        if (view.printJump) {
            const age = performance.now() - view.printJump.at;
            if (age > 4000) view.printJump = null;
            else if (age > 300) {
                const index = cards.findIndex(card => {
                    const data = scrollCardData(card);
                    return getScrollPrintKinds(view, data, toEventTime(data?.startTime)).length > 0;
                });
                if (index >= 0) { view.printJump = null; setScrollActive(view, index, true); }
            }
        }
        view.items = cards.map(card => toEventTime(scrollCardData(card)?.startTime));
        // 不評分的清單不讀取心電圖（卡片上的心電圖由網站自己讀取）。
        const missing = view.scored ? view.items.filter(time => time !== null && !view.entries.has(time)) : [];
        for (const time of missing) view.entries.set(time, { time, data: null, status: 'idle', result: null });
        if (missing.length) loadScrollEntries(view);
        cards.forEach((card, index) => decorateScrollCard(view, card, index));
        updateScrollSummary(view);
        updateScrollContext(view);
        updateScrollMapView(view);
    }
    // 清空後重建所有卡片（網站重新建立卡片並以目前寬度畫心電圖與灰色遮罩），重建後停在原本畫面最上方的那張。
    // 頁碼列隱藏後，右上角的 VEB／Measure（絕對定位）會壓到第一張卡片：捲動區上緣移到它下方。
    // 換成單頁後網站才收起頁碼列等列（例如 Longest R-R），捲動區會再往上移，因此每次檢查都重新校正；
    // keepHeight 時上緣移動多少、捲動區高度就減少多少，整個清單視窗高度不變。
    function alignScrollTop(view, keepHeight = true) {
        const content = view.content;
        const tools = view.ctx.dialog.querySelector('.tool-btns');
        if (!content || !tools || tools.offsetParent !== content.offsetParent || !tools.offsetHeight) return;
        const margin = parseFloat(content.style.marginTop) || 0;
        const next = Math.max(0, Math.round(tools.offsetTop + tools.offsetHeight + 6 - (content.offsetTop - margin)));
        if (next === margin) return;
        content.style.marginTop = next ? `${next}px` : '';
        const height = parseFloat(content.style.height);
        if (keepHeight && height) content.style.height = `${Math.max(SCROLL_MIN_HEIGHT, height - (next - margin))}px`;
    }
    // 顯示方式（view.mode）：'' 一般（顯示評分欄）、'zoom' 放大 ECG、'context' 選印範圍；兩個按鈕互斥，再按一次回到一般。
    // 切換過的顯示方式保留到重新整理頁面（之後開啟的捲動檢視沿用，換清單、換報告也一樣），重新整理後回到一般。
    // 放大 ECG：隱藏評分欄，心電圖拉寬到填滿卡片、高度不變、格子正方形（見 updateScrollZoom）。
    // 選印範圍：隱藏評分欄與網站的 10 秒心電圖，改顯示報告下方 30 秒縮圖的範圍（與選印清單的 👁 相同：印出的 8 秒前 11 秒起），
    // 以網站的元件畫成一列（可編輯標籤）；綠色底為印出的 8 秒。資料只讀取畫面附近的卡片。
    let lastScrollMode = ''; // 上次切換的顯示方式：之後開啟的捲動檢視沿用，重新整理頁面後回到一般
    const SCROLL_MODE_BUTTONS = {
        zoom: { selector: '.rc-scroll-zoom', off: '放大 ECG', on: '還原大小',
            offTitle: '隱藏評分欄，心電圖拉寬到填滿卡片，高度不變、格子維持正方形（波形跟著變高）', onTitle: '還原心電圖並顯示評分欄' },
        context: { selector: '.rc-scroll-range', off: '選印範圍', on: '還原心電圖',
            offTitle: '每張改顯示報告下方 30 秒縮圖的範圍（原比例，綠色為印出的 8 秒）', onTitle: '回到原本的心電圖並顯示評分欄' },
    };
    function setScrollMode(view, mode) {
        view.mode = mode || '';
        const root = view.ctx.root;
        root.classList.toggle('rc-scroll-zoomed', view.mode === 'zoom');
        root.classList.toggle('rc-scroll-context', view.mode === 'context');
        for (const [key, config] of Object.entries(SCROLL_MODE_BUTTONS)) {
            const button = view.panel?.querySelector(config.selector);
            if (!button) continue;
            const on = view.mode === key;
            button.classList.toggle('is-on', on);
            button.textContent = on ? config.on : config.off;
            button.title = on ? config.onTitle : config.offTitle;
        }
        updateScrollZoom(view);
        updateScrollContext(view);
    }
    function toggleScrollMode(view, mode) {
        // 切換後停在原本畫面最上方的那張。
        const content = view.content;
        let anchor = getScrollCards(view).findIndex(card => card.offsetTop + card.offsetHeight > content.scrollTop + 4);
        if (anchor < 0) anchor = view.active;
        setScrollMode(view, view.mode === mode ? '' : mode);
        lastScrollMode = view.mode;
        requestAnimationFrame(() => {
            scrollToCard(view, anchor, 'auto');
            updateScrollMapView(view);
            updateScrollContext(view);
        });
    }
    // 放大 ECG：把目前的心電圖拉寬到填滿卡片，高度不變，格子維持正方形（振幅一起放大）。依卡片上網站元件（標籤列、心電圖、灰色遮罩）原本的設定複製一份，
    // 只把寬度改成卡片寬度，資料仍是卡片自己的（currentData），標籤可照常點擊或用快捷鍵修改；點心電圖與原本相同
    // （複製網站的 graphy-cover：Tachy／Brady／Pause 點一下消除、拖曳快速消除都可用）。只畫捲動區附近的卡片。
    const SCROLL_WIDE_TAGS = { ecgRMarker: 'ecg-r-marker', ecgWave: 'ecg-wave', ecgMask: 'ecg-mask', ecgAnno: 'ecg-anno' };
    function escapeAttr(value) {
        return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    // 由卡片上已建立的網站元件（指令以 replace 建立，原本的屬性仍留在元素上）組出模板；回傳 { html, heightExpr, widthExpr }。
    function buildScrollWideTemplate(card) {
        const block = card.querySelector('.ecg-graphy-blk .ecg-individual-blk');
        if (!block) return null;
        let html = '<div class="ecg-individual-blk">';
        let heightExpr = null, widthExpr = null;
        for (const element of block.children) {
            const name = Object.keys(SCROLL_WIDE_TAGS).find(cls => element.classList.contains(cls));
            if (!name) continue;
            const tag = SCROLL_WIDE_TAGS[name];
            const attrs = [...element.attributes].filter(attr => attr.name.includes('-')).map(attr => {
                let value = attr.value;
                if (attr.name === 'canvas-width') {
                    if (tag === 'ecg-wave') widthExpr = value;
                    value = 'rcWide.width';
                }
                else if (attr.name === 'canvas-height' && tag !== 'ecg-r-marker') {
                    if (tag === 'ecg-wave') heightExpr = value;
                    value = 'rcWide.height';
                }
                return `${attr.name}="${escapeAttr(value)}"`;
            });
            const keep = [...element.classList].filter(cls => /^margin-/.test(cls));
            html += `<${tag} ${attrs.join(' ')}${keep.length ? ` class="${keep.join(' ')}"` : ''}></${tag}>`;
        }
        const siteCover = card.querySelector('.ecg-graphy-blk > .graphy-cover');
        const coverAttrs = siteCover ? [...siteCover.attributes].filter(attr => /^ng-(click|class)$/.test(attr.name))
            .map(attr => `${attr.name}="${escapeAttr(attr.value)}"`).join(' ') : '';
        html += `<div class="rc-scroll-ctx-cover${siteCover ? ' graphy-cover' : ''}" ng-show="!af.ecgEnlargedChart.chartSwitch" ${coverAttrs}></div></div>`;
        return heightExpr && widthExpr ? { html, heightExpr, widthExpr } : null;
    }
    function updateScrollZoom(view) {
        if (scrollView !== view) return;
        const boxes = view.content.querySelectorAll('.rc-scroll-wide');
        if (view.mode !== 'zoom') {
            for (const box of boxes) { clearScrollContextBox(box); box.remove(); }
            return;
        }
        const width = Math.floor(scrollCardWidth(view)) - 4;
        const top = view.content.scrollTop - SCROLL_CONTEXT_NEAR;
        const bottom = view.content.scrollTop + view.content.clientHeight + SCROLL_CONTEXT_NEAR;
        for (const card of getScrollCards(view)) {
            const wave = card.querySelector(':scope > .ecg-wave');
            const data = scrollCardData(card);
            if (!wave || !data) continue;
            let box = wave.querySelector(':scope > .rc-scroll-wide');
            if (!box) {
                box = document.createElement('div');
                box.className = 'rc-scroll-wide';
                wave.appendChild(box);
            }
            if (!view.wideTemplate) view.wideTemplate = buildScrollWideTemplate(card);
            const template = view.wideTemplate;
            const cardScope = window.angular?.element(card).scope();
            if (!template || !cardScope) continue;
            // 高度不變、格子維持正方形：以拉寬的倍率畫出較高的心電圖（振幅一起放大），只顯示原本高度的範圍，
            // 基準線維持在原本的位置（網站的 0 mV 在心電圖高度的 2/3），超出的波形裁掉。
            const baseWidth = Number(cardScope.$eval(template.widthExpr)) || width;
            const visible = Number(cardScope.$eval(template.heightExpr)) || 106;
            const height = Math.round(visible * width / baseWidth);
            const label = Number(view.ctx.af.ecgAnno?.height) || 20;
            box.style.minHeight = `${label + visible + 6}px`;
            if (card.offsetTop + card.offsetHeight < top || card.offsetTop > bottom) continue;
            // 網站尚未讀到這張的心電圖：等讀到後再畫（卡片資料換新時也重畫）。
            if (!Array.isArray(data.ecgData) || !data.ecgData.length) continue;
            if (box.rcSource === data.ecgData && box.rcWidth === width && box.rcScope) continue;
            renderScrollWide(box, cardScope, template.html, width, height, visible);
            box.rcSource = data.ecgData;
            box.rcWidth = width;
        }
    }
    function renderScrollWide(box, cardScope, html, width, height, visible) {
        const $compile = window.angular?.element(document.body).injector()?.get('$compile');
        clearScrollContextBox(box);
        if (!$compile) return;
        const scope = cardScope.$new();
        scope.rcWide = { width, height };
        const element = $compile(html)(scope)[0];
        box.rcScope = scope;
        box.appendChild(element);
        scope.$digest();
        // 心電圖與灰色遮罩放進固定高度的裁切框，往上移動使基準線落在原本的高度。
        const parts = [...element.children].filter(child => child.matches('.ecgWave, .ecgMask, .ecgAnno'));
        if (parts.length) {
            const clip = document.createElement('div');
            clip.className = 'rc-scroll-wide-clip';
            clip.style.height = `${visible}px`;
            const inner = document.createElement('div');
            inner.className = 'rc-scroll-wide-inner';
            inner.style.marginTop = `${-Math.round((height - visible) * 2 / 3)}px`;
            parts[0].before(clip);
            clip.appendChild(inner);
            for (const part of parts) inner.appendChild(part);
        }
        requestAnimationFrame(() => {
            const clip = element.querySelector('.rc-scroll-wide-clip');
            const cover = element.querySelector('.rc-scroll-ctx-cover');
            if (clip && cover) { cover.style.top = `${clip.offsetTop}px`; cover.style.height = `${clip.offsetHeight}px`; }
        });
    }
    function scrollCardWidth(view) {
        const style = getComputedStyle(view.content);
        return view.content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
    }
    const SCROLL_CONTEXT_NEAR = 1500; // 捲動區上下這個範圍內的卡片才讀取、畫出選印範圍（px）
    const SCROLL_CONTEXT_CONCURRENCY = 3;
    // 報告印出的 8 秒的起點（與 reviewPrintStart 相同的規則）：Min／Max HR、Max HR sinus 有 10 秒平均心率時為該時間，
    // Pause 為事件前 4 秒，其他（含 Longest R-R）為事件前 3 秒。
    function scrollPrintStart(view, time) {
        const { type, af } = view.ctx;
        if (['minHR', 'maxHR', 'maxSinus'].includes(type) && af.record?.hasAvgHRIn10s) return time;
        if (/^pause/.test(type)) return time - 4;
        return time - 3;
    }
    // 30 秒畫成一列、填滿卡片寬度：寬高比與網站的 10 秒卡片相同（格子維持正方形），因此高度較矮。
    function scrollContextSize(view, width) {
        const layout = view.ctx.af.eventDialogLayout || {};
        const pxPerSec = width / PRINT_CONTEXT_SECONDS;
        const sitePxPerSec = (Number(layout.width) || 800) / 10;
        const height = Math.round((Number(layout.height) || 106) * pxPerSec / sitePxPerSec);
        const label = Number(view.ctx.af.ecgAnno?.height) || 20;
        return { pxPerSec, height, total: label + height + 6 };
    }
    // 卡片內的標籤列與心電圖沿用網站自己的元件（ecg-r-marker、ecg-wave），改餵 30 秒的資料：
    // 標籤可照常點擊修改（需編輯模式），數字鍵、中鍵等快捷鍵也作用在這一列（.ecg-individual-blk）。
    const SCROLL_CONTEXT_TEMPLATE = '<div class="ecg-individual-blk">'
        + '<ecg-r-marker anno-data="rcCtx.anno" canvas-width="rcCtx.width" canvas-height="af.ecgAnno.height" seg-sec="rcCtx.sec"'
        + ' sample-rate="rcCtx.sampleRate" border-color="{{af.ecgChart.chartMajorGridColor}}" idx-adjust="rcCtx.adjust"'
        + ' modified-data="af.ecgAnno.modifiedData" start-time="rcCtx.start" event-disabled="!af.editingSwitch" font-size="12"'
        + ' interval-switch="true" pos-info="rcCtx.posInfo" class="margin-2"></ecg-r-marker>'
        + '<ecg-wave open-p-r-dialog="openPRDialog" pr-edit="true" pr-data="af.PREditing" ecg-data="rcCtx.ecg" canvas-width="rcCtx.width"'
        + ' canvas-height="rcCtx.height" sample-rate="rcCtx.sampleRate" seg-sec="rcCtx.sec"'
        + ' major-grid-color="{{af.ecgChart.chartMajorGridColor}}" minor-grid-color="{{af.ecgChart.chartMinorGridColor}}"'
        + ' bg-color="#fff" ecg-color="#262626" minor-grid-width="af.ecgChart.minorGridWidth" major-grid-width="af.ecgChart.majorGridWidth"'
        + ' splited-data="af.eventDialog.splitedData" event-switch="af.ecgEnlargedChart.chartSwitch" anno-data="rcCtx.anno"'
        + ' modified-data="af.ecgAnno.modifiedData" start-time="rcCtx.start" splited-anno="af.eventDialog.splitedAnno"'
        + ' pos-info="rcCtx.posInfo" splited-pos-info="af.eventDialog.splitedPosInfo" zoom-scale="af.hrChart.zoomScale"'
        + ' channel-switch="af.record.channelSwitch"></ecg-wave>'
        // 與網站卡片的 graphy-cover 相同：蓋住心電圖，滑鼠移過不會出現量測線；開啟 Measure 時才移開。
        + '<div class="rc-scroll-ctx-cover" ng-show="!af.ecgEnlargedChart.chartSwitch"></div></div>';
    function clearScrollContextBox(box) {
        box.rcScope?.$destroy();
        box.rcScope = null;
        box.textContent = '';
        delete box.dataset.key;
    }
    function updateScrollContext(view) {
        if (scrollView !== view) return;
        const cards = getScrollCards(view);
        if (view.mode !== 'context') {
            for (const box of view.content.querySelectorAll('.rc-scroll-ctx')) { clearScrollContextBox(box); box.remove(); }
            return;
        }
        if (!view.contextData) view.contextData = new Map();
        // 未儲存的修改減少（按了 Save 或放棄修改）：讀到的伺服器標籤已過期，等寫入完成後重新讀取（畫面先保留舊圖）。
        const mods = Array.isArray(view.ctx.af.ecgAnno?.modifiedData) ? view.ctx.af.ecgAnno.modifiedData.length : 0;
        if (view.contextMods > mods) {
            for (const delay of SCROLL_REFRESH_DELAYS) {
                setTimeout(() => {
                    if (scrollView !== view || view.mode !== 'context') return;
                    view.contextData.clear();
                    updateScrollContext(view);
                }, delay);
            }
        }
        view.contextMods = mods;
        const width = Math.floor(scrollCardWidth(view)) - 4;
        const size = scrollContextSize(view, width);
        const top = view.content.scrollTop - SCROLL_CONTEXT_NEAR;
        const bottom = view.content.scrollTop + view.content.clientHeight + SCROLL_CONTEXT_NEAR;
        let queued = false;
        cards.forEach(card => {
            const wave = card.querySelector(':scope > .ecg-wave');
            const time = toEventTime(scrollCardData(card)?.startTime);
            if (!wave || time === null) return;
            let box = wave.querySelector(':scope > .rc-scroll-ctx');
            if (!box) {
                box = document.createElement('div');
                box.className = 'rc-scroll-ctx';
                wave.appendChild(box);
            }
            // 尚未畫出的卡片先預留高度，捲動位置與 Minimap 才不會跳動。
            box.style.minHeight = `${size.total}px`;
            if (card.offsetTop + card.offsetHeight < top || card.offsetTop > bottom) return;
            const entry = view.contextData.get(time);
            if (!entry) {
                view.contextData.set(time, { status: 'idle', data: null });
                queued = true;
                if (!box.childElementCount) box.dataset.state = '讀取中…';
                return;
            }
            if (entry.status === 'error') { clearScrollContextBox(box); box.dataset.state = '讀取失敗'; return; }
            if (entry.status !== 'ready') return;
            const key = `${time}|${width}|${entry.version}`;
            if (box.dataset.key === key) return;
            renderScrollContext(view, card, box, entry.data, time, width, size);
            box.dataset.key = key;
            delete box.dataset.state;
        });
        if (queued) loadScrollContext(view);
    }
    async function loadScrollContext(view) {
        if (view.contextLoading) return;
        view.contextLoading = true;
        try {
            const pending = [...view.contextData].filter(([, entry]) => entry.status === 'idle').map(([time]) => time);
            await runLimited(pending, SCROLL_CONTEXT_CONCURRENCY, async time => {
                const entry = view.contextData.get(time);
                if (scrollView !== view || view.mode !== 'context' || entry?.status !== 'idle') return;
                entry.status = 'loading';
                const start = scrollPrintStart(view, time) - PRINT_CONTEXT_BEFORE;
                try {
                    entry.data = await fetchEventECG(view.ctx.af, time, time - start, start + PRINT_CONTEXT_SECONDS - time);
                    entry.data.rcStart = start;
                    entry.version = ++scrollContextSeq;
                    entry.status = 'ready';
                } catch (_) {
                    entry.status = 'error';
                }
                if (scrollView === view) updateScrollContext(view);
            });
        } finally {
            view.contextLoading = false;
        }
        // 讀取期間又捲到新的卡片：再讀一輪。
        if (scrollView === view && view.mode === 'context' && [...view.contextData.values()].some(entry => entry.status === 'idle')) {
            loadScrollContext(view);
        }
    }
    let scrollContextSeq = 0;
    function renderScrollContext(view, card, box, data, eventTime, width, size) {
        const cardScope = window.angular?.element(card).scope();
        const $compile = window.angular?.element(document.body).injector()?.get('$compile');
        clearScrollContextBox(box);
        if (!cardScope || !$compile) { box.dataset.state = '無法顯示'; return; }
        const sampleRate = Number(data.sampleRate) || Number(view.ctx.af.ecgChart?.sampleRate) || 250;
        const ecg = data.ecg.map(Number);
        const seconds = ecg.length / sampleRate;
        const start = Number.isFinite(data.rcStart) ? data.rcStart : eventTime - PRINT_CONTEXT_BEFORE - 3;
        // 紀錄開頭附近的事件：紀錄開始前沒有資料，伺服器從紀錄開始處回傳（較短），心電圖實際從 dataStart 開始。
        // 比例固定為 30 秒填滿寬度，較短的資料只畫出對應的寬度，印出範圍依實際起點定位。
        const recordStart = Number(view.ctx.af.record?.dataRange?.[0]);
        const dataStart = Number.isFinite(recordStart) && recordStart > start ? recordStart : start;
        const pxPerSec = width / PRINT_CONTEXT_SECONDS;
        const stripWidth = Math.min(width, Math.round(seconds * pxPerSec));
        const scope = cardScope.$new();
        scope.rcCtx = {
            ecg,
            anno: Object.entries(data.anno || {}).map(([index, type]) => ({ type, index: Number(index) })),
            posInfo: { idxRange: [data.fromIndex, data.endIndex], sampleRate, morphologyType: data.morphologyType || {} },
            sampleRate, sec: seconds, start: dataStart, width: stripWidth, height: size.height,
        };
        const element = $compile(SCROLL_CONTEXT_TEMPLATE)(scope)[0];
        box.rcScope = scope;
        box.appendChild(element);
        scope.$digest();
        // 印出的 8 秒（淡綠色）：疊在網站的心電圖上，不攔截滑鼠；遮罩（rc-scroll-ctx-cover）與心電圖同高。
        // 不標事件時間：清單的事件時間只到整秒，事件的心搏實際落在其後約 1 秒內，標出來反而容易誤會。
        const overlay = document.createElement('div');
        overlay.className = 'rc-scroll-ctx-print';
        const printLeft = (start + PRINT_CONTEXT_BEFORE - dataStart) * pxPerSec;
        overlay.style.left = `${Math.max(0, printLeft)}px`;
        overlay.style.width = `${Math.max(0, Math.min(stripWidth, printLeft + PRINT_SHOWN_SECONDS * pxPerSec) - Math.max(0, printLeft))}px`;
        element.appendChild(overlay);
        requestAnimationFrame(() => {
            const wave = element.querySelector('.ecgWave');
            if (!wave) return;
            overlay.style.top = `${wave.offsetTop}px`;
            overlay.style.height = `${wave.offsetHeight}px`;
            const cover = element.querySelector('.rc-scroll-ctx-cover');
            if (cover) { cover.style.top = `${wave.offsetTop}px`; cover.style.height = `${wave.offsetHeight}px`; }
        });
    }
    function rebuildScrollCards(view) {
        const { ctx, content } = view;
        let anchor = getScrollCards(view).findIndex(card => card.offsetTop + card.offsetHeight > content.scrollTop);
        if (anchor < 0) anchor = view.active;
        ctx.host.$apply(() => { ctx.ed.currentData = []; });
        ctx.host.$apply(() => ctx.host.pageChanged(ctx.type));
        requestAnimationFrame(() => scrollToCard(view, anchor, 'auto'));
    }
    // 評分用的心電圖標籤是開啟時向伺服器讀取的，再套上未儲存的修改（af.ecgAnno.modifiedData）。
    // 儲存（或 Discard）後網站清空未儲存的修改，若不重讀，分數會回到修改前的標籤：
    // 修改清單中消失的項目所在的卡片重新讀取。清空的時機可能早於伺服器寫入完成，因此稍後再讀一次。
    const SCROLL_REFRESH_DELAYS = [800, 3000]; // 未儲存修改消失後重新讀取的時間（ms）
    function noteSavedScrollMods(view, modifiedData) {
        const current = Array.isArray(modifiedData) ? modifiedData.map(item => JSON.stringify(item)) : [];
        const previous = view.modItems || [];
        view.modItems = current;
        const kept = new Set(current);
        const indexes = previous.filter(item => !kept.has(item))
            .map(item => { try { return Number(JSON.parse(item)?.[1]); } catch (_) { return NaN; } })
            .filter(Number.isFinite);
        if (!indexes.length) return;
        for (const delay of SCROLL_REFRESH_DELAYS) setTimeout(() => refreshScrollEntries(view, indexes), delay);
    }
    async function refreshScrollEntries(view, indexes) {
        if (scrollView !== view) return;
        const { af, config } = view.ctx;
        const targets = [...view.entries.values()].filter(entry => {
            if (entry.status !== 'ready' || !Array.isArray(entry.data?.ecg)) return false;
            const from = Number(entry.data.fromIndex) || 0;
            const to = from + entry.data.ecg.length;
            return indexes.some(index => index >= from && index <= to);
        });
        if (!targets.length) return;
        await runLimited(targets, QUICK_FETCH_CONCURRENCY, async entry => {
            if (scrollView !== view) return;
            try {
                entry.data = await fetchEventECG(af, entry.time, config.before, config.after);
                entry.result = scoreScrollItem(view, entry);
            } catch (_) { /* 讀取失敗時保留原本的資料與分數 */ }
        });
        if (scrollView === view) tickScrollView(view);
    }
    async function loadScrollEntries(view) {
        const job = view.loadJob = {};
        const pending = [...view.entries.values()].filter(entry => entry.status === 'idle');
        const { af, config } = view.ctx;
        await runLimited(pending, QUICK_FETCH_CONCURRENCY, async entry => {
            if (scrollView !== view || view.loadJob !== job || entry.status !== 'idle') return;
            entry.status = 'loading';
            try {
                entry.data = await fetchEventECG(af, entry.time, config.before, config.after);
                entry.status = 'ready';
                entry.result = scoreScrollItem(view, entry);
            } catch (_) {
                entry.status = 'error';
            }
        });
        if (scrollView === view) tickScrollView(view);
    }
    function scrollEntryLight(entry) {
        return entry?.status === 'ready' && entry.result ? entry.result.light : '';
    }
    // 卡片標題列：時間後方加上燈號與分數；右側評分欄列出各條件的明細。
    function decorateScrollCard(view, card, index) {
        if (!view.scored) {
            // 不評分的清單：沒有燈號與評分欄，只標示目前這張與更新 Minimap。
            card.classList.toggle('rc-scroll-active', index === view.active);
            updateScrollCell(view, card, index, null, '');
            decorateScrollSwap(view, card);
            return;
        }
        const header = card.querySelector('.event-blk-header');
        if (!header) return;
        let badge = header.querySelector('.rc-scroll-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'rc-scroll-badge';
            badge.innerHTML = '<span class="rc-scroll-dot"></span><b></b>';
            const anchor = header.querySelector('.pop-out-bnt');
            if (anchor) anchor.after(badge); else header.appendChild(badge);
        }
        const entry = view.entries.get(view.items[index]);
        const light = scrollEntryLight(entry);
        const score = light ? `${entry.result.score} 分` : entry?.status === 'error' ? '讀取失敗' : '評分中…';
        if (badge.dataset.signature !== `${light}|${score}`) {
            badge.dataset.signature = `${light}|${score}`;
            badge.className = 'rc-scroll-badge' + (light ? ` is-${light}` : '');
            badge.querySelector('b').textContent = score;
        }
        decorateScrollSide(view, card, index, entry, light, score);
        card.classList.toggle('rc-scroll-active', index === view.active);
        updateScrollCell(view, card, index, entry, light);
    }
    // 右側評分欄：分數；扣分的條件逐行列出原因與扣分（由多到少），通過的條件縮成一排小標籤（滑過看說明）。
    // 條件增加時通過的標籤會換行排列；內容超過卡片高度時評分欄自己捲動，卡片高度不變。
    function decorateScrollSide(view, card, index, entry, light, score) {
        let side = card.querySelector(':scope > .rc-scroll-side');
        if (!side) {
            side = document.createElement('div');
            side.className = 'rc-scroll-side';
            side.innerHTML = '<div class="rc-scroll-side-head"><span class="rc-scroll-dot"></span><b class="rc-scroll-side-score"></b>'
                + '<span class="rc-scroll-side-bpm"></span><span class="rc-scroll-side-state"></span></div>'
                + '<ul class="rc-scroll-side-list"></ul><div class="rc-scroll-side-pass"></div>';
            card.appendChild(side);
        }
        const results = light ? entry.result.results : [];
        const minus = results.filter(result => result.penalty > 0).sort((a, b) => b.penalty - a.penalty);
        const passed = results.filter(result => result.penalty <= 0);
        const state = light ? (minus.length ? `${minus.length} 項扣分・${passed.length} 項通過` : `${passed.length} 項全部通過`) : '';
        // 實際平均 BPM 只在有「平均 BPM」條件的清單（Min／Max HR、Max HR sinus）顯示，後面附上清單 HR。
        const average = results.find(result => result.id === 'avgBPM');
        const avgBPM = average ? entry.result.avgBPM : null;
        const listedHR = entry?.result?.listedHR;
        const bpmText = avgBPM === null ? '' : `平均 ${formatBPM(avgBPM)} bpm` + (listedHR > 0 ? `（清單 ${listedHR}）` : '');
        const bpmOff = !!average && average.penalty > 0;
        const signature = JSON.stringify([light, score, state, bpmText, bpmOff, results.map(result => [result.id, result.penalty, result.note])]);
        if (side.dataset.signature === signature) return;
        side.dataset.signature = signature;
        side.className = 'rc-scroll-side' + (light ? ` is-${light}` : '');
        side.querySelector('.rc-scroll-side-head').className = 'rc-scroll-side-head' + (light ? ` is-${light}` : '');
        side.querySelector('.rc-scroll-side-score').textContent = score;
        const bpm = side.querySelector('.rc-scroll-side-bpm');
        bpm.textContent = bpmText;
        bpm.className = 'rc-scroll-side-bpm' + (bpmOff ? ' is-off' : '');
        bpm.title = average ? `${average.note}（允許範圍 ±${SCROLL_AVG_TOLERANCE} BPM）` : '';
        side.querySelector('.rc-scroll-side-state').textContent = state;
        const list = side.querySelector('.rc-scroll-side-list');
        list.textContent = '';
        for (const result of minus) {
            const item = document.createElement('li');
            item.className = result.penalty >= 100 ? 'is-zero' : 'is-minus';
            item.innerHTML = '<span class="rc-side-icon">✗</span><span class="rc-side-name"></span>'
                + '<span class="rc-side-note"></span><span class="rc-side-penalty"></span>';
            item.querySelector('.rc-side-name').textContent = result.name;
            item.querySelector('.rc-side-note').textContent = result.note;
            item.querySelector('.rc-side-penalty').textContent = `−${result.penalty}`;
            item.title = `${result.name}：${result.note}（扣 ${result.penalty} 分）`;
            list.appendChild(item);
        }
        const pass = side.querySelector('.rc-scroll-side-pass');
        pass.textContent = '';
        for (const result of passed) {
            const chip = document.createElement('span');
            chip.textContent = `✓ ${result.name}`;
            chip.title = `${result.name}：${result.note}`;
            pass.appendChild(chip);
        }
    }

    // ── Minimap：每張卡片一個燈號，左側深色條／「印」為選印、★（小燈號為金色圓點）為星號；藍框為目前畫面中的卡片 ──
    // 燈號有最小高度（SCROLL_MAP_CELL_MIN），張數多到放不下時，Minimap 依清單的捲動比例跟著捲動（與 VS Code 的 Minimap 相同）。
    // 左側為編號刻度。
    function buildScrollMap(view) {
        view.map.textContent = '';
        view.cells = [];
        const track = view.mapTrack = document.createElement('div');
        track.className = 'rc-scroll-map-track';
        view.mapTicks = document.createElement('div');
        track.appendChild(view.mapTicks);
        for (let i = 0; i < view.count; i++) {
            const cell = document.createElement('div');
            cell.className = 'rc-scroll-map-cell';
            cell.dataset.index = String(i);
            cell.innerHTML = '<span class="rc-map-print"></span><span class="rc-map-star"></span>';
            view.cells.push(cell);
            track.appendChild(cell);
        }
        view.mapView = document.createElement('div');
        view.mapView.className = 'rc-scroll-map-view';
        track.appendChild(view.mapView);
        view.map.appendChild(track);
        layoutScrollMap(view);
    }
    function layoutScrollMap(view) {
        if (!view.mapTrack) return;
        const height = view.map.clientHeight;
        const pitch = Math.min(SCROLL_MAP_CELL_MAX, Math.max(SCROLL_MAP_CELL_MIN, height / Math.max(1, view.count)));
        const gap = pitch >= 12 ? 3 : 2;
        view.mapCell = pitch;
        view.mapTrack.style.height = `${view.count * pitch}px`;
        view.cells.forEach((cell, i) => {
            cell.style.top = `${i * pitch}px`;
            cell.style.height = `${pitch - gap}px`;
        });
        // 編號刻度：第 1 張與每 step 張標一次。
        const step = SCROLL_MAP_TICK_STEPS.find(value => value * pitch >= 28) || SCROLL_MAP_TICK_STEPS[SCROLL_MAP_TICK_STEPS.length - 1];
        view.mapTicks.textContent = '';
        for (let n = 1; n <= view.count; n = n === 1 ? step : n + step) {
            const tick = document.createElement('div');
            tick.className = 'rc-scroll-map-tick';
            tick.style.top = `${(n - 1) * pitch + (pitch - gap) / 2}px`;
            tick.innerHTML = `<span>${n}</span>`;
            view.mapTicks.appendChild(tick);
        }
        for (const cell of view.cells) cell.dataset.signature = '';
        updateScrollMapView(view);
    }
    // 選印種類與 Minimap 顏色（與網站心電圖上的選印圖示相同：綠色選印、橘色強制選印、藍色區段選印）。
    const SCROLL_PRINT_KINDS = {
        selected: { name: '選印', color: '#8fb43a' },
        forced: { name: '強制選印', color: '#d88f3f' },
        section: { name: '藍色選印', color: '#3f7fd0' },
    };
    // 本頁選印狀態：強制選印即時讀取 printDialog（不支援的清單改用拉條的 preselectedEvents），
    // 藍色選印為清單的區段勾選（eventDialog.section）與網站保存的區段範圍（eventRecordRange）。每次 tick 重算一次。
    function refreshScrollPrintSets(view) {
        const { af, type, dialog } = view.ctx;
        let forced = getLiveForcedEvents(af);
        if (!forced) {
            try {
                const bar = dialog.querySelector('.pagination-range svg.paginationEventBar');
                forced = bar ? window.angular.element(bar).isolateScope()?.preselectedEvents : null;
            } catch (_) { forced = null; }
        }
        const ranges = af.eventRecordRange?.[type];
        const section = [...(Array.isArray(af.eventDialog?.section) ? af.eventDialog.section : []),
            ...(ranges && typeof ranges === 'object' ? Object.keys(ranges) : [])];
        const toSet = list => new Set((Array.isArray(list) ? list : []).map(toEventTime).filter(time => time !== null));
        view.printSets = { forced: toSet(forced), section: toSet(section) };
    }
    function getScrollPrintKinds(view, data, time) {
        const sets = view.printSets || { forced: new Set(), section: new Set() };
        const kinds = [];
        if (data?.selectedEvent) kinds.push('selected');
        if (time !== null && sets.forced.has(time)) kinds.push('forced');
        if (data?.isPrintSection || (time !== null && sets.section.has(time))) kinds.push('section');
        return kinds;
    }
    function updateScrollCell(view, card, index, entry, light) {
        const cell = view.cells[index];
        if (!cell) return;
        const data = scrollCardData(card);
        const time = view.items[index];
        // HR／R-R 清單只有一張會印出（報告記錄的那張）；其他清單依選印種類：綠色選印（卡片勾選框）、
        // 橘色強制選印、藍色區段選印，一張可能同時有兩種以上（見 getScrollPrintKinds）。
        const kinds = view.ctx.config.printed
            ? (time !== null && toEventTime(view.ctx.config.printed(view.ctx.af)) === time ? ['selected'] : [])
            : getScrollPrintKinds(view, data, time);
        const printed = kinds.length > 0;
        const starred = !!data?.isSpecific;
        const big = view.mapCell - 3 >= 9;
        // 最近一次新增的選印（見 trackScrollNewPrints）：Minimap 加黃框並標「新」。
        const fresh = printed && !!view.newTimes?.has(time);
        const signature = `${light}|${kinds.join(',')}|${starred}|${index === view.active}|${big}|${fresh}`;
        if (cell.dataset.signature === signature) return;
        cell.dataset.signature = signature;
        cell.className = 'rc-scroll-map-cell' + (light ? ` is-${light}` : '') + (view.scored ? '' : ' is-plain') + (printed ? ' is-printed' : '')
            + (starred ? ' is-starred' : '') + (big ? '' : ' is-small') + (index === view.active ? ' is-active' : '') + (fresh ? ' is-new' : '');
        // 不評分的清單：燈號顏色即選印種類，同時有多種時左右分色。
        if (!view.scored) {
            const colors = kinds.map(kind => SCROLL_PRINT_KINDS[kind].color);
            cell.style.background = !colors.length ? '' : colors.length === 1 ? colors[0]
                : `linear-gradient(90deg, ${colors.map((color, i) => `${color} ${i * 100 / colors.length}% ${(i + 1) * 100 / colors.length}%`).join(', ')})`;
        }
        cell.querySelector('.rc-map-print').textContent = big && printed ? (fresh ? '新' : '印') : '';
        cell.querySelector('.rc-map-star').textContent = big && starred ? '★' : '';
        const printText = view.scored ? (printed ? '　已選印' : '') : kinds.map(kind => `　${SCROLL_PRINT_KINDS[kind].name}`).join('');
        cell.title = `#${index + 1}` + (light ? `　${entry.result.score} 分` : '') + printText + (fresh ? '　最新選印' : '') + (starred ? '　★' : '');
    }
    // 藍框：目前畫面中看得到的卡片範圍。Minimap 放不下所有燈號時，依清單捲動的比例移動，使藍框保持在 Minimap 內。
    function updateScrollMapView(view) {
        if (!view.mapView || !view.count) return;
        const { content } = view;
        const overflow = Math.max(0, view.count * view.mapCell - view.map.clientHeight);
        const range = content.scrollHeight - content.clientHeight;
        view.mapOffset = overflow && range > 0 ? overflow * Math.min(1, Math.max(0, content.scrollTop / range)) : 0;
        view.mapTrack.style.transform = `translateY(${-view.mapOffset}px)`;
        // 卡片依序排列：以 offsetTop 二分搜尋畫面中第一張與最後一張。
        const cards = getScrollCards(view);
        const top = content.scrollTop;
        const bottom = top + content.clientHeight;
        const firstBelow = edge => {
            let low = 0, high = cards.length;
            while (low < high) {
                const mid = (low + high) >> 1;
                if (cards[mid].offsetTop + cards[mid].offsetHeight <= edge) low = mid + 1; else high = mid;
            }
            return low;
        };
        const first = firstBelow(top);
        let last = firstBelow(bottom);
        if (last >= cards.length || cards[last].offsetTop >= bottom) last--;
        if (first >= cards.length || last < first) { view.mapView.style.display = 'none'; return; }
        view.mapView.style.display = '';
        view.mapView.style.top = `${first * view.mapCell - 1}px`;
        view.mapView.style.height = `${Math.max(4, (last - first + 1) * view.mapCell + 1)}px`;
    }
    // 點燈號跳到該張；點空白處或拖曳時依位置比例捲動；在 Minimap 上滾動滑鼠滾輪即捲動清單。
    function installScrollMapDrag(view) {
        const { map } = view;
        const scrollToPoint = clientY => {
            const rect = map.getBoundingClientRect();
            const total = view.count * view.mapCell;
            const { content } = view;
            if (total <= rect.height) {
                const index = Math.max(0, Math.min(view.count - 1, Math.floor((clientY - rect.top) / Math.max(1, view.mapCell))));
                scrollToCard(view, index, 'auto');
            } else {
                const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
                content.scrollTop = ratio * (content.scrollHeight - content.clientHeight);
            }
        };
        map.addEventListener('pointerdown', event => {
            if (event.button !== 0 || !view.count) return;
            event.preventDefault();
            const cell = event.target.closest('.rc-scroll-map-cell');
            if (cell) { setScrollActive(view, Number(cell.dataset.index), true); return; }
            map.setPointerCapture(event.pointerId);
            scrollToPoint(event.clientY);
            const move = moveEvent => scrollToPoint(moveEvent.clientY);
            const up = () => { map.removeEventListener('pointermove', move); map.removeEventListener('pointerup', up); };
            map.addEventListener('pointermove', move);
            map.addEventListener('pointerup', up);
        });
        map.addEventListener('wheel', event => {
            event.preventDefault();
            view.content.scrollTop += event.deltaY;
        }, { passive: false });
    }
    function scrollToCard(view, index, behavior = 'smooth') {
        const card = getScrollCards(view)[index];
        // 只捲動卡片捲動區（卡片的 offsetTop 以 .content-blk 為基準，它是 position: relative）。
        if (card) view.content.scrollTo({ top: Math.max(0, card.offsetTop - 3), behavior });
    }
    function setScrollActive(view, index, scroll = true) {
        if (!(index >= 0 && index < view.count)) return;
        view.active = index;
        getScrollCards(view).forEach((card, i) => {
            card.classList.toggle('rc-scroll-active', i === index);
            updateScrollCell(view, card, i, view.entries.get(view.items?.[i]), scrollEntryLight(view.entries.get(view.items?.[i])));
        });
        if (scroll) scrollToCard(view, index);
    }
    // 僅選印（VEB／SVEB 清單）：分頁資料只留下有選印的心電圖（綠色選印、橘色強制選印、藍色選印），每頁張數不變；
    // 完整清單記在 view.fullFlat，再按一次或返回分頁時還原。只改顯示用的分頁資料，選印紀錄與快速選印（讀網站的完整清單）不受影響；
    // 分頁資料與完整清單張數不同時，「不在清單中的選印」自動取消也不會作用（getOrphanPrints）。
    function isScrollItemPrinted(view, item) {
        const { af, ed } = view.ctx;
        // 清單資料可能是物件（含 startTime）或直接是時間（VEB／SVEB 清單）。
        if (typeof item === 'object' && item && (item.isPrintSection || isSitePrintSelected(af, item, ed.dscp?.printedEventType))) return true;
        const time = toEventTime(typeof item === 'object' && item ? item.startTime : item);
        if (time === null) return false;
        const selected = af.printDialog?.selectedEvents?.[ed.dscp?.printedEventType];
        if (Array.isArray(selected) && selected.some(value => toEventTime(value) === time)) return true;
        const sets = view.printSets;
        return !!sets && (sets.forced.has(time) || sets.section.has(time));
    }
    function applyScrollPrintFilter(view) {
        const printed = view.fullFlat.filter(item => isScrollItemPrinted(view, item));
        view.filterCount = printed.length;
        setScrollPages(view.ctx, splitScrollPages(printed, view.perPage), view.perPage, 1);
        view.filterPages = view.ctx.ed.pageData;
    }
    function toggleScrollPrintFilter(view) {
        const button = view.panel.querySelector('.rc-scroll-printonly');
        refreshScrollPrintSets(view);
        if (!view.printOnly) {
            const full = view.ctx.ed.pageData.flat();
            if (!full.some(item => isScrollItemPrinted(view, item))) { quickToast(button, '這個清單沒有選印的心電圖', true); return; }
            view.fullFlat = full;
            view.printOnly = true;
            applyScrollPrintFilter(view);
        } else {
            const full = view.fullFlat || view.ctx.ed.pageData.flat();
            view.printOnly = false;
            view.fullFlat = null;
            view.filterPages = null;
            setScrollPages(view.ctx, splitScrollPages(full, view.perPage), view.perPage, 1);
        }
        button.classList.toggle('is-on', view.printOnly);
        button.textContent = view.printOnly ? '顯示全部' : '僅選印';
        view.page = 1;
        view.active = 0;
        view.content.scrollTop = 0;
        tickScrollView(view);
    }
    // 「新」標示：只標最近一次新增的選印（換一個、快速選印、加選、點印表機圖示都算）；同一次新增多張時一起標。
    // 比對前後的綠色與藍色選印（不看分頁，強制選印由網站決定不算），出現新的時間就以它們取代原本的「新」。
    function trackScrollNewPrints(view) {
        const { af, ed, type } = view.ctx;
        if (!QUICK_PRINT_TYPES[type]) return false;
        const selected = af.printDialog?.selectedEvents?.[ed.dscp?.printedEventType];
        const now = new Set([...(Array.isArray(selected) ? selected : []).map(toEventTime), ...(view.printSets?.section || [])]
            .filter(time => time !== null));
        let refiltered = false;
        if (view.prevPrinted) {
            const added = [...now].filter(time => !view.prevPrinted.has(time));
            if (added.length) {
                view.newTimes = new Set(added);
                // 僅選印中有新的選印（快速選印、加選、換一個等）：重新篩選，新的加入清單（取消的移除），並捲到第一張新的。
                if (view.printOnly && view.fullFlat) {
                    view.prevPrinted = now;
                    applyScrollPrintFilter(view);
                    const first = view.ctx.ed.pageData.flat().map(scrollItemTime).find(time => added.includes(time));
                    if (first !== undefined) jumpScrollItem(view, first);
                    refiltered = true;
                }
            }
        }
        view.prevPrinted = now;
        return refiltered;
    }
    // 換一個（VEB／SVEB 清單的捲動檢視）：選印的卡片標題列加上按鈕，依快速選印的規則（與選印清單的「換一個」相同）
    // 換成另一張：取消這張、選印找到的那張，這張記為淘汰（之後快速選印、換一個不再選回）。橘色強制選印由網站決定，不顯示。
    // 選印只改網站記憶體中的資料，與快速選印相同，關閉事件清單時由網站上傳。換好後捲到換上的那張（在其他頁時換頁）。
    function decorateScrollSwap(view, card) {
        const header = card.querySelector('.event-blk-header');
        if (!header) return;
        let button = header.querySelector('.rc-scroll-swap');
        const data = scrollCardData(card);
        const time = toEventTime(data?.startTime);
        const kinds = time === null ? [] : getScrollPrintKinds(view, data, time);
        const show = !!QUICK_PRINT_TYPES[view.ctx.type] && !kinds.includes('forced') && (kinds.includes('selected') || kinds.includes('section'));
        // 最近一次新增的選印（見 trackScrollNewPrints）：卡片加黃框（出現時閃一下）並在時間旁標「新選印」。
        const fresh = kinds.length > 0 && !!view.newTimes?.has(time);
        card.classList.toggle('rc-scroll-new', fresh);
        let badge = header.querySelector('.rc-scroll-newbadge');
        if (fresh && !badge) {
            badge = document.createElement('span');
            badge.className = 'rc-scroll-newbadge';
            badge.textContent = '新選印';
            const anchor = header.querySelector('.pop-out-bnt');
            if (anchor) anchor.after(badge); else header.appendChild(badge);
        }
        if (badge) badge.hidden = !fresh;
        if (!show && !button) return;
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'rc-scroll-swap';
            button.textContent = '換一個';
            button.title = '依快速選印的規則換成另一張（這張取消選印並記為淘汰）';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const current = toEventTime(scrollCardData(card)?.startTime);
                if (current !== null) swapScrollPrint(view, current, button);
            });
            const anchor = header.querySelector('.pop-out-bnt');
            if (anchor) anchor.after(button); else header.appendChild(button);
        }
        if (!button.disabled) button.hidden = !show;
    }
    async function swapScrollPrint(view, time, button) {
        if (view.swapBusy || quickState.busy || review?.busy) return;
        const ctx = getQuickContext(button);
        if (!ctx || !QUICK_PRINT_TYPES[ctx.type]) return;
        view.swapBusy = true;
        button.disabled = true;
        button.textContent = '尋找中…';
        try {
            getQuickRejected(ctx).add(time);
            const { times, candidates } = await getQuickCandidates(ctx, (done, total) => { button.textContent = `${done}/${total}`; });
            if (scrollView !== view) return;
            const existing = getQuickPrinted(ctx, times).all.filter(other => other !== time);
            const range = getQuickRange(ctx, times);
            button.textContent = '驗證中…';
            const { valid: [replacement = null], skipped, lowPriority } = await pickValidated(ctx, candidates, existing, 1,
                (pool, others) => [pickQuickReplacement({ candidates: pool, existing: others, removed: time,
                    target: ctx.config.target(times.length), ...range, spread: ctx.config.spread !== false })].filter(value => value !== null));
            if (scrollView !== view) return;
            if (replacement === null) {
                getQuickRejected(ctx).delete(time);
                quickToast(button, '沒有其他符合條件的心電圖（需與其他選印相隔 1 分鐘以上，且不選淘汰過的及其前後 30 秒）'
                    + (skipped.length ? `；${skipped.length} 張標籤已不符合` : ''), true);
                return;
            }
            setQuickPrint(ctx, time, false);
            const section = setQuickPrint(ctx, replacement, true);
            view.newTimes = new Set([replacement]);
            quickToast(button, `已換成 ${formatQuickTime(ctx, replacement)}` + (section ? '（超過 30 秒，藍色選印）' : '')
                + (lowPriority ? '（沒有其他候選，使用前兩顆為 V、N 的 S）' : ''));
            showScrollItem(view, replacement);
        } catch (error) {
            quickToast(button, `換一個失敗：${error?.message || error}`, true);
        } finally {
            view.swapBusy = false;
            if (button.isConnected) { button.disabled = false; button.textContent = '換一個'; }
            if (scrollView === view) tickScrollView(view);
        }
    }
    function scrollItemTime(item) {
        return toEventTime(typeof item === 'object' && item ? item.startTime : item);
    }
    // 捲到某個時間的卡片：僅選印時先依最新的選印重新篩選（換掉的那張移除、換上的加入）；不在目前這頁時換到該頁。
    function showScrollItem(view, time) {
        refreshScrollPrintSets(view);
        if (view.printOnly && view.fullFlat && !trackScrollNewPrints(view)) applyScrollPrintFilter(view);
        jumpScrollItem(view, time);
    }
    function jumpScrollItem(view, time) {
        const { ctx } = view;
        const index = ctx.ed.pageData.flat().findIndex(item => scrollItemTime(item) === time);
        if (index < 0) return;
        const page = Math.floor(index / view.perPage) + 1;
        const current = Math.max(1, Number(ctx.ed.pagination.currentPage) || 1);
        if (page !== current) setScrollPages(ctx, ctx.ed.pageData, view.perPage, page);
        view.itemJump = { time, at: performance.now() };
    }
    function jumpNextGreen(view) {
        if (!view.scored) return;
        const order = [...Array(view.count).keys()];
        const next = [...order.slice(view.active + 1), ...order.slice(0, view.active + 1)]
            .find(i => scrollEntryLight(view.entries.get(view.items?.[i])) === 'green');
        if (next !== undefined) setScrollActive(view, next, true);
        else quickToast(view.panel.querySelector('.rc-scroll-next'), '沒有綠燈的心電圖', true);
    }
    function updateScrollSummary(view) {
        if (!view.scored) {
            // 不評分的清單：本頁範圍、總張數與本頁選印張數。
            const total = view.ctx.ed.pagination?.totalItems ?? view.count;
            const from = (view.page - 1) * view.perPage;
            const kinds = getScrollCards(view).map(card => {
                const data = scrollCardData(card);
                return getScrollPrintKinds(view, data, toEventTime(data?.startTime));
            });
            const printed = kinds.filter(list => list.length).length;
            const forced = kinds.filter(list => list.includes('forced')).length;
            const section = kinds.filter(list => list.includes('section')).length;
            const detail = [forced ? `強制 ${forced}` : '', section ? `藍色 ${section}` : ''].filter(Boolean).join('、');
            const html = (view.printOnly ? `<span>僅選印 ${total} 張</span><span>（全部 ${view.fullFlat?.length ?? total} 張）</span>` : `<span>共 ${total} 張</span>`)
                + (total > view.count ? `<span>本頁 ${view.count ? from + 1 : 0}–${from + view.count}</span>` : '')
                + `<span>本頁選印 ${printed}</span>` + (detail ? `<span>（${detail}）</span>` : '');
            const holder = view.panel.querySelector('.rc-scroll-counts');
            if (holder.innerHTML !== html) holder.innerHTML = html;
            return;
        }
        const counts = { green: 0, yellow: 0, red: 0 };
        let waiting = 0;
        for (const time of view.items || []) {
            const light = scrollEntryLight(view.entries.get(time));
            if (light) counts[light]++; else waiting++;
        }
        const html = `<span><span class="rc-scroll-dot is-green"></span>${counts.green}</span>`
            + `<span><span class="rc-scroll-dot is-yellow"></span>${counts.yellow}</span>`
            + `<span><span class="rc-scroll-dot is-red"></span>${counts.red}</span>`
            + `<span>共 ${view.count} 張${waiting ? `・評分中 ${view.count - waiting}/${view.count}` : ''}</span>`;
        const holder = view.panel.querySelector('.rc-scroll-counts');
        if (holder.innerHTML !== html) holder.innerHTML = html;
    }
    // 心電圖視窗或網站的確認視窗開在清單上方時，Esc 交給它們（正在關閉或已隱藏的視窗不算）。
    function isAboveScrollView(root) {
        return [...document.querySelectorAll('.ngdialog')].some(dialog =>
            dialog !== root && (root.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING)
            && !dialog.classList.contains('ngdialog-closing') && dialog.getClientRects().length > 0);
    }
    // 捲動檢視只保留 Esc：回到分頁（不讓網站關閉清單），即使游標在時間輸入框中；選印清單開著時 Esc 只關閉選印清單。
    window.addEventListener('keydown', event => {
        const view = scrollView;
        if (!view || event.code !== 'Escape' || !event.isTrusted || event.isComposing || review || event.rcReviewClosed
            || isAboveScrollView(view.ctx.root)) return;
        if (isEditingText()) document.activeElement.blur();
        event.preventDefault();
        event.stopImmediatePropagation();
        closeScrollView();
    }, true);
    // ── Tachy／Brady／Pause 清單：按住左鍵在心電圖上拖曳，經過的卡片一次消除（標為 Artifact） ──
    // 網站點一下心電圖（graphy-cover 的 eventOperationControl）會循環切換類型：Tachy 為 none → artifact → psvt → vt，
    // Brady、Pause 為 none ↔ artifact，並取消該張的選印；需編輯模式。拖曳時不循環：
    // 從未消除（none）的卡片開始拖曳為「消除」，只改經過的未消除卡片；從已消除（artifact）的卡片開始為「恢復」，只改已消除的卡片；
    // 改成 PSVT、VT 的卡片不受影響。只點一下（沒有拖到別張）時照常交給網站。
    // 捲動檢視（一欄）中快速拖曳跳過的卡片也一併處理；拖到捲動區上下緣時自動捲動。
    const SWIPE_TYPES = ['tachy', 'brady', 'pause', 'pause23', 'pause34', 'pause45', 'pause5'];
    const SWIPE_EDGE = 56; // 捲動區上下緣多少 px 內自動捲動
    const SWIPE_SPEED = 22; // 自動捲動每格最快的 px
    let swipe = null;
    const swipeStyle = document.createElement('style');
    swipeStyle.textContent = `
        body.rc-swipe-armed, body.rc-swipe-armed * { user-select:none !important; }
        body.rc-swiping, body.rc-swiping * { user-select:none !important; cursor:ns-resize !important; }
        body.rc-swiping #af-event-dialog .graphy-cover { box-shadow:inset 0 0 0 2px rgba(192,57,43,.35); }
    `;
    document.head.appendChild(swipeStyle);
    function swipeCardAt(x, y) {
        const cover = document.elementFromPoint(x, y)?.closest?.('#af-event-dialog .graphy-cover');
        return cover ? cover.closest(HR_CARD_SELECTOR) : null;
    }
    function swipeScroller(card) {
        for (let node = card.parentElement; node && node !== document.body; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
        }
        return document.scrollingElement;
    }
    function swipeApply(card) {
        if (!swipe || swipe.done.has(card)) return;
        swipe.done.add(card);
        let scope;
        try { scope = window.angular.element(card).scope(); } catch (_) { return; }
        const data = scope?.currentData;
        if (!data || typeof scope.eventOperationControl !== 'function' || (data.selectedType || 'none') !== swipe.from) return;
        // 網站每點一次切換到下一個類型：一直點到目標類型為止（Tachy 由 artifact 恢復需經過 psvt、vt）。
        scope.$apply(() => {
            for (let i = 0; i < 4 && (data.selectedType || 'none') !== swipe.to; i++) scope.eventOperationControl(data);
        });
        if ((data.selectedType || 'none') === swipe.to) swipe.count++;
    }
    // 捲動檢視為一欄：上次經過的卡片與目前這張之間的卡片（滑鼠移動或滾輪太快跳過的）也一併處理。分頁顯示為兩欄，只處理經過的卡片。
    // 游標往左右移出心電圖那一欄（例如移到右側空白處）時中斷（swipeBreak），之後經過的卡片不補，可用來略過不想消除的心電圖。
    function swipeReach(card) {
        if (!swipe || !card) return;
        if (swipe.single && swipe.last) {
            const cards = [...swipe.dialog.querySelectorAll(HR_CARD_SELECTOR)];
            const from = cards.indexOf(swipe.last);
            const to = cards.indexOf(card);
            if (from >= 0 && to >= 0) {
                const step = to >= from ? 1 : -1;
                for (let i = from; i !== to; i += step) swipeApply(cards[i]);
            }
        }
        swipeApply(card);
        swipe.last = card;
    }
    // 游標在心電圖那一欄的左右範圍外：中斷補卡（上下移動經過卡片標題列等空隙時不算，仍會補）。
    function swipeOutsideColumn(x) {
        const column = swipe?.column;
        return !!column && (x < column.left || x > column.right);
    }
    function swipeBreak() {
        if (swipe) swipe.last = null;
    }
    // 檢查某個游標位置：在心電圖上就處理該張；移出心電圖那一欄就中斷。
    function swipeSample(x, y) {
        const card = swipeCardAt(x, y);
        if (card) swipeReach(card);
        else if (swipeOutsideColumn(x)) swipeBreak();
    }
    function swipeAutoScroll() {
        if (!swipe?.active) return;
        const rect = swipe.scroller === document.scrollingElement
            ? { top: 0, bottom: window.innerHeight } : swipe.scroller.getBoundingClientRect();
        let delta = 0;
        if (swipe.y > rect.bottom - SWIPE_EDGE) delta = Math.min(1, (swipe.y - (rect.bottom - SWIPE_EDGE)) / SWIPE_EDGE);
        else if (swipe.y < rect.top + SWIPE_EDGE) delta = -Math.min(1, ((rect.top + SWIPE_EDGE) - swipe.y) / SWIPE_EDGE);
        if (delta) swipe.scroller.scrollTop += Math.ceil(Math.abs(delta) * SWIPE_SPEED) * Math.sign(delta);
        // 每格都檢查游標下的卡片：自動捲動或拖曳中轉動滾輪時，捲到游標下的卡片也一併處理。
        swipeSample(swipe.x, swipe.y);
        swipe.raf = requestAnimationFrame(swipeAutoScroll);
    }
    function endSwipe() {
        const ended = swipe;
        swipe = null;
        if (!ended) return;
        cancelAnimationFrame(ended.raf);
        document.body.classList.remove('rc-swiping', 'rc-swipe-armed');
        if (!ended.active) return;
        // 放開時若回到起點那張，網站會把這次當成點一下再切換一次：攔下緊接的 click。
        const block = event => { event.preventDefault(); event.stopImmediatePropagation(); };
        window.addEventListener('click', block, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', block, true), 0);
        if (scrollView) setTimeout(() => tickScrollView(scrollView), 50);
        quickToast(ended.start.isConnected ? ended.start.querySelector('.graphy-cover') : null,
            ended.to === 'artifact' ? `已消除 ${ended.count} 張（Artifact）` : `已恢復 ${ended.count} 張`);
    }
    document.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isDisabledPage()) return;
        const cover = event.target.closest?.('#af-event-dialog .graphy-cover');
        const card = cover?.closest(HR_CARD_SELECTOR);
        if (!card || !window.angular) return;
        let scope;
        try { scope = window.angular.element(card).scope(); } catch (_) { return; }
        const af = scope?.af;
        if (!af?.editingSwitch || !SWIPE_TYPES.includes(af.eventDialog?.dscp?.type)) return;
        const from = scope.currentData?.selectedType || 'none';
        if (from !== 'none' && from !== 'artifact') return;
        const dialog = card.closest('#af-event-dialog');
        swipe = { start: card, last: null, from, to: from === 'none' ? 'artifact' : 'none', active: false, done: new Set(), count: 0,
            x: event.clientX, y: event.clientY, dialog, scroller: swipeScroller(card), raf: 0, column: cover.getBoundingClientRect(),
            single: !!dialog.closest('.ngdialog')?.classList.contains('rc-scroll-mode') };
        // 按下時就禁止選取文字：拖曳要移到別張才算開始，在那之前滑鼠移動已會反白心電圖上的文字。
        document.body.classList.add('rc-swipe-armed');
    }, true);
    // 游標下換成別張卡片時開始拖曳；拖曳中處理經過的卡片。滑鼠移動與捲動（滾輪）都會呼叫。
    // from：上一個游標位置（滑鼠移動時）。快速移動時兩次事件之間可能跨過整張卡片，沿路每 SWIPE_PATH_STEP px 檢查一次，
    // 分頁顯示（兩欄）與捲動檢視都只處理游標實際經過的卡片。
    const SWIPE_PATH_STEP = 16;
    function swipeUpdate(from = null) {
        if (!swipe) return;
        // 沿路的取樣：卡片，或 null（游標移出心電圖那一欄，中斷補卡）。
        const passed = [];
        const push = (x, y) => {
            const card = swipeCardAt(x, y);
            const item = card || (swipeOutsideColumn(x) ? null : undefined);
            if (item !== undefined && item !== passed[passed.length - 1]) passed.push(item);
        };
        if (from) {
            const steps = Math.ceil(Math.hypot(swipe.x - from.x, swipe.y - from.y) / SWIPE_PATH_STEP);
            for (let i = 1; i < steps; i++) push(from.x + (swipe.x - from.x) * i / steps, from.y + (swipe.y - from.y) * i / steps);
        }
        push(swipe.x, swipe.y);
        // 路徑經過別張卡片即開始拖曳（快速甩動時游標最後可能停在卡片之間的空白處）。
        if (!swipe.active) {
            // 還沒開始前就已移出心電圖那一欄：開始後先中斷，不補起點與之後卡片之間的卡片。
            if (passed.includes(null)) swipe.brokeEarly = true;
            if (!passed.some(item => item && item !== swipe.start)) return;
            swipe.active = true;
            document.body.classList.add('rc-swiping');
            window.getSelection?.()?.removeAllRanges();
            swipeReach(swipe.start);
            if (swipe.brokeEarly) swipeBreak();
            swipe.raf = requestAnimationFrame(swipeAutoScroll);
        }
        for (const item of passed) {
            if (item) swipeReach(item); else swipeBreak();
        }
    }
    document.addEventListener('pointermove', event => {
        if (!swipe) return;
        if (!(event.buttons & 1)) { endSwipe(); return; }
        const from = { x: swipe.x, y: swipe.y };
        swipe.x = event.clientX;
        swipe.y = event.clientY;
        event.preventDefault();
        swipeUpdate(from);
    }, true);
    // 按住左鍵時轉動滾輪：清單照常捲動，捲到游標下的卡片同樣消除（或恢復）。
    document.addEventListener('scroll', () => swipeUpdate(), true);
    document.addEventListener('selectstart', event => { if (swipe) event.preventDefault(); }, true);
    document.addEventListener('pointerup', () => endSwipe(), true);
    document.addEventListener('pointercancel', () => endSwipe(), true);
    window.addEventListener('blur', () => endSwipe());

    // 捲動檢視中網站替清單重新分頁時會用到捲動檢視的每頁張數（全部一頁），例如 Max HR 的「Sync to Max Sinus HR」
    // 關閉清單後立即重建 Max HR sinus 的分頁；之後開啟該清單會變成一頁、兩欄列出全部心電圖。
    // 清單不在捲動檢視中、卻有某頁超過每頁張數時，依每頁張數重新分頁（停在第 1 頁）。
    function repairScrollPaging(ctx) {
        if (scrollView?.ctx.dialog === ctx.dialog) return;
        const perPage = Number(ctx.ed.pagination?.itemsPerPage);
        if (!(perPage > 0) || perPage >= SCROLL_ALL_PER_PAGE) return;
        if (!ctx.ed.pageData.some(page => Array.isArray(page) && page.length > perPage)) return;
        const flat = ctx.ed.pageData.flat();
        const pages = [];
        for (let i = 0; i < flat.length; i += perPage) pages.push(flat.slice(i, i + perPage));
        setScrollPages(ctx, pages.length ? pages : [[]], perPage, 1);
    }
    // 清單標題列的「☰ 捲動檢視」按鈕（時間輸入框之後、排除開關之前）；捲動檢視中改為「☰ 返回分頁」。
    function decorateScrollButtons() {
        if (isDisabledPage()) return;
        for (const id of SCROLL_DIALOG_IDS) {
            const dialog = document.getElementById(id);
            if (!dialog) continue;
            const ctx = getScrollListContext(dialog);
            let button = dialog.querySelector('.rc-scroll-open');
            const toolbar = dialog.querySelector('.data-tool-blk .float-left');
            if (!ctx || !toolbar) { button?.remove(); continue; }
            repairScrollPaging(ctx);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'rc-scroll-open';
                button.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    if (scrollView?.ctx.dialog === dialog) { closeScrollView(); return; }
                    const current = getScrollListContext(dialog);
                    if (current) openScrollView(current);
                });
                toolbar.insertBefore(button, toolbar.querySelector('.rc-hr-af, .rc-hr-restore'));
            }
            const on = scrollView?.ctx.dialog === dialog;
            const text = on ? '☰ 返回分頁' : `☰ 捲動檢視 ${ctx.ed.pageData.flat().length}`;
            if (button.textContent !== text) button.textContent = text;
            button.classList.toggle('is-on', on);
            button.title = on ? '回到原本的分頁顯示（Esc）'
                : ctx.config.score === false
                    ? `心電圖改為由上往下連續排列（每頁 ${ctx.config.perPage} 張，以上方頁碼換頁）；右側 Minimap 可跳到本頁任一張`
                    : '所有心電圖改為一頁、由上往下連續排列，並依條件評分以燈號標示；右側 Minimap 可跳到任一張';
        }
    }
    let scrollButtonPending = false;
    function scheduleScrollButtons() {
        if (scrollButtonPending) return;
        scrollButtonPending = true;
        requestAnimationFrame(() => { scrollButtonPending = false; decorateScrollButtons(); });
    }
    new MutationObserver(scheduleScrollButtons).observe(document.body, { childList: true, subtree: true });

    // ── Event Tag 選印時間：從 Event Tag 清單開啟的心電圖視窗中，滑鼠移到心電圖（上方 20 秒或下方 60 秒長條）
    // 時以虛線框顯示 10 秒的選印範圍，點一下即把選印時間移到該處，取代逐次點 ◀ ▶。
    // 與網站 adjustTagEventRange 相同：選印起點只能在標籤前 50 秒至標籤時間之間（紀錄開頭附近改為開頭起 60 秒內），
    // 並以 ◀ ▶ 的步距（5 秒）對齊；寫入 af.eventRecordRange.tag，關閉清單時由網站上傳。
    // Mesurer（放大量測）、R-type／Pause 編輯、PR 量測、按著修飾鍵或拖曳時都不處理，交給網站。
    const TAG_PRINT_SECONDS = 10;
    // 網站 ecgMask：Event Tag 的 10 秒中只印出前 8 秒，後 2 秒在清單上以灰色標示、報告中看不到。
    const TAG_PRINT_SHOWN = 8;
    const TAG_PRINT_STEP = 5;
    const TAG_PRINT_BEFORE = 50;
    function getTagPrintWindow(af, tagTime) {
        const recordStart = Number(af?.record?.startTimeInt);
        let bounds = [tagTime - TAG_PRINT_BEFORE, tagTime];
        if (bounds[0] < recordStart) bounds = [recordStart, recordStart + 60];
        // ◀ ▶ 由「已存的起點，沒有時為範圍終點」每次加減 5 秒，可到達的起點都與範圍終點相差 5 秒的倍數。
        let anchor = bounds[1];
        if (anchor < recordStart) anchor = recordStart;
        // 還沒調整過時，清單上顯示（也就是選印）的是標籤時間起 10 秒（base）。
        const base = Math.max(tagTime, recordStart);
        const saved = Number(af?.eventRecordRange?.tag?.[tagTime]);
        let start = saved || base;
        if (start < recordStart) start = recordStart;
        const steps = Math.floor((anchor - bounds[0]) / TAG_PRINT_STEP);
        return { start, base, anchor, min: anchor - steps * TAG_PRINT_STEP, max: anchor };
    }
    // 依游標時間（印出的 8 秒的中心）換算成可到達的起點；viewEnd 為心電圖視窗的結束時間，選印範圍不超出視窗。
    function snapTagPrintStart(limits, centerTime, viewEnd = Infinity) {
        const step = TAG_PRINT_STEP;
        const grid = value => limits.anchor + Math.floor((value - limits.anchor) / step) * step;
        const max = Math.max(limits.min, Math.min(limits.max, grid(viewEnd - TAG_PRINT_SECONDS)));
        const raw = centerTime - TAG_PRINT_SHOWN / 2;
        const snapped = Math.min(max, Math.max(limits.min, limits.anchor + Math.round((raw - limits.anchor) / step) * step));
        // 紀錄開頭附近的標籤：預設起點（標籤時間）不在 ◀ ▶ 的 5 秒格點上，游標較靠近它時也可選回預設起點，
        // 否則虛線框永遠無法與目前的選印重疊。
        const base = limits.base;
        if (Number.isFinite(base) && base >= limits.min && base <= max && Math.abs(raw - base) < Math.abs(raw - snapped)) return base;
        return snapped;
    }
    // Mesurer（放大量測）、R-type／Pause 編輯、PR 量測等需要點擊波形的網站功能是否開啟。
    function isECGMeasuring(af) {
        return !!(af?.ecgEnlargedChart?.chartSwitch || af?.ruler?.rulerMode || af?.labelEditing?.edit
            || af?.labelEditing?.pauseEdit || document.querySelector('#af-pr-dialog'));
    }
    // 目前心電圖視窗屬於哪個 Event Tag；不是從 Event Tag 清單開啟的或正在量測時回傳 null。
    function getTagPrintContext() {
        if (!window.angular) return null;
        const dialog = document.querySelector('.ngdialog.ecg-dialog #af-ecg-dialog-v2');
        if (!dialog) return null;
        let scope;
        try { scope = window.angular.element(dialog).scope(); } catch (_) { return null; }
        let host = scope;
        while (host && typeof host.adjustTagEventRange !== 'function') host = host.$parent;
        const af = host?.af;
        const info = af?.eventDialog?.printInfo;
        const tagTime = Number(info?.dataTms);
        // 所有選印清單停在 Event Tag 分頁時沒有開著 Event Tag 清單，同樣顯示選印範圍（detached：改動後自行上傳）。
        const detached = af?.eventDialog?.dscp?.type !== 'tags';
        const fromAllPrints = !!review?.multi && review.ctx.type === 'tags' && review.ctx.af === af;
        if (!af || info?.dialogType !== 'tags' || (detached && !fromAllPrints) || !Number.isFinite(tagTime)) return null;
        if (isECGMeasuring(af) || af.loading?.ecg) return null;
        const trend = af.ECGTrendDialog;
        const range = Array.isArray(trend?.timeRange) ? trend.timeRange.map(Number) : [];
        if (range.length < 2 || !Number.isFinite(Number(trend.startTime))) return null;
        return { dialog, host, af, tagTime, viewStart: Number(trend.startTime), range, detached };
    }
    // 心電圖視窗中可點選的波形：下方含綠色顯示範圍的是 60 秒長條，其餘為上方 20 秒心電圖（3 導程時有多條）。
    function getTagPrintStrips(ctx) {
        return [...ctx.dialog.querySelectorAll('.ecg-wave .ecgWave svg')].map(svg => {
            const overview = !!svg.querySelector('rect.pdfHighlightRect');
            return { svg, overview, from: overview ? ctx.range[0] : ctx.viewStart,
                seconds: overview ? ctx.range[1] - ctx.range[0] : 20 };
        }).filter(strip => strip.seconds > 0 && strip.svg.getBoundingClientRect().width > 0);
    }
    function tagStripTime(strip, clientX) {
        const rect = strip.svg.getBoundingClientRect();
        return strip.from + Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * strip.seconds;
    }
    // 波形實際看得到的時間範圍：視窗比心電圖窄時，網站的心電圖會被外層裁掉（或需左右捲動），只算看得到的部分。
    function tagStripVisible(strip) {
        const rect = strip.svg.getBoundingClientRect();
        let left = rect.left, right = rect.right;
        for (let el = strip.svg.parentElement; el && el !== document.body; el = el.parentElement) {
            if (getComputedStyle(el).overflowX === 'visible') continue;
            const box = el.getBoundingClientRect();
            left = Math.max(left, box.left);
            right = Math.min(right, box.right);
        }
        left = Math.max(left, 0);
        right = Math.min(right, window.innerWidth);
        const toTime = x => strip.from + Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * strip.seconds;
        return right > left ? { from: toTime(left), to: toTime(right) } : { from: strip.from, to: strip.from + strip.seconds };
    }
    // 點選的範圍不超出 60 秒長條看得到的部分。
    function tagViewEnd(ctx) {
        const overview = getTagPrintStrips(ctx).find(strip => strip.overview);
        return Math.min(ctx.range[1], overview ? tagStripVisible(overview).to : Infinity);
    }
    const tagPrintStyle = document.createElement('style');
    tagPrintStyle.textContent = `
        .rc-tagwin { pointer-events:none; }
        .rc-tagwin.is-current { fill:none; stroke:#d88f3f; stroke-width:1.5; }
        .rc-tagwin.is-hover { fill:none; stroke:#2c6aa0; stroke-width:1.5; stroke-dasharray:6 4; }
        .rc-tagwin-text { pointer-events:none; fill:#2c6aa0; font:600 11px Arial,"Microsoft JhengHei",sans-serif; }
        .rc-tagwin-cut { pointer-events:none; fill:rgba(0,0,0,.08); }
        .rc-tagwin-edge { pointer-events:none; fill:#d88f3f; font:600 11px Arial,"Microsoft JhengHei",sans-serif; }
    `;
    document.head.appendChild(tagPrintStyle);
    let tagHover = null; // { start } 滑鼠所在位置對應的起點
    // 在每條波形上畫出目前的選印範圍（實線）與滑鼠位置的範圍（虛線）。
    function drawTagPrintWindows() {
        const ctx = getTagPrintContext();
        for (const node of document.querySelectorAll('.rc-tagwin, .rc-tagwin-text, .rc-tagwin-cut, .rc-tagwin-edge')) {
            if (!ctx || !ctx.dialog.contains(node)) node.remove();
        }
        if (!ctx) { tagHover = null; return; }
        const current = getTagPrintWindow(ctx.af, ctx.tagTime).start;
        for (const strip of getTagPrintStrips(ctx)) {
            const width = Number(strip.svg.getAttribute('width')) || strip.svg.getBoundingClientRect().width;
            const height = Number(strip.svg.getAttribute('height')) || strip.svg.getBoundingClientRect().height;
            const scale = width / strip.seconds;
            // 框內最後 2 秒（不會印出）另以灰色標示，與清單上網站的灰色區塊相同。
            const place = (kind, start) => {
                let rect = strip.svg.querySelector(`:scope > rect.rc-tagwin.is-${kind}`);
                let cut = strip.svg.querySelector(`:scope > rect.rc-tagwin-cut.is-${kind}`);
                if (start === null) { rect?.remove(); cut?.remove(); return; }
                if (!cut) {
                    cut = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    cut.setAttribute('class', `rc-tagwin-cut is-${kind}`);
                    strip.svg.appendChild(cut);
                }
                if (!rect) {
                    rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('class', `rc-tagwin is-${kind}`);
                    strip.svg.appendChild(rect);
                }
                const y = 1, h = Math.max(0, height - 2);
                rect.setAttribute('x', String((start - strip.from) * scale));
                rect.setAttribute('y', String(y));
                rect.setAttribute('width', String(TAG_PRINT_SECONDS * scale));
                rect.setAttribute('height', String(h));
                cut.setAttribute('x', String((start + TAG_PRINT_SHOWN - strip.from) * scale));
                cut.setAttribute('y', String(y));
                cut.setAttribute('width', String((TAG_PRINT_SECONDS - TAG_PRINT_SHOWN) * scale));
                cut.setAttribute('height', String(h));
            };
            place('current', current);
            // 60 秒長條：目前的選印（印出的 8 秒）有部分在畫面外時，在該側邊緣標示選印時間。
            // 紀錄開頭附近的標籤，網站的 ◀ ▶ 可以把選印移到畫面之外。
            let edge = strip.svg.querySelector(':scope > text.rc-tagwin-edge');
            const visible = strip.overview ? tagStripVisible(strip) : null;
            const before = !!visible && current < visible.from;
            const after = !!visible && current + TAG_PRINT_SHOWN > visible.to;
            if (strip.overview && (before || after)) {
                if (!edge) {
                    edge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    edge.setAttribute('class', 'rc-tagwin-edge');
                    strip.svg.appendChild(edge);
                }
                edge.setAttribute('x', String(before ? (visible.from - strip.from) * scale + 4 : (visible.to - strip.from) * scale - 4));
                edge.setAttribute('y', String(height - 6));
                edge.setAttribute('text-anchor', before ? 'start' : 'end');
                const label = `選印 ${formatTagClock(ctx, current)}–${formatTagClock(ctx, current + TAG_PRINT_SHOWN)}`;
                setSvgText(edge, before ? `← ${label}` : `${label} →`);
            } else edge?.remove();
            const hover = tagHover && tagHover.start !== current ? tagHover.start : null;
            place('hover', hover);
            let text = strip.svg.querySelector(':scope > text.rc-tagwin-text');
            if (hover === null) { text?.remove(); continue; }
            if (!text) {
                text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('class', 'rc-tagwin-text');
                strip.svg.appendChild(text);
            }
            text.setAttribute('x', String((hover - strip.from) * scale + 4));
            text.setAttribute('y', '13');
            setSvgText(text, `點一下：選印 ${formatTagClock(ctx, hover)}–${formatTagClock(ctx, hover + TAG_PRINT_SHOWN)}`);
        }
    }
    // 內容相同時不重設：改文字會觸發頁面變動，而頁面變動又會重畫，避免不斷重畫。
    function setSvgText(node, text) {
        if (node.textContent !== text) node.textContent = text;
    }
    function formatTagClock(ctx, time) {
        try {
            const text = ctx.host.tmsFormat?.(time, 'HH:mm:ss');
            if (text) return text;
        } catch (_) {}
        return new Date(time * 1000).toLocaleTimeString();
    }
    function findTagStrip(ctx, target) {
        return getTagPrintStrips(ctx).find(strip => strip.svg.contains(target)) || null;
    }
    // 與網站 ◀ ▶ 相同的方式寫入：清單上有這張時借用 adjustTagEventRange，順便更新清單上的心電圖。
    function setTagPrintStart(ctx, start) {
        const af = ctx.af;
        if (!af.eventRecordRange) af.eventRecordRange = {};
        if (!af.eventRecordRange.tag) af.eventRecordRange.tag = {};
        const ranges = af.eventRecordRange.tag;
        const item = (!ctx.detached && Array.isArray(af.eventDialog.currentData) ? af.eventDialog.currentData : [])
            .find(entry => entry && toEventTime(entry) === ctx.tagTime);
        if (ctx.detached) scheduleDetachedUpload(af);
        ctx.host.$apply(() => {
            if (item) {
                // 先放在前一步，網站再往後移 5 秒正好落在 start；紀錄開頭（前一步早於開頭）改從後一步往前移。
                const fromAfter = start - TAG_PRINT_STEP < Number(af.record?.startTimeInt);
                ranges[ctx.tagTime] = fromAfter ? start + TAG_PRINT_STEP : start - TAG_PRINT_STEP;
                ctx.host.adjustTagEventRange(fromAfter ? 'prev' : 'next', item, 'tag');
            }
            if (Number(ranges[ctx.tagTime]) !== start) {
                ranges[ctx.tagTime] = start;
                if (item) item.timeRange = [start, start + TAG_PRINT_SECONDS];
            }
        });
    }
    // 心電圖視窗左右捲動時，畫面外的標示跟著看得到的邊緣移動。
    let tagScrollPending = false;
    document.addEventListener('scroll', () => {
        if (tagScrollPending || !document.querySelector('.rc-tagwin')) return;
        tagScrollPending = true;
        requestAnimationFrame(() => { tagScrollPending = false; drawTagPrintWindows(); });
    }, { capture: true, passive: true });
    let tagPointerDown = null;
    document.addEventListener('mousemove', event => {
        const inside = event.target.closest?.('.ngdialog.ecg-dialog .ecg-wave .ecgWave svg')
            && !event.target.closest('.rc-lead-eye');
        if (!inside && !tagHover) return;
        const ctx = inside && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !labelDrag
            ? getTagPrintContext() : null;
        const strip = ctx && findTagStrip(ctx, event.target);
        const next = strip ? { start: snapTagPrintStart(getTagPrintWindow(ctx.af, ctx.tagTime),
            tagStripTime(strip, event.clientX), tagViewEnd(ctx)) } : null;
        // Mesurer 等開啟時收起選印範圍框，不擋住量測。
        if (inside && !ctx && document.querySelector('.rc-tagwin')) { tagHover = null; drawTagPrintWindows(); return; }
        if (next?.start === tagHover?.start) return;
        tagHover = next;
        drawTagPrintWindows();
    }, { capture: true, passive: true });
    document.addEventListener('mousedown', event => {
        tagPointerDown = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    }, true);
    document.addEventListener('click', event => {
        if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || labelDrag) return;
        if (!event.target.closest?.('.ngdialog.ecg-dialog .ecg-wave .ecgWave svg')) return;
        if (event.target.closest('.rc-lead-eye')) return; // 導程眼睛按鈕自己處理點擊
        // 拖曳（例如選取或捲動）放開時不算點一下。
        if (tagPointerDown && Math.hypot(event.clientX - tagPointerDown.x, event.clientY - tagPointerDown.y) > 4) return;
        const ctx = getTagPrintContext();
        const strip = ctx && findTagStrip(ctx, event.target);
        if (!strip) return;
        // 這次點擊用來移動選印範圍：不交給網站波形的點擊（未開 Mesurer 也會畫出量測虛線）。
        event.preventDefault();
        event.stopImmediatePropagation();
        clearECGMeasureLine(strip.svg);
        const start = snapTagPrintStart(getTagPrintWindow(ctx.af, ctx.tagTime), tagStripTime(strip, event.clientX), tagViewEnd(ctx));
        if (start !== getTagPrintWindow(ctx.af, ctx.tagTime).start) setTagPrintStart(ctx, start);
        tagHover = null;
        drawTagPrintWindows();
        quickToast(strip.svg, `選印時間：${formatTagClock(ctx, start)}–${formatTagClock(ctx, start + TAG_PRINT_SHOWN)}`);
        // 選印清單中這張的縮圖改顯示新的選印範圍。
        const card = review?.ctx.config.tag ? review.cards.get(ctx.tagTime) : null;
        if (card) reloadReviewThumb(card, ctx.tagTime);
    }, true);
    // 選印清單開著時：網站點擊心電圖波形會切換並畫出 Mesurer 的量測虛線（未開 Mesurer 也會），
    // 只有 Mesurer 等量測功能開啟時才交給網站，否則擋下這次點擊。上方的標籤列不在波形內，改標籤不受影響。
    document.addEventListener('click', event => {
        if (!review || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || labelDrag) return;
        const svg = event.target.closest?.('.ngdialog.ecg-dialog .ecg-wave .ecgWave svg');
        if (!svg || !window.angular || event.target.closest('.rc-lead-eye')) return; // 導程眼睛按鈕不擋
        let scope;
        try { scope = window.angular.element(svg).scope(); } catch (_) { return; }
        while (scope && !scope.af) scope = scope.$parent;
        if (!scope?.af || isECGMeasuring(scope.af)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        clearECGMeasureLine(svg);
    }, true);
    // 先前點擊留下的量測虛線（網站的 eventSwitch 仍開著）一併關閉，滑鼠移動時網站就會收起。
    function clearECGMeasureLine(svg) {
        let wave;
        try { wave = window.angular.element(svg.closest('.ecgWave')).isolateScope(); } catch (_) { return; }
        if (wave?.eventSwitch) wave.$apply(() => { wave.eventSwitch = false; });
    }

    // Group：先儲存未儲存的標籤修改（與心電圖視窗的 Save 相同），等上傳完成後執行網站的 Group All
    // （伺服器重新分類事件並重新載入資料），載入完成後重新開啟同類型的事件清單與選印清單。
    const GROUP_SAVE_TIMEOUT_MS = 30000;
    const GROUP_RELOAD_TIMEOUT_MS = 90000;
    function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    // 每 100 毫秒檢查一次；check 連續成立 stableMs 才算完成。
    async function waitStable(check, stableMs, timeout) {
        const started = Date.now();
        let since = null;
        while (Date.now() - started < timeout) {
            let ok = false;
            try { ok = !!check(); } catch (_) {}
            if (!ok) since = null;
            else if (since === null) since = Date.now();
            else if (Date.now() - since >= stableMs) return true;
            await waitMs(100);
        }
        return false;
    }
    function getAFHost() {
        const element = document.querySelector('[ng-controller="RootiCareDashboardAFCtrl"]');
        if (!element || !window.angular) return null;
        let scope;
        try { scope = window.angular.element(element).scope(); } catch (_) { return null; }
        while (scope && typeof scope.classifyType !== 'function') scope = scope.$parent;
        return scope || null;
    }
    function isSiteLoading(host) {
        try {
            return !!host.rooticare?.loading || (typeof host.checkIsLoading === 'function' && host.checkIsLoading(host.af));
        } catch (_) { return true; }
    }
    // 上傳尚未儲存的選印：與網站關閉事件清單時的 postPDFSelectedEvents 相同，內容沒變就不上傳。
    // Group All 會從伺服器重新載入選印，清單開著時選的（含快速選印）若沒先上傳就會被覆蓋。
    async function uploadPrintSelections(af) {
        const printDialog = af?.printDialog;
        if (!printDialog?.selectedEvents) return;
        if (JSON.stringify(printDialog.tmpSelectedEvents) === JSON.stringify(printDialog.selectedEvents)) return;
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const snapshot = window.angular.copy(printDialog.selectedEvents);
        await manager.Af.postPDFSelectedEvents(af._vendorId, af._idNumber, af._measureId, printDialog.selectedEvents);
        printDialog.tmpSelectedEvents = snapshot;
    }
    // 上傳藍色選印（區段選印）：網站把區段範圍存在 eventRecordRange，關閉事件清單時以 postEventRangeAdjust 上傳
    // （連同 AF 心率資料 af_stat），與 ogEventRecordRange 相同就不上傳。
    async function uploadSectionSelections(af) {
        if (!af?.eventRecordRange) return;
        if (JSON.stringify(af.eventRecordRange) === JSON.stringify(af.ogEventRecordRange)) return;
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const payload = window.angular.copy(af.eventRecordRange);
        payload.af_stat = af.afHRData;
        await manager.Af.postEventRangeAdjust(af._vendorId, af._idNumber, af._measureId, payload);
        af.ogEventRecordRange = window.angular.copy(af.eventRecordRange);
    }
    function findPrintReviewAnchor(type) {
        for (const summary of document.querySelectorAll('.rc-print-summary.is-link')) {
            const ctx = getQuickContext(summary);
            if (ctx?.type === type) return summary;
        }
        return null;
    }
    async function groupReview() {
        if (!review || review.busy || review.grouping) return;
        const { ctx } = review;
        const type = ctx.type;
        const button = review.bar.querySelector('.rc-review-group');
        const host = getAFHost();
        if (!host) { quickToast(button, '找不到網站的 Group All 功能', true); return; }
        if (!ctx.af.editingSwitch) { quickToast(button, '請先進入編輯模式（點計時器）再 Group', true); return; }
        review.grouping = true;
        setReviewBusy(true);
        const setText = text => { if (button.isConnected) button.textContent = text; };
        try {
            // 1. 儲存：網站的 Save 會上傳修改並關閉心電圖視窗；沒有開著心電圖視窗時先開一張，避免關到事件清單。
            if (ctx.af.ecgAnno?.modifiedData?.length) {
                setText('儲存中…');
                if (!getReviewECGDialog() && review.items.length) await showReviewTime(review.active ?? review.items[0], true);
                if (!getReviewECGDialog()) throw new Error('無法開啟心電圖視窗以儲存修改');
                ctx.host.$apply(() => ctx.host.saveCurrentModifiedData());
                const saved = await waitStable(() => !ctx.af.loading?.modified, 300, GROUP_SAVE_TIMEOUT_MS);
                if (!saved) throw new Error('儲存逾時');
                // 網站在上傳後 2.5 秒會重新整理清單的心電圖，等它跑完再 Group。
                await waitMs(2700);
            }
            // 2. 先上傳選印（含快速選印），否則 Group All 重新載入時會被伺服器上的舊選印覆蓋。
            setText('儲存選印…');
            await uploadPrintSelections(host.af);
            await uploadSectionSelections(host.af);
            // 記下目前畫面：清單頁碼與正在看的選印，重新載入後回到同一處。
            const restorePage = Number(ctx.dialog.pagination?.currentPage) || 1;
            const restoreTime = review.active;
            // 3. Group All：伺服器重新分類後網站會重新載入整份資料（AF 區塊可能重建，開著的清單會被關掉）。
            //    每次都重新取得目前的 AF scope，等它不再載入、這個類型的清單資料就緒且穩定 1.5 秒。
            setText('Group 中…');
            host.$apply(() => host.classifyType('all'));
            await waitStable(() => { const h = getAFHost(); return !h || h !== host || isSiteLoading(h); }, 0, 5000);
            const loaded = await waitStable(() => {
                const h = getAFHost();
                return h && !isSiteLoading(h) && Array.isArray(h.af?.eventDialog?.[type]?.data);
            }, 1500, GROUP_RELOAD_TIMEOUT_MS);
            if (!loaded) throw new Error('重新載入逾時');
            // 4. 回到原本的畫面：同類型清單、同一頁、選印清單並開啟原本那張心電圖。
            setText('重整中…');
            closePrintReview();
            const ngDialog = window.angular.element(document.body).injector().get('ngDialog');
            for (const dialog of document.querySelectorAll('.ngdialog.ecg-dialog, .ngdialog.section-dialog, .ngdialog.event-dialog')) {
                if (dialog.id) ngDialog.close(dialog.id);
            }
            await waitFor(() => !document.querySelector('.ngdialog.ecg-dialog, .ngdialog.section-dialog, .ngdialog.event-dialog'), 3000);
            const freshHost = getAFHost();
            if (!freshHost?.af?.eventDialog?.[type]?.itemsLength) {
                quickToast(null, 'Group 完成；這個類型目前沒有事件，未重新開啟清單');
                return;
            }
            freshHost.$apply(() => freshHost.openEventBasicList(type));
            await waitFor(() => !!findPrintReviewAnchor(type), 15000);
            const anchor = findPrintReviewAnchor(type);
            if (!anchor) { quickToast(null, 'Group 完成，但無法重新開啟選印清單'); return; }
            const range = anchor.closest('.ngdialog')?.querySelector('.pagination-range');
            const pageCount = Number(freshHost.af.eventDialog.pagination?.pageCount)
                || Math.ceil(freshHost.af.eventDialog[type].itemsLength / (Number(freshHost.af.eventDialog.pagination?.itemsPerPage) || 1));
            if (restorePage > 1 && range) jumpToPage(range, Math.min(restorePage, pageCount || restorePage));
            openPrintReview(anchor, restoreTime);
            quickToast(review?.bar.querySelector('.rc-review-group') || null, 'Group 完成，已重新整理清單');
        } catch (error) {
            quickToast(button, `Group 失敗：${error?.message || error}`, true);
        } finally {
            if (review?.grouping) {
                review.grouping = false;
                setText('Group');
                setReviewBusy(false);
            }
        }
    }

    // 滑鼠中鍵：刪除標籤
    window.addEventListener('mousedown', async function(e) {
        if (e.button === 1) {
            if (rangeMode || rangeBusy || rangeHint.contains(e.target)) return;
            const activeBlock = getActiveBlockUnderMouse();
            if (activeBlock) {
                e.preventDefault();
                await processCommand('');
            }
        }
    }, { passive: false });

})();
