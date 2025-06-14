// ==UserScript==
// @name         PresetShare Downloader (Faster Version)
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Fast concurrent download of free presets from PresetShare.com
// @author       You
// @match        https://presetshare.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    const CONCURRENCY_LIMIT = 5;
    let isDownloading = false;
    let shouldCancel = false;
    let downloadButton, cancelButton;

    function createButtons() {
        downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download All Free Presets';
        downloadButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 9999;
        `;
        downloadButton.onclick = startDownload;

        cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel Downloads';
        cancelButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #f44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 9999;
            display: none;
        `;
        cancelButton.onclick = () => {
            shouldCancel = true;
            GM_notification({ text: 'Cancelling downloads...', title: 'PresetShare', timeout: 2000 });
        };

        document.body.appendChild(downloadButton);
        document.body.appendChild(cancelButton);
    }

    function updateButtons() {
        downloadButton.style.display = isDownloading ? 'none' : 'block';
        cancelButton.style.display = isDownloading ? 'block' : 'none';
    }

    function getFreeDownloadButtons() {
        return Array.from(document.querySelectorAll('a.download-button:not(.for-subs)'));
    }

    function downloadPreset(button) {
        const presetId = button.getAttribute('data-preset-id');
        const authorName = button.getAttribute('data-author-name');
        const downloadUrl = `https://presetshare.com/download/index?id=${presetId}`;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: downloadUrl,
                onload: (response) => {
                    let extension = '.vital';
                    const type = response.responseHeaders.match(/content-type: ([^;\r\n]+)/i)?.[1]?.toLowerCase();

                    if (type?.includes('zip')) {
                        extension = '.zip';
                    } else if (type?.includes('octet-stream')) {
                        const disposition = response.responseHeaders.match(/filename="?([^"]+)"?/i);
                        if (disposition) {
                            const ext = disposition[1].split('.').pop().toLowerCase();
                            if (['zip', 'vital', 'fxp', 'fxb'].includes(ext)) extension = `.${ext}`;
                        }
                    }

                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = `${authorName}_preset_${presetId}${extension}`;
                    link.style.display = 'none';
                    document.body.appendChild(link);

                    try {
                        link.click();
                        setTimeout(() => {
                            document.body.removeChild(link);
                            resolve();
                        }, 500);
                    } catch (e) {
                        document.body.removeChild(link);
                        reject(e);
                    }
                },
                onerror: reject,
            });
        });
    }

    async function runConcurrentDownloads(buttons) {
        let successCount = 0;
        let failCount = 0;
        let failedPresets = [];

        let index = 0;

        async function nextBatch() {
            if (shouldCancel || index >= buttons.length) return;

            const batch = buttons.slice(index, index + CONCURRENCY_LIMIT);
            index += CONCURRENCY_LIMIT;

            const results = await Promise.allSettled(batch.map(downloadPreset));

            results.forEach((result, i) => {
                const btn = batch[i];
                const id = btn.getAttribute('data-preset-id');
                const author = btn.getAttribute('data-author-name');

                if (result.status === 'fulfilled') {
                    successCount++;
                } else {
                    failCount++;
                    failedPresets.push(`${author} (ID: ${id})`);
                }
            });

            await nextBatch();
        }

        await nextBatch();

        GM_notification({
            title: 'PresetShare Downloader',
            text: shouldCancel
                ? `Cancelled: ${successCount} success, ${failCount} failed`
                : `Complete! ${successCount} success, ${failCount} failed${failedPresets.length ? `\nFailed: ${failedPresets.join(', ')}` : ''}`,
            timeout: 8000
        });
    }

    async function startDownload() {
        if (isDownloading) return;

        isDownloading = true;
        shouldCancel = false;
        updateButtons();

        const buttons = getFreeDownloadButtons();
        if (buttons.length === 0) {
            GM_notification({ title: 'PresetShare Downloader', text: 'No free presets found!', timeout: 3000 });
            isDownloading = false;
            updateButtons();
            return;
        }

        GM_notification({ title: 'PresetShare Downloader', text: `Downloading ${buttons.length} presets...`, timeout: 3000 });
        await runConcurrentDownloads(buttons);

        isDownloading = false;
        updateButtons();
    }

    function init() {
        createButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
