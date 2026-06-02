// ==UserScript==
// @name         GitLab MR Files Copier
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Копирует список изменённых файлов bpm-ui из GitLab MR
// @author       You
// @match        https://gitlab.silaunion.ru/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/gitlab-mr-copier.user.js
// @downloadURL  https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/gitlab-mr-copier.user.js
// ==/UserScript==

//Тест обновлений

(function() {
    'use strict';

    function getFiles() {
        const el = document.querySelector('.vue-recycle-scroller');
        if (!el) return [];
        const vueKey = Object.keys(el).find(k => k.startsWith('__vue'));
        const vm = el[vueKey];
        if (!vm?.items) return [];
        const seen = new Set();
        const files = [];
        vm.items.forEach(item => {
            if (item.isHeader || !item.key?.startsWith('bpm-ui/')) return;
            if (/\.(svg|png|jpg|jpeg|gif)$/i.test(item.key)) return;
            if (seen.has(item.key)) return;
            seen.add(item.key);
            files.push(`${item.key} +${item.addedLines} -${item.removedLines}`);
        });
        return files;
    }

    function addButton() {
        if (document.getElementById('bpm-copy-btn')) return;
        const listViewBtn = document.querySelector('[data-testid="list-view-toggle"]');
        if (!listViewBtn) return;
        const btn = document.createElement('button');
        btn.id = 'bpm-copy-btn';
        btn.textContent = 'Copy bpm-ui';
        btn.style.cssText = 'margin-left:8px;padding:4px 10px;background:#fc6d26;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        btn.onclick = async () => {
            const files = getFiles();
            if (!files.length) { btn.textContent = 'Не найдено'; return; }
            await navigator.clipboard.writeText(files.join('\n'));
            btn.textContent = `Скопировано ${files.length}!`;
            setTimeout(() => { btn.textContent = 'Copy bpm-ui'; }, 2000);
        };
        listViewBtn.parentElement.appendChild(btn);
    }

    function removeButton() {
        document.getElementById('bpm-copy-btn')?.remove();
    }

    document.addEventListener('click', e => {
        const listBtn = e.target.closest('[data-testid="list-view-toggle"]');
        const treeBtn = e.target.closest('[data-testid="tree-view-toggle"]');
        if (listBtn) setTimeout(addButton, 300);
        if (treeBtn) removeButton();
    });

    function addFileLinkButtons() {
        document.querySelectorAll('[data-testid="diff-file-copy-clipboard"]').forEach(copyBtn => {
            if (copyBtn.parentElement.querySelector('.copy-file-link-btn')) return;
            const fileAnchor = copyBtn.closest('[class*="file-title"]')?.querySelector('a[data-testid="file-title"]');
            if (!fileAnchor) return;
            let clipboardData;
            try { clipboardData = JSON.parse(copyBtn.getAttribute('data-clipboard-text')); } catch { return; }
            const fullPath = clipboardData?.text;
            if (!fullPath) return;
            const fileName = fullPath.split('/').pop();
            const href = fileAnchor.getAttribute('href');
            if (!href) return;
            const btn = document.createElement('button');
            btn.className = 'btn btn-default btn-sm gl-button btn-default-tertiary btn-icon copy-file-link-btn';
            btn.title = 'Copy file link';
            btn.innerHTML = `<svg class="gl-button-icon gl-icon s16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="currentColor" d="M10 0H2a2 2 0 0 0-2 2v10h2V2h8V0Zm3 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 10H6V6h7v8Z"/></svg>`;
            btn.onclick = async (e) => {
                e.stopPropagation();
                const cleanHref = href.split('#')[0];
                const url = cleanHref.startsWith('http') ? cleanHref : `${location.origin}${cleanHref}`;
                await navigator.clipboard.writeText(`[${fileName}](${url})`);
            };
            copyBtn.insertAdjacentElement('afterend', btn);
        });
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('[data-testid="list-view-toggle"].selected')) addButton();
        addFileLinkButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
