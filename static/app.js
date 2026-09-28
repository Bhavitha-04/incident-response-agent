/**
 * Incident Response Agent — Modern SRE & DevOps UI
 * Pure Vanilla JavaScript (No Frameworks, No Libraries, No Build Step)
 * 
 * Works out-of-the-box when served via FastAPI's StaticFiles at http://127.0.0.1:8000/
 * Communicates with FastAPI endpoint: POST /analyze
 */

(function () {
  'use strict';

  // ===========================================================================
  // 1. Configuration & Constants
  // ===========================================================================
  const STORAGE_KEY = 'incident_response_history_v1';
  const MAX_HISTORY = 5;

  // Resolves the API endpoint whether served via FastAPI, reverse proxy, or file://
  const API_ENDPOINT = (window.location.protocol === 'file:')
    ? 'http://127.0.0.1:8000/analyze'
    : '/analyze';

  const HEALTH_ENDPOINT = (window.location.protocol === 'file:')
    ? 'http://127.0.0.1:8000/health'
    : '/health';

  // Preset incident scenarios for quick SRE testing
  const QUICK_EXAMPLES = {
    redis: 'Alert: P99 latency on redis-cache-cluster-02 exceeded 450ms (threshold: 50ms) for > 3 minutes. Multiple services reporting connection timeouts and degradation in user session verification.',
    config: "Deployment failure on checkout-service v2.14.0. Pod crashlooping with error: 'FATAL: required environment variable PAYMENT_GATEWAY_SECRET_KEY is not set or empty'. Canary deploy halted.",
    database: "Alert: Postgres primary db-prod-aurora-01 connection pool exhausted. Active connections 500/500, pg_stat_activity shows 142 blocked queries waiting on lock for table 'orders_v2'. P95 read/write queries timing out after 10000ms.",
    auth: 'Spike in HTTP 401/403 responses on api-gateway. Auth-service reporting Redis token cache miss rate jumped from 0.8% to 94.2%. Auth pod CPU at 98% with OOM-kills on worker 3.'
  };

  // Cycling status messages to indicate reasoning steps during loading
  const LOADING_MESSAGES = [
    'Recalling past incidents...',
    'Querying Hindsight memory bank...',
    'Correlating service telemetry & past postmortems...',
    'Formulating mitigation steps & runbooks...'
  ];

  // ===========================================================================
  // 2. Application State
  // ===========================================================================
  let currentRawDiagnosis = '';
  let lastSubmittedDescription = '';
  let isLoading = false;
  let statusPollTimer = null;
  let loadingCycleTimer = null;

  // ===========================================================================
  // 3. DOM Element References
  // ===========================================================================
  const elements = {
    // Header & Status
    statusWrap: document.getElementById('connectionStatus'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    historyDropdownBtn: document.getElementById('historyDropdownBtn'),
    historyMenu: document.getElementById('historyMenu'),
    historyList: document.getElementById('historyList'),
    historyCount: document.getElementById('historyCount'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

    // Error banner
    errorBanner: document.getElementById('errorBanner'),
    errorMessage: document.getElementById('errorMessage'),
    errorRetryBtn: document.getElementById('errorRetryBtn'),
    errorDismissBtn: document.getElementById('errorDismissBtn'),

    // Input panel
    incidentInput: document.getElementById('incidentInput'),
    charCounter: document.getElementById('charCounter'),
    draftIndicator: document.getElementById('draftIndicator'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    analyzeBtnText: document.getElementById('analyzeBtnText'),
    analyzeSpinner: document.getElementById('analyzeSpinner'),
    clearBtn: document.getElementById('clearBtn'),
    exampleBtns: document.querySelectorAll('.btn-example'),

    // Output panel
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    loadingStatusText: document.getElementById('loadingStatusText'),
    diagnosisContent: document.getElementById('diagnosisContent'),
    diagnosisTimestamp: document.getElementById('diagnosisTimestamp'),
    copyDiagnosisBtn: document.getElementById('copyDiagnosisBtn'),
    copyLabelText: document.getElementById('copyLabelText')
  };

  // ===========================================================================
  // 4. Lightweight Markdown Parser (Self-Contained)
  // ===========================================================================
  /**
   * Custom markdown parser converting common markdown tokens into clean, safe HTML:
   * - Fenced code blocks with language headers and copy buttons
   * - Headers (##, ###, #)
   * - Bold (**text**) & Italic (*text*)
   * - Inline code (`code`)
   * - Unordered lists (- or *) and ordered lists (1.)
   * - Paragraphs and horizontal dividers (---)
   */
  function renderMarkdown(markdownText) {
    if (!markdownText) return '';

    // Step A: Extract fenced code blocks first so inner characters are not touched by inline rules
    const codeBlocks = [];
    let text = markdownText.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = codeBlocks.length;
      codeBlocks.push({ lang: lang || 'bash', code: code.trim() });
      return `%%FENCED_CODE_BLOCK_${id}%%`;
    });

    // Step B: Sanitize HTML characters for security
    text = escapeHtml(text);

    // Step C: Headings (##, ###, #)
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Step D: Horizontal rules
    text = text.replace(/^---$/gim, '<hr>');

    // Step E: Bold & Italic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Step F: Inline code
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Step G: Process lists & paragraphs line by line
    const lines = text.split(/\r?\n/);
    const htmlOutput = [];
    let inUl = false;
    let inOl = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this line is a code block placeholder
      if (line.startsWith('%%FENCED_CODE_BLOCK_') && line.endsWith('%%')) {
        if (inUl) { htmlOutput.push('</ul>'); inUl = false; }
        if (inOl) { htmlOutput.push('</ol>'); inOl = false; }
        htmlOutput.push(line);
        continue;
      }

      // Check for unordered list item (- or *)
      const ulMatch = line.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (inOl) { htmlOutput.push('</ol>'); inOl = false; }
        if (!inUl) { htmlOutput.push('<ul>'); inUl = true; }
        htmlOutput.push(`<li>${ulMatch[1]}</li>`);
        continue;
      }

      // Check for ordered list item (1.)
      const olMatch = line.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (inUl) { htmlOutput.push('</ul>'); inUl = false; }
        if (!inOl) { htmlOutput.push('<ol>'); inOl = true; }
        htmlOutput.push(`<li>${olMatch[1]}</li>`);
        continue;
      }

      // Close open lists if this line is not a list item
      if (inUl) { htmlOutput.push('</ul>'); inUl = false; }
      if (inOl) { htmlOutput.push('</ol>'); inOl = false; }

      // Skip empty lines
      if (!line) continue;

      // Output headings or standard paragraph
      if (line.startsWith('<h1') || line.startsWith('<h2') || line.startsWith('<h3') || line.startsWith('<hr')) {
        htmlOutput.push(line);
      } else {
        htmlOutput.push(`<p>${line}</p>`);
      }
    }

    if (inUl) htmlOutput.push('</ul>');
    if (inOl) htmlOutput.push('</ol>');

    let finalHtml = htmlOutput.join('\n');

    // Step H: Re-inject code blocks with syntax block wrapper and copy affordance
    finalHtml = finalHtml.replace(/%%FENCED_CODE_BLOCK_(\d+)%%/g, (match, id) => {
      const item = codeBlocks[Number(id)];
      if (!item) return '';

      const escapedCode = escapeHtml(item.code);
      const langLabel = (item.lang || 'terminal').toUpperCase();

      return `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-lang-label">${langLabel}</span>
            <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(item.code)}" title="Copy code snippet">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre class="code-block-pre"><code>${escapedCode}</code></pre>
        </div>
      `;
    });

    return finalHtml;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ===========================================================================
  // 5. Backend Connectivity & Health Check
  // ===========================================================================
  /**
   * Pings the backend to update the status indicator (green dot when reachable).
   * Checks /health or OPTIONS /analyze to see if FastAPI is online.
   */
  async function checkBackendConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Probe /health or OPTIONS /analyze
      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
        signal: controller.signal
      }).catch(async () => {
        return await fetch(API_ENDPOINT, {
          method: 'OPTIONS',
          signal: controller.signal
        });
      });

      clearTimeout(timeoutId);

      if (response && (response.ok || response.status === 204 || response.status === 405)) {
        setConnectionStatus('connected', 'Connected');
      } else {
        setConnectionStatus('disconnected', 'Disconnected');
      }
    } catch (err) {
      setConnectionStatus('disconnected', 'Disconnected');
    }
  }

  function setConnectionStatus(status, text) {
    elements.statusDot.className = 'status-dot';
    if (status === 'connected') {
      elements.statusDot.classList.add('status-connected');
      elements.statusWrap.title = 'Backend is reachable at ' + API_ENDPOINT;
    } else if (status === 'connecting') {
      elements.statusDot.classList.add('status-connecting');
      elements.statusWrap.title = 'Verifying connection to ' + API_ENDPOINT + '...';
    } else {
      elements.statusDot.classList.add('status-disconnected');
      elements.statusWrap.title = 'Backend unreachable. Ensure FastAPI backend is running on http://127.0.0.1:8000/';
    }
    elements.statusText.textContent = text;
  }

  // ===========================================================================
  // 6. History Management (localStorage, up to 5 items)
  // ===========================================================================
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
    } catch (err) {
      console.warn('Failed to parse history from localStorage', err);
      return [];
    }
  }

  function saveHistoryItem(description, diagnosis, timestamp) {
    try {
      const history = loadHistory();
      const newItem = {
        id: 'inc_' + Date.now(),
        description,
        diagnosis,
        timestamp: timestamp || new Date().toISOString()
      };

      // Deduplicate identical descriptions and keep up to MAX_HISTORY items
      const filtered = history.filter(item => item.description.trim() !== description.trim());
      filtered.unshift(newItem);
      const updated = filtered.slice(0, MAX_HISTORY);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      renderHistoryMenu(updated);
    } catch (err) {
      console.warn('Failed to save incident to localStorage', err);
    }
  }

  function renderHistoryMenu(history) {
    const items = history || loadHistory();
    elements.historyCount.textContent = items.length;

    if (items.length === 0) {
      elements.historyList.innerHTML = '<li class="history-empty-note">No recent analyses saved</li>';
      return;
    }

    elements.historyList.innerHTML = items.map((item, index) => {
      const timeStr = formatTimestamp(item.timestamp, true);
      const titleMatch = item.diagnosis.match(/^##\s*Incident Diagnosis:\s*(.+)$/m);
      const title = titleMatch ? titleMatch[1] : `Incident #${index + 1}`;
      const snippet = item.description.slice(0, 75).replace(/[\r\n]+/g, ' ');

      return `
        <li class="history-item" data-id="${item.id}" role="menuitem" tabindex="0">
          <div class="history-item-top">
            <span class="history-item-badge" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
            <span class="history-item-time">${timeStr}</span>
          </div>
          <div class="history-item-snippet" title="${escapeHtml(item.description)}">${escapeHtml(snippet)}</div>
        </li>
      `;
    }).join('');
  }

  function loadHistoryEntry(id) {
    const history = loadHistory();
    const found = history.find(item => item.id === id);
    if (!found) return;

    elements.incidentInput.value = found.description;
    autoResizeTextarea();
    updateCharCounter();

    displayDiagnosis(found.diagnosis, found.timestamp);
    toggleHistoryMenu(false);
    hideError();
  }

  function clearAllHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      renderHistoryMenu([]);
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  }

  function toggleHistoryMenu(forceState) {
    const isExpanded = elements.historyDropdownBtn.getAttribute('aria-expanded') === 'true';
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isExpanded;

    elements.historyDropdownBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) {
      elements.historyMenu.classList.remove('hidden');
    } else {
      elements.historyMenu.classList.add('hidden');
    }
  }

  // ===========================================================================
  // 7. UI Helpers & View State Transitions
  // ===========================================================================
  function autoResizeTextarea() {
    const textarea = elements.incidentInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(160, Math.min(textarea.scrollHeight, 400)) + 'px';
  }

  function updateCharCounter() {
    const length = elements.incidentInput.value.length;
    elements.charCounter.textContent = `${length.toLocaleString()} character${length === 1 ? '' : 's'}`;

    if (length > 0) {
      elements.analyzeBtn.disabled = isLoading;
      elements.draftIndicator.textContent = 'Drafting';
    } else {
      elements.analyzeBtn.disabled = true;
      elements.draftIndicator.textContent = 'Ready';
    }
  }

  function showError(message) {
    elements.errorMessage.textContent = message || 'Failed to communicate with /analyze endpoint.';
    elements.errorBanner.classList.remove('hidden');
  }

  function hideError() {
    elements.errorBanner.classList.add('hidden');
  }

  function formatTimestamp(isoString, compact = false) {
    try {
      const date = isoString ? new Date(isoString) : new Date();
      if (compact) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString()}`;
    } catch (e) {
      return '';
    }
  }

  function startLoadingCycle() {
    let index = 0;
    elements.loadingStatusText.textContent = LOADING_MESSAGES[0];

    loadingCycleTimer = setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      elements.loadingStatusText.textContent = LOADING_MESSAGES[index];
    }, 850);
  }

  function stopLoadingCycle() {
    if (loadingCycleTimer) {
      clearInterval(loadingCycleTimer);
      loadingCycleTimer = null;
    }
  }

  function setLoadingState(loading) {
    isLoading = loading;
    elements.analyzeBtn.disabled = loading || !elements.incidentInput.value.trim();
    elements.clearBtn.disabled = loading;
    elements.incidentInput.readOnly = loading;

    if (loading) {
      elements.analyzeSpinner.classList.remove('hidden');
      elements.analyzeBtnText.textContent = 'Analyzing...';
      elements.emptyState.classList.add('hidden');
      elements.diagnosisContent.classList.add('hidden');
      elements.diagnosisTimestamp.classList.add('hidden');
      elements.copyDiagnosisBtn.classList.add('hidden');
      elements.loadingState.classList.remove('hidden');
      startLoadingCycle();
      hideError();
    } else {
      elements.analyzeSpinner.classList.add('hidden');
      elements.analyzeBtnText.textContent = 'Analyze Incident';
      elements.loadingState.classList.add('hidden');
      stopLoadingCycle();
    }
  }

  function displayDiagnosis(diagnosisText, timestampIso) {
    currentRawDiagnosis = diagnosisText;

    // Render markdown to HTML
    elements.diagnosisContent.innerHTML = renderMarkdown(diagnosisText);

    // Format timestamp
    const timeFormatted = formatTimestamp(timestampIso);
    elements.diagnosisTimestamp.textContent = timeFormatted;
    elements.diagnosisTimestamp.classList.remove('hidden');

    // Show copy diagnosis button
    elements.copyDiagnosisBtn.classList.remove('hidden');
    elements.copyDiagnosisBtn.classList.remove('copied');
    elements.copyLabelText.textContent = 'Copy';
    elements.copyDiagnosisBtn.querySelector('.copy-icon').classList.remove('hidden');
    elements.copyDiagnosisBtn.querySelector('.check-icon').classList.add('hidden');

    // Toggle panels
    elements.emptyState.classList.add('hidden');
    elements.loadingState.classList.add('hidden');
    elements.diagnosisContent.classList.remove('hidden');
  }

  // ===========================================================================
  // 8. Incident Analysis API Call (POST /analyze)
  // ===========================================================================
  /**
   * Sends the user's incident description to the FastAPI backend.
   * Body: { "description": "..." }
   * Expected Response: { "diagnosis": "..." }
   */
  async function analyzeIncident() {
    const description = elements.incidentInput.value.trim();
    if (!description || isLoading) return;

    lastSubmittedDescription = description;
    setLoadingState(true);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ description })
      });

      if (!response.ok) {
        let errDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && (errData.detail || errData.error || errData.message)) {
            errDetail = errData.detail || errData.error || errData.message;
          }
        } catch (_) {}
        throw new Error(`Incident analysis failed: ${errDetail}`);
      }

      const data = await response.json();
      if (!data || typeof data.diagnosis !== 'string') {
        throw new Error('Invalid response structure: expected JSON { "diagnosis": "..." } from /analyze');
      }

      const timestamp = new Date().toISOString();
      displayDiagnosis(data.diagnosis, timestamp);
      saveHistoryItem(description, data.diagnosis, timestamp);
      setConnectionStatus('connected', 'Connected');
    } catch (err) {
      console.error('Analysis error:', err);
      showError(err.message || 'Network error: could not connect to POST /analyze');

      // Preserve existing diagnosis or restore empty state
      if (!currentRawDiagnosis) {
        elements.emptyState.classList.remove('hidden');
      } else {
        elements.diagnosisContent.classList.remove('hidden');
      }
      setConnectionStatus('disconnected', 'Disconnected');
    } finally {
      setLoadingState(false);
    }
  }

  // ===========================================================================
  // 9. Event Listeners & Interactions
  // ===========================================================================
  // Textarea input event for auto-resizing & character count
  elements.incidentInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateCharCounter();
  });

  // Keyboard shortcut: Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac) to submit
  elements.incidentInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      analyzeIncident();
    }
  });

  // Submit button
  elements.analyzeBtn.addEventListener('click', analyzeIncident);

  // Clear button
  elements.clearBtn.addEventListener('click', () => {
    elements.incidentInput.value = '';
    elements.incidentInput.style.height = '160px';
    updateCharCounter();
    elements.incidentInput.focus();
    hideError();
  });

  // Quick example preset buttons
  elements.exampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.example;
      if (QUICK_EXAMPLES[type]) {
        elements.incidentInput.value = QUICK_EXAMPLES[type];
        autoResizeTextarea();
        updateCharCounter();
        elements.incidentInput.focus();
        hideError();
      }
    });
  });

  // Copy Entire Diagnosis button (top right of output panel)
  elements.copyDiagnosisBtn.addEventListener('click', async () => {
    if (!currentRawDiagnosis) return;

    try {
      await navigator.clipboard.writeText(currentRawDiagnosis);
      elements.copyDiagnosisBtn.classList.add('copied');
      elements.copyLabelText.textContent = 'Copied!';
      elements.copyDiagnosisBtn.querySelector('.copy-icon').classList.add('hidden');
      elements.copyDiagnosisBtn.querySelector('.check-icon').classList.remove('hidden');

      setTimeout(() => {
        elements.copyDiagnosisBtn.classList.remove('copied');
        elements.copyLabelText.textContent = 'Copy';
        elements.copyDiagnosisBtn.querySelector('.copy-icon').classList.remove('hidden');
        elements.copyDiagnosisBtn.querySelector('.check-icon').classList.add('hidden');
      }, 2000);
    } catch (err) {
      console.warn('Clipboard writeText failed, using fallback', err);
      const dummy = document.createElement('textarea');
      dummy.value = currentRawDiagnosis;
      document.body.appendChild(dummy);
      dummy.select();
      document.execCommand('copy');
      document.body.removeChild(dummy);
    }
  });

  // Copy Individual Code Block button delegation
  elements.diagnosisContent.addEventListener('click', async (e) => {
    const copyCodeBtn = e.target.closest('.btn-copy-code');
    if (!copyCodeBtn) return;

    const rawCode = decodeURIComponent(copyCodeBtn.dataset.code || '');
    if (!rawCode) return;

    try {
      await navigator.clipboard.writeText(rawCode);
      const span = copyCodeBtn.querySelector('span');
      const originalText = span.textContent;
      span.textContent = 'Copied!';
      copyCodeBtn.style.color = 'var(--color-success)';

      setTimeout(() => {
        span.textContent = originalText;
        copyCodeBtn.style.color = '';
      }, 1800);
    } catch (err) {
      console.error('Failed to copy code snippet', err);
    }
  });

  // Error Banner: Retry and Dismiss
  elements.errorRetryBtn.addEventListener('click', () => {
    hideError();
    if (lastSubmittedDescription) {
      elements.incidentInput.value = lastSubmittedDescription;
      autoResizeTextarea();
      updateCharCounter();
      analyzeIncident();
    }
  });

  elements.errorDismissBtn.addEventListener('click', hideError);

  // Status Indicator: Click to re-check connection
  elements.statusWrap.addEventListener('click', () => {
    setConnectionStatus('connecting', 'Checking...');
    checkBackendConnection();
  });

  // History Dropdown Toggle
  elements.historyDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHistoryMenu();
  });

  // History Item Click & Keyboard Selection
  elements.historyList.addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (item && item.dataset.id) {
      loadHistoryEntry(item.dataset.id);
    }
  });

  elements.historyList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('.history-item');
      if (item && item.dataset.id) {
        e.preventDefault();
        loadHistoryEntry(item.dataset.id);
      }
    }
  });

  // Clear History
  elements.clearHistoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllHistory();
  });

  // Dismiss History Menu on Click Outside
  document.addEventListener('click', (e) => {
    if (!elements.historyMenu.contains(e.target) && !elements.historyDropdownBtn.contains(e.target)) {
      toggleHistoryMenu(false);
    }
  });

  // Dismiss on Escape Key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleHistoryMenu(false);
      hideError();
    }
  });

  // ===========================================================================
  // 10. Application Initialization
  // ===========================================================================
  function init() {
    // 1. Initial backend ping
    checkBackendConnection();

    // 2. Poll backend every 15s to keep status indicator synced
    statusPollTimer = setInterval(checkBackendConnection, 15000);

    // 3. Load past incident history from localStorage
    const saved = loadHistory();
    renderHistoryMenu(saved);

    // 4. Initialize textarea sizing and counter
    autoResizeTextarea();
    updateCharCounter();

    console.log('Incident Response Agent UI initialized. Target endpoint:', API_ENDPOINT);
  }

  // Execute on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
