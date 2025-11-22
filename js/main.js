/**
 * STRUDEL BAND - Main Application
 * Connects all modules together
 */

class App {
    constructor() {
        // Core modules
        this.ui = new UI();
        this.band = new Band();
        this.strudelEngine = new StrudelEngine();
        this.audioCapture = new AudioCapture();
        this.geminiManager = null;

        // State
        this.isListening = false;
        this.isPlaying = false;

        // Make app globally accessible
        window.app = this;
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('[App] Initializing Strudel Band...');

        // Initialize UI
        this.ui.init();

        // Initialize Strudel
        await this.strudelEngine.init();

        // Initialize audio capture
        await this.audioCapture.init();

        // Setup callbacks
        this.setupCallbacks();

        // Setup event listeners
        this.setupEventListeners();

        // Check for API key
        this.checkAPIKey();

        console.log('[App] Initialization complete!');
        this.ui.addChatMessage('system', 'Strudel Band ready. Let\'s jam!');
    }

    /**
     * Setup module callbacks
     */
    setupCallbacks() {
        // Band callbacks
        this.band.onCodeChange = (agentId, newCode, oldCode) => {
            this.ui.updateAgentCode(agentId, newCode);
            this.updateLiveCode();

            // Auto-play if we're in playing mode
            if (this.isPlaying) {
                this.play();
            }
        };

        this.band.onAgentUpdate = (agentId, update) => {
            if (update.status) {
                this.ui.updateAgentStatus(agentId, update.status);
            }
        };

        this.band.onBandChat = (agentId, message) => {
            this.ui.addChatMessage(agentId, message);

            // Show floating bubble for agent messages
            if (agentId !== 'system' && agentId !== 'director') {
                this.ui.showBubble(agentId, message);
            }
        };

        // Strudel callbacks
        this.strudelEngine.onPlay = (code) => {
            this.isPlaying = true;
            this.ui.updateTransport(true);
        };

        this.strudelEngine.onStop = () => {
            this.isPlaying = false;
            this.ui.updateTransport(false);
        };

        this.strudelEngine.onError = (error) => {
            this.ui.addChatMessage('system', `Error: ${error.message}`);
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Transport controls
        document.getElementById('btnPlay')?.addEventListener('click', () => this.play());
        document.getElementById('btnStop')?.addEventListener('click', () => this.stop());
        document.getElementById('btnListen')?.addEventListener('click', () => this.toggleListening());

        // Director
        document.getElementById('btnDirect')?.addEventListener('click', () => this.directBand());
        document.getElementById('directorPrompt')?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.directBand();
            }
        });

        // Presets
        document.querySelectorAll('.preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const mood = btn.dataset.mood;
                this.applyMood(mood);
            });
        });

        // Agent generate buttons
        document.querySelectorAll('.gen-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const agentId = btn.dataset.agent;
                this.generateForAgent(agentId);
            });
        });

        // Agent prompts (Enter to generate)
        ['drums', 'bass', 'lead', 'pads', 'fx'].forEach(agentId => {
            const input = document.getElementById(`${agentId}-prompt`);
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.generateForAgent(agentId);
                }
            });
        });

        // Mute/Solo buttons
        document.querySelectorAll('.ctrl-btn.mute').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const agentId = e.target.closest('.agent').dataset.agent;
                this.toggleMute(agentId);
            });
        });

        document.querySelectorAll('.ctrl-btn.solo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const agentId = e.target.closest('.agent').dataset.agent;
                this.toggleSolo(agentId);
            });
        });

        // Custom events from UI
        document.addEventListener('strudel:play', () => this.play());
        document.addEventListener('strudel:stop', () => this.stop());
        document.addEventListener('strudel:toggle', () => this.toggle());

        // Settings modal
        document.getElementById('btnSettings')?.addEventListener('click', () => this.openSettings());
        document.getElementById('btnCloseSettings')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('btnSaveSettings')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btnClearKeys')?.addEventListener('click', () => this.clearKeys());

        // Close modal on overlay click
        document.getElementById('settingsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') this.closeSettings();
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSettings();
        });
    }

    /**
     * Check for API key in URL or prompt
     */
    checkAPIKey() {
        // Check URL params
        const params = new URLSearchParams(window.location.search);
        const apiKey = params.get('apiKey') || params.get('key');

        if (apiKey) {
            window.ANTHROPIC_API_KEY = apiKey;
            this.ui.updateConnectionStatus('online');
            console.log('[App] API key found in URL');
        } else {
            // Check localStorage
            const storedKey = localStorage.getItem('anthropic_api_key');
            if (storedKey) {
                window.ANTHROPIC_API_KEY = storedKey;
                this.ui.updateConnectionStatus('online');
            } else {
                this.ui.addChatMessage('system',
                    'No API key found. Using demo patterns. Add ?key=YOUR_KEY to URL for full AI generation.');
            }
        }

        // Also check for Gemini key
        const geminiKey = params.get('geminiKey') || localStorage.getItem('gemini_api_key');
        if (geminiKey) {
            CONFIG.GEMINI_API_KEY = geminiKey;
            this.geminiManager = new GeminiAgentManager(geminiKey);
            this.geminiManager.init();
        }
    }

    /**
     * Play the current combined pattern
     */
    play() {
        const code = this.band.getCombinedCode();
        this.strudelEngine.play(code);
        this.updateLiveCode();
    }

    /**
     * Stop all sound
     */
    stop() {
        this.strudelEngine.stop();
    }

    /**
     * Toggle play/stop
     */
    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    /**
     * Update live code display
     */
    updateLiveCode() {
        const code = this.band.getCombinedCode();
        this.ui.updateLiveCode(code);
    }

    /**
     * Direct the whole band
     */
    async directBand() {
        const prompt = document.getElementById('directorPrompt')?.value.trim();
        if (!prompt) {
            this.ui.addChatMessage('system', 'Enter an instruction for the band!');
            return;
        }

        this.ui.showLoading('Directing the band...');
        this.ui.addChatMessage('director', prompt);

        try {
            await this.band.direct(prompt);
            this.updateLiveCode();

            // Auto-play after directing
            setTimeout(() => this.play(), 500);
        } catch (error) {
            console.error('[App] Direction failed:', error);
            this.ui.addChatMessage('system', `Error: ${error.message}`);
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Apply mood preset
     */
    async applyMood(mood) {
        this.ui.showLoading(`Applying ${mood} mood...`);
        this.ui.addChatMessage('director', `Let's go ${mood}!`);

        try {
            await this.band.applyMood(mood);
            this.updateLiveCode();

            // Auto-play
            setTimeout(() => this.play(), 500);
        } catch (error) {
            console.error('[App] Mood failed:', error);
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Generate pattern for single agent
     */
    async generateForAgent(agentId) {
        const input = document.getElementById(`${agentId}-prompt`);
        const prompt = input?.value.trim();

        if (!prompt) {
            this.ui.addChatMessage('system', `Enter a prompt for ${agentId.toUpperCase()}`);
            return;
        }

        this.ui.updateAgentStatus(agentId, 'generating');

        try {
            await this.band.generateForAgent(agentId, prompt);
            this.updateLiveCode();

            // Auto-play if we're playing
            if (this.isPlaying) {
                this.play();
            }

            // Agent says something
            const agent = this.band.getAgent(agentId);
            const sayings = [
                "Got it!",
                "Here we go!",
                "Let's groove!",
                "Check this out!",
                "Alright!",
                "New pattern coming up!"
            ];
            agent?.say(sayings[Math.floor(Math.random() * sayings.length)]);

        } catch (error) {
            console.error(`[App] Generate failed for ${agentId}:`, error);
            this.ui.updateAgentStatus(agentId, 'error');
        }
    }

    /**
     * Toggle mute for agent
     */
    toggleMute(agentId) {
        const agent = this.band.getAgent(agentId);
        if (agent) {
            const isMuted = agent.toggleMute();
            this.ui.updateMuteState(agentId, isMuted);
            this.updateLiveCode();

            if (this.isPlaying) {
                this.play();
            }

            if (isMuted) {
                agent.say("Taking a break...");
            } else {
                agent.say("I'm back!");
            }
        }
    }

    /**
     * Toggle solo for agent
     */
    toggleSolo(agentId) {
        const agent = this.band.getAgent(agentId);
        if (!agent) return;

        // Clear all solos first
        this.band.getAllAgents().forEach((a, id) => {
            if (id !== agentId) {
                a.isSolo = false;
                this.ui.updateSoloState(id, false);
            }
        });

        // Toggle this agent's solo
        const isSolo = agent.toggleSolo();
        this.ui.updateSoloState(agentId, isSolo);

        if (isSolo) {
            // Mute all others
            this.band.getAllAgents().forEach((a, id) => {
                if (id !== agentId) {
                    a.isMuted = true;
                    this.ui.updateMuteState(id, true);
                }
            });
            agent.say("Solo time!");
        } else {
            // Unmute all
            this.band.getAllAgents().forEach((a, id) => {
                a.isMuted = false;
                this.ui.updateMuteState(id, false);
            });
        }

        this.updateLiveCode();
        if (this.isPlaying) {
            this.play();
        }
    }

    /**
     * Toggle listening mode (Gemini audio streaming)
     */
    async toggleListening() {
        if (!this.geminiManager) {
            this.ui.addChatMessage('system',
                'Listening mode requires Gemini API key. Add ?geminiKey=YOUR_KEY to URL.');
            return;
        }

        this.isListening = !this.isListening;
        this.ui.updateListenMode(this.isListening);

        if (this.isListening) {
            this.ui.addChatMessage('system', 'Agents are now listening to the music...');

            // Start capturing audio
            this.audioCapture.startCapture((base64Audio) => {
                this.geminiManager.sendAudioToAll(base64Audio);
            });

            // Start listening sessions for each agent
            for (const [agentId, agent] of this.band.getAllAgents()) {
                await this.geminiManager.startListening(agentId, (msg) => {
                    // Handle agent response to audio
                    this.handleAgentAudioResponse(agentId, msg);
                });
            }
        } else {
            this.ui.addChatMessage('system', 'Agents stopped listening.');
            this.audioCapture.stopCapture();
            this.geminiManager.stopAll();
        }
    }

    /**
     * Handle agent's response to audio input
     */
    handleAgentAudioResponse(agentId, response) {
        if (response.type === 'text' && response.content) {
            // Add to chat
            this.ui.addChatMessage(agentId, response.content);

            // Show bubble
            this.ui.showBubble(agentId, response.content);

            // If agent suggests a change, we could auto-generate
            // For now, just show the message
        }
    }

    /**
     * Set tempo
     */
    setTempo(bpm) {
        this.strudelEngine.setTempo(bpm);
        const tempoDisplay = document.getElementById('tempoValue');
        if (tempoDisplay) {
            tempoDisplay.textContent = bpm;
        }
    }

    /**
     * Open settings modal
     */
    openSettings() {
        const modal = document.getElementById('settingsModal');
        const anthropicInput = document.getElementById('anthropicKey');
        const geminiInput = document.getElementById('geminiKey');
        const tempoInput = document.getElementById('tempoSetting');

        // Load current values
        if (anthropicInput) {
            anthropicInput.value = localStorage.getItem('anthropic_api_key') || '';
        }
        if (geminiInput) {
            geminiInput.value = localStorage.getItem('gemini_api_key') || '';
        }
        if (tempoInput) {
            tempoInput.value = this.strudelEngine.tempo || 120;
        }

        modal?.classList.add('active');
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        document.getElementById('settingsModal')?.classList.remove('active');
    }

    /**
     * Save settings
     */
    saveSettings() {
        const anthropicKey = document.getElementById('anthropicKey')?.value.trim();
        const geminiKey = document.getElementById('geminiKey')?.value.trim();
        const tempo = parseInt(document.getElementById('tempoSetting')?.value) || 120;

        // Save Anthropic key
        if (anthropicKey) {
            localStorage.setItem('anthropic_api_key', anthropicKey);
            window.ANTHROPIC_API_KEY = anthropicKey;
            this.ui.updateConnectionStatus('online');
            this.ui.addChatMessage('system', 'Anthropic API key saved!');
        }

        // Save Gemini key
        if (geminiKey) {
            localStorage.setItem('gemini_api_key', geminiKey);
            CONFIG.GEMINI_API_KEY = geminiKey;

            // Initialize Gemini manager if not already
            if (!this.geminiManager) {
                this.geminiManager = new GeminiAgentManager(geminiKey);
                this.geminiManager.init();
            }
            this.ui.addChatMessage('system', 'Gemini API key saved! Listening mode enabled.');
        }

        // Save tempo
        this.setTempo(tempo);

        this.closeSettings();
    }

    /**
     * Clear all stored keys
     */
    clearKeys() {
        localStorage.removeItem('anthropic_api_key');
        localStorage.removeItem('gemini_api_key');
        window.ANTHROPIC_API_KEY = '';
        CONFIG.GEMINI_API_KEY = '';

        document.getElementById('anthropicKey').value = '';
        document.getElementById('geminiKey').value = '';

        this.ui.updateConnectionStatus('offline');
        this.ui.addChatMessage('system', 'API keys cleared.');
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stop();
        this.audioCapture.destroy();
        this.ui.destroy();
        if (this.geminiManager) {
            this.geminiManager.stopAll();
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init().catch(console.error);
});

// Export
window.App = App;
