/**
 * STRUDEL BAND - Debug Console
 * Captures console logs for easy sharing
 */

(function() {
    // Store logs
    window.DEBUG_LOGS = [];
    const MAX_LOGS = 200;

    // Save original console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Helper to format log arguments
    function formatArgs(args) {
        return Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    // Helper to add log entry
    function addLog(type, args) {
        const entry = {
            type: type,
            time: new Date().toISOString().split('T')[1].split('.')[0],
            message: formatArgs(args)
        };

        window.DEBUG_LOGS.push(entry);

        // Trim if too many
        if (window.DEBUG_LOGS.length > MAX_LOGS) {
            window.DEBUG_LOGS.shift();
        }

        // Update UI if panel exists
        updateDebugPanel(entry);
    }

    // Override console.log
    console.log = function(...args) {
        addLog('log', args);
        originalLog.apply(console, args);
    };

    // Override console.warn
    console.warn = function(...args) {
        addLog('warn', args);
        originalWarn.apply(console, args);
    };

    // Override console.error
    console.error = function(...args) {
        addLog('error', args);
        originalError.apply(console, args);
    };

    // Capture uncaught errors
    window.addEventListener('error', function(e) {
        addLog('error', [`Uncaught: ${e.message} at ${e.filename}:${e.lineno}`]);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', function(e) {
        addLog('error', [`Unhandled Promise: ${e.reason}`]);
    });

    // Update debug panel UI
    function updateDebugPanel(entry) {
        const logsContainer = document.getElementById('debugLogs');
        if (!logsContainer) return;

        const logEl = document.createElement('div');
        logEl.className = `debug-log ${entry.type}`;
        logEl.textContent = `[${entry.time}] ${entry.message}`;
        logsContainer.appendChild(logEl);

        // Auto-scroll to bottom
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    // Global function to get logs as text
    window.getDebugLogs = function() {
        return window.DEBUG_LOGS.map(log =>
            `[${log.time}] [${log.type.toUpperCase()}] ${log.message}`
        ).join('\n');
    };

    // Global function to copy logs
    window.copyDebugLogs = async function() {
        const text = window.getDebugLogs();
        try {
            await navigator.clipboard.writeText(text);
            originalLog.call(console, '[Debug] Logs copied to clipboard!');
            return true;
        } catch (e) {
            originalError.call(console, '[Debug] Failed to copy:', e);
            return false;
        }
    };

    // Global function to clear logs
    window.clearDebugLogs = function() {
        window.DEBUG_LOGS = [];
        const logsContainer = document.getElementById('debugLogs');
        if (logsContainer) {
            logsContainer.innerHTML = '';
        }
        originalLog.call(console, '[Debug] Logs cleared');
    };

    // Setup debug panel when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        const debugPanel = document.getElementById('debugPanel');
        const btnDebug = document.getElementById('btnDebug');
        const btnCopyLogs = document.getElementById('btnCopyLogs');
        const btnClearLogs = document.getElementById('btnClearLogs');
        const btnCloseDebug = document.getElementById('btnCloseDebug');

        // Toggle debug panel
        if (btnDebug) {
            btnDebug.addEventListener('click', function() {
                debugPanel?.classList.toggle('active');
            });
        }

        // Copy logs
        if (btnCopyLogs) {
            btnCopyLogs.addEventListener('click', async function() {
                const success = await window.copyDebugLogs();
                btnCopyLogs.textContent = success ? 'Copied!' : 'Failed';
                setTimeout(() => {
                    btnCopyLogs.textContent = 'Copy';
                }, 2000);
            });
        }

        // Clear logs
        if (btnClearLogs) {
            btnClearLogs.addEventListener('click', window.clearDebugLogs);
        }

        // Close panel
        if (btnCloseDebug) {
            btnCloseDebug.addEventListener('click', function() {
                debugPanel?.classList.remove('active');
            });
        }

        // Populate existing logs
        const logsContainer = document.getElementById('debugLogs');
        if (logsContainer) {
            window.DEBUG_LOGS.forEach(entry => {
                const logEl = document.createElement('div');
                logEl.className = `debug-log ${entry.type}`;
                logEl.textContent = `[${entry.time}] ${entry.message}`;
                logsContainer.appendChild(logEl);
            });
        }
    });

    console.log('[Debug] Debug console initialized');
})();
