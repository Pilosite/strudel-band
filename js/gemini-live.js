/**
 * STRUDEL BAND - Gemini Live API Integration
 * Handles real-time audio streaming to Gemini for agent listening
 */

class GeminiLive {
    constructor(apiKey) {
        console.log('[GeminiLive] Constructor called');
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
        this.sessionConfig = null;

        // Callbacks
        this.onMessage = null;
        this.onError = null;
        this.onConnect = null;
        this.onDisconnect = null;

        // Message queue for when connection is pending
        this.messageQueue = [];

        // Session state
        this.currentAgent = null;
        console.log('[GeminiLive] Instance created');
    }

    /**
     * Connect to Gemini Live API via WebSocket
     */
    async connect(agentConfig = null) {
        console.log('[GeminiLive] connect() called');

        if (this.isConnected) {
            console.log('[GeminiLive] Already connected');
            return true;
        }

        if (!this.apiKey) {
            console.error('[GeminiLive] No API key provided');
            return false;
        }

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `${CONFIG.GEMINI_WS_URL}?key=${this.apiKey}`;
                console.log('[GeminiLive] Connecting to WebSocket:', wsUrl.replace(this.apiKey, 'API_KEY_HIDDEN'));
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('[GeminiLive] WebSocket connected');
                    this.isConnected = true;

                    // Send setup message
                    this.sendSetup(agentConfig);

                    if (this.onConnect) this.onConnect();
                    resolve(true);
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    console.error('[GeminiLive] WebSocket error:', error);
                    if (this.onError) this.onError(error);
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    console.log('[GeminiLive] WebSocket closed:', event.reason);
                    this.isConnected = false;
                    if (this.onDisconnect) this.onDisconnect(event);
                };

            } catch (error) {
                console.error('[GeminiLive] Connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Send initial setup message
     */
    sendSetup(agentConfig) {
        const systemInstruction = agentConfig?.systemPrompt ||
            `You are a DJ/producer AI that listens to live music and helps create patterns.
You can hear the audio playing. When you analyze it, describe:
- Energy level (calm, building, intense)
- What you hear (drums, bass, melody, etc)
- Suggest what should happen next

Keep responses SHORT (1-2 sentences). Be musical and creative.`;

        // Gemini Live API uses camelCase
        const setup = {
            setup: {
                model: `models/${CONFIG.GEMINI_MODEL}`,
                generationConfig: {
                    responseModalities: ["TEXT"]
                },
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                }
            }
        };

        this.send(setup);
        console.log('[GeminiLive] Setup sent:', JSON.stringify(setup));
    }

    /**
     * Send audio data to Gemini
     */
    sendAudio(base64Audio) {
        if (!this.isConnected) {
            console.warn('[GeminiLive] Not connected, queuing audio');
            return;
        }

        // Gemini Live API format for realtime audio input
        const message = {
            realtimeInput: {
                mediaChunks: [{
                    data: base64Audio,
                    mimeType: "audio/pcm;rate=16000"
                }]
            }
        };

        this.send(message);
    }

    /**
     * Send text message/instruction to Gemini
     */
    sendText(text) {
        if (!this.isConnected) {
            console.warn('[GeminiLive] Not connected');
            return;
        }

        // Gemini Live API format for client content
        const message = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: text }]
                }],
                turnComplete: true
            }
        };

        this.send(message);
        console.log('[GeminiLive] Sent text:', text);
    }

    /**
     * Send raw message
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            this.messageQueue.push(data);
        }
    }

    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);

            // Check for server content (model response)
            if (message.serverContent) {
                const content = message.serverContent;

                // Check if turn is complete
                if (content.turnComplete) {
                    console.log('[GeminiLive] Turn complete');
                }

                // Extract text response
                if (content.modelTurn?.parts) {
                    for (const part of content.modelTurn.parts) {
                        if (part.text) {
                            console.log('[GeminiLive] Response:', part.text);
                            if (this.onMessage) {
                                this.onMessage({
                                    type: 'text',
                                    content: part.text,
                                    agent: this.currentAgent
                                });
                            }
                        }
                    }
                }
            }

            // Check for setup complete
            if (message.setupComplete) {
                console.log('[GeminiLive] Setup complete');
            }

        } catch (error) {
            console.error('[GeminiLive] Failed to parse message:', error);
        }
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    /**
     * Check if connected
     */
    get connected() {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }
}

/**
 * Manager for multiple Gemini sessions (one per agent)
 */
class GeminiAgentManager {
    constructor(apiKey) {
        console.log('[GeminiAgentManager] Constructor called with key:', apiKey ? apiKey.slice(0, 8) + '...' : 'none');
        this.apiKey = apiKey;
        this.sessions = new Map(); // agentId -> GeminiLive instance
        this.sharedSession = null;  // Single session that all agents share
        this.useSharedSession = true; // Use one session for all (saves resources)
    }

    /**
     * Initialize the manager
     */
    async init() {
        console.log('[GeminiAgentManager] init() called');
        console.log('[GeminiAgentManager] API key:', this.apiKey ? this.apiKey.slice(0, 8) + '...' : 'none');

        if (!this.apiKey) {
            console.warn('[GeminiAgentManager] No API key - listening mode disabled');
            return false;
        }

        if (this.useSharedSession) {
            console.log('[GeminiAgentManager] Creating shared GeminiLive session...');
            this.sharedSession = new GeminiLive(this.apiKey);
            console.log('[GeminiAgentManager] Shared session created');
            return true;
        }

        console.log('[GeminiAgentManager] Init complete (multi-session mode)');
        return true;
    }

    /**
     * Start listening session for agent
     */
    async startListening(agentId, onResponse) {
        if (!this.apiKey) {
            console.warn('[GeminiAgentManager] No API key');
            return false;
        }

        const agentConfig = CONFIG.AGENTS[agentId];
        if (!agentConfig) {
            console.error('[GeminiAgentManager] Unknown agent:', agentId);
            return false;
        }

        let session;

        if (this.useSharedSession) {
            session = this.sharedSession;
        } else {
            session = new GeminiLive(this.apiKey);
            this.sessions.set(agentId, session);
        }

        session.currentAgent = agentId;
        session.onMessage = (msg) => {
            msg.agent = agentId;
            if (onResponse) onResponse(msg);
        };

        try {
            await session.connect({
                systemPrompt: agentConfig.systemPrompt + `\n\nYou are listening to a live jam session. React musically to what you hear.`
            });
            return true;
        } catch (error) {
            console.error('[GeminiAgentManager] Failed to start listening:', error);
            return false;
        }
    }

    /**
     * Send audio to all listening agents
     */
    sendAudioToAll(base64Audio) {
        if (this.useSharedSession && this.sharedSession?.connected) {
            this.sharedSession.sendAudio(base64Audio);
        } else {
            this.sessions.forEach(session => {
                if (session.connected) {
                    session.sendAudio(base64Audio);
                }
            });
        }
    }

    /**
     * Send instruction to specific agent
     */
    sendToAgent(agentId, text) {
        if (this.useSharedSession && this.sharedSession?.connected) {
            this.sharedSession.sendText(`[${agentId.toUpperCase()}] ${text}`);
        } else {
            const session = this.sessions.get(agentId);
            if (session?.connected) {
                session.sendText(text);
            }
        }
    }

    /**
     * Stop all sessions
     */
    stopAll() {
        if (this.sharedSession) {
            this.sharedSession.disconnect();
        }

        this.sessions.forEach(session => {
            session.disconnect();
        });
        this.sessions.clear();
    }
}

// Export
window.GeminiLive = GeminiLive;
window.GeminiAgentManager = GeminiAgentManager;
