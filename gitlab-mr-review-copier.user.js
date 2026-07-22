// ==UserScript==
// @name         GitLab MR копирование комментариев Review
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Копирует замечания ревью из GitLab MR (все или отдельный thread) в формате для Claude Code
// @author       DundIIR
// @match        https://gitlab.silaunion.ru/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/gitlab-mr-review-copier.user.js
// @downloadURL  https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/gitlab-mr-review-copier.user.js
// ==/UserScript==

(function() {
    'use strict';

    function parseMrUrl() {
        const m = location.pathname.match(/^\/(.+?)\/-\/merge_requests\/(\d+)/);
        if (!m) return null;
        return { project: encodeURIComponent(m[1]), path: m[1], iid: m[2] };
    }

    async function fetchAllDiscussions(project, iid) {
        let page = 1;
        const all = [];
        while (true) {
            const res = await fetch(`/api/v4/projects/${project}/merge_requests/${iid}/discussions?per_page=100&page=${page}`);
            if (!res.ok) throw new Error(`API ${res.status}`);
            all.push(...await res.json());
            const next = res.headers.get('x-next-page');
            if (!next) break;
            page = Number(next);
        }
        return all;
    }

    function formatThread(d, header) {
        const first = d.notes[0];
        const pos = first.position;
        const status = first.resolvable ? (first.resolved ? '[RESOLVED]' : '[UNRESOLVED]') : '';
        const out = [];
        if (pos) {
            const line = pos.new_line != null ? pos.new_line : `old:${pos.old_line}`;
            out.push(`${header} ${status} ${pos.new_path}:${line}`.replace(/\s+/g, ' '));
        } else {
            out.push(`${header} ${status} Общий комментарий`.replace(/\s+/g, ' '));
        }
        d.notes.filter(note => !note.system).forEach((note, i) => {
            const who = i === 0 ? note.author.name : `${note.author.name} (ответ)`;
            out.push(`${who}:`);
            note.body.trim().split('\n').forEach(l => out.push(`> ${l}`));
            out.push('');
        });
        return out;
    }

    function formatDiscussions(discussions, iid, projectPath) {
        const threads = discussions.filter(d => d.notes?.length && !d.notes[0].system);
        const out = [`# Замечания ревью MR !${iid} (${projectPath})`, ''];
        let n = 0;
        threads.forEach(d => {
            n++;
            out.push(...formatThread(d, `## ${n}.`));
        });
        return n ? out.join('\n') : null;
    }

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

    const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;pointer-events:none;"><path fill="currentColor" d="M10 0H2a2 2 0 0 0-2 2v10h2V2h8V0Zm3 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 10H6V6h7v8Z"></path></svg>';

    async function fetchDiscussion(project, iid, discussionId) {
        const res = await fetch(`/api/v4/projects/${project}/merge_requests/${iid}/discussions/${discussionId}`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
    }

    function addThreadButtons() {
        const mr = parseMrUrl();
        if (!mr) return;
        document.querySelectorAll('.discussion[data-discussion-id]').forEach(disc => {
            const headerInfo = disc.querySelector('.discussion-header .note-header-info');
            if (!headerInfo || headerInfo.querySelector('.thread-copy-btn')) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'thread-copy-btn';
            btn.title = 'Copy thread';
            btn.innerHTML = COPY_ICON;
            btn.style.cssText = 'margin-left:6px;padding:2px 4px;background:none;border:none;border-radius:4px;cursor:pointer;color:#737278;vertical-align:middle;';
            btn.onmouseenter = () => { btn.style.background = 'rgba(0,0,0,.08)'; };
            btn.onmouseleave = () => { btn.style.background = 'none'; };
            btn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.innerHTML = '…';
                try {
                    const d = await fetchDiscussion(mr.project, mr.iid, disc.dataset.discussionId);
                    if (!d.notes?.length) throw new Error('empty thread');
                    const text = [`# Замечание ревью MR !${mr.iid} (${mr.path})`, '', ...formatThread(d, '##')].join('\n');
                    await copyText(text);
                    btn.innerHTML = '✓';
                    btn.style.color = '#108548';
                } catch (err) {
                    btn.innerHTML = '✗';
                    btn.style.color = '#dd2b0e';
                    console.error('MR Review Copier (thread):', err);
                }
                setTimeout(() => { btn.innerHTML = COPY_ICON; btn.style.color = '#737278'; }, 2000);
            };
            headerInfo.appendChild(btn);
        });
    }

    function addButton() {
        if (document.getElementById('mr-review-copy-btn')) return;
        const mr = parseMrUrl();
        if (!mr) return;
        const tabs = document.querySelector('.merge-request-tabs');
        if (!tabs) return;
        const btn = document.createElement('button');
        btn.id = 'mr-review-copy-btn';
        btn.textContent = 'Copy review';
        btn.style.cssText = 'margin-left:8px;align-self:center;padding:4px 10px;background:#fc6d26;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        btn.onclick = async () => {
            btn.textContent = 'Загрузка...';
            try {
                const discussions = await fetchAllDiscussions(mr.project, mr.iid);
                const text = formatDiscussions(discussions, mr.iid, mr.path);
                if (!text) { btn.textContent = 'Нет замечаний'; }
                else {
                    await copyText(text);
                    const count = text.match(/^## /gm).length;
                    btn.textContent = `Скопировано ${count}!`;
                }
            } catch (e) {
                btn.textContent = 'Ошибка';
                console.error('MR Review Copier:', e);
            }
            setTimeout(() => { btn.textContent = 'Copy review'; }, 2500);
        };
        tabs.appendChild(btn);
    }

    function getCurrentUsername() {
        const stored = localStorage.getItem('gl-username');
        if (stored) return stored;
        const profileLink = document.querySelector('a[data-testid="user-profile-link"]');
        if (profileLink) {
            const m = profileLink.href.match(/\/([^/]+)$/);
            if (m) return m[1];
        }
        return null;
    }

    function patchMrDashboardButton() {
        const btn = document.querySelector('a[data-testid="merge-requests-shortcut-button"]');
        if (!btn || btn.dataset.mrPatched) return;
        const username = getCurrentUsername();
        if (!username) return;
        btn.dataset.mrPatched = '1';
        btn.href = `/next-ng/bpm/-/merge_requests/?sort=created_date&state=opened&author_username=${username}&first_page_size=20`;
    }

    const observer = new MutationObserver(() => { addButton(); patchMrDashboardButton(); addThreadButtons(); });
    observer.observe(document.body, { childList: true, subtree: true });
    addButton();
    patchMrDashboardButton();
    addThreadButtons();
})();
