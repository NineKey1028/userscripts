const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,
    '../scripts/rooticare/RootiCare ECG 變動率縮圖標記器.user.js'), 'utf8');
const context = { document: { readyState: 'loading', addEventListener() {} },
    window: { addEventListener() {} }, Event: class {} };
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `globalThis.api = {
    sampleWavePath, readColoredWaveShape: readColoredWavePixels, readPhysicalWaveShape: readColoredWaveShape,
    readWaveScale, validConditions, conditionMatches, readConditions,
    getPlayerPreviousConditions: () => playerPreviousConditions,
    thumbnailHits, conditionEditors, synchronizeConditions, thumbnailSelectionText,
    showBoundsMessage, clearBoundsMessage, selectThumbnailBatch, templateDirection
}; })();`), context);
const api = context.api;
let count = 0;
function test(name, run) { run(); console.log(`ok ${++count} - ${name}`); }
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixture(d, stops = [[0.475, '#666'], [0.5, 'red'], [0.525, '#666']], scale = {}) {
    const gradient = {
        getAttribute: () => null,
        querySelectorAll: () => stops.map(([offset, color]) => ({
            getAttribute: name => name === 'offset' ? String(offset) : color
        }))
    };
    const svg = { querySelector: () => gradient };
    const wavePath = { getAttribute: () => d, closest: () => svg };
    const attributes = { 'seg-sec': '10', 'min-m-volt': '0', 'max-m-volt': '73', ...scale };
    const group = { getAttribute: name => String(name === 'width' ? (scale.width || 10000) : (scale.height || 73)) };
    const wave = { getAttribute: name => attributes[name] ?? null, querySelector: () => group };
    return { querySelector: selector => selector === '.ecgWave' ? wave : wavePath, changeD(value) { d = value; } };
}
const positiveD = 'M0,50L35,50L40,50L45,50L47.5,50L50,30L52.5,50L55,50L60,50L65,50L100,50';
const positive = fixture(positiveD);
const negative = fixture(positiveD.replace('50,30', '50,70'), [[0.475, '#666'], [0.5, '#0568F7'], [0.525, '#666']]);

test('physical units use whole drawing width and voltage range', () => {
    const result = api.readPhysicalWaveShape(fixture(positiveD, undefined,
        { 'seg-sec': '4', width: 100, 'min-m-volt': '2.5', 'max-m-volt': '4.5', height: 100 }));
    near(result.width, 190); near(result.height, 0.4);
});

test('the same beat at different horizontal and vertical scales has the same physical values', () => {
    const scaled = positiveD.replace(/([ML])([\d.]+),([\d.]+)/g,
        (_, command, x, y) => `${command}${Number(x) * 2},${Number(y) * 2}`);
    const a = api.readPhysicalWaveShape(fixture(positiveD, undefined,
        { 'seg-sec': '4', width: 100, 'min-m-volt': '2.5', 'max-m-volt': '4.5', height: 100 }));
    const b = api.readPhysicalWaveShape(fixture(scaled, undefined,
        { 'seg-sec': '4', width: 200, 'min-m-volt': '2.5', 'max-m-volt': '4.5', height: 200 }));
    near(a.width, b.width); near(a.height, b.height);
});

test('unresolved scale bindings fail closed instead of guessing physical units', () => {
    const result = api.readPhysicalWaveShape(fixture(positiveD, undefined,
        { 'seg-sec': 'model.seconds', 'min-m-volt': 'model.min', 'max-m-volt': 'model.max' }));
    assert.equal(result.width, null); assert.equal(result.height, null);
});

test('thumbnail Angular bindings resolve through its own directive scope', () => {
    context.window = { angular: { element: () => ({ isolateScope: () => ({
        segSec: 4, minMVolt: 2.5, maxMVolt: 4.5, zoomScale: 2
    }) }) } };
    try {
        const result = api.readPhysicalWaveShape(fixture(positiveD, undefined,
            { 'seg-sec': 'model.seconds', width: 100, height: 100 }));
        near(result.width, 190); near(result.height, 0.2);
    } finally { context.window = {}; }
});
test('red positive peak, gray baseline and width', () => {
    const result = api.readColoredWaveShape(positive);
    near(result.baseline, 50); near(result.height, 20); near(result.width, 4.75);
});
test('blue negative peak retains sign', () => near(api.readColoredWaveShape(negative).height, -20));
test('baseline follows vertical offset', () => {
    const result = api.readColoredWaveShape(fixture(positiveD.replaceAll(',50', ',60').replace(',30', ',40')));
    near(result.baseline, 60); near(result.height, 20);
});
test('biphasic wave chooses larger absolute deviation', () => {
    const result = api.readColoredWaveShape(fixture(positiveD.replace('L50,30', 'L49,35L51,75')));
    near(result.height, -25);
});
test('cubic extrema are included', () => {
    const points = api.sampleWavePath('M0,50C30,10,70,10,100,50');
    near(Math.min(...points.map(p => p.y)), 20);
});
test('unsupported path does not produce a guessed measurement', () => {
    assert.equal(api.readColoredWaveShape(fixture('M0,50Q50,0,100,50')), null);
});
test('Player chooses central blue region instead of earlier red peak', () => {
    const result = api.readColoredWaveShape(fixture(positiveD,
        [[0.1, '#666'], [0.2, 'red'], [0.3, '#666'], [0.35, '#666'],
            [0.45, '#0568F7'], [0.5, '#0568F7'], [0.6, '#666'], [0.8, 'red'], [0.9, '#666']]), true);
    near(result.width, 4.75); near(result.height, 20);
});
test('same gradient distinguishes narrow and wide waveforms', () => {
    const wide = fixture(positiveD.replace('L47.5,50L50,30L52.5,50', 'L46,50L50,30L54,50'));
    assert.ok(api.readColoredWaveShape(wide).width > api.readColoredWaveShape(positive).width);
});
test('negative wave has the same baseline-to-baseline width', () => {
    near(api.readColoredWaveShape(negative).width, 4.75);
});
test('width stops at the valley before an adjoining P wave', () => {
    // P 波頂點 47、谷底 48.5（偏離 1.5 px，高於 1 px 容差）；舊算法會延伸到 43.67。
    const result = api.readColoredWaveShape(fixture(
        'M0,50L35,50L43,50L45,47L47,48.5L50,30L52.5,50L55,50L60,50L65,50L100,50'));
    near(result.height, 20); near(result.width, 52.375 - 47);
});
test('inverted wide QRS keeps its notch inside the width', () => {
    // 負向主峰 20 px；切跡谷底偏離 2.8 px（14%），高於谷底門檻，應延伸到真正回到基準線處。
    const result = api.readColoredWaveShape(fixture(
        'M0,50L35,50L43,50L44,54L45,52.8L47,56L50,70L52.5,50L55,50L60,50L65,50L100,50',
        [[0.475, '#666'], [0.5, '#0568F7'], [0.525, '#666']]));
    near(result.height, -20); near(result.width, 52.375 - 43.25);
});
test('inverted wave stops at the valley before an adjoining P wave', () => {
    const result = api.readColoredWaveShape(fixture(
        'M0,50L35,50L43,50L45,53L47,51.5L50,70L52.5,50L55,50L60,50L65,50L100,50',
        [[0.475, '#666'], [0.5, '#0568F7'], [0.525, '#666']]));
    near(result.height, -20); near(result.width, 52.375 - 47);
});
test('noisy baseline keeps width and height empty but still gives a direction', () => {
    // 基線每 0.5 px 在 48/52 間來回（斜率 8），沒有平坦線段可用；中位數仍為 50。
    const zigzag = (from, to) => Array.from({ length: (to - from) * 2 + 1 }, (_, i) => `L${from + i / 2},${i % 2 ? 52 : 48}`).join('');
    const result = api.readColoredWaveShape(fixture(`M0,50L35,50${zigzag(35, 47)}L47.5,50L50,30L52.5,50${zigzag(53, 65)}L65.5,50L100,50`));
    assert.equal(result.baseline, null); assert.equal(result.height, null); assert.equal(result.width, null);
    assert.equal(result.noisy, true); assert.equal(result.direction, 'up');
    assert.equal(api.readColoredWaveShape(positive).noisy, false);
});
test('noise analysis flags a jittery ST-T segment or a QRS right next to the red beat', () => {
    // 1000 點、250 Hz、4 秒；正常心搏在 200/350/650/800，紅點在 500（cx = 索引 × 10）。
    const spikeAt = (data, at, height) => { for (let i = -4; i <= 4; i++) data[at + i] += height * (1 - Math.abs(i) / 5); };
    const strip = extra => {
        const data = Array(1000).fill(0);
        for (const at of [200, 350, 650, 800]) spikeAt(data, at, 1);
        spikeAt(data, 500, 1);
        for (let i = 540; i < 600; i++) data[i] += 0.3 * Math.sin((i - 540) / 60 * Math.PI);
        extra?.(data);
        return data;
    };
    const dots = [200, 350, 500, 650, 800].map(at => ({ getAttribute: () => String(at * 10), classList: { contains: () => at === 500 } }));
    const read = ecgData => {
        context.window = { angular: { element: () => ({ isolateScope: () => ({ ecgData, sampleRate: 250, segSec: 4 }) }) } };
        const thumb = fixture(positiveD);
        thumb.querySelectorAll = () => dots;
        try { return api.readPhysicalWaveShape(thumb); } finally { context.window = {}; }
    };
    const clean = read(strip());
    assert.equal(clean.noisy, false); assert.equal(clean.spike, false); assert.ok(clean.turns < 3);
    const jitter = read(strip(data => { for (let i = 530; i < 620; i++) data[i] += Math.floor(i / 6) % 2 ? 0.2 : -0.2; }));
    assert.ok(jitter.turns >= 3); assert.equal(jitter.noisy, true);
    // 細小的肌電抖動（擺動約正常振幅 12%，低於 20% 門檻）不算雜訊。
    const tremor = read(strip(data => { for (let i = 530; i < 620; i++) data[i] += Math.floor(i / 3) % 2 ? 0.06 : -0.06; }));
    assert.equal(tremor.noisy, false); assert.ok(tremor.turns < 2);
    // 紅點後 120 ms 又出現與正常 QRS 相同的尖峰：紅點不是真正的心搏。
    const early = read(strip(data => spikeAt(data, 530, 1)));
    assert.equal(early.spike, true); assert.equal(early.noisy, true);
    // 寬高仍由基準線量測，不因判為雜訊而清空。
    assert.ok(jitter.height > 0); assert.ok(jitter.width > 0);
    // 沒有原始資料時不使用此判斷。
    assert.equal(api.readPhysicalWaveShape(fixture(positiveD)).turns, null);
});
test('flat wave has no measurable width', () => {
    assert.equal(api.readColoredWaveShape(fixture(positiveD.replace('50,30', '50,50'))).width, null);
});
test('same-color neighboring peak does not determine central width or height', () => {
    const result = api.readColoredWaveShape(fixture(
        positiveD.replace('L40,50L45,50', 'L40,50L42,0L45,50'),
        [[0.3, '#666'], [0.42, '#0568F7'], [0.5, '#0568F7'], [0.6, '#666']]), true);
    near(result.width, 4.75);
    near(result.height, 20);
});

test('Player measures anchored R peak even when nearby T is taller', () => {
    const result = api.readColoredWaveShape(fixture(
        'M0,50L35,50L45,50L49.7,50L50,30L50.3,50L50.7,0L51,50L55,50L65,50L100,50',
        [[0.35, '#666'], [0.5, 'red'], [0.65, '#666']]), true);
    near(result.height, 20); near(result.width, 0.57);
});

test('Player negative central peak retains sign despite taller positive T', () => {
    const result = api.readColoredWaveShape(fixture(
        'M0,50L35,50L45,50L49.7,50L50,70L50.3,50L50.7,0L51,50L55,50L65,50L100,50',
        [[0.35, '#666'], [0.5, '#0568F7'], [0.65, '#666']]), true);
    near(result.height, -20); near(result.width, 0.57);
});

test('Player includes the dominant negative lobe after the smaller anchored positive lobe', () => {
    const result = api.readColoredWaveShape(fixture(
        'M0,50L35,50L45,50L49.7,50L49.95,42L50.52,68L50.8,50L55,50L65,50L100,50',
        [[0.35, '#666'], [0.5, 'red'], [0.65, '#666']]), true);
    near(result.height, -18);
});

test('Player does not require a gray stop beyond consecutive colored beats', () => {
    const result = api.readColoredWaveShape(fixture(positiveD,
        [[0.3, 'red'], [0.5, 'red'], [0.7, 'red']]), true);
    near(result.height, 20); near(result.width, 4.75);
});

test('Player without an anchored peak does not substitute a distant T wave', () => {
    const result = api.readColoredWaveShape(fixture(
        'M0,50L35,50L45,50L50,50L52,50L55,0L58,50L65,50L100,50',
        [[0.35, '#666'], [0.5, 'red'], [0.65, '#666']]), true);
    assert.equal(result.height, null); assert.equal(result.width, null);
});
test('no return before adjacent beat boundary is not a measured width', () => {
    const result = api.readColoredWaveShape(fixture(
        'M0,50L30,50L35,50L40,50L45,30L50,30L55,30L60,30L65,50L70,50L100,50',
        [[0.3, '#666'], [0.4, '#666'], [0.5, 'red'], [0.6, '#666'], [0.7, '#666']]), true);
    assert.equal(result.width, null);
});
test('uncolored central Player beat is unavailable', () => {
    assert.equal(api.readColoredWaveShape(fixture(positiveD,
        [[0.3, '#666'], [0.4, 'red'], [0.5, '#666'], [0.6, '#666']]), true), null);
});
test('cache invalidates after waveform change', () => {
    const thumb = fixture(positiveD);
    near(api.readColoredWaveShape(thumb).height, 20);
    thumb.changeD(positiveD.replace('50,30', '50,70'));
    near(api.readColoredWaveShape(thumb).height, -20);
});
const condition = (kind, operator, value) => ({ kind, operator, value });
test('zero and negative height are valid, negative width is invalid', () => {
    for (const value of [0, -20]) assert.ok(api.validConditions({ conditions: [condition('height', '>=', value)] }));
    assert.ok(api.validConditions({ conditions: [condition('width', '<=', 0)] }));
    assert.equal(api.validConditions({ conditions: [condition('width', '<=', -1)] }), false);
});
test('inclusive negative boundaries and missing metrics', () => {
    assert.ok(api.conditionMatches({ height: -20 }, condition('height', '<=', -20)));
    assert.ok(api.conditionMatches({ height: -20 }, condition('height', '>=', -20)));
    assert.equal(api.conditionMatches({ height: null }, condition('height', '<=', 0)), false);
});
test('each numeric kind rejects inverted bounds and accepts equal bounds', () => {
    for (const kind of ['rate', 'bpm', 'height', 'width']) {
        assert.equal(api.validConditions({ conditions: [condition(kind, '>=', 20), condition(kind, '<=', 10)] }), false);
        assert.ok(api.validConditions({ conditions: [condition(kind, '>=', 20), condition(kind, '<=', 20)] }));
    }
});
test('negative height bounds use numeric ordering', () => {
    assert.ok(api.validConditions({ conditions: [condition('height', '>=', -20), condition('height', '<=', -10)] }));
    assert.equal(api.validConditions({ conditions: [condition('height', '>=', -10), condition('height', '<=', -20)] }), false);
});
function editor(conditions) {
    const e = { isConnected: true, conditions, dispatchEvent() {},
        replaceConditions(value) { this.conditions = value; },
        querySelectorAll() { return this.conditions.map(c => ({ dataset: { kind: c.kind },
            querySelector: selector => selector.includes('enabled') ? { checked: c.enabled !== false }
                : ({ value: String(selector.includes('operator') ? c.operator : c.value) }) })); }
    };
    e.parentElement = { querySelector: () => e };
    return e;
}
test('readConditions preserves numeric zero and rejects empty input', () => {
    const e = editor([condition('height', '>=', 0), condition('height', '<=', '')]);
    const values = api.readConditions(e.parentElement).conditions;
    assert.equal(values[0].value, 0); assert.ok(Number.isNaN(values[1].value));
});
test('unchecked bounds are ignored but their values survive synchronization', () => {
    const lower = condition('height', '>=', -10);
    const upper = { ...condition('height', '<=', -20), enabled: false };
    const a = editor([lower, upper]);
    const b = editor([]);
    const settings = api.readConditions(a.parentElement);
    assert.equal(settings.conditions.length, 1);
    assert.equal(settings.editorConditions.length, 2);
    assert.ok(api.validConditions(settings));
    api.conditionEditors.clear(); api.conditionEditors.add(a); api.conditionEditors.add(b);
    api.synchronizeConditions(a);
    assert.equal(b.conditions[1].enabled, false);
    assert.equal(b.conditions[1].value, -20);
    a.conditions[0].enabled = false;
    assert.equal(api.validConditions(api.readConditions(a.parentElement)), false);
    api.conditionEditors.clear();
});
test('shape bounds combine with AND and include equality', () => {
    context.document.querySelectorAll = () => [positive, negative];
    const hits = api.thumbnailHits({ conditions: [condition('height', '>=', -20),
        condition('height', '<=', 0), condition('width', '<=', 5)] });
    assert.equal(hits.size, 1); assert.ok(hits.has(negative));
});
test('shape conditions synchronize while predecessor condition stays local', () => {
    const a = editor([condition('height', '>=', -10), condition('width', '<=', 9)]);
    const b = editor([condition('previous', '=', 'N')]);
    api.conditionEditors.add(a); api.conditionEditors.add(b);
    api.synchronizeConditions(a);
    assert.equal(b.conditions.length, 3); assert.equal(b.conditions[0].kind, 'height');
    assert.equal(b.conditions[2].kind, 'previous');
    api.synchronizeConditions(b);
    assert.equal(a.conditions.length, 2);
});

test('closing Player preserves both predecessor operators and thumbnail edits do not erase them', () => {
    api.conditionEditors.clear();
    const player = editor([condition('previous', '=', 'V'), condition('previous', '!=', 'N')]);
    player.dataset = { allowPrevious: 'true' };
    api.synchronizeConditions(player);
    player.isConnected = false;
    api.synchronizeConditions(editor([condition('width', '>=', 100)]));
    const restored = JSON.parse(JSON.stringify(api.getPlayerPreviousConditions()));
    assert.deepEqual(restored, [
        { ...condition('previous', '=', 'V'), enabled: true },
        { ...condition('previous', '!=', 'N'), enabled: true }
    ]);
    player.conditions = [];
    api.synchronizeConditions(player);
    assert.equal(api.getPlayerPreviousConditions().length, 0);
});
test('direction matches the sign of the main deflection and ignores flat waves', () => {
    const up = condition('direction', '=', 'up'), down = condition('direction', '=', 'down');
    assert.ok(api.conditionMatches({ height: 0.4 }, up)); assert.equal(api.conditionMatches({ height: 0.4 }, down), false);
    assert.ok(api.conditionMatches({ height: -0.4 }, down)); assert.equal(api.conditionMatches({ height: -0.4 }, up), false);
    for (const height of [0, null]) assert.equal(api.conditionMatches({ height }, up) || api.conditionMatches({ height }, down), false);
    assert.ok(api.validConditions({ conditions: [up] }));
    assert.equal(api.validConditions({ conditions: [condition('direction', '=', '')] }), false);
});
test('direction filter combines with shape bounds on thumbnails', () => {
    context.document.querySelectorAll = () => [positive, negative];
    const hits = api.thumbnailHits({ conditions: [condition('direction', '=', 'down')] });
    assert.equal(hits.size, 1); assert.ok(hits.has(negative));
});
test('noise condition keeps or excludes noisy thumbnails and ignores unreadable ones', () => {
    const noise = condition('noise', '=', 'noise'), clean = condition('noise', '!=', 'noise');
    assert.ok(api.conditionMatches({ noisy: true }, noise)); assert.equal(api.conditionMatches({ noisy: true }, clean), false);
    assert.ok(api.conditionMatches({ noisy: false }, clean)); assert.equal(api.conditionMatches({ noisy: false }, noise), false);
    assert.equal(api.conditionMatches({}, noise) || api.conditionMatches({}, clean), false);
    assert.ok(api.validConditions({ conditions: [noise] })); assert.ok(api.validConditions({ conditions: [clean] }));
    assert.equal(api.validConditions({ conditions: [condition('noise', '>=', 'noise')] }), false);
});
test('noisy thumbnail direction comes from the fallback level', () => {
    assert.ok(api.conditionMatches({ height: null, noisy: true, direction: 'down' }, condition('direction', '=', 'down')));
    assert.equal(api.conditionMatches({ height: null, noisy: true, direction: null }, condition('direction', '=', 'up')), false);
});
test('type template direction uses the largest deflection near R', () => {
    const wave = peaks => Array.from({ length: 100 }, (_, i) => peaks[i] ?? 0);
    assert.equal(api.templateDirection(wave({ 36: 2.1, 45: -0.4 })), 'up');
    assert.equal(api.templateDirection(wave({ 36: 0.3, 48: -0.6 })), 'down');
    assert.equal(api.templateDirection(Array(100).fill(1)), null);
    assert.equal(api.templateDirection([1, 2]), null);
});
test('direction stays in the thumbnail editor and never reaches Player', () => {
    api.conditionEditors.clear();
    const thumbnail = editor([condition('width', '>=', 100), condition('direction', '=', 'down'), condition('noise', '!=', 'noise')]);
    const player = editor([condition('previous', '=', 'V')]);
    player.dataset = { allowPrevious: 'true' };
    api.conditionEditors.add(thumbnail); api.conditionEditors.add(player);
    api.synchronizeConditions(thumbnail);
    assert.equal(player.conditions.map(c => c.kind).join(), 'width,previous');
    api.synchronizeConditions(player);
    assert.equal(thumbnail.conditions.map(c => c.kind).join(), 'width,direction,noise');
    api.conditionEditors.clear();
});
test('thumbnail previous-beat filter reads the hidden label table and maps A to S', () => {
    const thumb = (labels, currentAt) => {
        const wave = {};
        const dots = Object.keys(labels).map(Number).sort((a, b) => a - b).map(abs => ({
            __data__: String(abs), getAttribute: () => String(abs), classList: { contains: () => abs === currentAt } }));
        return { wave, labels, querySelector: () => wave, querySelectorAll: () => dots };
    };
    const a = thumb({ 100: 'N', 200: 'A', 300: 'V', 400: 'N' }, 300);
    const b = thumb({ 100: 'N', 200: 'N', 300: 'V' }, 300);
    const c = thumb({ 300: 'V', 400: 'N' }, 300);
    const list = [a, b, c];
    context.window = { angular: { element: wave => ({ isolateScope: () => ({ annoData: list.find(item => item.wave === wave).labels }) }) } };
    context.document.querySelectorAll = () => list;
    try {
        const hits = condition => api.thumbnailHits({ conditions: [condition] });
        const s = hits(condition('previous', '=', 'S'));
        assert.equal(s.size, 1); assert.ok(s.has(a));
        const notS = hits(condition('previous', '!=', 'S'));
        // 沒有前一搏的縮圖不讓 ≠ 誤判成命中。
        assert.equal(notS.size, 1); assert.ok(notS.has(b));
    } finally { context.window = {}; }
});
function selectable(shape, selected = true) {
    return {
        querySelector: selector => selector === '.idBackground.selectedBackground' ? (selected ? {} : null) : shape.querySelector(selector),
        querySelectorAll: () => []
    };
}
test('single selection shows signed height and unavailable BPM', () => {
    context.document.querySelectorAll = () => [selectable(negative)];
    assert.match(api.thumbnailSelectionText(), /選取 1 搏 · 心搏速率\(BPM\) — · 心搏寬度 4.8 ms · 心搏高度 -20.000 mV/);
});
test('multiple selections show minimum and maximum, not the last click', () => {
    context.document.querySelectorAll = () => [selectable(negative), selectable(positive)];
    assert.match(api.thumbnailSelectionText(), /多選 2 搏/);
    assert.match(api.thumbnailSelectionText(), /高度 -20.000～20.000 mV/);
});
test('cross-page selections explicitly limit reported metrics to visible page', () => {
    context.document.querySelector = () => ({});
    context.window = { angular: { element: () => ({ scope: () => ({ morphology: { state: { selectedSegments: [1, 2, 3] } } }) }) } };
    assert.match(api.thumbnailSelectionText(), /本頁選取 2 \/ 共 3（以下為本頁）/);
    context.window = {};
});
test('deselection clears selection information', () => {
    context.document.querySelectorAll = () => [selectable(positive, false)];
    assert.equal(api.thumbnailSelectionText(), '');
});
test('dismissed bounds notice restores selected thumbnail metrics', () => {
    const slots = {};
    const status = { dataset: {}, querySelector: selector => {
        const name = selector.match(/data-slot="(\w+)"/)?.[1];
        return name ? (slots[name] ||= { textContent: '', title: '', setAttribute(key, value) { this[key] = value; } }) : null;
    } };
    const text = name => slots[name]?.textContent;
    context.document.querySelector = selector => selector.includes('batch-status') ? status : {};
    context.document.querySelectorAll = () => [selectable(negative)];
    const timers = new Map(); let id = 0;
    context.setTimeout = fn => { timers.set(++id, fn); return id; };
    context.clearTimeout = key => timers.delete(key);
    api.showBoundsMessage('thumbnail', '心搏寬度目前篩選不可 < 5');
    // 提示只佔訊息欄，選取資訊仍留在固定欄位。
    assert.equal(text('message'), '心搏寬度目前篩選不可 < 5');
    assert.equal(status.dataset.notice, 'true');
    assert.equal(text('count'), '選取 1 搏');
    api.clearBoundsMessage('thumbnail');
    assert.equal(text('count'), '選取 1 搏'); assert.equal(text('bpm'), 'BPM —');
    assert.equal(text('width'), '寬 4.8 ms'); assert.equal(text('height'), '高 -20.000 mV');
    assert.match(text('message'), /Esc 暫停/);
    assert.equal(status.dataset.notice, 'false');
    assert.equal(timers.size, 0);
    api.showBoundsMessage('thumbnail', 'temporary');
    [...timers.values()][0]();
    assert.match(text('message'), /Esc 暫停/);
    context.document.querySelectorAll = () => [selectable(positive, false)];
    api.clearBoundsMessage('thumbnail');
    // 取消選取時保留欄位，只換成破折號。
    assert.equal(text('count'), '未選取'); assert.equal(text('width'), '寬 —');
    // 缺值說明只放在 title，欄位維持精簡數值，避免多選時被截斷。
    const flat = fixture(positiveD.replace('50,30', '50,50'));
    context.document.querySelectorAll = () => [selectable(positive), selectable(flat)];
    api.clearBoundsMessage('thumbnail');
    assert.equal(text('count'), '多選 2 搏');
    assert.equal(text('width'), '寬 4.8 ms');
    assert.match(slots.width.title, /寬 4.8 ms（1 筆缺值）/);
});
test('selection-only batch clears old selection then accumulates matching beats across pages', () => {
    context.KeyboardEvent = class {};
    context.document.dispatchEvent = () => {};
    const segments = [0, 1, 2].map(absoluteIndex => ({ absoluteIndex }));
    const data = segments.map(() => ({ selected: false }));
    data[1].selected = data[2].selected = true;
    const model = { state: { selectedSegments: [segments[1], segments[2]] },
        ecgEnlargedChart: { information: { posInfo: segments } } };
    const scope = { morphology: model, $apply: fn => fn(), focusRight: () => { model.state.focus = 'right'; },
        selectEcg(segment, index) {
            const selected = model.state.selectedSegments;
            const at = selected.indexOf(segment);
            if (at < 0) selected.push(segment); else selected.splice(at, 1);
            data[index].selected = at < 0;
        } };
    const entries = segments.map((segment, index) => ({ segment, index, data: data[index] }));
    api.selectThumbnailBatch(scope, { entries: entries.slice(0, 2) }, [entries[0]]);
    assert.deepEqual(model.state.selectedSegments, [segments[0]]);
    api.selectThumbnailBatch(scope, { entries: [entries[2]] }, [entries[2]], true);
    assert.deepEqual(model.state.selectedSegments, [segments[0], segments[2]]);
    api.selectThumbnailBatch(scope, { entries: [entries[2]] }, [], true);
    assert.deepEqual(model.state.selectedSegments, [segments[0]]);
});
console.log(`${count} checks passed`);
