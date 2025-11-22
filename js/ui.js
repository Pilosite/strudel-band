/**
 * STRUDEL BAND - UI Module
 * Handles all user interface interactions
 */

class UI {
    constructor() {
        // Elements cache
        this.elements = {};

        // Animation frame for visualizer
        this.animationFrame = null;

        // Chat message queue
        this.chatQueue = [];
    }

    /**
     * Initialize UI
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.startVisualizer();

        console.log('[UI] Initialized');
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        // Top bar
        this.elements.connectionStatus = document.getElementById('connectionStatus');
        this.elements.btnPlay = document.getElementById('btnPlay');
        this.elements.btnStop = document.getElementById('btnStop');
        this.elements.btnListen = document.getElementById('btnListen');
        this.elements.btnFullscreen = document.getElementById('btnFullscreen');
        this.elements.tempoValue = document.getElementById('tempoValue');

        // Director
        this.elements.directorPrompt = document.getElementById('directorPrompt');
        this.elements.btnDirect = document.getElementById('btnDirect');
        this.elements.presets = document.querySelectorAll('.preset');

        // Chat
        this.elements.chatMessages = document.getElementById('chatMessages');

        // Agents
        this.elements.agents = {};
        ['drums', 'bass', 'lead', 'pads', 'fx'].forEach(id => {
            this.elements.agents[id] = {
                container: document.querySelector(`.agent[data-agent="${id}"]`),
                code: document.getElementById(`${id}-code`),
                prompt: document.getElementById(`${id}-prompt`),
                status: document.getElementById(`${id}-status`),
                viz: document.getElementById(`${id}-viz`),
                genBtn: document.querySelector(`.agent[data-agent="${id}"] .gen-btn`),
                muteBtn: document.querySelector(`.agent[data-agent="${id}"] .ctrl-btn.mute`),
                soloBtn: document.querySelector(`.agent[data-agent="${id}"] .ctrl-btn.solo`)
            };
        });

        // Code panel
        this.elements.liveCode = document.getElementById('liveCode');
        this.elements.btnCopyCode = document.getElementById('btnCopyCode');
        this.elements.analyzerCanvas = document.getElementById('analyzerCanvas');
        this.elements.detectedKey = document.getElementById('detectedKey');
        this.elements.detectedEnergy = document.getElementById('detectedEnergy');

        // Loading
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
        this.elements.loadingText = document.getElementById('loadingText');

        // Bubbles
        this.elements.agentBubbles = document.getElementById('agentBubbles');
    }

    /**
     * Setup event listeners (delegated to main.js)
     */
    setupEventListeners() {
        // Fullscreen
        this.elements.btnFullscreen?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Copy code
        this.elements.btnCopyCode?.addEventListener('click', () => {
            this.copyCode();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        // Don't trigger if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // But allow Ctrl/Cmd + Enter
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                // Will be handled by main.js
                document.dispatchEvent(new CustomEvent('strudel:play'));
            }
            return;
        }

        // Space = Play/Pause
        if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            document.dispatchEvent(new CustomEvent('strudel:toggle'));
        }

        // . = Stop
        if (e.key === '.') {
            e.preventDefault();
            document.dispatchEvent(new CustomEvent('strudel:stop'));
        }

        // F = Fullscreen
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            this.toggleFullscreen();
        }

        // 1-5 = Focus agent
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
            e.preventDefault();
            const agents = ['drums', 'bass', 'lead', 'pads', 'fx'];
            const agentId = agents[parseInt(e.key) - 1];
            this.focusAgent(agentId);
        }

        // Ctrl/Cmd + D = Focus director
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            this.elements.directorPrompt?.focus();
        }
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Focus agent input
     */
    focusAgent(agentId) {
        const agent = this.elements.agents[agentId];
        if (agent?.prompt) {
            agent.prompt.focus();
        }
    }

    /**
     * Update agent status
     */
    updateAgentStatus(agentId, status) {
        const agent = this.elements.agents[agentId];
        if (!agent) return;

        // Update status text
        if (agent.status) {
            agent.status.textContent = status;
            agent.status.className = `agent-status ${status}`;
        }

        // Update container classes
        if (agent.container) {
            agent.container.classList.remove('active', 'generating', 'muted');
            if (status === 'active') agent.container.classList.add('active');
            if (status === 'generating') agent.container.classList.add('generating');
            if (status === 'muted') agent.container.classList.add('muted');
        }
    }

    /**
     * Update agent code display
     */
    updateAgentCode(agentId, code) {
        const agent = this.elements.agents[agentId];
        if (!agent?.code) return;

        agent.code.textContent = code || '// waiting for pattern...';

        // Flash animation
        agent.code.classList.add('updating');
        setTimeout(() => {
            agent.code.classList.remove('updating');
        }, CONFIG.UI.codeAnimationDuration);
    }

    /**
     * Update live code panel
     */
    updateLiveCode(code) {
        if (this.elements.liveCode) {
            this.elements.liveCode.textContent = code;
        }
    }

    /**
     * Update mute button state
     */
    updateMuteState(agentId, isMuted) {
        const agent = this.elements.agents[agentId];
        if (agent?.muteBtn) {
            agent.muteBtn.classList.toggle('active', isMuted);
        }
        if (agent?.container) {
            agent.container.classList.toggle('muted', isMuted);
        }
    }

    /**
     * Update solo button state
     */
    updateSoloState(agentId, isSolo) {
        const agent = this.elements.agents[agentId];
        if (agent?.soloBtn) {
            agent.soloBtn.classList.toggle('active', isSolo);
        }
    }

    /**
     * Update transport state
     */
    updateTransport(isPlaying) {
        this.elements.btnPlay?.classList.toggle('active', isPlaying);
        this.elements.btnStop?.classList.toggle('active', !isPlaying);
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = status;
            this.elements.connectionStatus.classList.toggle('online', status === 'online');
        }
    }

    /**
     * Update listen mode
     */
    updateListenMode(isListening) {
        this.elements.btnListen?.classList.toggle('active', isListening);
    }

    /**
     * Add chat message
     */
    addChatMessage(agentId, message) {
        if (!this.elements.chatMessages) return;

        const msgEl = document.createElement('div');
        msgEl.className = `chat-msg ${agentId}`;

        if (agentId !== 'system' && agentId !== 'director') {
            const nameEl = document.createElement('span');
            nameEl.className = 'agent-name';
            nameEl.textContent = agentId.toUpperCase() + ':';
            msgEl.appendChild(nameEl);
        }

        const textNode = document.createTextNode(
            agentId === 'director' ? `DIRECTOR: ${message}` : message
        );
        msgEl.appendChild(textNode);

        this.elements.chatMessages.appendChild(msgEl);

        // Scroll to bottom
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;

        // Limit messages
        while (this.elements.chatMessages.children.length > CONFIG.UI.chatMaxMessages) {
            this.elements.chatMessages.removeChild(this.elements.chatMessages.firstChild);
        }
    }

    /**
     * Show agent bubble (floating chat)
     */
    showBubble(agentId, message) {
        if (!this.elements.agentBubbles) return;

        const bubble = document.createElement('div');
        bubble.className = `bubble ${agentId}`;
        bubble.textContent = message;

        this.elements.agentBubbles.appendChild(bubble);

        // Remove after animation
        setTimeout(() => {
            bubble.remove();
        }, CONFIG.UI.bubbleDuration);
    }

    /**
     * Show loading overlay
     */
    showLoading(text = 'Generating...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('active');
        }
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('active');
        }
    }

    /**
     * Copy code to clipboard
     */
    async copyCode() {
        const code = this.elements.liveCode?.textContent;
        if (code) {
            try {
                await navigator.clipboard.writeText(code);
                this.showBubble('system', 'Code copied!');
            } catch (e) {
                console.error('Copy failed:', e);
            }
        }
    }

    /**
     * Start audio visualizer
     */
    startVisualizer() {
        const canvas = this.elements.analyzerCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;

        const draw = () => {
            this.animationFrame = requestAnimationFrame(draw);

            // Get analyzer data if available
            const analyzerData = window.app?.audioCapture?.getAnalyzerData();

            // Clear
            ctx.fillStyle = 'rgba(10, 10, 12, 0.3)';
            ctx.fillRect(0, 0, width, height);

            if (analyzerData) {
                // Draw frequency bars
                const barWidth = width / analyzerData.length;
                ctx.fillStyle = CONFIG.AGENTS.drums.color;

                for (let i = 0; i < analyzerData.length; i++) {
                    const barHeight = (analyzerData[i] / 255) * height;
                    const x = i * barWidth;
                    const y = height - barHeight;

                    // Gradient based on position
                    const hue = (i / analyzerData.length) * 60 + 120; // Green to yellow
                    ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
                    ctx.fillRect(x, y, barWidth - 1, barHeight);
                }

                // Update energy display
                const features = window.app?.audioCapture?.analyzeFeatures();
                if (features && this.elements.detectedEnergy) {
                    const energy = Math.round(features.energy * 100);
                    this.elements.detectedEnergy.textContent = `Energy: ${energy}%`;
                }
            } else {
                // Draw placeholder
                ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
                const centerY = height / 2;
                const amplitude = Math.sin(Date.now() / 500) * 10 + 15;

                ctx.beginPath();
                ctx.moveTo(0, centerY);
                for (let x = 0; x < width; x++) {
                    const y = centerY + Math.sin(x / 20 + Date.now() / 300) * amplitude;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        };

        draw();
    }

    /**
     * Stop visualizer
     */
    stopVisualizer() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopVisualizer();
    }
}

// Export
window.UI = UI;
