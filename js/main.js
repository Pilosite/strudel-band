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
        console.log('[App] ========== INIT START ==========');
        console.log('[App] CONFIG state at init:', {
            GEMINI_API_KEY: CONFIG.GEMINI_API_KEY ? 'set (' + CONFIG.GEMINI_API_KEY.slice(0, 8) + '...)' : 'empty',
            GEMINI_MODEL: CONFIG.GEMINI_MODEL,
            GEMINI_WS_URL: CONFIG.GEMINI_WS_URL
        });
        console.log('[App] localStorage state:', {
            gemini_api_key: localStorage.getItem('gemini_api_key') ? 'exists' : 'empty',
            gemini_model: localStorage.getItem('gemini_model') || 'not set'
        });

        // Initialize UI
        console.log('[App] Step 1: Initializing UI...');
        this.ui.init();
        console.log('[App] Step 1: UI initialized');

        // Initialize Strudel
        console.log('[App] Step 2: Initializing Strudel...');
        await this.strudelEngine.init();
        console.log('[App] Step 2: Strudel initialized');

        // Initialize audio capture
        console.log('[App] Step 3: Initializing audio capture...');
        await this.audioCapture.init();
        console.log('[App] Step 3: Audio capture initialized');

        // Setup callbacks
        console.log('[App] Step 4: Setting up callbacks...');
        this.setupCallbacks();
        console.log('[App] Step 4: Callbacks set up');

        // Setup event listeners
        console.log('[App] Step 5: Setting up event listeners...');
        this.setupEventListeners();
        console.log('[App] Step 5: Event listeners set up');

        // Check for API key
        console.log('[App] Step 6: Checking API keys...');
        this.checkAPIKey();
        console.log('[App] Step 6: API keys checked');

        // Display default patterns in UI
        console.log('[App] Step 7: Displaying default patterns in UI...');
        this.band.agents.forEach((agent, id) => {
            if (agent.code) {
                console.log(`[App] Setting UI code for ${id}:`, agent.code);
                this.ui.updateAgentCode(id, agent.code);
                this.ui.updateAgentStatus(id, 'active');
            }
        });
        this.updateLiveCode();
        console.log('[App] Step 7: Default patterns displayed');

        console.log('[App] ========== INIT COMPLETE ==========');
        this.ui.addChatMessage('system', 'Strudel Band ready. Press Play to start jamming!');
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
        const directorInput = document.getElementById('directorPrompt');
        if (directorInput) {
            directorInput.addEventListener('keydown', (e) => {
                // CTRL+Enter or CMD+Enter to submit
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    console.log('[App] CTRL+Enter detected, directing band...');
                    this.directBand();
                }
                // Also allow Shift+Enter to submit (alternative)
                if (e.shiftKey && e.key === 'Enter') {
                    e.preventDefault();
                    console.log('[App] Shift+Enter detected, directing band...');
                    this.directBand();
                }
            });
            console.log('[App] Director prompt keyboard shortcuts attached');
        }

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
     * Check for Gemini API key in URL or localStorage
     */
    checkAPIKey() {
        console.log('[App] checkAPIKey() called');

        // Check URL params
        const params = new URLSearchParams(window.location.search);
        console.log('[App] URL params:', window.location.search);

        // Check for Gemini key
        console.log('[App] Checking Gemini key...');
        const geminiKeyFromURL = params.get('geminiKey') || params.get('key');
        const geminiKeyFromStorage = localStorage.getItem('gemini_api_key');
        console.log('[App] Gemini key from URL:', geminiKeyFromURL ? 'found (' + geminiKeyFromURL.slice(0, 8) + '...)' : 'not found');
        console.log('[App] Gemini key from localStorage:', geminiKeyFromStorage ? 'found (' + geminiKeyFromStorage.slice(0, 8) + '...)' : 'not found');

        const geminiKey = geminiKeyFromURL || geminiKeyFromStorage;

        if (geminiKey) {
            console.log('[App] Using Gemini key:', geminiKey.slice(0, 8) + '...');
            this.ui.updateConnectionStatus('online');

            try {
                console.log('[App] Setting CONFIG.GEMINI_API_KEY...');
                CONFIG.GEMINI_API_KEY = geminiKey;
                console.log('[App] CONFIG.GEMINI_API_KEY set successfully');

                console.log('[App] Creating GeminiAgentManager...');
                this.geminiManager = new GeminiAgentManager(geminiKey);
                console.log('[App] GeminiAgentManager created');

                // Don't await init - let it run in background
                console.log('[App] Starting Gemini init (non-blocking)...');
                this.geminiManager.init()
                    .then(() => console.log('[App] Gemini init completed successfully'))
                    .catch(e => console.warn('[App] Gemini init failed:', e));

            } catch (e) {
                console.error('[App] Failed to create Gemini manager:', e);
                console.error('[App] Error stack:', e.stack);
            }
        } else {
            console.log('[App] No Gemini key found - AI generation will use demo patterns');
            this.ui.updateConnectionStatus('offline');
        }

        console.log('[App] checkAPIKey() completed');
    }

    /**
     * Play the current combined pattern
     */
    play() {
        console.log('[App] play() called');

        // Check band state
        console.log('[App] Band agents:', [...this.band.agents.keys()]);
        this.band.agents.forEach((agent, id) => {
            console.log(`[App] Agent ${id}:`, {
                isActive: agent.isActive,
                isMuted: agent.isMuted,
                hasCode: !!agent.code,
                codePreview: agent.code ? agent.code.substring(0, 50) + '...' : 'none'
            });
        });

        const code = this.band.getCombinedCode();
        console.log('[App] Combined code:', code);

        if (!code || code === '// No active patterns') {
            console.error('[App] No active patterns to play!');
            this.ui.addChatMessage('system', 'No patterns to play! Generate some patterns first.');
            return;
        }

        console.log('[App] Calling strudelEngine.play()...');
        const result = this.strudelEngine.play(code);
        console.log('[App] strudelEngine.play() returned:', result);

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

        // No overlay - show status in chat instead
        this.ui.addChatMessage('director', prompt);
        this.ui.addChatMessage('system', '🎼 Generating...');

        try {
            await this.band.direct(prompt);
            this.updateLiveCode();

            // Auto-play after directing
            setTimeout(() => this.play(), 500);
        } catch (error) {
            console.error('[App] Direction failed:', error);
            this.ui.addChatMessage('system', `Error: ${error.message}`);
        }
    }

    /**
     * Apply mood preset
     */
    async applyMood(mood) {
        this.ui.addChatMessage('director', `Let's go ${mood}!`);

        try {
            await this.band.applyMood(mood);
            this.updateLiveCode();

            // Auto-play
            setTimeout(() => this.play(), 500);
        } catch (error) {
            console.error('[App] Mood failed:', error);
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
            // Un-mute the solo agent, mute all others
            agent.isMuted = false;
            this.ui.updateMuteState(agentId, false);

            this.band.getAllAgents().forEach((a, id) => {
                if (id !== agentId) {
                    a.isMuted = true;
                    this.ui.updateMuteState(id, true);
                }
            });
            agent.say("🎤 Solo time!");
        } else {
            // Unmute AND reactivate all agents
            this.band.getAllAgents().forEach((a, id) => {
                a.isMuted = false;
                a.isActive = true;  // Force re-activate
                a.isSolo = false;   // Clear solo state
                this.ui.updateMuteState(id, false);
                this.ui.updateSoloState(id, false);
            });
            agent.say("Everyone's back!");
            console.log('[App] Solo ended - all agents reactivated');
        }

        this.updateLiveCode();
        if (this.isPlaying) {
            // Small delay to ensure UI updates before playing
            setTimeout(() => this.play(), 100);
        }
    }

    /**
     * Toggle listening mode (Gemini audio streaming)
     */
    async toggleListening() {
        this.isListening = !this.isListening;
        this.ui.updateListenMode(this.isListening);

        if (this.isListening) {
            this.ui.addChatMessage('system', '🎧 Agents are now listening to the music...');

            // Show each agent starting to listen
            const agentMessages = {
                drums: "J'écoute le groove... 🥁",
                bass: "Je capte les basses fréquences... 🎸",
                lead: "Je suis les mélodies... 🎹",
                pads: "J'analyse l'atmosphère... 🎛️",
                fx: "Je guette les textures... ✨"
            };

            // Each agent says hello
            for (const [agentId, agent] of this.band.getAllAgents()) {
                setTimeout(() => {
                    this.ui.addChatMessage(agentId, agentMessages[agentId] || "J'écoute...");
                }, Math.random() * 1000 + 200);
            }

            // If Gemini is available, use real audio streaming
            if (this.geminiManager) {
                // Start capturing audio
                this.audioCapture.startCapture((base64Audio) => {
                    this.geminiManager.sendAudioToAll(base64Audio);
                });

                // Start listening sessions for each agent
                for (const [agentId, agent] of this.band.getAllAgents()) {
                    await this.geminiManager.startListening(agentId, (msg) => {
                        this.handleAgentAudioResponse(agentId, msg);
                    });
                }
            } else {
                // Demo mode - simulate periodic agent responses
                this.startDemoListening();
            }
        } else {
            this.ui.addChatMessage('system', '🔇 Agents stopped listening.');
            this.stopDemoListening();

            if (this.geminiManager) {
                this.audioCapture.stopCapture();
                this.geminiManager.stopAll();
            }
        }
    }

    /**
     * Demo listening mode - agents give simulated feedback
     */
    startDemoListening() {
        const demoResponses = {
            drums: [
                "Ce groove est solide! 🔥",
                "Je sens le tempo...",
                "Les kicks claquent bien!",
                "On pourrait ajouter des fills ici"
            ],
            bass: [
                "La ligne de basse groove!",
                "Je suis en harmonie avec les drums",
                "Ces basses fréquences... 🎶",
                "On pourrait monter d'une octave?"
            ],
            lead: [
                "J'aime cette mélodie!",
                "Je pourrais ajouter des arpèges",
                "Le lead se marie bien avec les pads",
                "Prêt pour un solo? 🎹"
            ],
            pads: [
                "L'atmosphère est parfaite",
                "Ces textures sont douces...",
                "Je maintiens l'harmonie",
                "Ambiance spacieuse! 🌌"
            ],
            fx: [
                "J'ajoute des textures subtiles ✨",
                "Ces delays sonnent bien!",
                "Je sens le vibe",
                "Prêt à glitcher! 🎛️"
            ]
        };

        this.demoListenInterval = setInterval(() => {
            if (!this.isListening || !this.isPlaying) return;

            // Pick a random agent to speak
            const agents = ['drums', 'bass', 'lead', 'pads', 'fx'];
            const agentId = agents[Math.floor(Math.random() * agents.length)];
            const responses = demoResponses[agentId];
            const response = responses[Math.floor(Math.random() * responses.length)];

            this.ui.addChatMessage(agentId, response);
            this.ui.showBubble(agentId, response);
        }, 4000 + Math.random() * 3000); // Every 4-7 seconds
    }

    /**
     * Stop demo listening
     */
    stopDemoListening() {
        if (this.demoListenInterval) {
            clearInterval(this.demoListenInterval);
            this.demoListenInterval = null;
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
        console.log('[App] Opening settings modal');
        const modal = document.getElementById('settingsModal');
        const geminiInput = document.getElementById('geminiKey');
        const geminiModelSelect = document.getElementById('geminiModel');
        const tempoInput = document.getElementById('tempoSetting');

        // Load current values
        if (geminiInput) {
            geminiInput.value = localStorage.getItem('gemini_api_key') || '';
            console.log('[App] Loaded Gemini key from localStorage:', geminiInput.value ? 'exists' : 'empty');
        }
        if (geminiModelSelect) {
            geminiModelSelect.value = localStorage.getItem('gemini_model') || CONFIG.GEMINI_MODEL;
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
        console.log('[App] saveSettings called');
        const geminiKey = document.getElementById('geminiKey')?.value.trim();
        const geminiModel = document.getElementById('geminiModel')?.value;
        const tempo = parseInt(document.getElementById('tempoSetting')?.value) || 120;

        console.log('[App] Saving settings:', {
            geminiKey: geminiKey ? 'set (' + geminiKey.slice(0, 8) + '...)' : 'empty',
            geminiModel,
            tempo
        });

        // Save Gemini settings
        if (geminiKey) {
            localStorage.setItem('gemini_api_key', geminiKey);
            CONFIG.GEMINI_API_KEY = geminiKey;
            console.log('[App] Gemini key saved to localStorage and CONFIG');
            this.ui.updateConnectionStatus('online');
        }

        if (geminiModel) {
            localStorage.setItem('gemini_model', geminiModel);
            CONFIG.GEMINI_MODEL = geminiModel;
            console.log('[App] Gemini model set to:', geminiModel);
        }

        // Initialize or re-initialize Gemini manager with new settings
        if (geminiKey) {
            try {
                console.log('[App] Creating new GeminiAgentManager...');
                this.geminiManager = new GeminiAgentManager(geminiKey);
                this.geminiManager.init();
                this.ui.addChatMessage('system', `Gemini configured! Model: ${geminiModel}`);
            } catch (e) {
                console.error('[App] Failed to init Gemini:', e);
                this.ui.addChatMessage('system', `Gemini init error: ${e.message}`);
            }
        }

        // Save tempo
        this.setTempo(tempo);

        this.closeSettings();
    }

    /**
     * Clear all stored keys
     */
    clearKeys() {
        localStorage.removeItem('gemini_api_key');
        CONFIG.GEMINI_API_KEY = '';

        const geminiKeyInput = document.getElementById('geminiKey');
        if (geminiKeyInput) geminiKeyInput.value = '';

        this.ui.updateConnectionStatus('offline');
        this.ui.addChatMessage('system', 'Gemini API key cleared.');
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
