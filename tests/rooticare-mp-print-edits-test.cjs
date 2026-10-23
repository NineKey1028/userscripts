// MP 快速選印：標籤修改（已儲存與 Morphology 未儲存）後，心搏仍找得到時間並歸入正確的 V／S 清單。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare ECG 變動率縮圖標記器.user.js'), 'utf8');
const grab = name => {
    const match = source.match(new RegExp(`    function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}\\n`));
    assert.ok(match, `${name} not found`);
    return match[0];
};
const api = vm.runInNewContext(`${['pairBeats', 'mergeLabelEdits', 'setListBeats', 'findBeat'].map(grab).join('')}
({ pairBeats, mergeLabelEdits, setListBeats, findBeat })`);

const build = (vBeats, sBeats, edits) => {
    const sets = api.mergeLabelEdits({ V: api.pairBeats(vBeats.map(b => b[1]), vBeats.map(b => b[0])),
        S: api.pairBeats(sBeats.map(b => b[1]), sBeats.map(b => b[0])) }, edits);
    const lists = { V: { name: 'V' }, S: { name: 'S' } };
    api.setListBeats(lists.V, sets.V);
    api.setListBeats(lists.S, sets.S);
    return { lists };
};
const plain = value => JSON.parse(JSON.stringify(value));

// 原始 V：[位置, 時間]；S 同理。
const V = [[1000, 10], [3000, 30]];
const S = [[2000, 20], [4000, 40]];
// 已儲存修改：X→V（新增 V）、S→V（S 移到 V）、V→N（移除）、沒有旗標的不套用。
const edits = [[25, 2500, 'V', 'X', 1], [40, 4000, 'V', 'S', 1], [10, 1000, 'N', 'V', 1], [20, 2000, 'V', 'S', 0], [50, 5000, 'A', 'X', 1]];
const ctx = build(V, S, edits);
assert.deepEqual(plain(ctx.lists.V.positions), [2500, 3000, 4000]);
assert.deepEqual(plain(ctx.lists.V.times), [25, 30, 40]);
assert.deepEqual(plain(ctx.lists.S.positions), [2000, 5000]); // A 視為 S

// 改標成 V 的心搏（原本是 X）找得到。
let beat = api.findBeat(ctx, { absoluteIndex: 2500, label: 'V', timestamp: 25 }, 'V');
assert.equal(beat.list.name, 'V');
assert.equal(beat.list.times[beat.index], 25);
// 已儲存 S→V：在 V 清單找到，不會歸到 S。
beat = api.findBeat(ctx, { absoluteIndex: 4000, label: 'V', timestamp: 40 }, 'V');
assert.equal(beat.list.name, 'V');

// Morphology 未儲存改標：原本 S 的 2000 改成 V → 從 S 移到 V。
beat = api.findBeat(ctx, { absoluteIndex: 2000, label: 'S', modifiedLabel: 'V', timestamp: 20 }, 'S');
assert.equal(beat.list.name, 'V');
assert.equal(ctx.lists.S.indexByPos.has(2000), false);
assert.equal(ctx.lists.V.times[beat.index], 20);
// 反方向：V 的 3000 改成 S。
beat = api.findBeat(ctx, { absoluteIndex: 3000, label: 'V', modifiedLabel: 'S', timestamp: 30 }, 'V');
assert.equal(beat.list.name, 'S');
assert.equal(ctx.lists.V.indexByPos.has(3000), false);

// 兩份清單都沒有：第一次不插入（讓呼叫端重新讀取），重新讀取後才以縮圖時間加入。
assert.equal(api.findBeat(ctx, { absoluteIndex: 7000, label: 'V', timestamp: 70 }, 'V'), null);
beat = api.findBeat(ctx, { absoluteIndex: 7000, label: 'V', timestamp: 70 }, 'V', true);
assert.equal(beat.list.name, 'V');
assert.equal(beat.list.times[beat.index], 70);
// 改成 N 的縮圖不選印。
assert.equal(api.findBeat(ctx, { absoluteIndex: 2500, label: 'V', modifiedLabel: 'N', timestamp: 25 }, 'V', true), null);
console.log('PASS: MP print merges saved and unsaved label edits into V/S lists');
