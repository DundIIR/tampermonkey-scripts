// ==UserScript==
// @name         Message Hider (Claude + ChatGPT)
// @namespace    http://tampermonkey.net/
// @version      1.0.3
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

  const isClaude = location.hostname === 'claude.ai';
  const isGPT = location.hostname === 'chatgpt.com';

  let overlayCounter = 0;

  function createNoiseOverlay() {
    const id = 'spoiler-overlay-' + (++overlayCounter);
    const size = 200;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = (0.3 + Math.random() * 0.4) * 255 | 0;
    }
    ctx.putImageData(imageData, 0, 0);

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'background-image:url(' + canvas.toDataURL() + ')',
      'background-repeat:repeat',
      'background-size:200px 200px',
      'pointer-events:none',
      'border-radius:inherit',
      'z-index:10',
      'opacity:0',
      'transition:opacity 0.3s ease',
    ].join(';');
    return overlay;
  }

  function addButton(actionBar, content, btnClass) {
    if (actionBar.querySelector('.hide-msg-btn') ||
        actionBar.closest('[data-test-render-count]')?.querySelector('.hide-msg-btn')) return;
    if (!content) return;

    const btn = document.createElement('button');
    btn.className = 'hide-msg-btn ' + btnClass;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Hide message');
    btn.innerHTML = EYE_OPEN;

    const overlay = createNoiseOverlay();
    content.style.position = 'relative';
    content.style.transition = 'filter 0.3s ease';
    content.appendChild(overlay);

    let hidden = false;

    function show() {
      hidden = false;
      content.style.filter = '';
      content.style.cursor = '';
      content.style.userSelect = '';
      overlay.style.opacity = '0';
      btn.innerHTML = EYE_OPEN;
      btn.setAttribute('aria-label', 'Hide message');
    }

    function hide() {
      hidden = true;
      content.style.filter = 'blur(4px)';
      content.style.cursor = 'pointer';
      content.style.userSelect = 'none';
      overlay.style.opacity = '1';
      btn.innerHTML = EYE_OFF;
      btn.setAttribute('aria-label', 'Show message');
    }

    btn.onclick = () => hidden ? show() : hide();

    content.addEventListener('click', () => {
      if (hidden) show();
    });

    actionBar.appendChild(btn);
  }

  function addClaudeButtons() {
    document.querySelectorAll('[role="group"][aria-label="Message actions"]').forEach(actionBar => {
      const wrapper = actionBar.closest('[data-test-render-count]');
      if (!wrapper) return;
      const content = wrapper.querySelector('.font-claude-response');
      const innerBar = actionBar.querySelector('.flex.items-stretch') || actionBar;
      addButton(innerBar, content,
        'cds-reset group/btn relative isolate inline-flex shrink-0 items-center justify-center border-0 outline-none rounded h-control aspect-square w-control !text-muted hover:!text-primary'
      );
    });
  }

  function addGPTButtons() {
    document.querySelectorAll('[aria-label="Действия с ответом"], [aria-label="Copy, talk, and more"]').forEach(actionBar => {
      if (actionBar.querySelector('.hide-msg-btn')) return;
      const agentTurn = actionBar.closest('.agent-turn');
      if (!agentTurn) return;
      const content = agentTurn.querySelector('.markdown');
      if (!content) return;
      addButton(actionBar, content,
        'text-token-text-secondary hover:bg-token-bg-secondary rounded-lg flex items-center justify-center h-8 w-8'
      );
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
