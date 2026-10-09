const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/rooticare/RootiCare Report 檢查器.user.js'), 'utf8');
const config = source.slice(source.indexOf('    const CONFIG ='), source.indexOf('    let indicator;'));
const fn = source.slice(source.indexOf('    function getLowVTHeartRateFindings('), source.indexOf('    function getMissingSpecificsFindings('));
const scan = vm.runInNewContext(`${config}\n${fn}\ngetLowVTHeartRateFindings`);
// Minimized from the live EU report: first-page VT cards and later vtData pages.
const prefix = '[ng-repeat="pageData in af.printPartitionData.vtData track by $index"]';
const cards = [
    ['[ng-repeat="arrData in af.printDialog.longestVTTms track by $index"]', '53 - 109bpm'],
    ['[ng-repeat="arrData in af.printDialog.fastestAvgVTTms track by $index"]', '76 - 185bpm'],
    ['[ng-repeat="arrData in af.printDialog.firstVT track by $index"]', '92 - 127bpm'],
    [`${prefix} [ng-repeat="arrData in pageData track by $index"]`, '52 - 70bpm']
].map(([selector, range]) => ({ selector, range, ecg: {}, hidden: false,
    querySelector(s) {
        if (s === '.event-ecg-blk') return this.ecg;
        return { classList: { contains: () => this.hidden }, querySelectorAll: () => [
            { textContent: '4Battiti / 4sec' }, { textContent: this.range }, { textContent: '60bpm' }
        ] };
    }
}));
const report = { querySelectorAll: selector => cards.filter(card => selector.split(', ').includes(card.selector)) };
assert.equal(scan(report).length, 1, 'Later VT page with HR 52–70 bpm must be detected');
assert.equal(scan(report)[0].ecg, cards[3].ecg);
cards[3].range = '52 - 100bpm';
assert.equal(scan(report).length, 0, '100 bpm boundary must not warn');
cards[3].range = '52 - 70bpm';
cards[3].hidden = true;
assert.equal(scan(report).length, 0, 'Hidden statistics must not warn');
console.log('PASS: later VT page, first-page exclusions, 100 bpm boundary, hidden statistics');
