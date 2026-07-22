// ==UserScript==
// @name         Скрытие сообщений (Claude + ChatGPT)
// @namespace    http://tampermonkey.net/
// @version      1.0.7
// @description  Скрывает сообщения ассистента через blur на Claude и ChatGPT
// @author       DundIIR
// @match        https://claude.ai/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/message-hider.user.js
// @downloadURL  https://raw.githubusercontent.com/DundIIR/tampermonkey-scripts/main/message-hider.user.js
// ==/UserScript==

(function() {
  'use strict';

  const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/>
    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>
  </svg>`;

  const EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828"/>
    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87"/>
    <path d="M3 3l18 18"/>
  </svg>`;

  const TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M4 7l16 0"/>
    <path d="M10 11l0 6"/>
    <path d="M14 11l0 6"/>
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>
  </svg>`;

  const RESTORE = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M9 14l-4 -4l4 -4"/>
    <path d="M5 10h11a4 4 0 1 1 0 8h-1"/>
  </svg>`;

  const isClaude = location.hostname === 'claude.ai';
  const isGPT = location.hostname === 'chatgpt.com';

  function addButton(actionBar, content, btnClass) {
    if (actionBar.querySelector('.hide-msg-btn') ||
        actionBar.closest('[data-test-render-count]')?.querySelector('.hide-msg-btn')) return;
    if (!content) return;

    const btn = document.createElement('button');
    btn.className = 'hide-msg-btn ' + btnClass;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Hide message');
    btn.innerHTML = EYE_OPEN;

    let hidden = false;
    btn.onclick = () => {
      hidden = !hidden;
      content.style.filter = hidden ? 'blur(6px)' : '';
      content.style.cursor = hidden ? 'pointer' : '';
      content.style.userSelect = hidden ? 'none' : '';
      btn.innerHTML = hidden ? EYE_OFF : EYE_OPEN;
      btn.setAttribute('aria-label', hidden ? 'Show message' : 'Hide message');
    };

    content.addEventListener('click', () => {
      if (hidden) btn.click();
    });

    actionBar.appendChild(btn);
  }

  function addDeleteButton(actionBar, container, btnClass) {
    if (actionBar.querySelector('.delete-msg-btn') ||
        actionBar.closest('[data-test-render-count]')?.querySelector('.delete-msg-btn')) return;
    if (!container) return;

    const btn = document.createElement('button');
    btn.className = 'delete-msg-btn ' + btnClass;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Delete message');
    btn.innerHTML = TRASH;

    let deleted = false;
    btn.onclick = () => {
      deleted = !deleted;
      container.style.display = deleted ? 'none' : '';
      btn.innerHTML = deleted ? RESTORE : TRASH;
      btn.style.color = deleted ? '#ef4444' : '';
      btn.setAttribute('aria-label', deleted ? 'Restore message' : 'Delete message');
    };

    actionBar.appendChild(btn);
  }

  function addClaudeButtons() {
    document.querySelectorAll('[role="toolbar"][aria-label="Message actions"]').forEach(actionBar => {
      const wrapper = actionBar.closest('[data-test-render-count]');
      if (!wrapper) return;
      const content = wrapper.querySelector('.font-claude-response');
      const innerBar = actionBar.querySelector('.flex.items-stretch') || actionBar;
      const btnClass = 'cds-reset group/btn relative isolate inline-flex shrink-0 items-center justify-center border-0 outline-none rounded h-control aspect-square w-control !text-muted hover:!text-primary';
      addButton(innerBar, content, btnClass);
      addDeleteButton(innerBar, content, btnClass);
    });
  }

  function addGPTButtons() {
    document.querySelectorAll('[aria-label="Действия с ответом"], [aria-label="Copy, talk, and more"]').forEach(actionBar => {
      if (actionBar.querySelector('.hide-msg-btn')) return;
      const agentTurn = actionBar.closest('.agent-turn');
      if (!agentTurn) return;
      const content = agentTurn.querySelector('.markdown');
      if (!content) return;
      const btnClass = 'text-token-text-secondary hover:bg-token-bg-secondary rounded-lg flex items-center justify-center h-8 w-8';
      addButton(actionBar, content, btnClass);
      addDeleteButton(actionBar, content, btnClass);
    });
  }

  function addEyeButtons() {
    if (isClaude) addClaudeButtons();
    if (isGPT) addGPTButtons();
  }

  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => addEyeButtons(), 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  addEyeButtons();
})();
