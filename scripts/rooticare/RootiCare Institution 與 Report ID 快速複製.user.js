// ==UserScript==
// @name         RootiCare Institution 與 Report ID 快速複製
// @namespace    https://dashboard.rooticare.com/
// @version      1.1
// @description  在 Todo 詳細資料彈窗加入按鈕，複製 Institution / Report ID。
// @author       Alex
// @match        https://dashboard.rooticare.com/todo.page*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';
    const buttonClass = 'rooticare-copy-report-button';
    const normalize = text => (text || '').replace(/\s+/g, ' ').trim();

    function getField(modal, name) {
        const label = [...modal.querySelectorAll('.row label')]
            .find(item => normalize(item.textContent) === name);
        const value = label?.parentElement.nextElementSibling?.querySelector('.form-control.readonly');
        return normalize(value?.textContent);
    }

    function getCopyText(modal) {
        const institution = getField(modal, 'Institution');
        const reportId = getField(modal, 'Report ID');
        return institution && reportId ? `${institution} / ${reportId}` : '';
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const focused = document.activeElement;
            const input = document.createElement('textarea');
            input.value = text;
            input.setAttribute('readonly', '');
            input.style.cssText = 'position:fixed;left:-9999px;top:0';
            // Keep the fallback inside the modal so focus trapping permits selection.
            const modal = focused?.closest('.modal') || document.body;
            modal.appendChild(input);
            input.select();
            const copied = document.execCommand('copy');
            input.remove();
            focused?.focus?.({ preventScroll: true });
            if (!copied) throw new Error('Copy failed');
        }
    }

    function refresh() {
        for (const modal of document.querySelectorAll('.modal')) {
            const reportLabel = [...modal.querySelectorAll('.row label')]
                .find(item => normalize(item.textContent) === 'Report ID');
            const host = reportLabel?.parentElement.nextElementSibling;
            if (!host) continue;
            const text = getCopyText(modal);
            let button = modal.querySelector(`.${buttonClass}`);
            if (!text) {
                button?.remove();
                continue;
            }
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = buttonClass;
                button.textContent = '⧉';
                button.setAttribute('aria-label', '複製 Institution / Report ID');
                button.style.cssText = 'position:absolute;right:-13px;top:50%;transform:translateY(-50%);width:24px;height:24px;padding:0;border:1px solid #c8ced8;border-radius:4px;background:#fff;color:#536273;font:20px/1 Arial,sans-serif;cursor:pointer;z-index:1';
                button.addEventListener('click', async event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const currentText = getCopyText(modal);
                    if (!currentText || button.disabled) return;
                    button.disabled = true;
                    try {
                        await copyText(currentText);
                        button.textContent = '✓';
                    } catch {
                        button.textContent = '!';
                    } finally {
                        setTimeout(() => {
                            button.disabled = false;
                            button.textContent = '⧉';
                        }, 1200);
                    }
                });
                if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
                host.appendChild(button);
            }
            const title = `複製 Institution / Report ID：${text}`;
            if (button.title !== title) button.title = title;
        }
    }

    let scheduled = false;
    new MutationObserver(records => {
        const relevant = records.some(record => {
            const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (element?.closest(`.${buttonClass}`)) return false;
            if (record.type === 'childList' && [...record.addedNodes, ...record.removedNodes]
                .every(node => node.nodeType === 1 && node.classList.contains(buttonClass))) return false;
            return true;
        });
        if (!relevant || scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            refresh();
        });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    refresh();
})();
