// Frontend client controller for HackMeIfYouCan Dashboard
let currentLabs = [];
let activeFilter = 'all';
let activeDifficulty = 'all';
let searchQuery = '';
let cachedHints = {};

// DOM Elements
const labsGrid = document.getElementById('labs-grid');
const solvedStat = document.getElementById('solved-stat');
const progressBar = document.getElementById('progress-bar');
const progressPct = document.getElementById('progress-pct');
const searchInput = document.getElementById('search-input');
const categoryBtns = document.querySelectorAll('.filters-section:not(.difficulty-filters-section) .filter-btn');
const btnReset = document.getElementById('btn-reset');
const btnStartAll = document.getElementById('btn-start-all');
const btnStopAll = document.getElementById('btn-stop-all');
const notification = document.getElementById('notification');

const btnRepeater = document.getElementById('btn-repeater');
const repeaterModal = document.getElementById('repeater-modal');
const modalClose = document.getElementById('modal-close');
const reqSendBtn = document.getElementById('req-send-btn');

const consoleModal = document.getElementById('console-modal');
const consoleClose = document.getElementById('console-close');
const consoleTitle = document.getElementById('console-title');

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  fetchLabs();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Category Filters
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeFilter = e.target.getAttribute('data-filter');
      renderLabs();
    });
  });

  // Difficulty Filters
  const diffBtns = document.querySelectorAll('.difficulty-filters .filter-btn');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      diffBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeDifficulty = e.target.getAttribute('data-difficulty');
      renderLabs();
    });
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderLabs();
  });

  // Start All Labs
  if (btnStartAll) {
    btnStartAll.addEventListener('click', async () => {
      showNotification("Starting all lab containers... This may take a moment.", "info");
      try {
        const res = await fetch('/api/labs/start-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showNotification("All labs started!", "success");
          fetchLabs();
        } else {
          showNotification(`Error starting labs: ${data.error}`, "error");
        }
      } catch (err) {
        showNotification("Failed to connect to backend.", "error");
      }
    });
  }

  // Stop All Labs
  if (btnStopAll) {
    btnStopAll.addEventListener('click', async () => {
      showNotification("Stopping all running lab containers...", "info");
      try {
        const res = await fetch('/api/labs/stop-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showNotification("All labs stopped!", "success");
          fetchLabs();
        } else {
          showNotification(`Error stopping labs: ${data.error}`, "error");
        }
      } catch (err) {
        showNotification("Failed to connect to backend.", "error");
      }
    });
  }

  // Reset Progress
  btnReset.addEventListener('click', async () => {

    if (confirm("Are you sure you want to reset all lab progress and stop all running containers?")) {
      showNotification("Resetting platform state...", "info");
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showNotification("All labs reset successfully!", "success");
          fetchLabs();
        } else {
          showNotification(`Error resetting: ${data.error}`, "error");
        }
      } catch (err) {
        showNotification("Failed to connect to backend.", "error");
      }
    }
  });

  // Repeater modal toggle
  if (btnRepeater && repeaterModal && modalClose) {
    btnRepeater.addEventListener('click', () => {
      repeaterModal.classList.add('show');
    });
    modalClose.addEventListener('click', () => {
      repeaterModal.classList.remove('show');
    });
    window.addEventListener('click', (e) => {
      if (e.target === repeaterModal) {
        repeaterModal.classList.remove('show');
      }
    });
  }

  // Repeater Send button
  if (reqSendBtn) {
    reqSendBtn.addEventListener('click', executeRepeaterRequest);
  }

  // Console modal close bindings
  if (consoleClose && consoleModal) {
    consoleClose.addEventListener('click', closeConsole);
    window.addEventListener('click', (e) => {
      if (e.target === consoleModal) {
        closeConsole();
      }
    });
  }
}

// Fetch labs data from API
async function fetchLabs() {
  try {
    const res = await fetch('/api/labs');
    const data = await res.json();
    if (data.success) {
      currentLabs = data.labs;
      renderLabs();
      updateStats();
    } else {
      labsGrid.innerHTML = `<div class="loading">Error loading labs: ${data.error}</div>`;
    }
  } catch (err) {
    labsGrid.innerHTML = `<div class="loading">Failed to reach the dashboard backend server.</div>`;
  }
}

// Update Header Statistics
function updateStats() {
  const total = currentLabs.length;
  const solved = currentLabs.filter(l => l.solved).length;
  solvedStat.innerText = `${solved} / ${total}`;
  
  const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;
  progressBar.style.width = `${percentage}%`;
  progressPct.innerText = `${percentage}%`;
}

// Render Lab Grid
function renderLabs() {
  labsGrid.innerHTML = '';
  
  const filtered = currentLabs.filter(lab => {
    // Category match
    const categoryMatch = activeFilter === 'all' || lab.category.startsWith(activeFilter);
    // Difficulty match
    const difficultyMatch = activeDifficulty === 'all' || lab.difficulty.toLowerCase() === activeDifficulty;
    // Search match
    const searchMatch = lab.name.toLowerCase().includes(searchQuery) || 
                        lab.category.toLowerCase().includes(searchQuery) ||
                        lab.difficulty.toLowerCase().includes(searchQuery);
    return categoryMatch && difficultyMatch && searchMatch;
  });

  if (filtered.length === 0) {
    labsGrid.innerHTML = `<div class="loading">No training labs match your search/filter parameters.</div>`;
    return;
  }

  filtered.forEach(lab => {
    const card = document.createElement('div');
    card.className = `lab-card difficulty-${lab.difficulty.toLowerCase()} ${lab.solved ? 'solved' : ''}`;
    
    // Create status template
    const activeClass = lab.active ? 'active' : '';
    const statusText = lab.active ? 'RUNNING' : 'STOPPED';
    
    const labUrl = `/lab/${lab.id}/`;

    let actionButtons = '';
    if (lab.active) {
      actionButtons = `
        <a href="${labUrl}" target="_blank" class="btn btn-link">ACCESS LAB</a>
        <button class="btn btn-secondary btn-console" onclick="openConsole('${lab.containerName}', '${lab.name}')">CONSOLE</button>
        <button class="btn btn-danger" onclick="stopLab('${lab.id}')">STOP</button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-primary" style="flex-grow:1" onclick="startLab('${lab.id}')">START LAB</button>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="card-header">
          <span class="category-tag">${lab.category.split(':')[0]}</span>
          <div class="badge-group">
            <span class="diff-badge diff-${lab.difficulty.toLowerCase()}">${lab.difficulty}</span>
            ${lab.solved ? '<span class="solved-badge">SOLVED</span>' : ''}
          </div>
        </div>
        <h3 class="lab-title">${lab.name}</h3>
        <p class="lab-desc">Practice exploring and exploiting vulnerabilities corresponding to category ${lab.category.split('-')[1] || lab.category.split(':')[1]}. Exploit the system and extract the flag.</p>
      </div>
      
      <div class="control-panel">
        <div class="status-row">
          <div class="status-indicator ${activeClass}">
            <div class="status-dot"></div>
            <span class="status-label-text">${statusText}</span>
          </div>
          ${lab.active ? `<span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--primary)">PORT: ${lab.port}</span>` : ''}
        </div>
        
        <div class="action-row">
          ${actionButtons}
        </div>

        <form class="flag-form" onsubmit="submitFlag(event, '${lab.id}')">
          <input type="text" placeholder="FLAG{...}" class="flag-input" required id="flag-${lab.id}" ${lab.solved ? 'disabled value="SOLVED"' : ''}>
          <button type="submit" class="btn btn-secondary btn-submit" ${lab.solved ? 'disabled' : ''}>SUBMIT</button>
        </form>
      </div>
    `;
    
    labsGrid.appendChild(card);
  });
}

// API Interactions
async function startLab(id) {
  showNotification("Starting lab container, please wait...", "info");
  try {
    const res = await fetch(`/api/labs/${id}/start`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showNotification("Container spun up successfully!", "success");
      // update lab state
      const lab = currentLabs.find(l => l.id === id);
      if (lab) {
        lab.active = true;
        renderLabs();
      }
    } else {
      showNotification(data.error, "error");
    }
  } catch (err) {
    showNotification("Failed to send start signal to backend.", "error");
  }
}

async function stopLab(id) {
  showNotification("Shutting down lab container...", "info");
  try {
    const res = await fetch(`/api/labs/${id}/stop`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showNotification("Container stopped.", "info");
      const lab = currentLabs.find(l => l.id === id);
      if (lab) {
        lab.active = false;
        renderLabs();
      }
    } else {
      showNotification(data.error, "error");
    }
  } catch (err) {
    showNotification("Failed to send stop signal to backend.", "error");
  }
}

async function submitFlag(event, id) {
  event.preventDefault();
  const input = document.getElementById(`flag-${id}`);
  const flag = input.value;
  
  try {
    const res = await fetch(`/api/labs/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag })
    });
    const data = await res.json();
    if (data.success) {
      showNotification("Success! Correct flag submitted.", "success");
      const lab = currentLabs.find(l => l.id === id);
      if (lab) {
        lab.solved = true;
        renderLabs();
        updateStats();
      }
    } else {
      showNotification(data.error, "error");
    }
  } catch (err) {
    showNotification("Failed to submit flag.", "error");
  }
}

// Notification Drawer
let notificationTimeout = null;
function showNotification(message, type = "info") {
  if (notificationTimeout) clearTimeout(notificationTimeout);
  
  notification.className = `notification show ${type}`;
  notification.innerText = message;
  
  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
  }, 4000);
}

// Mini-Burp Request execution logic
async function executeRepeaterRequest() {
  const method = document.getElementById('req-method').value;
  const url = document.getElementById('req-url').value || document.getElementById('req-url').placeholder;
  const headersText = document.getElementById('req-headers').value;
  const bodyText = document.getElementById('req-body').value;
  const sendBtn = document.getElementById('req-send-btn');
  
  const respStatus = document.getElementById('resp-status');
  const respTime = document.getElementById('resp-time');
  const respHeaders = document.getElementById('resp-headers');
  const respBody = document.getElementById('resp-body');
  
  if (!url) {
    showNotification("Target URL is required", "error");
    return;
  }
  
  const headers = {};
  const lines = headersText.split('\n');
  lines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      const val = line.substring(colonIndex + 1).trim();
      if (key) {
        headers[key] = val;
      }
    }
  });
  
  sendBtn.disabled = true;
  sendBtn.innerText = "SENDING...";
  respStatus.innerText = "REQ SENT";
  respStatus.className = "resp-status-badge";
  respHeaders.innerText = "Awaiting response...";
  respBody.innerText = "Awaiting response...";
  
  try {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method,
        url,
        headers,
        body: bodyText
      })
    });
    
    const data = await res.json();
    if (data.success) {
      respTime.innerText = `${data.elapsed}ms`;
      respStatus.innerText = `${data.status} ${data.statusText}`;
      
      respStatus.className = "resp-status-badge";
      if (data.status >= 200 && data.status < 300) {
        respStatus.classList.add('status-2xx');
      } else if (data.status >= 400) {
        respStatus.classList.add('status-4xx');
      }
      
      let headersStr = '';
      for (const [key, val] of Object.entries(data.headers)) {
        headersStr += `${key}: ${val}\n`;
      }
      respHeaders.innerText = headersStr || "No headers returned.";
      
      try {
        const parsed = JSON.parse(data.body);
        respBody.innerText = JSON.stringify(parsed, null, 2);
      } catch (e) {
        respBody.innerText = data.body || "[Empty Body]";
      }
    } else {
      respStatus.innerText = "ERROR";
      respStatus.className = "resp-status-badge status-5xx";
      respHeaders.innerText = "N/A";
      respBody.innerText = data.error || "Failed to route request via platform proxy.";
    }
  } catch (err) {
    respStatus.innerText = "FAILED";
    respStatus.className = "resp-status-badge status-5xx";
    respHeaders.innerText = "N/A";
    respBody.innerText = `Network or Connection error: ${err.message}`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerText = "SEND";
  }
}

// Intel Hints dynamic drawer implementation
async function toggleHints(id) {
  const drawer = document.getElementById(`hints-drawer-${id}`);
  if (!drawer) return;
  
  if (drawer.style.display === 'none') {
    drawer.style.display = 'block';
    if (!cachedHints[id]) {
      const contentDiv = document.getElementById(`hints-content-${id}`);
      contentDiv.innerText = "Retrieving Intel from secure storage...";
      try {
        const res = await fetch(`/api/labs/${id}/hints`);
        const data = await res.json();
        if (data.success) {
          cachedHints[id] = data.hints;
          switchHintTab(id, 'recon');
        } else {
          contentDiv.innerText = `Error: ${data.error || "Failed to load hints"}`;
        }
      } catch (err) {
        contentDiv.innerText = "Connection failure while fetching intel.";
      }
    } else {
      const activeTab = drawer.querySelector('.hint-tab-btn.active');
      const tabType = activeTab ? activeTab.id.split('-').pop() : 'recon';
      switchHintTab(id, tabType);
    }
  } else {
    drawer.style.display = 'none';
  }
}

function switchHintTab(id, tabType) {
  const drawer = document.getElementById(`hints-drawer-${id}`);
  if (!drawer) return;
  
  const tabs = drawer.querySelectorAll('.hint-tab-btn');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  const targetTab = document.getElementById(`tab-${id}-${tabType}`);
  if (targetTab) targetTab.classList.add('active');
  
  const contentDiv = document.getElementById(`hints-content-${id}`);
  if (!contentDiv) return;
  
  if (cachedHints[id] && cachedHints[id][tabType]) {
    contentDiv.innerHTML = formatHintMarkdown(cachedHints[id][tabType]);
  } else {
    contentDiv.innerText = "No Intel available for this tier.";
  }
}

function formatHintMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); color: var(--primary); padding: 0.1rem 0.3rem; border-radius: 3px; font-family: var(--font-mono); font-size: 0.85em;">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: var(--text-bright);">$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// xterm.js TTY interactive console execution piping
let activeSocket = null;
let activeTerminal = null;

function openConsole(containerName, labName) {
  const consoleModal = document.getElementById('console-modal');
  const consoleTitle = document.getElementById('console-title');
  const terminalContainer = document.getElementById('terminal-container');
  
  if (!consoleModal || !terminalContainer) return;
  
  consoleTitle.innerText = labName;
  consoleModal.classList.add('show');
  
  closeConsole();
  
  activeTerminal = new Terminal({
    cursorBlink: true,
    theme: {
      background: '#000000',
      foreground: '#4af626', // retro hacking green
      cursor: '#4af626'
    },
    fontFamily: 'var(--font-mono)',
    fontSize: 13
  });
  
  const fitAddon = new window.FitAddon.FitAddon();
  activeTerminal.loadAddon(fitAddon);
  
  terminalContainer.innerHTML = '';
  activeTerminal.open(terminalContainer);
  fitAddon.fit();
  
  activeTerminal.writeln("\r\n\u001b[32m[+] Connecting to secure Web Shell gateway...\u001b[0m");
  activeTerminal.writeln(`\u001b[32m[+] Target Container: ${containerName}\u001b[0m\r\n`);
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/shell/${containerName}`;
  activeSocket = new WebSocket(wsUrl);
  
  activeSocket.onmessage = (event) => {
    activeTerminal.write(event.data);
  };
  
  activeTerminal.onData((data) => {
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
      activeSocket.send(data);
    }
  });
  
  activeSocket.onclose = () => {
    activeTerminal.writeln("\r\n\u001b[31m[-] Web Shell session terminated.\u001b[0m\r\n");
  };
  
  activeSocket.onerror = (err) => {
    activeTerminal.writeln(`\r\n\u001b[31m[Error] WebSocket connection error\u001b[0m\r\n`);
  };
  
  window.addEventListener('resize', () => {
    if (activeTerminal && fitAddon) fitAddon.fit();
  });
}

function closeConsole() {
  const consoleModal = document.getElementById('console-modal');
  if (consoleModal) {
    consoleModal.classList.remove('show');
  }
  
  if (activeSocket) {
    activeSocket.close();
    activeSocket = null;
  }
  
  if (activeTerminal) {
    activeTerminal.dispose();
    activeTerminal = null;
  }
}
