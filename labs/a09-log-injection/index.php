<?php
// Modern Multi-stage PHP Log Poisoning & LFI Lab
error_reporting(E_ALL);
ini_set('display_errors', 1);

$logDir = __DIR__ . '/logs';
if (!file_exists($logDir)) {
    mkdir($logDir, 0777, true);
}

// Session configuration for Stage 3
session_save_path($logDir);
if (isset($_COOKIE['PHPSESSID'])) {
    session_id($_COOKIE['PHPSESSID']);
}

// Load Security Mode
$securityModeFile = $logDir . '/security_mode.txt';
$securityMode = 'vulnerable';
if (file_exists($securityModeFile)) {
    $securityMode = trim(file_get_contents($securityModeFile));
}

// Helper: Custom HTTP Logger
$httpLogsFile = $logDir . '/http_logs.json';
function addHttpLog($method, $path, $status) {
    global $httpLogsFile, $securityMode;
    $logs = [];
    if (file_exists($httpLogsFile)) {
        $logs = json_decode(file_get_contents($httpLogsFile), true) ?: [];
    }
    
    $newLog = [
        'id' => count($logs) + 1,
        'timestamp' => date('Y-m-d\TH:i:s\Z'),
        'method' => $method,
        'path' => $path,
        'statusCode' => $status,
        'duration' => rand(5, 35) . 'ms',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        'securityMode' => $securityMode
    ];
    
    array_push($logs, $newLog);
    if (count($logs) > 50) {
        array_shift($logs);
    }
    file_put_contents($httpLogsFile, json_encode($logs, JSON_PRETTY_PRINT));
}

// Route API settings & logs
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

if (strpos($requestUri, '/api/settings/security-mode') !== false) {
    if ($requestMethod === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $mode = $input['mode'] ?? 'vulnerable';
        if ($mode === 'secure' || $mode === 'vulnerable') {
            $securityMode = $mode;
            file_put_contents($securityModeFile, $securityMode);
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'securityMode' => $securityMode]);
            exit;
        }
    } else {
        header('Content-Type: application/json');
        echo json_encode(['securityMode' => $securityMode]);
        exit;
    }
}

if (strpos($requestUri, '/api/logs/clear') !== false && $requestMethod === 'POST') {
    file_put_contents($httpLogsFile, json_encode([]));
    header('Content-Type: application/json');
    echo json_encode(['success' => true]);
    exit;
}

if (strpos($requestUri, '/api/logs') !== false) {
    header('Content-Type: application/json');
    $logs = [];
    if (file_exists($httpLogsFile)) {
        $logs = json_decode(file_get_contents($httpLogsFile), true) ?: [];
    }
    echo json_encode(['logs' => $logs]);
    exit;
}

// Parse stage parameter
$stage = isset($_GET['stage']) ? intval($_GET['stage']) : 1;

// Log connections depending on stage
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$referer = $_SERVER['HTTP_REFERER'] ?? '';

// Write to active log
if ($securityMode === 'secure') {
    // SECURE: Strict input encoding & sanitization
    $safeUa = htmlspecialchars($ua, ENT_QUOTES, 'UTF-8');
    $safeReferer = htmlspecialchars($referer, ENT_QUOTES, 'UTF-8');
    $logLine = "[" . date('Y-m-d H:i:s') . "] IP: {$ip} | UA: {$safeUa} | REF: {$safeReferer}\n";
    file_put_contents($logDir . '/access.log', $logLine, FILE_APPEND);
} else {
    // VULNERABLE behavior per stage
    if ($stage === 1) {
        $logLine = "[" . date('Y-m-d H:i:s') . "] IP: {$ip} | UA: {$ua}\n";
        file_put_contents($logDir . '/access.log', $logLine, FILE_APPEND);
    } else if ($stage === 2) {
        $escapedUa = htmlspecialchars($ua, ENT_QUOTES, 'UTF-8');
        $logLine = "[" . date('Y-m-d H:i:s') . "] IP: {$ip} | UA: {$escapedUa} | REF: {$referer}\n";
        file_put_contents($logDir . '/access_stage2.log', $logLine, FILE_APPEND);
    } else if ($stage === 3) {
        // Stage 3 Session poisoning
        if (isset($_COOKIE['PHPSESSID'])) {
            session_start();
            // If the user-agent contains php code, store it raw into session
            if (strpos($ua, '<?php') !== false || strpos($referer, '<?php') !== false) {
                $_SESSION['poison'] = $ua . $referer;
            } else {
                $_SESSION['user'] = 'guest_operator';
            }
            session_write_close();
        }
        $escapedUa = htmlspecialchars($ua, ENT_QUOTES, 'UTF-8');
        $escapedRef = htmlspecialchars($referer, ENT_QUOTES, 'UTF-8');
        $logLine = "[" . date('Y-m-d H:i:s') . "] IP: {$ip} | UA: {$escapedUa} | REF: {$escapedRef}\n";
        file_put_contents($logDir . '/access_stage3.log', $logLine, FILE_APPEND);
    } else if ($stage === 4) {
        // Stage 4 filters
        $escapedUa = htmlspecialchars($ua, ENT_QUOTES, 'UTF-8');
        $escapedRef = htmlspecialchars($referer, ENT_QUOTES, 'UTF-8');
        $logLine = "[" . date('Y-m-d H:i:s') . "] IP: {$ip} | UA: {$escapedUa} | REF: {$escapedRef}\n";
        file_put_contents($logDir . '/access_stage4.log', $logLine, FILE_APPEND);
    }
}

// Handle LFI
$file = $_GET['file'] ?? null;
if ($file) {
    addHttpLog($requestMethod, $requestUri, 200);
    
    if ($securityMode === 'secure') {
        // SECURE mode: path traversal prevention & white-list matching
        $baseName = basename($file);
        if ($baseName === 'access.log' && $file === 'logs/access.log') {
            include($logDir . '/access.log');
        } else {
            echo "Access Denied: Dynamic LFI blocked by Remediation Shield.";
        }
        exit;
    } else {
        // VULNERABLE LFI
        // Stage 4 strict validation but filter chains allowed
        if ($stage === 4) {
            if (strpos($file, 'php://filter') !== false) {
                // Parse filter chain to simulate base64 decoding and execution
                // To keep it standard and simple, if php://filter is requested, we process it
                if (preg_match('/resource=(.+)/i', $file, $matches)) {
                    $resource = $matches[1];
                    if (file_exists($resource)) {
                        include($file);
                    } else {
                        // Allow filter-chain based base64 shell directly
                        echo "Processing PHP Filter Chain...";
                        include($file);
                    }
                } else {
                    include($file);
                }
                exit;
            } else {
                echo "LFI Blocked: Standard path traversals are restricted in Stage 4. Use PHP filters.";
                exit;
            }
        }
        
        if (file_exists($file)) {
            include($file);
            exit;
        } else {
            echo "File not found: " . htmlspecialchars($file);
            exit;
        }
    }
}

addHttpLog($requestMethod, $requestUri, 200);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Operations Logger</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #000000;
      --panel-bg: rgba(12, 12, 12, 0.95);
      --glass-border: rgba(255, 255, 255, 0.08);
      --primary: #10b981;
      --primary-glow: none;
      --accent: #10b981;
      --success: #10b981;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --font-sans: 'Outfit', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--bg-color);
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      font-size: 20px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--glass-border);
      background: rgba(17, 24, 39, 0.4);
      backdrop-filter: blur(12px);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.5px;
    }

    .brand-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 6px;
    }

    .shield-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #f87171;
    }

    .shield-btn.secure {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #34d399;
    }

    main {
      flex: 1;
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      padding: 2rem;
      gap: 2rem;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
    }

    @media (max-width: 1024px) {
      main {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      background: var(--panel-bg);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 2rem;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .stages-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stages-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
    }

    .stage-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .stage-card:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateY(-2px);
    }

    .stage-card.active {
      background: var(--primary-glow);
      border-color: var(--primary);
    }

    .stage-num {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .stage-name {
      font-weight: 700;
      color: #fff;
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    .stage-status {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      margin-top: 0.5rem;
      text-transform: uppercase;
    }

    .stage-status.unsolved {
      color: #f87171;
    }

    .stage-status.solved {
      color: var(--success);
    }

    .desc-box {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 1.25rem;
    }

    .desc-title {
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.5rem;
    }

    .desc-body {
      font-size: 20px;
      line-height: 1.6;
      color: var(--text-muted);
    
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input, textarea {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--glass-border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.3s;
    }

    input:focus, textarea:focus {
      border-color: var(--primary);
    }

    .btn {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border: none;
      color: #fff;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-family: var(--font-sans);
      transition: all 0.3s ease;
      text-align: center;
    }

    .btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .logger-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .logger-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logger-terminal {
      flex: 1;
      background: #02040a;
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      padding: 1rem;
      overflow-y: auto;
      max-height: 500px;
      min-height: 300px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .log-item {
      display: flex;
      gap: 0.75rem;
      line-height: 1.4;
      border-bottom: 1px solid rgba(255,255,255,0.02);
      padding-bottom: 0.25rem;
    }

    .log-method {
      font-weight: 700;
      color: var(--accent);
    }

    .log-path {
      color: #fff;
      flex: 1;
      word-break: break-all;
    }

    .log-status {
      color: var(--success);
    }

    .log-status.err {
      color: #f87171;
    }
  
    /* Mobile and Split-Screen Responsiveness */
    @media (max-width: 1024px) {
      header {
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
        gap: 1rem !important;
        padding: 1rem !important;
      }
      .brand, .patch-control {
        justify-content: center !important;
        margin: 0 auto !important;
      }
      .container {
        grid-template-columns: 1fr !important;
        margin: 1rem auto !important;
        gap: 1.5rem !important;
      }
      aside {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        background: rgba(255, 255, 255, 0.03) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 8px !important;
        cursor: pointer !important;
      }
      aside::before {
        content: "☰ Menu (Select Lab Stage)" !important;
        display: block !important;
        padding: 0.75rem 1rem !important;
        font-family: var(--font-sans) !important;
        font-weight: bold !important;
        color: var(--primary) !important;
        text-align: center !important;
      }
      /* Hide all immediate children of aside except when active-menu is toggled */
      aside > * {
        display: none !important;
      }
      aside.active-menu > * {
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        background: #000000 !important;
        position: absolute !important;
        top: 100% !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 1000 !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 8px !important;
        padding: 0.5rem !important;
        gap: 6px !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9) !important;
      }
      .sidebar-btn, aside a, aside button, .nav-item {
        width: 100% !important;
        text-align: left !important;
        padding: 0.75rem 1rem !important;
        background: rgba(255,255,255,0.02) !important;
        border: 1px solid var(--glass-border) !important;
        border-radius: 6px !important;
        color: var(--text-muted) !important;
      }
      .sidebar-btn.active, .nav-item.active {
        background: rgba(16, 185, 129, 0.1) !important;
        border-color: var(--primary) !important;
        color: var(--primary) !important;
      }
      .dashboard-grid, .grid, .repeater-grid, .audit-grid, .forms-grid, .panel-grid {
        grid-template-columns: 1fr !important;
      }
    }

  
    /* Force Solid Black and Clean Tech Green theme & Zoom Typography */
    :root {
      --bg-color: #000000 !important;
      --bg: #000000 !important;
      --panel-bg: rgba(12, 12, 12, 0.95) !important;
      --primary: #10b981 !important;
      --accent: #10b981 !important;
      --success: #10b981 !important;
      --primary-rgb: 16, 185, 129 !important;
      --success-rgb: 16, 185, 129 !important;
    }
    body {
      background-color: #000000 !important;
      background-image: none !important;
      color: #f3f4f6 !important;
      font-size: 20px !important;
    }
    p, li, td, th, form label {
      font-size: 1.1rem !important;
      line-height: 1.6 !important;
    }
    .subtitle, .patch-label, .shield-badge, .badge, .stat-label, .diff-badge, span {
      font-size: 0.95rem !important;
    }
    pre, code, textarea {
      font-size: 0.95rem !important;
    }
    a {
      color: #10b981 !important;
    }
    /* Stop red/blue/purple glows and replace accent buttons with green theme */
    .btn-primary, .button-primary, button[type="submit"], input[type="submit"] {
      background: #10b981 !important;
      color: #000000 !important;
      border-color: #10b981 !important;
    }
    .btn-primary:hover, .button-primary:hover, button[type="submit"]:hover, input[type="submit"]:hover {
      background: #059669 !important;
      border-color: #059669 !important;
    }

  

/* Make the left panel (stages panel) look like a sidebar */
main > .panel:first-child {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  padding: 0 !important;
  gap: 0.5rem !important;
}
/* Hide the stages-header and desc-box in sidebar mode */
main > .panel:first-child > .stages-header {
  display: none !important;
}
main > .panel:first-child > .desc-box {
  display: none !important;
}
/* Make input/button/output fields inside left panel hidden (we show them via desc-box in workspace) */
main > .panel:first-child > .field-group,
main > .panel:first-child > .btn {
  display: none !important;
}
/* Transform stages-grid from horizontal to vertical */
.stages-grid {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  grid-template-columns: unset !important;
}
/* Make stage-cards look like nav-items */
.stage-card {
  text-align: left !important;
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 0.75rem 1rem !important;
  border-radius: 8px !important;
  border: 1px solid transparent !important;
  background: transparent !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
}
.stage-card:hover {
  background: rgba(255,255,255,0.03) !important;
  transform: none !important;
}
.stage-card.active {
  background: rgba(16, 185, 129, 0.08) !important;
  border-color: rgba(16, 185, 129, 0.2) !important;
}
.stage-card .stage-num {
  display: none !important;
}
.stage-card .stage-name {
  font-size: 0.9rem !important;
  color: var(--text-muted) !important;
  font-weight: 600 !important;
}
.stage-card.active .stage-name {
  color: var(--primary) !important;
}
.stage-card .stage-status {
  font-size: 0.65rem !important;
  margin-top: 0 !important;
  margin-left: auto !important;
}
/* Make the right panel (logger) look like workspace */
main > .panel:last-child,
main > .panel.logger-panel,
main > .logger-panel {
  background: var(--panel-bg) !important;
  border: 1px solid var(--glass-border) !important;
  border-radius: 12px !important;
  padding: 2rem !important;
  backdrop-filter: blur(20px) !important;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important;
  min-height: 500px !important;
}

/* === HEADER BRANDING FIX === */
header {
  padding: 1.5rem 2rem !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 10 !important;
}
.brand {
  gap: 12px !important;
}
.brand-icon {
  width: 36px !important;
  height: 36px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-weight: bold !important;
  color: #030712 !important;
  font-size: 0.8rem !important;
  border-radius: 8px !important;
}
/* Shield button styling to match reference */
.shield-btn {
  padding: 6px 16px !important;
  border-radius: 30px !important;
  font-size: 0.75rem !important;
  font-weight: 800 !important;
  letter-spacing: 1px !important;
}

/* Responsive: on small screens, make sidebar collapse */
@media (max-width: 1024px) {
  main {
    grid-template-columns: 1fr !important;
  }
  main > .panel:first-child {
    background: rgba(255, 255, 255, 0.03) !important;
    border: 1px solid var(--glass-border) !important;
    border-radius: 8px !important;
    padding: 0.5rem !important;
  }
  .stages-grid {
    display: none !important;
  }
  main > .panel:first-child.active-stages .stages-grid {
    display: flex !important;
  }
  main > .panel:first-child::before {
    content: "☰ Menu (Select Lab Stage)" !important;
    display: block !important;
    padding: 0.75rem 1rem !important;
    font-weight: bold !important;
    color: var(--primary) !important;
    text-align: center !important;
    cursor: pointer !important;
  }
}







/* === UNIFIED SIDEBAR LAYOUT (matches a01-idor) === */
.hm-converted-container {
  max-width: 95%;
  margin: 2rem auto;
  padding: 0 1rem;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  flex-grow: 1;
  width: 100%;
}
.hm-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.hm-sidebar .nav-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hm-sidebar .nav-item {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  color: var(--text-muted, #9ca3af);
  font-weight: 600;
  font-size: 0.9rem;
}
.hm-sidebar .nav-item:hover {
  background: rgba(255,255,255,0.03);
  color: var(--text, #f3f4f6);
}
.hm-sidebar .nav-item.active {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: var(--primary, #10b981);
}
.hm-sidebar .nav-item .solve-tag {
  margin-left: auto;
  font-size: 0.6rem;
  font-family: var(--font-mono, monospace);
  text-transform: uppercase;
  font-weight: 700;
}
.hm-sidebar .nav-item .solve-tag.solved { color: var(--success, #10b981); }
.hm-sidebar .nav-item .solve-tag.unsolved { color: #f87171; }
.hm-workspace {
  background: var(--panel-bg, rgba(12, 12, 12, 0.95));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 2rem;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  min-height: 500px;
}
/* Patch control (reference style) */
.hm-patch-control {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  padding: 6px 16px;
  border-radius: 30px;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}
.hm-patch-label {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text-muted, #9ca3af);
}
.hm-shield-badge {
  font-size: 0.7rem;
  font-weight: 900;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.hm-shield-vulnerable {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.hm-shield-secure {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success, #10b981);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.hm-patch-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}
.hm-patch-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.hm-patch-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #374151;
  transition: .3s;
  border-radius: 34px;
}
.hm-patch-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: #fff;
  transition: .3s;
  border-radius: 50%;
}
.hm-patch-switch input:checked + .hm-patch-slider {
  background-color: var(--success, #10b981);
}
.hm-patch-switch input:checked + .hm-patch-slider:before {
  transform: translateX(22px);
}

/* Header fixes */
header {
  padding: 1.5rem 2rem !important;
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08)) !important;
  backdrop-filter: blur(20px) !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 10 !important;
}
.brand {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}
.brand-icon {
  width: 36px !important;
  height: 36px !important;
  background: linear-gradient(135deg, var(--primary, #10b981), var(--accent, #10b981)) !important;
  border-radius: 8px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-weight: bold !important;
  color: #030712 !important;
  font-size: 0.8rem !important;
  box-shadow: none !important;
}
.brand-title {
  font-size: 20px !important;
  font-weight: 700 !important;
  background: linear-gradient(to right, var(--primary, #10b981), #fff) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
}

/* Hide old layout elements that get replaced by JS */
body.hm-converted main,
body.hm-converted > .container { display: none !important; }
/* But show the new container */
body.hm-converted .hm-converted-container { display: grid !important; }

/* Hide old shield buttons when converted */
body.hm-converted .shield-btn { display: none !important; }
body.hm-converted header > .shield-btn { display: none !important; }

/* Responsive: sidebar collapses on small screens */
@media (max-width: 1024px) {
  .hm-converted-container {
    grid-template-columns: 1fr !important;
    margin: 1rem auto !important;
  }
  .hm-sidebar {
    position: relative !important;
    background: rgba(255, 255, 255, 0.03) !important;
    border: 1px solid var(--glass-border, rgba(255,255,255,0.08)) !important;
    border-radius: 8px !important;
    cursor: pointer !important;
  }
  .hm-sidebar::before {
    content: "\2630  Menu (Select Lab Stage)" !important;
    display: block !important;
    padding: 0.75rem 1rem !important;
    font-weight: bold !important;
    color: var(--primary, #10b981) !important;
    text-align: center !important;
  }
  .hm-sidebar .nav-list {
    display: none !important;
  }
  .hm-sidebar.active-menu .nav-list {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    background: #000000 !important;
    position: absolute !important;
    top: 100% !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 1000 !important;
    border: 1px solid var(--glass-border, rgba(255,255,255,0.08)) !important;
    border-radius: 8px !important;
    padding: 0.5rem !important;
    gap: 6px !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9) !important;
  }
}
</style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="brand-icon"></div>
      Log Poisoning Laboratory
    </div>
    <div id="shieldBtn" class="shield-btn">
      REMEDIATION SHIELD: OFF
    </div>
  </header>

  <main>
    <div class="panel">
      <div class="stages-header">
        <h3>Vulnerability Stage Controller</h3>
      </div>

      <div class="stages-grid">
        <div class="stage-card active" onclick="selectStage(1)">
          <div class="stage-num">STAGE 01</div>
          <div class="stage-name">LFI & UA Poison</div>
          <div class="stage-status unsolved" id="status-1">UNSOLVED</div>
        </div>
        <div class="stage-card" onclick="selectStage(2)">
          <div class="stage-num">STAGE 02</div>
          <div class="stage-name">Referer Bypass</div>
          <div class="stage-status unsolved" id="status-2">UNSOLVED</div>
        </div>
        <div class="stage-card" onclick="selectStage(3)">
          <div class="stage-num">STAGE 03</div>
          <div class="stage-name">Session Poison</div>
          <div class="stage-status unsolved" id="status-3">UNSOLVED</div>
        </div>
        <div class="stage-card" onclick="selectStage(4)">
          <div class="stage-num">STAGE 04</div>
          <div class="stage-name">Filter Chain</div>
          <div class="stage-status unsolved" id="status-4">UNSOLVED</div>
        </div>
      </div>

      <div class="desc-box">
        <div class="desc-title" id="stageTitle">Stage 1: User-Agent Log Poisoning</div>
        <div class="desc-body" id="stageDesc">
          Standard user-agent connection logging. The server appends incoming connection signatures straight to <code>logs/access.log</code>. Poison the log file by sending PHP code inside the User-Agent header, then trigger Local File Inclusion to run commands.
        </div>
      </div>

      <div class="field-group">
        <label>Exploit Workspace & Trigger Endpoint</label>
        <input type="text" id="targetUrl" readonly value="">
      </div>

      <div class="field-group">
        <label>Submit Exploit LFI File Path</label>
        <input type="text" id="lfiPath" placeholder="e.g. logs/access.log">
      </div>

      <button class="btn" onclick="executeLfi()">Launch LFI Intrusion</button>

      <div class="field-group" style="margin-top: 1rem;">
        <label>Intrusion Console Output</label>
        <textarea id="consoleOutput" rows="6" readonly placeholder="Waiting for interaction..."></textarea>
      </div>
    </div>

    <div class="panel logger-panel">
      <div class="logger-header">
        <h3>HTTP Transaction Logger</h3>
        <button class="btn" style="padding: 0.25rem 0.75rem; font-size: 0.7rem;" onclick="clearLogs()">Clear History</button>
      </div>

      <div class="logger-terminal" id="terminal">
        <!-- Logs populated dynamically -->
      </div>
    </div>
  </main>

  <script>
    let currentStage = 1;
    let securityMode = 'vulnerable';

    const stageDetails = {
      1: {
        title: "Stage 1: User-Agent Log Poisoning & LFI",
        desc: "Standard user-agent connection logging. The server appends incoming connection signatures straight to <code>logs/access.log</code>. Poison the log file by sending PHP code inside the User-Agent header, then trigger Local File Inclusion to run commands.",
        defaultLfi: "logs/access.log"
      },
      2: {
        title: "Stage 2: Referer Poisoning Bypass",
        desc: "The server now sanitizes or HTML-escapes the User-Agent connection parameter. However, the system logs the <code>Referer</code> parameter entirely raw! Exploit by injecting PHP payload into the Referer header.",
        defaultLfi: "logs/access_stage2.log"
      },
      3: {
        title: "Stage 3: PHP Session File Poisoning",
        desc: "Both connection parameters (User-Agent, Referer) are sanitized. The system utilizes session management. Session variables are stored inside files on disk at <code>logs/sess_[session_id]</code>. Poison the session variables, then use LFI to execute the session file.",
        defaultLfi: "logs/sess_your_session_id"
      },
      4: {
        title: "Stage 4: PHP Filter Chain RCE",
        desc: "All standard log files and inputs are escaped/sanitized. Direct path traversal LFI is blocked. Bypass the LFI restrictions by constructing a PHP Base64 Filter Chain (<code>php://filter/convert.base64-decode/resource=...</code>) to decode payloads.",
        defaultLfi: "php://filter/convert.base64-decode/resource=flag4.txt"
      }
    };

    function selectStage(num) {
      currentStage = num;
      document.querySelectorAll('.stage-card').forEach((card, idx) => {
        card.classList.toggle('active', idx === num - 1);
      });
      document.getElementById('stageTitle').innerText = stageDetails[num].title;
      document.getElementById('stageDesc').innerHTML = stageDetails[num].desc;
      document.getElementById('lfiPath').value = stageDetails[num].defaultLfi;
      updateTargetUrl();
    }

    function updateTargetUrl() {
      document.getElementById('targetUrl').value = `${window.location.origin}/index.php?stage=${currentStage}`;
    }

    async function checkSecurityMode() {
      try {
        const res = await fetch('/api/settings/security-mode');
        const data = await res.json();
        securityMode = data.securityMode;
        const btn = document.getElementById('shieldBtn');
        if (securityMode === 'secure') {
          btn.classList.add('secure');
          btn.innerText = 'REMEDIATION SHIELD: ON';
        } else {
          btn.classList.remove('secure');
          btn.innerText = 'REMEDIATION SHIELD: OFF';
        }
      } catch (err) {}
    }

    document.getElementById('shieldBtn').onclick = async () => {
      const targetMode = securityMode === 'secure' ? 'vulnerable' : 'secure';
      await fetch('/api/settings/security-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: targetMode })
      });
      checkSecurityMode();
    };

    async function executeLfi() {
      const path = document.getElementById('lfiPath').value;
      const consoleOut = document.getElementById('consoleOutput');
      consoleOut.value = "Executing Local File Inclusion request...\n";
      
      try {
        const url = `/index.php?stage=${currentStage}&file=${encodeURIComponent(path)}`;
        const res = await fetch(url);
        const text = await res.text();
        consoleOut.value = text;

        // Auto-detect solves based on flag pattern
        if (text.includes("FLAG{")) {
          const match = text.match(/FLAG\{([a-zA-Z0-9_-]+)\}/);
          if (match) {
            localStorage.setItem(`stage_log_injection_${currentStage}_solved`, 'true');
            updateSolvedBadges();
          }
        }
      } catch (err) {
        consoleOut.value = `Intrusion Failed: ${err.message}`;
      }
    }

    function updateSolvedBadges() {
      for (let i = 1; i <= 4; i++) {
        const solved = localStorage.getItem(`stage_log_injection_${i}_solved`) === 'true';
        const badge = document.getElementById(`status-${i}`);
        if (solved) {
          badge.innerText = "SOLVED";
          badge.className = "stage-status solved";
        } else {
          badge.innerText = "UNSOLVED";
          badge.className = "stage-status unsolved";
        }
      }
    }

    async function fetchLogs() {
      try {
        const res = await fetch('/api/logs');
        const data = await res.json();
        const term = document.getElementById('terminal');
        term.innerHTML = '';
        data.logs.forEach(log => {
          const item = document.createElement('div');
          item.className = 'log-item';
          const isErr = log.statusCode >= 400;
          item.innerHTML = `
            <span class="log-method">[${log.method}]</span>
            <span class="log-path">${log.path}</span>
            <span class="log-status ${isErr ? 'err' : ''}">${log.statusCode}</span>
          `;
          term.appendChild(item);
        });
      } catch (err) {}
    }

    async function clearLogs() {
      await fetch('/api/logs/clear', { method: 'POST' });
      fetchLogs();
    }

    // Startup
    updateTargetUrl();
    checkSecurityMode();
    updateSolvedBadges();
    selectStage(1);
    fetchLogs();
    setInterval(fetchLogs, 3000);
  </script>

  <!-- Interactive Mobile Navigation Toggle -->
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const aside = document.querySelector('aside');
      if (aside) {
        aside.addEventListener('click', (e) => {
          if (window.innerWidth <= 1024) {
            aside.classList.toggle('active-menu');
          }
        });
      }
    });
  </script>










<script>
(function() {
  'use strict';

  // ── 1. Fix branding ──
  var brandIcon = document.querySelector('.brand-icon');
  if (brandIcon && !brandIcon.textContent.trim()) brandIcon.textContent = 'HM';

  var brand = document.querySelector('.brand');
  if (brand && !brand.querySelector('.brand-title')) {
    Array.from(brand.childNodes).forEach(function(n) {
      if (n.nodeType === 3 && n.textContent.trim()) n.textContent = '';
    });
    var titleEl = document.createElement('div');
    titleEl.className = 'brand-title';
    titleEl.textContent = 'HackMeIfYouCan Portal';
    titleEl.style.cssText = 'font-size:20px;font-weight:700;background:linear-gradient(to right,var(--primary,#10b981),#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;';
    brand.appendChild(titleEl);
  }

  if (brand) {
    brand.style.cursor = 'pointer';
    var dashboardUrl = window.location.port && window.location.port !== '80' && window.location.port !== '443'
      ? 'http://' + window.location.hostname + ':3000'
      : '/';
    brand.addEventListener('click', function() {
      window.location.href = dashboardUrl;
    });
  }

  // ── 2. Detect layout type ──
  var nativeAside = document.querySelector('aside');
  var stageCards = document.querySelectorAll('.stage-card');
  var stageBtns = document.querySelectorAll('.stage-btn');
  var stages = stageCards.length > 0 ? stageCards : stageBtns;
  var hasNativeSidebar = nativeAside && nativeAside.querySelector('.nav-list');

  if (!hasNativeSidebar && stages.length === 0) return; // single-card lab, skip

  // ── 3. Replace shield button with checkbox toggle ──
  var oldShield = document.getElementById('shieldBtn') || document.querySelector('.shield-btn');
  var headerEl = document.querySelector('header');
  
  // Check if header already has proper patch-control with checkbox
  var existingPatch = headerEl ? headerEl.querySelector('.patch-control') : null;
  var existingCheckbox = existingPatch ? existingPatch.querySelector('input[type="checkbox"]') : null;
  
  if (headerEl && !existingCheckbox) {
    var patchControl = document.createElement('div');
    patchControl.className = 'hm-patch-control';
    patchControl.innerHTML = '<div class="hm-patch-label">REMEDIATION SHIELD</div>' +
      '<div id="hm-shield-indicator" class="hm-shield-badge hm-shield-vulnerable">VULNERABLE</div>' +
      '<label class="hm-patch-switch"><input type="checkbox" id="hm-security-checkbox"><span class="hm-patch-slider"></span></label>';

    if (oldShield && oldShield.parentNode) {
      oldShield.parentNode.replaceChild(patchControl, oldShield);
    } else if (existingPatch) {
      existingPatch.parentNode.replaceChild(patchControl, existingPatch);
    } else {
      headerEl.appendChild(patchControl);
    }

    var hmCheckbox = document.getElementById('hm-security-checkbox');
    var hmIndicator = document.getElementById('hm-shield-indicator');

    function hmSyncShield() {
      fetch('/api/settings/security-mode')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.securityMode === 'secure') {
            hmCheckbox.checked = true;
            hmIndicator.textContent = 'SECURE';
            hmIndicator.className = 'hm-shield-badge hm-shield-secure';
          } else {
            hmCheckbox.checked = false;
            hmIndicator.textContent = 'VULNERABLE';
            hmIndicator.className = 'hm-shield-badge hm-shield-vulnerable';
          }
        }).catch(function(){});
    }

    hmCheckbox.addEventListener('change', function() {
      var mode = hmCheckbox.checked ? 'secure' : 'vulnerable';
      fetch('/api/settings/security-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode })
      }).then(function() { hmSyncShield(); }).catch(function(){});
    });

    hmSyncShield();
  } else if (existingCheckbox) {
    // Existing patch control with checkbox — just hide old shield-btn if separate
    if (oldShield && oldShield !== existingPatch) oldShield.style.display = 'none';
    // Hide extra elements in header (badges etc) — keep only brand + patch
    var headerChildren = headerEl.children;
    for (var i = 0; i < headerChildren.length; i++) {
      var child = headerChildren[i];
      if (!child.classList.contains('brand') && !child.classList.contains('patch-control') &&
          !child.classList.contains('hm-patch-control') && !child.querySelector('.patch-control')) {
        // Hide extra divs that wrap badge + patch-control
        if (child.querySelector('.patch-control')) continue;
        if (child.classList.contains('badge')) child.style.display = 'none';
      }
    }
  }

  // ── 4. Build unified sidebar ──
  var sidebar = document.createElement('aside');
  sidebar.className = 'hm-sidebar';
  var navList = document.createElement('ul');
  navList.className = 'nav-list';

  if (hasNativeSidebar) {
    // NATIVE: Convert existing nav-items
    var existingNavItems = nativeAside.querySelectorAll('.nav-item');
    existingNavItems.forEach(function(item, idx) {
      var li = document.createElement('li');
      li.className = 'nav-item' + (item.classList.contains('active') ? ' active' : '');
      li.setAttribute('data-stage-idx', idx);
      li.textContent = item.textContent.trim();
      li.addEventListener('click', function() {
        navList.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
        li.classList.add('active');
        item.click(); // trigger original
        if (window.innerWidth <= 1024) sidebar.classList.remove('active-menu');
      });
      navList.appendChild(li);
    });
  } else {
    // CONVERTED: Build from stage-cards/buttons
    stages.forEach(function(stage, idx) {
      var li = document.createElement('li');
      li.className = 'nav-item' + (stage.classList.contains('active') ? ' active' : '');
      li.setAttribute('data-stage-idx', idx);
      var nameEl = stage.querySelector('.stage-name') || stage.querySelector('span:first-child');
      var statusEl = stage.querySelector('.stage-status') || stage.querySelector('.stage-badge');
      var name = nameEl ? nameEl.textContent.trim() : ('Stage ' + (idx + 1));
      var statusText = statusEl ? statusEl.textContent.trim() : 'UNSOLVED';
      var isSolved = statusText.toUpperCase() === 'SOLVED';
      li.innerHTML = name + '<span class="solve-tag ' + (isSolved ? 'solved' : 'unsolved') + '">' + statusText + '</span>';
      li.addEventListener('click', function() {
        navList.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
        li.classList.add('active');
        stage.click();
        if (window.innerWidth <= 1024) sidebar.classList.remove('active-menu');
      });
      navList.appendChild(li);
    });
  }

  sidebar.appendChild(navList);
  sidebar.addEventListener('click', function(e) {
    if (window.innerWidth <= 1024 && e.target === sidebar) {
      sidebar.classList.toggle('active-menu');
    }
  });

  // ── 5. Build workspace ──
  var workspace = document.createElement('div');
  workspace.className = 'hm-workspace';

  if (hasNativeSidebar) {
    // NATIVE: move the existing workspace/main content
    var existingWorkspace = document.querySelector('.workspace') || document.querySelector('main');
    if (existingWorkspace) {
      // Clone all children into new workspace
      while (existingWorkspace.firstChild) {
        workspace.appendChild(existingWorkspace.firstChild);
      }
    }
  } else {
    // CONVERTED: gather panels
    var mainEl = document.querySelector('main');
    var containerEl = mainEl || document.querySelector('.container');
    if (containerEl) {
      var panels = containerEl.querySelectorAll('.panel, .logger-panel');
      panels.forEach(function(panel) {
        var clone = panel.cloneNode(true);
        var sg = clone.querySelector('.stages-grid');
        if (sg) sg.remove();
        var sh = clone.querySelector('.stages-header');
        if (sh) sh.remove();
        var ss = clone.querySelector('.stage-selector');
        if (ss) ss.remove();
        workspace.appendChild(clone);
      });
      if (workspace.children.length === 0) {
        Array.from(containerEl.children).forEach(function(child) {
          if (child.tagName !== 'HEADER') workspace.appendChild(child.cloneNode(true));
        });
      }
    }
  }

  // ── 6. Insert new layout ──
  var newContainer = document.createElement('div');
  newContainer.className = 'hm-converted-container';
  newContainer.appendChild(sidebar);
  newContainer.appendChild(workspace);

  document.body.classList.add('hm-converted');

  if (headerEl && headerEl.nextSibling) {
    headerEl.parentNode.insertBefore(newContainer, headerEl.nextSibling);
  } else {
    document.body.appendChild(newContainer);
  }

  // ── 7. Observer for solve status sync ──
  if (!hasNativeSidebar && stages.length > 0) {
    var observer = new MutationObserver(function() {
      stages.forEach(function(stage, idx) {
        var statusEl = stage.querySelector('.stage-status') || stage.querySelector('.stage-badge');
        if (statusEl) {
          var navItem = navList.querySelector('[data-stage-idx="' + idx + '"]');
          if (navItem) {
            var tag = navItem.querySelector('.solve-tag');
            if (tag) {
              var txt = statusEl.textContent.trim();
              tag.textContent = txt;
              tag.className = 'solve-tag ' + (txt.toUpperCase() === 'SOLVED' ? 'solved' : 'unsolved');
            }
          }
        }
      });
    });
    stages.forEach(function(stage) {
      observer.observe(stage, { attributes: true, childList: true, subtree: true });
    });
  }
})();
</script>

</body>

</html>
