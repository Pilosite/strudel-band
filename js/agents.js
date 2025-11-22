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
PERSONALITY: ${this.config.personality}

Generate Strudel (TidalCycles) code for live music performance.

CRITICAL RULES:
1. Output ONLY valid Strudel code, no markdown, no explanation, no comments
2. For SYNTHS: use m("pattern").note().s("synthname") - synths: sine, sawtooth, square, triangle
3. For DRUMS: use s("bd sd ch cp").bank("RolandTR-808") - sounds: bd (kick), sd (snare), ch (closed hat), oh (open hat), cp (clap)
4. Use stack() to layer multiple patterns: stack(kick, hihat, percussion)
5. Valid effects: .lpf(freq) .decay(time) .attack(time) .release(time) .gain(0-1) .delay(0-1) .room(0-1)
6. Mini-notation: "c4 e4 g4" (sequence), "<c4 e4>" (alternate), "[c4 e4]" (simultaneous), "c4*4" (repeat), "~" (rest)
7. Keep patterns simple and musical
8. DO NOT use: note() without m(), mask, stutter, slide, pan, or any undefined functions
9. Available drum banks (WITH HYPHENS!): RolandTR-808, RolandTR-909, RolandTR-707, RolandTR-606

BAR/LOOP LENGTH (Ableton-style - each instrument can have different lengths):
- 1 bar: use .fast(4) - pattern loops 4x per cycle
- 2 bars: use .fast(2) - pattern loops 2x per cycle
- 4 bars: default, no modifier needed
- 8 bars: use .slow(2) - pattern spans 2 cycles
- 16 bars: use .slow(4) - pattern spans 4 cycles

EXAMPLES:
- Drums basic: stack(s("bd ~ sd ~").bank("RolandTR-808").gain(0.9), s("ch*8").bank("RolandTR-808").gain(0.3))
- Drums funky: stack(s("bd ~ [sd ~] [~ bd]").bank("RolandTR-808").gain(0.9), s("ch*8").bank("RolandTR-808").gain(0.3), s("~ ~ cp ~").bank("RolandTR-808").gain(0.4))
- Bass 8 bars: m("c2 eb2 g2 bb2 c3 bb2 g2 eb2").note().s("sawtooth").slow(2).lpf(800).gain(0.5)
- Lead 16-bar solo: m("c4 e4 g4 b4 c5 d5 e5 g5 a5 g5 e5 d5 c5 b4 g4 e4").note().s("square").slow(4).lpf(2000).gain(0.5)
- Pads: m("<c3 e3 g3>").note().s("triangle").lpf(500).attack(0.5).release(2).gain(0.3)
- FX: m("c5*4").note().s("sine").decay(0.05).delay(0.5).gain(0.2)`;

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
     * Demo patterns when API is not available (using synths, no samples needed)
     */
    getDemoPattern(prompt) {
        const lowerPrompt = prompt.toLowerCase();

        const patterns = {
            drums: {
                default: 'stack(s("bd ~ sd ~").bank("RolandTR-808").gain(0.9), s("ch*8").bank("RolandTR-808").gain(0.3))',
                funky: 'stack(s("bd ~ [sd ~] [~ bd]").bank("RolandTR-808").gain(0.9), s("ch*8").bank("RolandTR-808").gain(0.3), s("~ ~ cp ~").bank("RolandTR-808").gain(0.4))',
                minimal: 'stack(s("bd ~ ~ ~ sd ~ ~ ~").bank("RolandTR-808").gain(0.7), s("ch*4").bank("RolandTR-808").gain(0.2))',
                intense: 'stack(s("bd*2 ~ sd ~ bd ~ sd bd").bank("RolandTR-808").gain(0.95), s("ch*16").bank("RolandTR-808").gain(0.4), s("cp*2").bank("RolandTR-808").gain(0.5))',
                ambient: 'stack(s("~ bd ~ sd").bank("RolandTR-808").room(0.6).gain(0.5), s("ch*4").bank("RolandTR-808").room(0.5).gain(0.15))'
            },
            bass: {
                default: 'm("c2 [~ c2] eb2 g2").note().s("sawtooth").lpf(800).decay(0.2).gain(0.5)',
                funky: 'm("c2*2 ~ eb2 [g2 c3]").note().s("sawtooth").lpf(600).decay(0.15).gain(0.5)',
                minimal: 'm("c2 ~ ~ c2 ~ ~ ~ ~").note().s("sine").lpf(400).decay(0.3).gain(0.5)',
                intense: 'm("c2*4 eb2*2 g2*2").note().s("square").lpf(1200).gain(0.6)',
                ambient: 'm("<c2 g2>").note().s("sine").lpf(300).attack(0.5).release(2).gain(0.4)'
            },
            lead: {
                default: 'm("<c4 e4 g4 b4>").note().s("square").lpf(2000).decay(0.3).gain(0.4)',
                funky: 'm("[c4 ~ e4 ~]*2").note().s("square").lpf(3000).decay(0.1).gain(0.5)',
                minimal: 'm("c5 ~ ~ ~ e5 ~ ~ ~").note().s("sine").delay(0.5).gain(0.3)',
                intense: 'm("c4*4 e4*4 g4*4 b4*4").note().s("sawtooth").lpf(4000).gain(0.5)',
                ambient: 'm("<c5 e5 g5>").note().s("sine").lpf(1500).attack(1).release(3).delay(0.6).gain(0.3)'
            },
            pads: {
                default: 'm("<c3 e3 g3>").note().s("sawtooth").lpf(500).attack(0.5).release(2).gain(0.3)',
                funky: 'm("<c3 eb3 g3 bb3>").note().s("sawtooth").lpf(800).attack(0.2).gain(0.4)',
                minimal: 'm("<c3 g3>").note().s("sine").lpf(400).attack(2).release(4).gain(0.3)',
                intense: 'm("<c3 eb3 g3 b3>").note().s("sawtooth").lpf(2000).gain(0.5)',
                ambient: 'm("<c3 e3 g3 b3>").note().s("sine").lpf(600).attack(2).release(6).room(0.9).gain(0.25)'
            },
            fx: {
                default: 'm("c5*4").note().s("triangle").decay(0.05).delay(0.5).room(0.5).gain(0.2)',
                funky: 'm("c6*4").note().s("square").decay(0.02).delay(0.25).gain(0.2)',
                minimal: 'm("~ ~ ~ c5").note().s("sine").decay(0.3).room(0.8).gain(0.15)',
                intense: 'm("c5*8").note().s("triangle").decay(0.02).lpf(8000).gain(0.3)',
                ambient: 'm("<c6 g6>").note().s("sine").attack(1).release(4).room(0.9).gain(0.15)'
            }
        };

        const agentPatterns = patterns[this.id] || patterns.drums;

        // Match mood from prompt
        let pattern;
        if (lowerPrompt.includes('funk')) {
            pattern = agentPatterns.funky;
        } else if (lowerPrompt.includes('minimal')) {
            pattern = agentPatterns.minimal;
        } else if (lowerPrompt.includes('intense') || lowerPrompt.includes('chaos')) {
            pattern = agentPatterns.intense;
        } else if (lowerPrompt.includes('ambient') || lowerPrompt.includes('chill')) {
            pattern = agentPatterns.ambient;
        } else {
            pattern = agentPatterns.default;
        }

        // Detect bar length and apply .fast() or .slow() modifier
        // Ableton-style: each instrument can have different loop lengths
        // 1 bar = .fast(4), 2 bars = .fast(2), 4 bars = default, 8 bars = .slow(2), 16 bars = .slow(4)
        const barModifier = this.detectBarModifier(lowerPrompt);
        if (barModifier) {
            pattern = pattern.replace(/\.gain\(/, `${barModifier}.gain(`);
        }

        return pattern;
    }

    /**
     * Detect bar length from prompt and return the appropriate modifier
     */
    detectBarModifier(prompt) {
        // Match patterns like "1 bar", "1 mesure", "2 bars", "8 mesures", etc.
        // Also match French: "sur 8 mesures", "en 2 mesures"
        // Note: bars? and mesures? to match both singular and plural

        // 16 bars
        if (/16\s*(bars?|mesures?)/i.test(prompt) || /seize\s*(bars?|mesures?)/i.test(prompt)) {
            return '.slow(4)';
        }
        // 8 bars
        if (/8\s*(bars?|mesures?)/i.test(prompt) || /huit\s*(bars?|mesures?)/i.test(prompt)) {
            return '.slow(2)';
        }
        // 2 bars
        if (/2\s*(bars?|mesures?)/i.test(prompt) || /deux\s*(bars?|mesures?)/i.test(prompt)) {
            return '.fast(2)';
        }
        // 1 bar (check after 16, 12, etc. to avoid false matches)
        if (/(?:^|\s)1\s*(bars?|mesures?)/i.test(prompt) || /une?\s*(bars?|mesures?)/i.test(prompt)) {
            return '.fast(4)';
        }
        // 4 bars is default, no modifier needed
        if (/4\s*(bars?|mesures?)/i.test(prompt) || /quatre\s*(bars?|mesures?)/i.test(prompt)) {
            return null; // default
        }

        return null;
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
        // Default starting patterns using m() to parse mini-notation
        const defaultPatterns = {
            drums: 'stack(s("bd ~ sd ~").bank("RolandTR-808").gain(0.9), s("ch*8").bank("RolandTR-808").gain(0.3))',
            bass: 'm("c2 [~ c2] eb2 g2").note().s("sawtooth").lpf(800).decay(0.2).gain(0.5)',
            lead: 'm("<c4 e4 g4 b4>").note().s("square").lpf(2000).decay(0.3).gain(0.4)',
            pads: 'm("<c3 e3 g3>").note().s("triangle").lpf(800).attack(0.3).release(1).gain(0.3)',
            fx: 'm("c5*4").note().s("sine").decay(0.05).delay(0.5).gain(0.2)'
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

        // Fallback: detect which agent is mentioned and only modify that one
        const lower = instruction.toLowerCase();
        const result = {};

        // Detect specific agent mentions (French and English)
        const agentKeywords = {
            drums: ['drum', 'batterie', 'percussion', 'kick', 'snare', 'hihat'],
            bass: ['bass', 'basse', 'sub', 'low'],
            lead: ['lead', 'mélodie', 'melody', 'solo', 'hook'],
            pads: ['pad', 'nappe', 'atmosphere', 'ambient', 'texture'],
            fx: ['fx', 'effet', 'effect', 'glitch', 'noise', 'weird']
        };

        let foundAgent = false;
        for (const [agentId, keywords] of Object.entries(agentKeywords)) {
            if (keywords.some(kw => lower.includes(kw))) {
                result[agentId] = instruction;
                foundAgent = true;
            }
        }

        // If no specific agent found, apply to all
        if (!foundAgent) {
            return {
                drums: instruction,
                bass: instruction,
                lead: instruction,
                pads: instruction,
                fx: instruction
            };
        }

        return result;
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
