// 快速選印的標籤驗證：套用未儲存的標籤修改後，事件是否仍符合清單類型。
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
const { effectiveEventBeats, checkEventPattern } = vm.runInNewContext(
    `${constant('QUICK_RUN_MIN')}${grab('effectiveEventBeats')}${grab('checkEventPattern')}({ effectiveEventBeats, checkEventPattern })`);

// 250 Hz、事件時間 1000，資料從 996 秒（索引 0）開始。
const sr = 250;
const at = second => Math.round((second - 996) * sr);
const data = labels => ({ sampleRate: sr, fromIndex: 0, fromTimestamp: 996, ecg: new Array(10 * sr).fill(0),
    anno: Object.fromEntries(labels.map(([second, type]) => [at(second), type])) });
const beatsOf = (labels, modified = []) => effectiveEventBeats(data(labels), modified, 1000);
const config = (kind, extra = {}) => ({ kind, beat: 'V', name: 'Test', ...extra });
const isolated = config('isolated');
const couplet = config('average', { beats: 2 });
const triplet = config('average', { beats: 3 });
const run = config('run');
const bigeminy = config('pattern', { every: 2 });
const trigeminy = config('pattern', { every: 3 });

// 基本：A 視為 S、非心搏標籤略過、offset 為相對事件時間。
const plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(beatsOf([[999, 'N'], [1000, 'A'], [1001, '|']])), [{ offset: -1, type: 'N' }, { offset: 0, type: 'S' }]);

// Couplet：N V V N 符合；改成 V V V（未儲存修改）後變成 Triplet，不再符合 Couplet。
const coupletLabels = [[998, 'N'], [999, 'N'], [1000, 'V'], [1000.4, 'V'], [1001.2, 'N'], [1002, 'N']];
assert.equal(checkEventPattern(beatsOf(coupletLabels), couplet).ok, true);
const toV = [[0, at(1001.2), 'V', 'N', 1]];
assert.equal(checkEventPattern(beatsOf(coupletLabels, toV), couplet).ok, false);
assert.equal(checkEventPattern(beatsOf(coupletLabels, toV), triplet).ok, true);
assert.match(checkEventPattern(beatsOf(coupletLabels, toV), couplet).reason, /目前 3 顆連續 V/);
// 把其中一顆 V 改成 N：剩單顆，Couplet 不符合、Isolated 符合。
const oneToN = [[0, at(1000.4), 'N', 'V', 1]];
assert.equal(checkEventPattern(beatsOf(coupletLabels, oneToN), couplet).ok, false);
assert.equal(checkEventPattern(beatsOf(coupletLabels, oneToN), isolated).ok, true);
// 刪除標籤（新標籤空白）與沒有旗標的修改：只套用有旗標的。
assert.equal(checkEventPattern(beatsOf(coupletLabels, [[0, at(1000), '', 'V', 1], [0, at(1000.4), '', 'V', 1]]), couplet).ok, false);
assert.equal(checkEventPattern(beatsOf(coupletLabels, [[0, at(1000.4), 'N', 'V', 0]]), couplet).ok, true);
// 事件時間附近沒有早搏。
assert.match(checkEventPattern(beatsOf([[999, 'N'], [1000, 'N'], [1004, 'V']]), isolated).reason, /附近沒有 V/);

// VT／run：至少 4 顆連續。
const four = [[999, 'N'], [1000, 'V'], [1000.3, 'V'], [1000.6, 'V'], [1000.9, 'V'], [1002, 'N']];
assert.equal(checkEventPattern(beatsOf(four), run).ok, true);
assert.equal(checkEventPattern(beatsOf(four, [[0, at(1000.9), 'N', 'V', 1]]), run).ok, false);

// Bigeminy：V N V N V；Trigeminy：V N N V N N V。
const big = [[999.2, 'N'], [1000, 'V'], [1000.8, 'N'], [1001.6, 'V'], [1002.4, 'N'], [1003.2, 'V'], [1004, 'N']];
assert.equal(checkEventPattern(beatsOf(big), bigeminy).ok, true);
assert.equal(checkEventPattern(beatsOf(big), trigeminy).ok, false);
const tri = [[999.2, 'N'], [1000, 'V'], [1000.8, 'N'], [1001.6, 'N'], [1002.4, 'V'], [1003.2, 'N'], [1004, 'N'], [1004.8, 'V']];
assert.equal(checkEventPattern(beatsOf(tri), trigeminy).ok, true);
assert.equal(checkEventPattern(beatsOf(tri), bigeminy).ok, false);
// 二聯律中間的 V 改成 N：事件 V 與下一顆 V 隔 3 顆，前面也沒有 V → 不符合。
assert.equal(checkEventPattern(beatsOf(big, [[0, at(1001.6), 'N', 'V', 1]]), bigeminy).ok, false);
// S 類型清單只看 S（A 也算）。
const sCouplet = { kind: 'average', beat: 'S', beats: 2, name: 'S' };
assert.equal(checkEventPattern(beatsOf([[999, 'N'], [1000, 'A'], [1000.5, 'S'], [1001.3, 'N']]), sCouplet).ok, true);
console.log('PASS: quick print label validation with unsaved edits');
