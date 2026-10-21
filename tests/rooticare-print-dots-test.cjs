// 選印圓點排列：只排一列，相鄰圓點不重疊，盡量靠近各自的綠線。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare 標註快捷鍵.user.js'), 'utf8');
const match = source.match(/    function layoutPrintDots\(targets, barWidth\) \{[\s\S]*?\n    \}\n/);
assert.ok(match, 'layoutPrintDots not found');
const layoutPrintDots = vm.runInNewContext(`(${match[0].trim()})`);

const BAR = 310;
function check(name, targets) {
    const xs = layoutPrintDots(targets, BAR);
    assert.equal(xs.length, targets.length, `${name}: one position per dot`);
    const gap = Math.max(15, Math.min(18, BAR / targets.length));
    for (let i = 1; i < xs.length; i++) {
        assert.ok(xs[i] - xs[i - 1] >= gap - 0.01, `${name}: dots ${i - 1} and ${i} overlap (${xs[i - 1]}, ${xs[i]})`);
    }
    if (targets.length * gap <= BAR) {
        assert.ok(xs[0] >= gap / 2 - 0.01 && xs.at(-1) <= BAR - gap / 2 + 0.01, `${name}: stays inside the bar`);
    }
    console.log(`PASS: ${name}`);
    return xs;
}

// 單一圓點留在自己的綠線下方。
assert.equal(check('single dot', [100])[0], 100);
// 分散的圓點各自對齊綠線。
assert.deepEqual([...check('spread dots', [20, 100, 200])], [20, 100, 200]);
// 回報的情況：左側一群越加越多，會被左邊界推回，不能疊到後面的圓點。
for (let n = 1; n <= 12; n++) {
    const left = Array.from({ length: n }, (_, i) => 2 + i * 0.5);
    check(`left cluster of ${n} next to later dots`, [...left, 40, 55, 70, 150]);
}
// 右側邊界同理。
for (let n = 1; n <= 12; n++) {
    const right = Array.from({ length: n }, (_, i) => 305 + i * 0.4);
    check(`right cluster of ${n} after earlier dots`, [180, 230, 260, ...right]);
}
// 中間兩群逐漸靠近後合併。
check('two clusters merging', [140, 141, 142, 150, 151, 152, 153]);
// 數量多到超過拉條寬度時仍不重疊。
check('more dots than fit', Array.from({ length: 30 }, (_, i) => i * 3));
