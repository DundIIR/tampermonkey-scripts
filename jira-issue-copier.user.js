// ==UserScript==
// @name         Jira Issue Copier
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Копирует номер и название задачи из детальной панели доски Jira
// @author       DundIIR
// @match        https://jira.silaunion.ru/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/jira-issue-copier.user.js
// @downloadURL  https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/jira-issue-copier.user.js
// ==/UserScript==

(function() {
    'use strict';

    const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;pointer-events:none;"><path fill="currentColor" d="M10 0H2a2 2 0 0 0-2 2v10h2V2h8V0Zm3 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 10H6V6h7v8Z"></path></svg>';
    const LINK_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;pointer-events:none;"><path fill="currentColor" d="M6.5 9.5a1 1 0 0 0 1.42 1.42l3-3a2.5 2.5 0 1 0-3.54-3.54l-1 1a1 1 0 1 0 1.42 1.42l1-1a.5.5 0 1 1 .7.7l-3 3a.5.5 0 0 1-.7 0 1 1 0 0 0-1.3-.02Zm3-3a1 1 0 0 0-1.42-1.42l-3 3a2.5 2.5 0 1 0 3.54 3.54l1-1a1 1 0 1 0-1.42-1.42l-1 1a.5.5 0 1 1-.7-.7l3-3a.5.5 0 0 1 .7 0 1 1 0 0 0 1.3.02Z"></path></svg>';

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
    }

    function getIssueData(detailEl) {
        const key = detailEl.dataset.issuekey;
        const summary = detailEl.querySelector('#summary-val')?.textContent.trim();
        if (!key || !summary) return null;
        return `${key} ${summary}`;
    }

    function getIssueUrl(detailEl) {
        const key = detailEl.dataset.issuekey;
        if (!key) return null;
        return `${location.origin}/browse/${key}`;
    }

    function createCopyButton(className, title, icon, getText) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className;
        btn.title = title;
        btn.innerHTML = icon;
        btn.style.cssText = 'margin-right:6px;padding:2px 4px;background:none;border:none;border-radius:4px;cursor:pointer;color:#737278;vertical-align:middle;';
        btn.onmouseenter = () => { btn.style.background = 'rgba(0,0,0,.08)'; };
        btn.onmouseleave = () => { btn.style.background = 'none'; };
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = getText();
            if (!text) {
                btn.innerHTML = '✗';
                btn.style.color = '#dd2b0e';
            } else {
                await copyText(text);
                btn.innerHTML = '✓';
                btn.style.color = '#108548';
            }
            setTimeout(() => { btn.innerHTML = icon; btn.style.color = '#737278'; }, 2000);
        };
        return btn;
    }

    function addButton() {
        const detailEl = document.getElementById('ghx-detail-issue');
        if (!detailEl) return;
        const controls = detailEl.querySelector('.ghx-controls');
        if (!controls || controls.querySelector('.jira-issue-copy-btn')) return;

        const copyBtn = createCopyButton(
            'jira-issue-copy-btn',
            'Скопировать номер и название задачи',
            COPY_ICON,
            () => getIssueData(detailEl)
        );
        const linkBtn = createCopyButton(
            'jira-issue-link-btn',
            'Скопировать ссылку на задачу',
            LINK_ICON,
            () => getIssueUrl(detailEl)
        );
        controls.insertBefore(linkBtn, controls.firstChild);
        controls.insertBefore(copyBtn, controls.firstChild);
    }

    const observer = new MutationObserver(() => addButton());
    observer.observe(document.body, { childList: true, subtree: true });
    addButton();
})();
