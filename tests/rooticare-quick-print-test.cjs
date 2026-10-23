// 快速選印：均分時段、相隔 1 分鐘、排序規則與換一個。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare 標註快捷鍵.user.js'), 'utf8');
const grab = name => {
    const match = source.match(new RegExp(`    function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}\\n`));
    assert.ok(match, `${name} not found`);
    return match[0];
};
const constant = name => {
    const match = source.match(new RegExp(`    const ${name} = [^\\n]*\\n`));
    assert.ok(match, `${name} not found`);
    return match[0];
};
const api = vm.runInNewContext(`${constant('QUICK_MIN_GAP')}${constant('QUICK_RUN_GAP')}${constant('QUICK_EVENT_AFTER')}${constant('QUICK_FEW')}
${['lowerBound', 'makeMinuteHR', 'findEventBeat', 'runFrom', 'patternFrom', 'averageBPM', 'compareQuickScore',
    'pickQuickPrints', 'pickQuickReplacement', 'getEventStat', 'makeRankPlace'].map(grab).join('')}
({ makeMinuteHR, findEventBeat, runFrom, patternFrom, averageBPM, pickQuickPrints, pickQuickReplacement, getEventStat, makeRankPlace, QUICK_FEW })`);
const plain = value => JSON.parse(JSON.stringify(value));
const c = (time, ...score) => ({ time, score });

// 數量規則：超過 300 選 4 張，否則 3 張。
assert.equal(api.QUICK_FEW(299), 3);
assert.equal(api.QUICK_FEW(300), 3);
assert.equal(api.QUICK_FEW(301), 4);

// 紀錄 0～8000 秒、目標 4 張 → 時段 [0,2000) [2000,4000) [4000,6000) [6000,8000)。
const range = { start: 0, end: 8000 };
const candidates = [c(100, 150), c(150, 160), c(2100, 90), c(2500, 95), c(4100, 80), c(7000, 70), c(7030, 200)];
// 每個時段各選分數最高的一張。
assert.deepEqual(plain(api.pickQuickPrints({ candidates, existing: [], target: 4, ...range })), [7030, 150, 2500, 4100]);
// 已選印的佔掉所在時段，只補不足的張數。
assert.deepEqual(plain(api.pickQuickPrints({ candidates, existing: [3000, 6500], target: 4, ...range })), [150, 4100]);
// 已達目標不再選。
assert.deepEqual(plain(api.pickQuickPrints({ candidates, existing: [1, 2001, 4001, 6001], target: 4, ...range })), []);
// 相隔不到 60 秒的不選：7030 與已選的 7000 太近，該時段沒有其他心電圖 → 改從全部依分數補足。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: [c(7030, 200), c(100, 50), c(130, 40)], existing: [7000], target: 2, ...range })), [100]);
// 時段沒有事件時，時段對半細分再選，讓補上的盡量分散：24 段時 500 自成一段，48 段時 200 與 100 分開；仍需相隔 60 秒（140 不選）。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: [c(100, 9), c(140, 8), c(200, 7), c(500, 6)], existing: [], target: 3, ...range })),
    [100, 500, 200]);
// 細分到比 60 秒還短仍不足時，才依分數補足（仍需相隔 60 秒）。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: [c(100, 9), c(170, 8), c(110, 7)], existing: [], target: 3, start: 0, end: 300 })),
    [100, 170]);
// 分數全為 0（找不到早搏）的不佔時段，只在最後補足時使用。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: [c(100, 9), c(5000, 0, 0), c(300, 3)], existing: [], target: 2, ...range })), [100, 300]);
assert.deepEqual(plain(api.pickQuickPrints({ candidates: [c(100, 9), c(5000, 0, 0)], existing: [], target: 2, ...range })), [100, 5000]);
// 分數相同依第二項（如心搏數相同比 BPM），再相同依時間。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: [c(100, 5, 100), c(300, 5, 120), c(600, 4, 200)], existing: [], target: 1, ...range })), [300]);

// 加選一個：時段數取目前張數 + 1，選在空出的中間時段，即使其他時段有分數更高的。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: [c(200, 99), c(4000, 10)], existing: [100, 7900], need: 1, target: 3, ...range })), [4000]);
// Bigeminy／Trigeminy 不分時段：23、19、18 beats 都在同一時段也照排序選，仍相隔 60 秒（22 beats 的 1030 太近）。
const beatsFirst = [c(1000, 23), c(1030, 22), c(1100, 19), c(1200, 18), c(5000, 17), c(7000, 9)];
assert.deepEqual(plain(api.pickQuickPrints({ candidates: beatsFirst, existing: [], target: 3, ...range, spread: false })), [1000, 1100, 1200]);
// 分時段時則每段各選一張（比較用）。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: beatsFirst, existing: [], target: 3, ...range })), [1000, 5000, 7000]);
// 換一個（不分時段）：直接選排序最前、相隔 60 秒以上的（1030 與 1100 相隔 70 秒）。
assert.equal(api.pickQuickReplacement({ candidates: beatsFirst, existing: [1100, 1200], removed: 1000, target: 3, ...range, spread: false }), 1030);
// 網站事件統計：第 5 項為心搏數、第 3 項為平均 HR。
const statAf = { eventTypeStat: { S_trigemini: { 1000: [12, 121, 119, 116, 23], 2000: [1, 0, 0, 0, 0], 3000: [1, 2] } } };
assert.deepEqual(plain(api.getEventStat(statAf, 'S_trigemini', 1000)), { beats: 23, avgHR: 119 });
assert.deepEqual(plain(api.getEventStat(statAf, 'S_trigemini', 2000)), { beats: null, avgHR: null });
assert.equal(api.getEventStat(statAf, 'S_trigemini', 3000), null);
assert.equal(api.getEventStat(statAf, 'trigemini', 1000), null);
// 換一個：優先在同一時段選分數最高的。
assert.equal(api.pickQuickReplacement({ candidates, existing: [2500, 4100, 7030], removed: 150, target: 4, ...range }), 100);
// 同時段沒有可選的時，依均分規則選一張（這裡是未被佔用的 2000～4000 時段）。
assert.equal(api.pickQuickReplacement({ candidates: [c(2100, 1), c(5000, 9)], existing: [4100, 7030], removed: 150, target: 4, ...range }), 2100);
assert.equal(api.pickQuickReplacement({ candidates: [], existing: [], removed: 150, target: 4, ...range }), null);

// 每分鐘平均心率：取該時間所在分鐘。
const hr = api.makeMinuteHR([{ time: 1000, data: 60 }, { time: 1060, data: 90 }, { time: 1120, data: 0 }]);
assert.equal(hr(1000), 60);
assert.equal(hr(1059), 60);
assert.equal(hr(1061), 90);
assert.equal(hr(1130), 0);
assert.equal(hr(999), 0);

// 早搏位置（250 Hz）：連發與固定心搏數。
const sr = 250;
const list = { times: [100, 200, 200, 201, 201, 300, 302, 304, 306, 400],
    positions: [25000, 50000, 50100, 50200, 50300, 75000, 75500, 76000, 76500, 100000] };
assert.equal(api.findEventBeat(list, 200), 1);
assert.equal(api.findEventBeat(list, 199), 1);
assert.equal(api.findEventBeat(list, 150), -1); // 下一顆在 6 秒外
assert.deepEqual(plain(api.runFrom(list, 1, sr)), [50000, 50100, 50200, 50300]);
assert.deepEqual(plain(api.runFrom(list, 1, sr, 2)), [50000, 50100]);
assert.deepEqual(plain(api.runFrom(list, 0, sr)), [25000]);
// 規律間隔（每 500 樣本）的二聯律：4 顆；下一顆間隔差太多就結束。
assert.equal(api.patternFrom(list, 5, sr), 4);
assert.equal(api.patternFrom(list, 9, sr), 1);
// BPM：RR 100 樣本 = 150 bpm，RR 125 = 120 bpm，平均 135。
assert.equal(api.averageBPM([100, 125], sr), 135);
assert.equal(api.averageBPM([], sr), 0);

// 依事件名次分段（與頁碼拉條一致）：事件集中在前段時，依時間分段會把多張擠在一起。
// 40 個事件：前 30 個在 0～3000 秒、後 10 個在 70000～79000 秒；紀錄 0～80000 秒，選 4 張。
const dense = [...Array.from({ length: 30 }, (_, i) => 100 * i), ...Array.from({ length: 10 }, (_, i) => 70000 + 1000 * i)];
const denseScores = dense.map((time, i) => c(time, 100 - i)); // 越早分數越高
const place = api.makeRankPlace(dense);
assert.equal(place.count, 40);
assert.equal(place.position(0), 0);
assert.equal(place.position(70000), 0.75);
// 名次分段：每段 10 個事件，各段選分數最高的 → 0、1000、2000（各差 10 名）、70000。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: denseScores, existing: [], target: 4, start: 0, end: 80000, place })),
    [0, 1000, 2000, 70000]);
// 半段間隔（此處 5 名）：已選第 8 名（800），下一段的第 10～12 名離它太近，改選第 13 名（1300）。
assert.deepEqual(plain(api.pickQuickPrints({ candidates: denseScores.filter(x => x.time !== 800), existing: [800], target: 4,
    start: 0, end: 80000, place })), [1300, 2000, 70000]);
// 換一個也依名次分段：換掉 1000 時優先選同段（第 10～19 名）中分數最高、與其他相隔半段的。
assert.equal(api.pickQuickReplacement({ candidates: denseScores.filter(x => ![0, 1000, 2000, 70000].includes(x.time)),
    existing: [0, 2000, 70000], removed: 1000, target: 4, start: 0, end: 80000, place }), 1100);
console.log('PASS: quick print picking and ranking rules');
