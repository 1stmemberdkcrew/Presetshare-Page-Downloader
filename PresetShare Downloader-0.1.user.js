// ==UserScript==
// @name         PresetShare Downloader
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Download presets from PresetShare.com
// @author       You
// @match        https://presetshare.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const DOWNLOAD_FOLDER = 'C:\\Users\\pgorh\\Documents\\Vital';
    let isDownloading = false;
    let shouldCancel = false;
    let downloadButton = null;
    let cancelButton = null;

    // Create floating buttons
    function createButtons() {
        // Create download button
        downloadButton = document.createElement('button');
        downloadButton.innerHTML = 'Download All Free Presets';
        downloadButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            margin-right: 10px;
        `;

        downloadButton.addEventListener('mouseover', () => {
            downloadButton.style.backgroundColor = '#45a049';
        });

        downloadButton.addEventListener('mouseout', () => {
            downloadButton.style.backgroundColor = '#4CAF50';
        });

        downloadButton.addEventListener('click', startDownload);

        // Create cancel button (initially hidden)
        cancelButton = document.createElement('button');
        cancelButton.innerHTML = 'Cancel Downloads';
        cancelButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            padding: 10px 20px;
            background-color: #f44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: none;
        `;

        cancelButton.addEventListener('mouseover', () => {
            cancelButton.style.backgroundColor = '#da190b';
        });

        cancelButton.addEventListener('mouseout', () => {
            cancelButton.style.backgroundColor = '#f44336';
        });

        cancelButton.addEventListener('click', cancelDownloads);

        // Add buttons to document
        document.body.appendChild(downloadButton);
        document.body.appendChild(cancelButton);
    }

    // Show/hide buttons based on download state
    function updateButtonVisibility() {
        if (isDownloading) {
            downloadButton.style.display = 'none';
            cancelButton.style.display = 'block';
        } else {
            downloadButton.style.display = 'block';
            cancelButton.style.display = 'none';
        }
    }

    // Cancel downloads
    function cancelDownloads() {
        shouldCancel = true;
        GM_notification({
            text: 'Cancelling downloads...',
            title: 'PresetShare Downloader',
            timeout: 2000
        });
    }

    // Get all free download buttons
    function getFreeDownloadButtons() {
        return Array.from(document.querySelectorAll('a.download-button:not(.for-subs)'));
    }

    // Download a single preset
    function downloadPreset(button) {
        const presetId = button.getAttribute('data-preset-id');
        const authorName = button.getAttribute('data-author-name');
        const downloadUrl = `https://presetshare.com/download/index?id=${presetId}`;

        return new Promise((resolve, reject) => {
            // Create a temporary link element
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${authorName}_preset_${presetId}.vital`;
            link.style.display = 'none';

            // Add it to the document
            document.body.appendChild(link);

            // Trigger the download
            try {
                link.click();
                // Remove the link after a short delay
                setTimeout(() => {
                    document.body.removeChild(link);
                    resolve();
                }, 1000);
            } catch (error) {
                document.body.removeChild(link);
                console.error(`Download failed for preset ${presetId}:`, error);
                reject(error);
            }
        });
    }

    // Start the download process
    async function startDownload() {
        if (isDownloading) {
            GM_notification({
                text: 'Download already in progress!',
                title: 'PresetShare Downloader',
                timeout: 3000
            });
            return;
        }

        isDownloading = true;
        shouldCancel = false;
        updateButtonVisibility();

        const buttons = getFreeDownloadButtons();

        if (buttons.length === 0) {
            GM_notification({
                text: 'No free presets found on this page!',
                title: 'PresetShare Downloader',
                timeout: 3000
            });
            isDownloading = false;
            updateButtonVisibility();
            return;
        }

        console.log(`Found ${buttons.length} free presets to download`);
        GM_notification({
            text: `Starting download of ${buttons.length} presets...`,
            title: 'PresetShare Downloader',
            timeout: 3000
        });

        let successCount = 0;
        let failCount = 0;
        let failedPresets = [];

        for (const button of buttons) {
            if (shouldCancel) {
                console.log('Downloads cancelled by user');
                break;
            }

            try {
                await downloadPreset(button);
                // Wait 1 second between downloads
                await new Promise(resolve => setTimeout(resolve, 1000));
                successCount++;
            } catch (error) {
                console.error('Download failed:', error);
                failCount++;
                const presetId = button.getAttribute('data-preset-id');
                const authorName = button.getAttribute('data-author-name');
                failedPresets.push(`${authorName} (ID: ${presetId})`);
            }
        }

        // Show detailed notification about failures
        let notificationText = shouldCancel
            ? `Downloads cancelled! Successfully downloaded: ${successCount}, Failed: ${failCount}`
            : `Download complete! Success: ${successCount}, Failed: ${failCount}`;

        if (failedPresets.length > 0) {
            notificationText += `\nFailed presets: ${failedPresets.join(', ')}`;
        }

        GM_notification({
            text: notificationText,
            title: 'PresetShare Downloader',
            timeout: 8000
        });

        isDownloading = false;
        updateButtonVisibility();
    }

    // Initialize the script
    function init() {
        createButtons();
    }

    // Run when the page is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();