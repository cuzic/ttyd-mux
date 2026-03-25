/**
 * Agent Timeline Page JavaScript
 *
 * SSE streaming, event rendering, filtering, and status polling.
 * Reads configuration from window.__TIMELINE_BASE_PATH__.
 */
(() => {
  var BASE_PATH = window.__TIMELINE_BASE_PATH__ || '';
  var container = document.getElementById('timelineContainer');
  var statusBar = document.getElementById('statusBar');
  var connectionStatus = document.getElementById('connectionStatus');
  var emptyMessage = document.getElementById('emptyMessage');

  // === State ===
  var events = [];
  var filters = { agents: [], eventTypes: [], severities: [] };
  var knownAgents = [];
  var knownEventTypes = [];
  var autoScroll = true;
  var eventSource = null;
  var statusPollTimer = null;
  var currentView = 'timeline'; // 'timeline' | 'kanban'
  var kanbanAgentData = {}; // agentName -> { status, lines[], lastTool }
  var isWaiting = false; // waiting screen active
  var isCompleted = false; // completion screen active
  var _completionTimer = null;
  var completionCountdownSec = 10;
  var completionCountdownTimer = null;
  var userInteracted = false; // cancel auto-return on interaction

  // === Utilities ===

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(isoString) {
    try {
      var d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_e) {
      return '';
    }
  }

  // === Waiting Screen ===

  var waitingScreen = document.getElementById('waitingScreen');

  function showWaitingScreen() {
    isWaiting = true;
    if (waitingScreen) waitingScreen.style.display = '';
    // Hide main content
    if (statusBar) statusBar.style.display = 'none';
    var viewToggle = document.querySelector('.view-toggle');
    if (viewToggle) viewToggle.style.display = 'none';
    var filterBar = document.getElementById('filterBar');
    if (filterBar) filterBar.style.display = 'none';
    if (connectionStatus) connectionStatus.style.display = 'none';
    if (container) container.style.display = 'none';
    if (kanbanContainer) kanbanContainer.style.display = 'none';
  }

  function hideWaitingScreen() {
    if (!isWaiting) return;
    isWaiting = false;
    if (waitingScreen) waitingScreen.style.display = 'none';
    // Restore main content
    if (statusBar) statusBar.style.display = '';
    var viewToggle = document.querySelector('.view-toggle');
    if (viewToggle) viewToggle.style.display = '';
    var filterBar = document.getElementById('filterBar');
    if (filterBar) filterBar.style.display = '';
    if (connectionStatus) connectionStatus.style.display = '';
    if (container) container.style.display = '';
    // Start polling that was deferred during waiting
    updateStatusBar();
    updateConflicts();
    updateFilterBar();
    if (!statusPollTimer) {
      statusPollTimer = setInterval(updateStatusBar, 10000);
      setInterval(updateConflicts, 10000);
    }
  }

  // === Return URL ===

  // Remember where we came from for auto-return
  var returnUrl = '';
  try {
    var stored = sessionStorage.getItem('bunterm_returnUrl');
    if (stored) {
      returnUrl = stored;
    } else if (document.referrer && document.referrer.indexOf('/agents') === -1) {
      returnUrl = document.referrer;
      sessionStorage.setItem('bunterm_returnUrl', returnUrl);
    }
  } catch (_e) {
    // sessionStorage not available
  }
  // Fallback: portal page
  if (!returnUrl) {
    returnUrl = `${BASE_PATH}/`;
  }

  // === Completion Screen ===

  var completionScreen = document.getElementById('completionScreen');
  var completionSummary = document.getElementById('completionSummary');
  var completionCountdown = document.getElementById('completionCountdown');
  var completionReturnLink = document.getElementById('completionReturnLink');

  function showCompletionScreen(agentResults) {
    if (isCompleted) return;
    isCompleted = true;

    // Update return link
    if (completionReturnLink) {
      completionReturnLink.href = returnUrl;
    }

    // Build summary
    if (completionSummary) {
      var totalAgents = agentResults.length;
      var html = `<p>${totalAgents} エージェント — 全タスク完了</p><ul class="completion-agent-list">`;
      for (var i = 0; i < agentResults.length; i++) {
        var agent = agentResults[i];
        var icon = agent.status === 'error' ? '\uD83D\uDD34' : '\uD83D\uDFE2';
        var statusLabel = agent.status === 'error' ? 'エラー' : '完了';
        html += `<li>${icon} ${escapeHtml(agent.sessionName)}: ${statusLabel}</li>`;
      }
      html += '</ul>';
      // biome-ignore lint: client-side DOM rendering
      completionSummary.innerHTML = html;
    }

    // Hide main content, show completion
    if (statusBar) statusBar.style.display = 'none';
    var viewToggle = document.querySelector('.view-toggle');
    if (viewToggle) viewToggle.style.display = 'none';
    var filterBar = document.getElementById('filterBar');
    if (filterBar) filterBar.style.display = 'none';
    if (connectionStatus) connectionStatus.style.display = 'none';
    if (container) container.style.display = 'none';
    if (kanbanContainer) kanbanContainer.style.display = 'none';
    if (completionScreen) completionScreen.style.display = '';

    // Start auto-return countdown
    startCompletionCountdown();
  }

  function startCompletionCountdown() {
    completionCountdownSec = 10;
    userInteracted = false;
    updateCountdownDisplay();
    completionCountdownTimer = setInterval(() => {
      if (userInteracted) {
        clearInterval(completionCountdownTimer);
        completionCountdownTimer = null;
        if (completionCountdown) {
          completionCountdown.textContent = '自動遷移はキャンセルされました';
        }
        return;
      }
      completionCountdownSec--;
      updateCountdownDisplay();
      if (completionCountdownSec <= 0) {
        clearInterval(completionCountdownTimer);
        completionCountdownTimer = null;
        window.location.href = returnUrl;
      }
    }, 1000);
  }

  function updateCountdownDisplay() {
    if (completionCountdown) {
      completionCountdown.textContent = `${completionCountdownSec} 秒後にターミナルに戻ります...`;
    }
  }

  // Cancel auto-return on user interaction
  function onUserInteraction() {
    if (isCompleted && !userInteracted) {
      userInteracted = true;
    }
  }
  // biome-ignore lint: static page script
  document.addEventListener('scroll', onUserInteraction, { passive: true });
  // biome-ignore lint: static page script
  document.addEventListener('touchstart', onUserInteraction, { passive: true });

  // === Completion Detection ===

  var hadAgents = false; // true once we've seen agents active
  var completionCheckCount = 0; // consecutive idle checks

  function checkCompletion(statuses) {
    if (isCompleted || isWaiting) return;

    // Must have seen agents active before we can detect completion
    if (!hadAgents) {
      if (Array.isArray(statuses) && statuses.length > 0) {
        var anyActive = false;
        for (var i = 0; i < statuses.length; i++) {
          if (statuses[i].status === 'active') {
            anyActive = true;
            break;
          }
        }
        if (anyActive) hadAgents = true;
      }
      completionCheckCount = 0;
      return;
    }

    // Check if all agents are idle/unknown (no active ones)
    var allDone = true;
    if (Array.isArray(statuses) && statuses.length > 0) {
      for (var j = 0; j < statuses.length; j++) {
        if (statuses[j].status === 'active') {
          allDone = false;
          break;
        }
      }
    }

    if (allDone) {
      completionCheckCount++;
      // Require 2 consecutive idle polls to avoid false positives
      if (completionCheckCount >= 2) {
        showCompletionScreen(statuses);
      }
    } else {
      completionCheckCount = 0;
    }
  }

  // === Performance: RAF Batching & Debouncing ===

  var pendingEvents = [];
  var rafId = 0;
  var DEBOUNCE_MS = 100;
  var debounceTimer = null;

  /** Queue an SSE event for batched DOM update */
  function queueEvent(event) {
    pendingEvents.push(event);
    scheduleFlush();
  }

  /** Schedule a flush using debounce + RAF */
  function scheduleFlush() {
    if (debounceTimer !== null) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!rafId) {
        rafId = requestAnimationFrame(flushEvents);
      }
    }, DEBOUNCE_MS);
  }

  /** Process all pending events in a single RAF callback */
  function flushEvents() {
    rafId = 0;
    var batch = pendingEvents;
    pendingEvents = [];
    for (var i = 0; i < batch.length; i++) {
      appendEvent(batch[i]);
    }
  }

  // === IntersectionObserver for off-screen cards ===

  var visibleCards = {};
  var deferredCardUpdates = {}; // agentName -> latest event

  var cardObserver =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            for (var i = 0; i < entries.length; i++) {
              var entry = entries[i];
              var agentId = entry.target.dataset.agent;
              if (!agentId) continue;
              if (entry.isIntersecting) {
                visibleCards[agentId] = true;
                // Apply deferred update if any
                if (deferredCardUpdates[agentId]) {
                  updateKanbanCard(agentId);
                  delete deferredCardUpdates[agentId];
                }
              } else {
                delete visibleCards[agentId];
              }
            }
          },
          { rootMargin: '100px' }
        )
      : null;

  /** Check if a card is currently visible (or observer unavailable) */
  function isCardVisible(agentName) {
    if (!cardObserver) return true; // no observer = always update
    return !!visibleCards[agentName];
  }

  // === Auto-scroll tracking ===

  function isNearBottom() {
    var threshold = 100;
    return window.innerHeight + window.scrollY >= document.body.scrollHeight - threshold;
  }

  // biome-ignore lint: static page script
  window.addEventListener(
    'scroll',
    () => {
      autoScroll = isNearBottom();
    },
    { passive: true }
  );

  function scrollToBottom() {
    if (autoScroll) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }

  // === Event Card Rendering ===

  function createEventCard(event) {
    var card = document.createElement('div');
    card.className = 'event-card';
    if (event.severity === 'warn') card.className += ' event-card--warn';
    if (event.severity === 'error') card.className += ' event-card--error';
    card.dataset.agent = event.agentName;
    card.dataset.eventType = event.eventType;
    card.dataset.severity = event.severity;
    card.dataset.eventId = event.id;

    var hasDetail = event.detail && event.detail.trim().length > 0;

    var headerHtml =
      '<div class="event-card-header">' +
      '<div class="event-meta">' +
      '<div class="event-top-row">' +
      '<span class="event-agent">' +
      escapeHtml(event.agentName) +
      '</span>' +
      '<span class="event-type-badge">' +
      escapeHtml(event.eventType) +
      '</span>' +
      '<span class="event-time">' +
      escapeHtml(formatTime(event.timestamp)) +
      '</span>' +
      '</div>' +
      '<div class="event-summary">' +
      escapeHtml(event.summary) +
      '</div>' +
      '<a href="' +
      escapeHtml(BASE_PATH) +
      '/' +
      encodeURIComponent(event.agentName) +
      '/" target="_blank" class="timeline-terminal-link" onclick="event.stopPropagation();">' +
      '\u2192 \u30BF\u30FC\u30DF\u30CA\u30EB\u3092\u958B\u304F' +
      '</a>' +
      '</div>' +
      (hasDetail ? '<span class="event-expand-icon">&#8250;</span>' : '') +
      '</div>';

    var detailHtml = '';
    if (hasDetail) {
      detailHtml =
        '<div class="event-detail">' +
        '<div class="event-detail-content">' +
        '<pre>' +
        escapeHtml(event.detail) +
        '</pre>' +
        '</div>' +
        '</div>';
    }

    // biome-ignore lint: client-side DOM rendering
    card.innerHTML = headerHtml + detailHtml;

    if (hasDetail) {
      // biome-ignore lint: static page script
      card.querySelector('.event-card-header').addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
    }

    return card;
  }

  function matchesFilters(event) {
    if (filters.agents.length > 0 && filters.agents.indexOf(event.agentName) === -1) {
      return false;
    }
    if (filters.eventTypes.length > 0 && filters.eventTypes.indexOf(event.eventType) === -1) {
      return false;
    }
    if (filters.severities.length > 0 && filters.severities.indexOf(event.severity) === -1) {
      return false;
    }
    return true;
  }

  function renderAllEvents() {
    // Remove all event cards
    var cards = container.querySelectorAll('.event-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].remove();
    }

    var hasVisible = false;
    for (var j = 0; j < events.length; j++) {
      if (matchesFilters(events[j])) {
        container.appendChild(createEventCard(events[j]));
        hasVisible = true;
      }
    }

    if (emptyMessage) {
      emptyMessage.style.display = hasVisible ? 'none' : 'block';
    }
  }

  function appendEvent(event) {
    hideWaitingScreen();
    events.push(event);
    trackFilterValues(event);

    if (matchesFilters(event)) {
      var card = createEventCard(event);
      container.appendChild(card);
      if (cardObserver) cardObserver.observe(card);
      if (emptyMessage) emptyMessage.style.display = 'none';
      scrollToBottom();
    }

    // Update kanban state
    updateKanbanAgentData(event);
    updateKanbanCard(event.agentName);
  }

  // === Filters ===

  function trackFilterValues(event) {
    if (knownAgents.indexOf(event.agentName) === -1) {
      knownAgents.push(event.agentName);
      updateFilterBar();
    }
    if (knownEventTypes.indexOf(event.eventType) === -1) {
      knownEventTypes.push(event.eventType);
      updateFilterBar();
    }
  }

  function updateFilterBar() {
    var bar = document.getElementById('filterBar');
    if (!bar) return;

    var html = '';

    // Agent filters
    if (knownAgents.length > 0) {
      html += '<span class="filter-label">Agent:</span><div class="filter-group">';
      for (var i = 0; i < knownAgents.length; i++) {
        var agent = knownAgents[i];
        var agentActive = filters.agents.indexOf(agent) !== -1 ? ' active' : '';
        html +=
          '<button class="filter-btn' +
          agentActive +
          '" data-filter-type="agents" data-filter-value="' +
          escapeHtml(agent) +
          '">' +
          escapeHtml(agent) +
          '</button>';
      }
      html += '</div>';
    }

    // Event type filters
    if (knownEventTypes.length > 0) {
      html += '<span class="filter-label">Type:</span><div class="filter-group">';
      for (var j = 0; j < knownEventTypes.length; j++) {
        var type = knownEventTypes[j];
        var typeActive = filters.eventTypes.indexOf(type) !== -1 ? ' active' : '';
        html +=
          '<button class="filter-btn' +
          typeActive +
          '" data-filter-type="eventTypes" data-filter-value="' +
          escapeHtml(type) +
          '">' +
          escapeHtml(type) +
          '</button>';
      }
      html += '</div>';
    }

    // Severity filters
    var severities = ['info', 'warn', 'error'];
    html += '<span class="filter-label">Severity:</span><div class="filter-group">';
    for (var k = 0; k < severities.length; k++) {
      var sev = severities[k];
      var sevActive = filters.severities.indexOf(sev) !== -1 ? ' active' : '';
      html +=
        '<button class="filter-btn' +
        sevActive +
        '" data-filter-type="severities" data-filter-value="' +
        sev +
        '">' +
        escapeHtml(sev) +
        '</button>';
    }
    html += '</div>';

    // biome-ignore lint: client-side DOM rendering
    bar.innerHTML = html;
  }

  // Delegate filter button clicks
  // biome-ignore lint: static page script
  document.addEventListener('click', (e) => {
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;

    var filterType = btn.dataset.filterType;
    var filterValue = btn.dataset.filterValue;
    if (!filterType || !filterValue) return;

    var arr = filters[filterType];
    var idx = arr.indexOf(filterValue);
    if (idx === -1) {
      arr.push(filterValue);
    } else {
      arr.splice(idx, 1);
    }

    renderAllEvents();
    updateFilterBar();
  });

  // === Status Bar ===

  function updateStatusBar() {
    fetch(`${BASE_PATH}/api/agents/status`)
      .then((res) => res.json())
      .then((json) => {
        var statuses = json.data;
        if (!Array.isArray(statuses) || statuses.length === 0) {
          // biome-ignore lint: client-side DOM rendering
          statusBar.innerHTML = '<span class="status-empty">No agents detected</span>';
          checkCompletion(statuses || []);
          return;
        }

        var html = '';
        for (var i = 0; i < statuses.length; i++) {
          var agent = statuses[i];
          var dotClass = `status-dot status-dot--${agent.status || 'unknown'}`;
          var label = escapeHtml(agent.sessionName || agent.agentName || 'unknown');
          html +=
            '<span class="status-badge">' +
            '<span class="' +
            dotClass +
            '"></span>' +
            label +
            '</span>';
        }
        // biome-ignore lint: client-side DOM rendering
        statusBar.innerHTML = html;

        // Check if all agents completed
        checkCompletion(statuses);
      })
      .catch(() => {
        // Keep current state on error
      });
  }

  // === File Conflict Detection ===

  var conflictBadge = document.getElementById('conflictBadge');
  var lastConflictCount = 0;

  function updateConflicts() {
    fetch(`${BASE_PATH}/api/agents/conflicts`)
      .then((res) => res.json())
      .then((json) => {
        var conflicts = json.data;
        if (!Array.isArray(conflicts) || conflicts.length === 0) {
          if (conflictBadge) {
            conflictBadge.style.display = 'none';
            conflictBadge.title = '';
          }
          lastConflictCount = 0;
          return;
        }

        // Show badge
        if (conflictBadge) {
          conflictBadge.style.display = 'inline-flex';
          conflictBadge.textContent = `\u26A0 ${conflicts.length}`;
          var tooltipLines = conflicts.map((c) => `${c.filePath} (${c.agents.join(', ')})`);
          conflictBadge.title = `File conflicts:\n${tooltipLines.join('\n')}`;
        }

        // Insert warning event cards for new conflicts
        if (conflicts.length > lastConflictCount) {
          for (var i = lastConflictCount; i < conflicts.length; i++) {
            var conflict = conflicts[i];
            var warningEvent = {
              id: `conflict_${Date.now()}_${i}`,
              agentName: conflict.agents.join(', '),
              eventType: 'toolUse',
              summary: `File conflict: ${conflict.filePath}`,
              detail: `Agents editing same file: ${conflict.agents.join(', ')}`,
              timestamp: conflict.detectedAt,
              severity: 'warn'
            };
            appendEvent(warningEvent);
          }
        }

        lastConflictCount = conflicts.length;
      })
      .catch(() => {
        // Keep current state on error
      });
  }

  // === SSE Connection ===

  function setConnectionStatus(state) {
    if (!connectionStatus) return;
    connectionStatus.className = `timeline-connection ${state}`;
    if (state === 'connected') {
      connectionStatus.textContent = 'Connected';
      setTimeout(() => {
        connectionStatus.style.display = 'none';
      }, 2000);
    } else if (state === 'disconnected') {
      connectionStatus.textContent = 'Disconnected - reconnecting...';
      connectionStatus.style.display = 'block';
    } else if (state === 'connecting') {
      connectionStatus.textContent = 'Connecting...';
      connectionStatus.style.display = 'block';
    }
  }

  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    setConnectionStatus('connecting');

    eventSource = new EventSource(`${BASE_PATH}/api/agents/timeline`);

    eventSource.onopen = () => {
      setConnectionStatus('connected');
    };

    eventSource.onerror = () => {
      setConnectionStatus('disconnected');
    };

    // Listen to all event types (batched via queueEvent)
    var eventTypes = [
      'toolUse',
      'toolResult',
      'thinking',
      'text',
      'error',
      'sessionStart',
      'sessionEnd'
    ];
    for (var i = 0; i < eventTypes.length; i++) {
      ((type) => {
        // biome-ignore lint: static page script
        eventSource.addEventListener(type, (e) => {
          try {
            var event = JSON.parse(e.data);
            queueEvent(event);
          } catch (_err) {
            // Ignore parse errors
          }
        });
      })(eventTypes[i]);
    }
  }

  // === View Toggle ===

  var kanbanContainer = document.getElementById('kanbanContainer');
  var kanbanCards = document.getElementById('kanbanCards');
  var kanbanDots = document.getElementById('kanbanDots');

  function switchView(view) {
    currentView = view;
    var btns = document.querySelectorAll('.view-toggle-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.view === view);
    }

    var filterBar = document.getElementById('filterBar');

    if (view === 'timeline') {
      container.style.display = '';
      if (kanbanContainer) kanbanContainer.style.display = 'none';
      if (filterBar) filterBar.style.display = '';
      if (emptyMessage) emptyMessage.style.display = events.length === 0 ? 'block' : 'none';
    } else {
      container.style.display = 'none';
      if (kanbanContainer) kanbanContainer.style.display = '';
      if (filterBar) filterBar.style.display = 'none';
      renderKanban();
    }
  }

  // biome-ignore lint: static page script
  document.addEventListener('click', (e) => {
    var btn = e.target.closest('.view-toggle-btn');
    if (!btn) return;
    var view = btn.dataset.view;
    if (view) switchView(view);
  });

  // === Kanban ===

  function stripAnsi(str) {
    // Remove ANSI escape sequences
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
  }

  function updateKanbanAgentData(event) {
    var name = event.agentName;
    if (!kanbanAgentData[name]) {
      kanbanAgentData[name] = { status: 'active', lines: [], lastTool: '' };
    }
    var data = kanbanAgentData[name];

    // Update lines from text/toolResult events
    if ((event.eventType === 'text' || event.eventType === 'toolResult') && event.detail) {
      var cleaned = stripAnsi(event.detail);
      var newLines = cleaned.split('\n');
      for (var i = 0; i < newLines.length; i++) {
        data.lines.push(newLines[i]);
      }
      // Keep only last 5 lines
      if (data.lines.length > 5) {
        data.lines = data.lines.slice(data.lines.length - 5);
      }
    }

    // Update last tool from toolUse events
    if (event.eventType === 'toolUse') {
      data.lastTool = event.summary;
    }

    // Track session lifecycle
    if (event.eventType === 'sessionEnd') {
      data.status = 'idle';
    } else if (event.eventType === 'error') {
      data.status = 'error';
    } else {
      data.status = 'active';
    }
  }

  function renderKanbanCard(agentName) {
    var data = kanbanAgentData[agentName] || { status: 'active', lines: [], lastTool: '' };

    var card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.agent = agentName;

    var dotClass = `status-dot status-dot--${data.status}`;
    var terminalContent =
      data.lines.length > 0 ? escapeHtml(data.lines.join('\n')) : 'No output yet...';

    var cardHtml =
      '<div class="kanban-card-header">' +
      '<span class="kanban-agent-name">' +
      escapeHtml(agentName) +
      '</span>' +
      '<span class="' +
      dotClass +
      '"></span>' +
      '</div>' +
      '<pre class="kanban-mini-terminal">' +
      terminalContent +
      '</pre>' +
      (data.lastTool ? `<div class="kanban-last-tool">${escapeHtml(data.lastTool)}</div>` : '') +
      '<a href="' +
      escapeHtml(BASE_PATH) +
      '/' +
      encodeURIComponent(agentName) +
      '/" target="_blank" class="kanban-terminal-link">' +
      '\u2192 \u30BF\u30FC\u30DF\u30CA\u30EB\u3092\u958B\u304F' +
      '</a>';
    // biome-ignore lint: client-side DOM rendering
    card.innerHTML = cardHtml;

    return card;
  }

  function renderKanban() {
    if (!kanbanCards) return;
    kanbanCards.innerHTML = '';

    var agents = Object.keys(kanbanAgentData);
    if (agents.length === 0) {
      // biome-ignore lint: client-side DOM rendering
      kanbanCards.innerHTML = '<div class="timeline-empty">No agents detected</div>';
      if (kanbanDots) kanbanDots.innerHTML = '';
      return;
    }

    for (var i = 0; i < agents.length; i++) {
      var card = renderKanbanCard(agents[i]);
      kanbanCards.appendChild(card);
      if (cardObserver) cardObserver.observe(card);
    }

    // Page dots for mobile
    if (kanbanDots) {
      var dotsHtml = '';
      for (var j = 0; j < agents.length; j++) {
        dotsHtml += `<span class="kanban-dot${j === 0 ? ' active' : ''}"></span>`;
      }
      // biome-ignore lint: client-side DOM rendering
      kanbanDots.innerHTML = dotsHtml;
    }

    // Track scroll for dot indicator
    kanbanCards.onscroll = updateKanbanDots;
  }

  function updateKanbanDots() {
    if (!kanbanCards || !kanbanDots) return;
    var dots = kanbanDots.querySelectorAll('.kanban-dot');
    if (dots.length === 0) return;

    var scrollLeft = kanbanCards.scrollLeft;
    var cardWidth = kanbanCards.offsetWidth;
    var activeIdx = Math.round(scrollLeft / cardWidth);
    activeIdx = Math.max(0, Math.min(activeIdx, dots.length - 1));

    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === activeIdx);
    }
  }

  function updateKanbanCard(agentName) {
    if (currentView !== 'kanban' || !kanbanCards) return;

    // Defer updates for off-screen cards
    if (!isCardVisible(agentName)) {
      deferredCardUpdates[agentName] = true;
      return;
    }

    var existing = kanbanCards.querySelector(`[data-agent="${agentName}"]`);
    var newCard = renderKanbanCard(agentName);

    if (existing) {
      existing.replaceWith(newCard);
      // Re-observe the new card element
      if (cardObserver) cardObserver.observe(newCard);
    } else {
      kanbanCards.appendChild(newCard);
      if (cardObserver) cardObserver.observe(newCard);
      // Update dots when a new card is added
      renderKanbanDots();
    }
  }

  function renderKanbanDots() {
    if (!kanbanDots || !kanbanCards) return;
    var cards = kanbanCards.querySelectorAll('.kanban-card');
    var dotsHtml = '';
    for (var i = 0; i < cards.length; i++) {
      dotsHtml += `<span class="kanban-dot${i === 0 ? ' active' : ''}"></span>`;
    }
    // biome-ignore lint: client-side DOM rendering
    kanbanDots.innerHTML = dotsHtml;
  }

  // === Initialization ===

  function loadHistory() {
    fetch(`${BASE_PATH}/api/agents/timeline/history?limit=50`)
      .then((res) => res.json())
      .then((json) => {
        var history = json.data;
        if (!Array.isArray(history)) return;

        for (var i = 0; i < history.length; i++) {
          events.push(history[i]);
          trackFilterValues(history[i]);
          updateKanbanAgentData(history[i]);
        }

        renderAllEvents();
        updateFilterBar();
        if (currentView === 'kanban') renderKanban();

        // Scroll to bottom after loading history
        autoScroll = true;
        scrollToBottom();
      })
      .catch((e) => {
        console.error('Failed to load timeline history:', e);
      });
  }

  // === Initial Status Check ===

  function checkInitialStatus() {
    fetch(`${BASE_PATH}/api/agents/status`)
      .then((res) => res.json())
      .then((json) => {
        var statuses = json.data;
        if (!Array.isArray(statuses) || statuses.length === 0) {
          showWaitingScreen();
        } else {
          loadHistory();
          updateStatusBar();
          updateConflicts();
          updateFilterBar();
          statusPollTimer = setInterval(updateStatusBar, 10000);
          setInterval(updateConflicts, 10000);
        }
      })
      .catch(() => {
        // On error, show timeline as fallback
        loadHistory();
        updateStatusBar();
        updateConflicts();
        updateFilterBar();
        statusPollTimer = setInterval(updateStatusBar, 10000);
        setInterval(updateConflicts, 10000);
      });
  }

  // Start everything
  checkInitialStatus();
  connectSSE();
})();
