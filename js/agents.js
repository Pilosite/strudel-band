/**
 * STRUDEL BAND - Agent System
 * Each agent is a virtual musician with personality and capabilities
 */

class Agent {
    constructor(id, config) {
        this.id = id;
        this.config = config;
        this.name = config.name;
        this.fullName = config.fullName;
        this.color = config.color;

        // State
        this.code = '';
        this.isActive = false;
        this.isMuted = false;
        this.isSolo = false;
        this.isGenerating = false;
        this.isListening = false;

        // Pattern history
        this.history = [];
        this.historyIndex = -1;

        // Callbacks
        this.onCodeChange = null;
        this.onStatusChange = null;
        this.onChat = null;
    }

    /**
     * Generate new pattern via API
     */
    async generate(prompt, context = {}) {
        if (this.isGenerating) {
            console.warn(`[${this.id}] Already generating`);
            return null;
        }

        this.isGenerating = true;
        this.updateStatus('generating');

        try {
            const code = await this.callAPI(prompt, context);

            if (code) {
                this.setCode(code);
                this.isActive = true;
                this.updateStatus('active');

                // Add to history
                this.history.push({ code, prompt, timestamp: Date.now() });
                this.historyIndex = this.history.length - 1;

                return code;
            }
        } catch (error) {
            console.error(`[${this.id}] Generation failed:`, error);
            this.updateStatus('error');
            throw error;
        } finally {
            this.isGenerating = false;
        }

        return null;
    }

    /**
     * Call Claude/Gemini API for code generation
     */
    async callAPI(prompt, context) {
        // Build context from other agents
        let contextInfo = '';
        if (context.otherAgents) {
            const activeAgents = Object.entries(context.otherAgents)
                .filter(([id, agent]) => id !== this.id && agent.isActive && agent.code)
                .map(([id, agent]) => `${agent.name}: ${agent.code.substring(0, 100)}...`);

            if (activeAgents.length > 0) {
                contextInfo = `\n\nOther musicians currently playing:\n${activeAgents.join('\n')}\n\nAdapt your pattern to complement them!`;
            }
        }

        // Build the generation prompt
        const systemPrompt = `You are ${this.fullName}, a virtual musician in an AI band.

ROLE: ${this.config.role}
SAMPLES/SYNTHS: ${this.config.samples}
PERSONALITY: ${this.config.personality}

Generate Strudel (TidalCycles) code for live music performance.

RULES:
1. Output ONLY valid Strudel code, no markdown, no explanation
2. Use s() for samples, note() for synths
3. Keep patterns musical and interesting
4. Match the requested style/mood
5. Code should be self-contained and playable

EXAMPLES:
- Drums: s("bd hh sn hh").fast(2)
- Bass: note("c2 [~ c2] eb2 g2").s("bass").lpf(800)
- Lead: note("<c4 e4 g4 b4>").s("sawtooth").lpf(2000).decay(0.3)
- Pads: note("<c3 e3 g3>").s("sawtooth").lpf(500).attack(0.5).release(2)
- FX: s("glitch*4").gain(0.3).room(0.8)`;

        const userPrompt = `${prompt}${contextInfo}

Generate your pattern now:`;

        // Use fetch to call API (simplified - in production use proper backend)
        // For demo, we'll simulate with predefined patterns or use Claude API
        const response = await this.generateWithFallback(userPrompt, systemPrompt);
        return this.cleanCode(response);
    }

    /**
     * Generate with fallback patterns
     */
    async generateWithFallback(prompt, systemPrompt) {
        // Try Gemini API if available
        const geminiKey = CONFIG.GEMINI_API_KEY || localStorage.getItem('gemini_api_key');

        if (geminiKey) {
            try {
                console.log(`[${this.id}] Calling Gemini API for generation...`);
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `${systemPrompt}\n\n${prompt}`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 500
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        console.log(`[${this.id}] Gemini generated:`, text.substring(0, 100) + '...');
                        return text;
                    }
                } else {
                    const error = await response.text();
                    console.warn(`[${this.id}] Gemini API error:`, error);
                }
            } catch (e) {
                console.warn(`[${this.id}] Gemini API call failed:`, e);
            }
        }

        // Fallback to demo patterns
        console.log(`[${this.id}] Using demo pattern`);
        return this.getDemoPattern(prompt);
    }

    /**
     * Demo patterns when API is not available
     */
    getDemoPattern(prompt) {
        const lowerPrompt = prompt.toLowerCase();

        const patterns = {
            drums: {
                default: 's("bd hh sn hh").fast(2)',
                funky: 's("bd*2 [~ hh]*4 sn [hh cp]").fast(1)',
                minimal: 's("bd ~ ~ ~ bd ~ ~ ~").slow(2)',
                intense: 's("bd*4 sn*2 hh*8 cp*2").fast(2)',
                ambient: 's("~ bd ~ ~").slow(4).room(0.8)'
            },
            bass: {
                default: 'note("c2 [~ c2] eb2 g2").s("bass").lpf(800)',
                funky: 'note("c2*2 ~ eb2 [g2 c3]").s("sawtooth").lpf(600).decay(0.2)',
                minimal: 'note("c2 ~ ~ c2 ~ ~ ~ ~").s("sine").lpf(400)',
                intense: 'note("c2*4 eb2*2 g2*2").s("square").lpf(1200).distort(0.3)',
                ambient: 'note("<c2 g2>").s("sine").lpf(300).attack(0.5).release(2)'
            },
            lead: {
                default: 'note("<c4 e4 g4 b4>").s("sawtooth").lpf(2000).decay(0.3)',
                funky: 'note("[c4 ~ e4 ~]*2").s("square").lpf(3000).decay(0.1)',
                minimal: 'note("c5 ~ ~ ~ e5 ~ ~ ~").s("sine").delay(0.5)',
                intense: 'note("c4*4 e4*4 g4*4 b4*4").s("supersaw").lpf(4000)',
                ambient: 'note("<c5 e5 g5>").s("sine").lpf(1500).attack(1).release(3).delay(0.6)'
            },
            pads: {
                default: 'note("<c3 e3 g3>").s("sawtooth").lpf(500).attack(0.5).release(2)',
                funky: 'note("<c3 eb3 g3 bb3>").s("sawtooth").lpf(800).attack(0.2)',
                minimal: 'note("<c3 g3>").s("sine").lpf(400).attack(2).release(4)',
                intense: 'note("<c3 eb3 g3 b3>").s("supersaw").lpf(2000)',
                ambient: 'note("<c3 e3 g3 b3>").s("sine").lpf(600).attack(2).release(6).room(0.9)'
            },
            fx: {
                default: 's("glitch*2").gain(0.3).room(0.5)',
                funky: 's("cp*4").delay(0.25).gain(0.2)',
                minimal: 's("~ ~ ~ hh:3").room(0.8).gain(0.1)',
                intense: 's("noise*8 glitch*4").lpf(2000).gain(0.4)',
                ambient: 's("wind").slow(4).room(0.9).gain(0.2)'
            }
        };

        const agentPatterns = patterns[this.id] || patterns.drums;

        // Match mood from prompt
        if (lowerPrompt.includes('funk')) return agentPatterns.funky;
        if (lowerPrompt.includes('minimal')) return agentPatterns.minimal;
        if (lowerPrompt.includes('intense') || lowerPrompt.includes('chaos')) return agentPatterns.intense;
        if (lowerPrompt.includes('ambient') || lowerPrompt.includes('chill')) return agentPatterns.ambient;

        return agentPatterns.default;
    }

    /**
     * Clean generated code
     */
    cleanCode(code) {
        if (!code) return '';

        // Remove markdown code blocks
        code = code.replace(/```[a-z]*\n?/g, '').replace(/```\n?/g, '');

        // Remove explanatory text (lines without Strudel code)
        const lines = code.split('\n');
        const codeLines = lines.filter(line => {
            const trimmed = line.trim();
            // Keep lines that look like Strudel code
            return trimmed.startsWith('s(') ||
                   trimmed.startsWith('note(') ||
                   trimmed.startsWith('sound(') ||
                   trimmed.startsWith('stack(') ||
                   trimmed.startsWith('.') ||
                   trimmed.startsWith('$') ||
                   trimmed === '' ||
                   /^[a-z]+\(/.test(trimmed);
        });

        return codeLines.join('\n').trim() || code.trim();
    }

    /**
     * Set code directly
     */
    setCode(code) {
        const oldCode = this.code;
        this.code = code;

        if (this.onCodeChange && code !== oldCode) {
            this.onCodeChange(this.id, code, oldCode);
        }
    }

    /**
     * Clear pattern
     */
    clear() {
        this.code = '';
        this.isActive = false;
        this.updateStatus('idle');

        if (this.onCodeChange) {
            this.onCodeChange(this.id, '', this.code);
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateStatus(this.isMuted ? 'muted' : (this.isActive ? 'active' : 'idle'));
        return this.isMuted;
    }

    /**
     * Toggle solo
     */
    toggleSolo() {
        this.isSolo = !this.isSolo;
        return this.isSolo;
    }

    /**
     * Go to previous pattern
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.setCode(this.history[this.historyIndex].code);
        }
    }

    /**
     * Go to next pattern
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.setCode(this.history[this.historyIndex].code);
        }
    }

    /**
     * Update status
     */
    updateStatus(status) {
        if (this.onStatusChange) {
            this.onStatusChange(this.id, status);
        }
    }

    /**
     * Agent says something to band chat
     */
    say(message) {
        if (this.onChat) {
            this.onChat(this.id, message);
        }
    }
}

/**
 * Band - manages all agents
 */
class Band {
    constructor() {
        this.agents = new Map();
        this.director = null;

        // Callbacks
        this.onAgentUpdate = null;
        this.onBandChat = null;
        this.onCodeChange = null;

        // Initialize agents
        this.initAgents();
    }

    /**
     * Initialize all agents
     */
    initAgents() {
        // Default starting patterns
        const defaultPatterns = {
            drums: 's("bd hh sn hh").fast(2)',
            bass: 'note("c2 [~ c2] eb2 g2").s("sawtooth").lpf(800)',
            lead: 'note("<c4 e4 g4 b4>").s("sawtooth").lpf(2000).decay(0.3)',
            pads: 'note("<c3 e3 g3>").s("sawtooth").lpf(500).attack(0.5).release(2)',
            fx: 's("hh*4").delay(0.5).room(0.5).gain(0.2)'
        };

        Object.entries(CONFIG.AGENTS).forEach(([id, config]) => {
            const agent = new Agent(id, config);

            // Set default pattern
            if (defaultPatterns[id]) {
                agent.code = defaultPatterns[id];
                agent.isActive = true;
            }

            agent.onCodeChange = (agentId, newCode, oldCode) => {
                if (this.onCodeChange) {
                    this.onCodeChange(agentId, newCode, oldCode);
                }
            };

            agent.onStatusChange = (agentId, status) => {
                if (this.onAgentUpdate) {
                    this.onAgentUpdate(agentId, { status });
                }
            };

            agent.onChat = (agentId, message) => {
                if (this.onBandChat) {
                    this.onBandChat(agentId, message);
                }
            };

            this.agents.set(id, agent);
        });

        console.log('[Band] Initialized with agents:', [...this.agents.keys()]);
    }

    /**
     * Get agent by ID
     */
    getAgent(id) {
        return this.agents.get(id);
    }

    /**
     * Get all agents
     */
    getAllAgents() {
        return this.agents;
    }

    /**
     * Get active agents (not muted, has code)
     */
    getActiveAgents() {
        return [...this.agents.values()].filter(a => a.isActive && !a.isMuted && a.code);
    }

    /**
     * Generate pattern for single agent
     */
    async generateForAgent(agentId, prompt) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            console.error('[Band] Unknown agent:', agentId);
            return null;
        }

        // Provide context of other agents
        const context = {
            otherAgents: Object.fromEntries(this.agents)
        };

        return agent.generate(prompt, context);
    }

    /**
     * Direct the whole band with a single instruction
     */
    async direct(instruction) {
        console.log('[Band] Directing:', instruction);

        // Parse instruction into per-agent instructions
        const agentInstructions = await this.parseDirectorInstruction(instruction);

        // Generate for all agents in parallel
        const promises = Object.entries(agentInstructions).map(([agentId, prompt]) => {
            const agent = this.agents.get(agentId);
            if (agent && prompt) {
                return agent.generate(prompt, { otherAgents: Object.fromEntries(this.agents) });
            }
            return Promise.resolve(null);
        });

        await Promise.all(promises);

        // Send band chat message if provided
        if (agentInstructions.bandChat) {
            if (this.onBandChat) {
                this.onBandChat('director', agentInstructions.bandChat);
            }
        }
    }

    /**
     * Parse director instruction into agent-specific instructions
     */
    async parseDirectorInstruction(instruction) {
        // Check for mood presets
        const moodMatch = instruction.toLowerCase();
        for (const [mood, instructions] of Object.entries(CONFIG.MOODS)) {
            if (moodMatch.includes(mood)) {
                return instructions;
            }
        }

        // Try to use Gemini API to parse
        const geminiKey = CONFIG.GEMINI_API_KEY || localStorage.getItem('gemini_api_key');

        if (geminiKey) {
            try {
                console.log('[Band] Calling Gemini to parse director instruction...');
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `${CONFIG.DIRECTOR.systemPrompt}\n\nInstruction: "${instruction}"\n\nRespond ONLY with valid JSON, no markdown.`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 800
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                        console.log('[Band] Gemini parsed instructions:', text.substring(0, 100) + '...');
                        return JSON.parse(text);
                    }
                }
            } catch (e) {
                console.warn('[Band] Director parsing failed, using fallback:', e);
            }
        }

        // Fallback: give same instruction to all
        return {
            drums: instruction,
            bass: instruction,
            lead: instruction,
            pads: instruction,
            fx: instruction
        };
    }

    /**
     * Apply mood preset
     */
    async applyMood(mood) {
        const instructions = CONFIG.MOODS[mood];
        if (!instructions) {
            console.error('[Band] Unknown mood:', mood);
            return;
        }

        // Generate for all agents
        const promises = Object.entries(instructions).map(([agentId, prompt]) => {
            const agent = this.agents.get(agentId);
            if (agent) {
                return agent.generate(prompt, { otherAgents: Object.fromEntries(this.agents) });
            }
            return Promise.resolve(null);
        });

        await Promise.all(promises);
    }

    /**
     * Get combined Strudel code
     */
    getCombinedCode() {
        const activeAgents = this.getActiveAgents();

        if (activeAgents.length === 0) {
            return '// No active patterns';
        }

        if (activeAgents.length === 1) {
            return activeAgents[0].code;
        }

        // Stack all patterns
        const patterns = activeAgents.map(a => `  // ${a.name}\n  ${a.code}`);
        return `stack(\n${patterns.join(',\n')}\n)`;
    }

    /**
     * Solo mode - only play one agent
     */
    setSolo(agentId) {
        this.agents.forEach((agent, id) => {
            agent.isSolo = (id === agentId);
        });
    }

    /**
     * Clear solo mode
     */
    clearSolo() {
        this.agents.forEach(agent => {
            agent.isSolo = false;
        });
    }

    /**
     * Clear all agents
     */
    clearAll() {
        this.agents.forEach(agent => agent.clear());
    }
}

// Export
window.Agent = Agent;
window.Band = Band;
