// ==UserScript==
// @name         YouTube Shorts Blocker
// @namespace    https://www.youtube.com/
// @version      1.0.1
// @description  隱藏 YouTube 一般頁面上的 Shorts 入口與影片區塊，直接開啟 Shorts 網址仍可觀看。
// @author       NineKey1028
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/youtube
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/youtube/YouTube-Shorts-Blocker.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/youtube/YouTube-Shorts-Blocker.user.js
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(() => {
  'use strict';

  const HIDE_STYLE = 'yt-shorts-blocker-style';
  const HIDDEN_ATTR = 'data-yt-shorts-blocked';

  // CSS immediately hides navigation links and Shorts shelf/renderer elements.
  const css = `
    ytd-guide-entry-renderer:has(a[href^="/shorts"]),
    ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),
    ytd-reel-shelf-renderer,
    ytd-reel-item-renderer,
    ytd-shorts,
    ytd-rich-item-renderer[${HIDDEN_ATTR}],
    ytd-video-renderer[${HIDDEN_ATTR}],
    ytd-compact-video-renderer[${HIDDEN_ATTR}],
    ytd-grid-video-renderer[${HIDDEN_ATTR}],
    ytd-playlist-video-renderer[${HIDDEN_ATTR}],
    ytd-rich-section-renderer[${HIDDEN_ATTR}] { display: none !important; }
  `;

  function installStyle() {
    if (!document.documentElement || document.getElementById(HIDE_STYLE)) return;
    const style = document.createElement('style');
    style.id = HIDE_STYLE;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function hideShortsContainer(anchor) {
    let node = anchor;
    // Find the card-level renderer, avoiding hiding a broad page container.
    for (let i = 0; node && i < 8; i++, node = node.parentElement) {
      const tag = node.tagName?.toLowerCase();
      if (tag === 'ytd-rich-item-renderer' || tag === 'ytd-video-renderer' ||
          tag === 'ytd-compact-video-renderer' || tag === 'ytd-grid-video-renderer' ||
          tag === 'ytd-playlist-video-renderer' || tag === 'ytd-reel-item-renderer') {
        node.setAttribute(HIDDEN_ATTR, '');
        return;
      }
    }
    // For shelf titles/links, hide the shelf itself.
    node = anchor.closest('ytd-reel-shelf-renderer, ytd-rich-section-renderer');
    if (node) node.setAttribute(HIDDEN_ATTR, '');
  }

  function scan(root = document) {
    installStyle();
    if (location.hostname !== 'www.youtube.com') return;

    const anchors = root.querySelectorAll?.('a[href^="/shorts/"]') || [];
    for (const anchor of anchors) hideShortsContainer(anchor);

    // Shorts links may be wrapped in a reel renderer or use absolute URLs.
    const links = root.querySelectorAll?.('a[href*="youtube.com/shorts/"]') || [];
    for (const anchor of links) hideShortsContainer(anchor);

    root.querySelectorAll?.('ytd-reel-shelf-renderer, ytd-reel-item-renderer, ytd-shorts')
      .forEach(node => node.setAttribute(HIDDEN_ATTR, ''));
  }

  // Observe YouTube's continuously replaced SPA content.
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
    }
  });

  function start() {
    installStyle();
    scan();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('yt-navigate-finish', () => scan());
    window.addEventListener('popstate', () => scan());
  }

  if (document.documentElement) start();
  else new MutationObserver((_, obs) => {
    if (document.documentElement) { obs.disconnect(); start(); }
  }).observe(document, { childList: true, subtree: true });
})();
