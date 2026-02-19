import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { TranscriptSegment, SummaryData } from '@/utils/types';

const PANEL_ANCHOR_SELECTOR = 'ytd-watch-metadata';
const PANEL_FALLBACK_ANCHOR = '#below';

const signInBannerDismissed = storage.defineItem<boolean>(
  'local:signInBannerDismissed',
  { fallback: false }
);

// Module-level state
let panelUi: ShadowRootContentScriptUi<HTMLDivElement> | null = null;
let currentVideoId: string | null = null;
let segments: TranscriptSegment[] = [];
let showTimestamps = false;
let themeObserver: MutationObserver | null = null;
let currentSummary: SummaryData | null = null;

// --- SVG icon helpers ---

function createCloseIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const line1 = document.createElementNS(ns, 'line');
  line1.setAttribute('x1', '18');
  line1.setAttribute('y1', '6');
  line1.setAttribute('x2', '6');
  line1.setAttribute('y2', '18');
  svg.appendChild(line1);
  const line2 = document.createElementNS(ns, 'line');
  line2.setAttribute('x1', '6');
  line2.setAttribute('y1', '6');
  line2.setAttribute('x2', '18');
  line2.setAttribute('y2', '18');
  svg.appendChild(line2);
  return svg;
}

function createCopyIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const rect1 = document.createElementNS(ns, 'rect');
  rect1.setAttribute('x', '9');
  rect1.setAttribute('y', '9');
  rect1.setAttribute('width', '13');
  rect1.setAttribute('height', '13');
  rect1.setAttribute('rx', '2');
  svg.appendChild(rect1);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
  svg.appendChild(path);
  return svg;
}

function createDownloadIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
  svg.appendChild(path);
  const polyline = document.createElementNS(ns, 'polyline');
  polyline.setAttribute('points', '7 10 12 15 17 10');
  svg.appendChild(polyline);
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', '12');
  line.setAttribute('y1', '15');
  line.setAttribute('x2', '12');
  line.setAttribute('y2', '3');
  svg.appendChild(line);
  return svg;
}

function createSparkIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z');
  svg.appendChild(path);
  return svg;
}

function createCheckIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const polyline = document.createElementNS(ns, 'polyline');
  polyline.setAttribute('points', '20 6 9 17 4 12');
  svg.appendChild(polyline);
  return svg;
}

// --- Utility helpers ---

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

function applyPanelTheme(panel: HTMLDivElement): void {
  const isDark = document.documentElement.hasAttribute('dark');
  panel.classList.toggle('tg-dark', isDark);
}

function showToast(message: string, container: ShadowRoot): void {
  const existing = container.querySelector('.tg-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'tg-toast';
  toast.textContent = message;

  const panel = container.querySelector('.tg-panel');
  if (panel) {
    panel.appendChild(toast);
  } else {
    container.appendChild(toast);
  }

  requestAnimationFrame(() => {
    toast.classList.add('tg-toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('tg-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/** Clear all child nodes from a container */
function clearChildren(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/** Render summary bullets as a styled list */
function renderBullets(container: HTMLDivElement, bullets: string): void {
  clearChildren(container);
  const ul = document.createElement('ul');
  ul.className = 'tg-summary-list';
  const lines = bullets.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const li = document.createElement('li');
    li.textContent = line.replace(/^[-*]\s*/, '');
    ul.appendChild(li);
  }
  container.appendChild(ul);
}

/** Render summary paragraph */
function renderParagraph(container: HTMLDivElement, paragraph: string): void {
  clearChildren(container);
  const p = document.createElement('p');
  p.className = 'tg-summary-paragraph';
  p.textContent = paragraph;
  container.appendChild(p);
}

// --- Panel lifecycle ---

export async function showPanel(
  ctx: ContentScriptContext,
  videoId: string
): Promise<void> {
  // If panel exists for same video, just show it (toggle back on)
  if (panelUi && currentVideoId === videoId) {
    (panelUi as any).shadowHost.style.display = '';
    return;
  }

  // If panel exists for different video, destroy and recreate
  if (panelUi) {
    destroyPanel();
  }

  currentVideoId = videoId;
  segments = [];
  showTimestamps = false;
  currentSummary = null;

  // Find anchor element
  let anchor = await waitForElement(PANEL_ANCHOR_SELECTOR);
  if (!anchor) {
    anchor = await waitForElement(PANEL_FALLBACK_ANCHOR);
  }
  if (!anchor) {
    console.warn('[TranscriptGrab] Could not find anchor element for panel injection');
    return;
  }

  panelUi = await createShadowRootUi(ctx, {
    name: 'transcriptgrab-panel',
    position: 'inline',
    anchor,
    append: 'after',
    onMount(uiContainer) {
      const panel = document.createElement('div');
      panel.className = 'tg-panel';
      applyPanelTheme(panel);

      // Theme observer
      themeObserver = new MutationObserver(() => applyPanelTheme(panel));
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['dark'],
      });

      // Track auth state for summary tab and auto-save
      let isSignedIn = false;

      // --- Sign-in banner (built but inserted async) ---
      const bannerPlaceholder = document.createElement('div');
      panel.appendChild(bannerPlaceholder);

      const authReady = (async () => {
        const dismissed = await signInBannerDismissed.getValue();
        try {
          const authResult = await sendMessage('checkAuth', undefined);
          isSignedIn = authResult.isSignedIn;
        } catch {
          // Assume not signed in if check fails
        }

        if (!dismissed && !isSignedIn) {
          const banner = document.createElement('div');
          banner.className = 'tg-panel-banner';

          const text = document.createElement('span');
          text.textContent = 'Save transcripts to your history \u2014 ';
          banner.appendChild(text);

          const link = document.createElement('a');
          link.textContent = 'Sign in';
          link.href = '#';
          link.className = 'tg-banner-link';
          const signInUrl = import.meta.env.DEV ? DEV_URL : PROD_URL;
          link.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(signInUrl, '_blank');
          });
          banner.appendChild(link);

          const dismissBtn = document.createElement('button');
          dismissBtn.className = 'tg-banner-dismiss';
          dismissBtn.textContent = '\u00d7';
          dismissBtn.addEventListener('click', async () => {
            await signInBannerDismissed.setValue(true);
            banner.classList.add('tg-banner-hiding');
            setTimeout(() => banner.remove(), 300);
          });
          banner.appendChild(dismissBtn);

          bannerPlaceholder.replaceWith(banner);
        } else {
          bannerPlaceholder.remove();
        }
      })();

      // --- Header ---
      const header = document.createElement('div');
      header.className = 'tg-panel-header';

      const titleRow = document.createElement('div');
      titleRow.className = 'tg-panel-title-row';

      const videoInfo = document.createElement('div');
      videoInfo.className = 'tg-panel-video-info';

      const videoTitle = document.createElement('div');
      videoTitle.className = 'tg-panel-video-title';
      videoTitle.textContent = 'Loading...';
      videoInfo.appendChild(videoTitle);

      const channelName = document.createElement('div');
      channelName.className = 'tg-panel-channel-name';
      channelName.textContent = '';
      videoInfo.appendChild(channelName);

      titleRow.appendChild(videoInfo);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tg-panel-close';
      closeBtn.appendChild(createCloseIcon());
      closeBtn.addEventListener('click', () => hidePanel());
      titleRow.appendChild(closeBtn);

      header.appendChild(titleRow);
      panel.appendChild(header);

      // --- Tab bar ---
      const tabBar = document.createElement('div');
      tabBar.className = 'tg-tab-bar';

      const transcriptTab = document.createElement('button');
      transcriptTab.className = 'tg-tab tg-tab-active';
      transcriptTab.textContent = 'Transcript';

      const summaryTab = document.createElement('button');
      summaryTab.className = 'tg-tab';
      summaryTab.textContent = 'Summary';

      tabBar.appendChild(transcriptTab);
      tabBar.appendChild(summaryTab);
      panel.appendChild(tabBar);

      // --- Transcript tab content ---
      const transcriptTabContent = document.createElement('div');
      transcriptTabContent.className = 'tg-tab-content';
      transcriptTabContent.id = 'tg-tab-transcript';

      // Actions row (hidden during loading, transcript-only)
      const actions = document.createElement('div');
      actions.className = 'tg-panel-actions';
      actions.style.display = 'none';

      const timestampLabel = document.createElement('label');
      timestampLabel.className = 'tg-timestamp-toggle';
      const timestampCheckbox = document.createElement('input');
      timestampCheckbox.type = 'checkbox';
      timestampCheckbox.checked = false;
      const timestampText = document.createElement('span');
      timestampText.textContent = 'Timestamps';
      timestampLabel.appendChild(timestampCheckbox);
      timestampLabel.appendChild(timestampText);

      timestampCheckbox.addEventListener('change', () => {
        showTimestamps = timestampCheckbox.checked;
        const segmentsEl = transcriptTabContent.querySelector('.tg-panel-segments');
        if (segmentsEl) {
          segmentsEl.classList.toggle('tg-timestamp-visible', showTimestamps);
        }
      });

      actions.appendChild(timestampLabel);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'tg-panel-btn tg-copy-btn';
      copyBtn.appendChild(createCopyIcon());
      const copyLabel = document.createElement('span');
      copyLabel.textContent = 'Copy';
      copyBtn.appendChild(copyLabel);
      copyBtn.addEventListener('click', async () => {
        const text = formatTranscriptText(segments, showTimestamps);
        try {
          await navigator.clipboard.writeText(text);
          showToast('Copied to clipboard', uiContainer.shadowRoot!);
        } catch {
          showToast('Failed to copy', uiContainer.shadowRoot!);
        }
      });
      actions.appendChild(copyBtn);

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'tg-panel-btn tg-download-btn';
      downloadBtn.appendChild(createDownloadIcon());
      const downloadLabel = document.createElement('span');
      downloadLabel.textContent = 'Download';
      downloadBtn.appendChild(downloadLabel);
      downloadBtn.addEventListener('click', () => {
        const text = formatTranscriptText(segments, showTimestamps);
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFilename(videoTitle.textContent || 'transcript')}-transcript.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
      actions.appendChild(downloadBtn);

      transcriptTabContent.appendChild(actions);

      // Transcript body (loading, error, segments)
      const transcriptBody = document.createElement('div');
      transcriptBody.className = 'tg-panel-body';

      const loading = document.createElement('div');
      loading.className = 'tg-panel-loading';
      const spinner = document.createElement('div');
      spinner.className = 'tg-spinner';
      loading.appendChild(spinner);
      const loadingText = document.createElement('span');
      loadingText.textContent = 'Loading transcript...';
      loading.appendChild(loadingText);

      const error = document.createElement('div');
      error.className = 'tg-panel-error';
      error.style.display = 'none';

      const segmentsContainer = document.createElement('div');
      segmentsContainer.className = 'tg-panel-segments';
      segmentsContainer.style.display = 'none';

      transcriptBody.appendChild(loading);
      transcriptBody.appendChild(error);
      transcriptBody.appendChild(segmentsContainer);
      transcriptTabContent.appendChild(transcriptBody);
      panel.appendChild(transcriptTabContent);

      // --- Summary tab content ---
      const summaryTabContent = document.createElement('div');
      summaryTabContent.className = 'tg-tab-content';
      summaryTabContent.id = 'tg-tab-summary';
      summaryTabContent.style.display = 'none';

      // Summary content area (filled dynamically)
      const summaryBody = document.createElement('div');
      summaryBody.className = 'tg-panel-body';
      summaryTabContent.appendChild(summaryBody);
      panel.appendChild(summaryTabContent);

      // Track active format for summary
      let activeFormat: 'bullets' | 'paragraph' = 'bullets';

      /** Show the summary empty/CTA state */
      function showSummaryEmpty(): void {
        clearChildren(summaryBody);
        const empty = document.createElement('div');
        empty.className = 'tg-summary-empty';

        const icon = createSparkIcon();
        icon.classList.add('tg-summary-icon');
        empty.appendChild(icon);

        const heading = document.createElement('div');
        heading.className = 'tg-summary-heading';
        heading.textContent = 'Get a summary of this video';
        empty.appendChild(heading);

        const subtitle = document.createElement('div');
        subtitle.className = 'tg-summary-subtitle';
        subtitle.textContent = 'AI-generated key takeaways';
        empty.appendChild(subtitle);

        if (isSignedIn) {
          const btn = document.createElement('button');
          btn.className = 'tg-summarize-btn';
          btn.textContent = 'Summarize';
          btn.addEventListener('click', () => handleSummarize());
          empty.appendChild(btn);
        } else {
          const signInLink = document.createElement('a');
          signInLink.className = 'tg-summary-signin';
          signInLink.href = '#';
          signInLink.textContent = 'Sign in to summarize';
          const signInUrl = import.meta.env.DEV ? DEV_URL : PROD_URL;
          signInLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(signInUrl, '_blank');
          });
          empty.appendChild(signInLink);
        }

        summaryBody.appendChild(empty);
      }

      /** Show summary loading state */
      function showSummaryLoading(): void {
        clearChildren(summaryBody);
        const loadingEl = document.createElement('div');
        loadingEl.className = 'tg-panel-loading';
        const spinnerEl = document.createElement('div');
        spinnerEl.className = 'tg-spinner';
        loadingEl.appendChild(spinnerEl);
        const textEl = document.createElement('span');
        textEl.textContent = 'Generating summary...';
        loadingEl.appendChild(textEl);
        summaryBody.appendChild(loadingEl);
      }

      /** Show summary display with format toggle and copy */
      function showSummaryDisplay(data: SummaryData): void {
        clearChildren(summaryBody);

        // Actions row: format toggle + copy
        const summaryActions = document.createElement('div');
        summaryActions.className = 'tg-summary-actions';

        // Format toggle (segmented control)
        const formatToggle = document.createElement('div');
        formatToggle.className = 'tg-format-toggle';

        const bulletsOption = document.createElement('button');
        bulletsOption.className = 'tg-format-option tg-format-active';
        bulletsOption.textContent = 'Bullets';

        const paragraphOption = document.createElement('button');
        paragraphOption.className = 'tg-format-option';
        paragraphOption.textContent = 'Paragraph';

        formatToggle.appendChild(bulletsOption);
        formatToggle.appendChild(paragraphOption);
        summaryActions.appendChild(formatToggle);

        // Copy button for summary
        const summaryCopyBtn = document.createElement('button');
        summaryCopyBtn.className = 'tg-panel-btn tg-copy-btn';
        summaryCopyBtn.appendChild(createCopyIcon());
        const summaryCopyLabel = document.createElement('span');
        summaryCopyLabel.textContent = 'Copy';
        summaryCopyBtn.appendChild(summaryCopyLabel);
        summaryActions.appendChild(summaryCopyBtn);

        summaryBody.appendChild(summaryActions);

        // Content area
        const contentArea = document.createElement('div');
        contentArea.className = 'tg-summary-content';
        summaryBody.appendChild(contentArea);

        // Render initial format
        activeFormat = 'bullets';
        renderBullets(contentArea, data.bullets);

        // Format toggle handlers
        bulletsOption.addEventListener('click', () => {
          if (activeFormat === 'bullets') return;
          activeFormat = 'bullets';
          bulletsOption.classList.add('tg-format-active');
          paragraphOption.classList.remove('tg-format-active');
          renderBullets(contentArea, data.bullets);
        });

        paragraphOption.addEventListener('click', () => {
          if (activeFormat === 'paragraph') return;
          activeFormat = 'paragraph';
          paragraphOption.classList.add('tg-format-active');
          bulletsOption.classList.remove('tg-format-active');
          renderParagraph(contentArea, data.paragraph);
        });

        // Copy handler
        summaryCopyBtn.addEventListener('click', async () => {
          const text = activeFormat === 'bullets' ? data.bullets : data.paragraph;
          try {
            await navigator.clipboard.writeText(text);
            showToast('Copied to clipboard', uiContainer.shadowRoot!);
          } catch {
            showToast('Failed to copy', uiContainer.shadowRoot!);
          }
        });
      }

      /** Handle summarize button click */
      async function handleSummarize(): Promise<void> {
        if (!currentVideoId || segments.length === 0) {
          showToast('Load the transcript first', uiContainer.shadowRoot!);
          return;
        }

        // If we already have a cached summary, show it
        if (currentSummary) {
          showSummaryDisplay(currentSummary);
          return;
        }

        showSummaryLoading();

        const transcriptText = formatTranscriptText(segments, false);
        const response = await sendMessage('summarize', {
          videoId: currentVideoId,
          transcriptText,
        });

        if (response.success && response.data) {
          currentSummary = response.data;
          showSummaryDisplay(response.data);
        } else {
          // Error: show toast and revert to CTA state
          showToast(response.error ?? 'Failed to generate summary', uiContainer.shadowRoot!);
          showSummaryEmpty();
        }
      }

      // --- Tab switching ---
      function switchTab(tab: 'transcript' | 'summary'): void {
        if (tab === 'transcript') {
          transcriptTab.classList.add('tg-tab-active');
          summaryTab.classList.remove('tg-tab-active');
          transcriptTabContent.style.display = '';
          summaryTabContent.style.display = 'none';
        } else {
          summaryTab.classList.add('tg-tab-active');
          transcriptTab.classList.remove('tg-tab-active');
          summaryTabContent.style.display = '';
          transcriptTabContent.style.display = 'none';

          // Populate summary tab if needed
          if (currentSummary) {
            showSummaryDisplay(currentSummary);
          } else if (summaryBody.children.length === 0) {
            showSummaryEmpty();
          }
        }
      }

      transcriptTab.addEventListener('click', () => switchTab('transcript'));
      summaryTab.addEventListener('click', () => switchTab('summary'));

      uiContainer.appendChild(panel);

      // --- Fetch transcript ---
      (async () => {
        // Wait for auth check to complete before deciding auto-save
        await authReady;

        try {
          const response = await sendMessage('getTranscript', { videoId });

          // Hide loading
          loading.style.display = 'none';

          if (response.success && response.transcript) {
            segments = response.transcript.segments;

            // Set metadata
            videoTitle.textContent =
              response.metadata?.title || 'Unknown video';
            channelName.textContent = response.metadata?.author || '';

            // Show transcript actions
            actions.style.display = '';

            // Render segments
            segmentsContainer.style.display = '';
            for (const seg of segments) {
              const segEl = document.createElement('div');
              segEl.className = 'tg-segment';

              const ts = document.createElement('span');
              ts.className = 'tg-segment-timestamp';
              ts.textContent = `[${formatTimestamp(seg.start)}]`;
              segEl.appendChild(ts);

              const txt = document.createElement('span');
              txt.className = 'tg-segment-text';
              txt.textContent = decodeHtmlEntities(seg.text);
              segEl.appendChild(txt);

              segmentsContainer.appendChild(segEl);
            }

            // Auto-save for signed-in users (non-blocking from content script side too)
            if (isSignedIn && response.transcript) {
              sendMessage('autoSave', {
                videoId,
                transcript: response.transcript,
                metadata: response.metadata,
              }).then((result) => {
                if (result.saved) {
                  // Show saved indicator in header
                  const indicator = document.createElement('div');
                  indicator.className = 'tg-saved-indicator';
                  indicator.appendChild(createCheckIcon());
                  const savedText = document.createElement('span');
                  savedText.textContent = 'Saved';
                  indicator.appendChild(savedText);
                  titleRow.appendChild(indicator);
                }
              }).catch(() => {});
            }
          } else {
            error.textContent = response.error || 'Failed to load transcript';
            error.style.display = '';
          }
        } catch (err) {
          loading.style.display = 'none';
          error.textContent = 'Failed to load transcript';
          error.style.display = '';
          console.error('[TranscriptGrab] Panel fetch error:', err);
        }
      })();

      return panel;
    },
    onRemove() {
      if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
      }
      panelUi = null;
      currentVideoId = null;
      segments = [];
      currentSummary = null;
    },
  });

  panelUi.mount();
}

/** Hide panel visually without destroying it (preserves cached transcript) */
export function hidePanel(): void {
  if (panelUi) {
    (panelUi as any).shadowHost.style.display = 'none';
  }
}

/** Fully destroy the panel and clean up (for SPA navigation) */
export function destroyPanel(): void {
  if (panelUi) {
    try {
      panelUi.remove();
    } catch {
      // UI already detached
    }
    panelUi = null;
    currentVideoId = null;
    segments = [];
    currentSummary = null;
  }
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
}

export function isPanelVisible(): boolean {
  if (!panelUi) return false;
  return (panelUi as any).shadowHost.style.display !== 'none';
}
