/**
 * STRUDEL BAND - Agent System
 * Each agent is a virtual musician with personality and capabilities
 */

/**
 * MusicalContext - Global musical state for the band
 */
class MusicalContext {
    constructor() {
        this.key = 'c';
        this.scale = 'minor';
        this.bpm = 120;
        this.tension = 0.5;  // 0 = calm, 1 = intense
        this.section = 'verse';  // intro, verse, chorus, bridge, outro
        this.progression = [];
        this.currentChordIndex = 0;
        this.barsSinceChange = 0;
    }

    setKey(key, scale = 'minor') {
        this.key = key.toLowerCase();
        this.scale = scale;
        this.generateProgression();
    }

    setBPM(bpm) {
        this.bpm = Math.max(60, Math.min(200, bpm));
    }

    setTension(value) {
        this.tension = Math.max(0, Math.min(1, value));
    }

    setSection(section) {
        this.section = section;
        this.barsSinceChange = 0;
    }

    generateProgression() {
        const progressions = {
            major: [
                ['I', 'IV', 'V', 'I'],
                ['I', 'vi', 'IV', 'V'],
                ['I', 'V', 'vi', 'IV'],
                ['ii', 'V', 'I', 'vi']
            ],
            minor: [
                ['i', 'iv', 'VII', 'III'],
                ['i', 'VI', 'III', 'VII'],
                ['i', 'iv', 'v', 'i'],
                ['i', 'VII', 'VI', 'VII']
            ],
            dorian: [
                ['i', 'IV', 'VII', 'i'],
                ['i', 'ii', 'IV', 'VII']
            ],
            mixolydian: [
                ['I', 'VII', 'IV', 'I'],
                ['I', 'IV', 'VII', 'IV']
            ]
        };

        const scaleProgressions = progressions[this.scale] || progressions.minor;
        this.progression = scaleProgressions[Math.floor(Math.random() * scaleProgressions.length)];
        this.currentChordIndex = 0;
    }

    getCurrentChord() {
        return this.progression[this.currentChordIndex] || 'i';
    }

    advanceChord() {
        this.currentChordIndex = (this.currentChordIndex + 1) % this.progression.length;
        this.barsSinceChange++;
    }

    getNotesForScale() {
        const scaleNotes = {
            'c': { major: ['c', 'd', 'e', 'f', 'g', 'a', 'b'], minor: ['c', 'd', 'eb', 'f', 'g', 'ab', 'bb'] },
            'd': { major: ['d', 'e', 'f#', 'g', 'a', 'b', 'c#'], minor: ['d', 'e', 'f', 'g', 'a', 'bb', 'c'] },
            'e': { major: ['e', 'f#', 'g#', 'a', 'b', 'c#', 'd#'], minor: ['e', 'f#', 'g', 'a', 'b', 'c', 'd'] },
            'f': { major: ['f', 'g', 'a', 'bb', 'c', 'd', 'e'], minor: ['f', 'g', 'ab', 'bb', 'c', 'db', 'eb'] },
            'g': { major: ['g', 'a', 'b', 'c', 'd', 'e', 'f#'], minor: ['g', 'a', 'bb', 'c', 'd', 'eb', 'f'] },
            'a': { major: ['a', 'b', 'c#', 'd', 'e', 'f#', 'g#'], minor: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
            'b': { major: ['b', 'c#', 'd#', 'e', 'f#', 'g#', 'a#'], minor: ['b', 'c#', 'd', 'e', 'f#', 'g', 'a'] }
        };
        return scaleNotes[this.key]?.[this.scale] || scaleNotes.c.minor;
    }

    getContextForPrompt() {
        return `
MUSICAL CONTEXT:
- Key: ${this.key} ${this.scale}
- Current Chord: ${this.getCurrentChord()}
- Tension: ${this.tension.toFixed(1)} (${this.tension > 0.7 ? 'HIGH - energetic!' : this.tension < 0.3 ? 'LOW - calm' : 'MEDIUM'})
- Section: ${this.section}
- BPM: ${this.bpm}
- Scale notes: ${this.getNotesForScale().join(', ')}`;
    }
}

/**
 * Pattern length preferences per role
 */
const PATTERN_LENGTH_PREFS = {
    drums: {
        lengths: [1, 2, 4],
        weights: [0.4, 0.45, 0.15],
        maxWhenTense: 2
    },
    bass: {
        lengths: [1, 2, 4, 8],
        weights: [0.2, 0.4, 0.3, 0.1],
        maxWhenTense: 4
    },
    lead: {
        lengths: [2, 4, 8, 16],
        weights: [0.2, 0.4, 0.3, 0.1],
        maxWhenTense: 4
    },
    pads: {
        lengths: [4, 8, 16],
        weights: [0.3, 0.4, 0.3],
        maxWhenTense: 8
    },
    fx: {
        lengths: [1, 2, 4],
        weights: [0.3, 0.4, 0.3],
        maxWhenTense: 2
    }
};

class Agent {
    constructor(id, config) {
        this.id = id;
        this.config = config;
        this.name = config.name;
        this.fullName = config.fullName;
        this.color = config.color;

        // State
        this.code = '';
        this.patternLength = 4;  // Default 4 bars
        this.isActive = false;
        this.isMuted = false;
        this.isSolo = false;
        this.isGenerating = false;
        this.isListening = false;

        // Pattern history for variation
        this.patternHistory = [];
        this.maxHistory = 5;

        // Legacy history for undo/redo
        this.history = [];
        this.historyIndex = -1;

        // Callbacks
        this.onCodeChange = null;
        this.onStatusChange = null;
        this.onChat = null;
    }

    /**
     * Choose pattern length based on role and context
     */
    choosePatternLength(musicalContext) {
        const prefs = PATTERN_LENGTH_PREFS[this.id] || PATTERN_LENGTH_PREFS.bass;
        let availableLengths = [...prefs.lengths];
        let weights = [...prefs.weights];

        // If high tension, prefer shorter patterns (more reactive)
        if (musicalContext && musicalContext.tension > 0.7) {
            availableLengths = availableLengths.filter(l => l <= prefs.maxWhenTense);
            weights = weights.slice(0, availableLengths.length);
        }

        // 60% chance to keep same length if recently changed
        if (musicalContext && musicalContext.barsSinceChange < 8 && this.patternLength) {
            if (Math.random() < 0.6 && availableLengths.includes(this.patternLength)) {
                return this.patternLength;
            }
        }

        // Weighted random selection
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < availableLengths.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return availableLengths[i];
            }
        }

        return availableLengths[0];
    }

    /**
     * Get pattern history for prompt (to avoid repetition)
     */
    getHistoryForPrompt() {
        if (this.patternHistory.length === 0) return '';

        const historyLines = this.patternHistory.map((h, i) =>
            `${i + 1}. [${h.length} bars] ${h.description || h.code.substring(0, 50)}...`
        ).join('\n');

        return `
⚠️ AVOID REPEATING - Your last ${this.patternHistory.length} patterns:
${historyLines}
Generate something DIFFERENT!`;
    }

    /**
     * Add to pattern history
     */
    addToHistory(code, length, description = '') {
        this.patternHistory.push({
            code,
            length,
            description,
            timestamp: Date.now()
        });

        // Keep only last N patterns
        if (this.patternHistory.length > this.maxHistory) {
            this.patternHistory.shift();
        }
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
        // Get musical context from band
        const musicalContext = context.musicalContext;
        const suggestedLength = this.choosePatternLength(musicalContext);
        this.patternLength = suggestedLength;

        // Build context from other agents
        let otherAgentsInfo = '';
        if (context.otherAgents) {
            const activeAgents = Object.entries(context.otherAgents)
                .filter(([id, agent]) => id !== this.id && agent.isActive && agent.code)
                .map(([id, agent]) => `${agent.name} (${agent.patternLength || 4} bars): ${agent.code.substring(0, 60)}...`);

            if (activeAgents.length > 0) {
                otherAgentsInfo = `\n\nOTHER MUSICIANS PLAYING:\n${activeAgents.join('\n')}\nAdapt your pattern to complement them!`;
            }
        }

        // Get musical context info
        const musicalInfo = musicalContext ? musicalContext.getContextForPrompt() : '';

        // Get history to avoid repetition
        const historyInfo = this.getHistoryForPrompt();

        // Build the generation prompt
        const systemPrompt = `You are ${this.fullName}, a virtual musician in an AI band.

ROLE: ${this.config.role}
PERSONALITY: ${this.config.personality}
${musicalInfo}

YOUR PATTERN LENGTH: ${suggestedLength} bars
${suggestedLength === 1 ? '(use .fast(4) modifier)' :
  suggestedLength === 2 ? '(use .fast(2) modifier)' :
  suggestedLength === 4 ? '(no modifier needed)' :
  suggestedLength === 8 ? '(use .slow(2) modifier)' :
  '(use .slow(4) modifier)'}

Generate Strudel (TidalCycles) code for live music performance.

CRITICAL RULES:
1. Output ONLY valid Strudel code, no markdown, no explanation, no comments
2. For SYNTHS: use note("pattern").s("synthname") - synths: sine, sawtooth, square, triangle
3. For DRUMS: use Tidal names directly: 808bd, 808sd, 808ch, 808oh, 808cp, 909bd, 909sd, etc.
4. Use stack() to layer multiple patterns: stack(kick, hihat, percussion)
5. Valid effects: .lpf(freq) .decay(time) .attack(time) .release(time) .gain(0-1) .delay(0-1) .room(0-1)
6. Mini-notation: "c4 e4 g4" (sequence), "<c4 e4>" (alternate), "[c4 e4]" (simultaneous), "c4*4" (repeat), "~" (rest)
7. Keep patterns simple and musical - USE THE SCALE NOTES PROVIDED
8. DO NOT use: .bank(), mask, stutter, slide, pan, or any undefined functions
9. Available drum sounds: 808bd, 808sd, 808ch, 808oh, 808cp, 808mt, 808ht, 808lt, 909bd, 909sd, 909ch, 909oh, 909cp

BAR LENGTH MODIFIER - VERY IMPORTANT:
- 1 bar: add .fast(4) at the end
- 2 bars: add .fast(2) at the end
- 4 bars: NO modifier (this is the default)
- 8 bars: add .slow(2) at the end
- 16 bars: add .slow(4) at the end

VARIATION RULES:
- Use DIFFERENT rhythms and note patterns each time
- Vary note durations and densities
- Try syncopation, off-beats, rests
- Use Strudel modifiers: .every(), .sometimes(), .off(), .rev()

FUNCTION REFERENCE SYNTAX - CRITICAL:
- .every(N, functionName) - functionName is NOT quoted!
- CORRECT: .every(2, rev)  .sometimes(fast(2))  .off(0.25, add(7))
- WRONG: .every(2, "rev")  .sometimes("fast(2)")  (DO NOT quote functions!)
${historyInfo}

EXAMPLES for ${suggestedLength}-bar patterns:
${this.getExamplesForLength(suggestedLength)}`;

        const userPrompt = `${prompt}${otherAgentsInfo}

Generate your ${suggestedLength}-bar pattern now:`;

        // Use fetch to call API
        const response = await this.generateWithFallback(userPrompt, systemPrompt);
        const cleanedCode = this.cleanCode(response);

        // Add to history for variation
        this.addToHistory(cleanedCode, suggestedLength, prompt.substring(0, 50));

        return cleanedCode;
    }

    /**
     * Get examples for specific pattern length
     */
    getExamplesForLength(length) {
        const examples = {
            drums: {
                1: 's("808bd 808sd 808bd 808sd").gain(0.9)',
                2: 'stack(s("808bd ~ 808sd ~").gain(0.9), s("808ch*8").gain(0.3)).fast(2)',
                4: 'stack(s("808bd ~ 808sd ~ 808bd ~ [808sd 808sd]").gain(0.9), s("808ch*16").gain(0.3))',
                8: 'stack(s("808bd ~ 808sd ~ 808bd [~ 808bd] 808sd ~").gain(0.9), s("808ch*8").gain(0.3)).slow(2)',
                16: 'stack(s("808bd ~ 808sd ~").every(4, fast(2)).gain(0.9), s("808ch*8").sometimes(fast(2)).gain(0.3)).slow(4)'
            },
            bass: {
                1: 'note("c2 eb2 g2 c3").s("sawtooth").lpf(800).fast(4).gain(0.5)',
                2: 'note("c2 ~ eb2 g2 | bb1 ~ d2 f2").s("sawtooth").lpf(800).fast(2).gain(0.5)',
                4: 'note("c2 ~ eb2 g2 bb1 ~ d2 f2").s("sawtooth").lpf(800).gain(0.5)',
                8: 'note("c2 eb2 g2 bb2 c3 bb2 g2 eb2").s("sawtooth").slow(2).lpf(800).gain(0.5)',
                16: 'note("<c2 eb2 g2 bb2>").s("sawtooth").off(0.25, add(7)).slow(4).lpf(800).gain(0.5)'
            },
            lead: {
                2: 'note("c4 d4 eb4 g4 | f4 eb4 d4 c4").s("square").lpf(2000).fast(2).gain(0.4)',
                4: 'note("c4 d4 eb4 g4 f4 eb4 d4 c4").s("square").lpf(2000).gain(0.4)',
                8: 'note("c4 d4 eb4 g4 bb4 g4 f4 eb4 d4 c4 ~ ~ ~ ~ ~ ~").s("square").slow(2).lpf(2000).gain(0.4)',
                16: 'note("<c4 eb4 g4 bb4>").s("square").off(0.125, add(12)).slow(4).lpf(2000).gain(0.4)'
            },
            pads: {
                4: 'note("<[c3,eb3,g3] [bb2,d3,f3]>").s("triangle").lpf(800).attack(0.3).release(1).gain(0.3)',
                8: 'note("<[c3,eb3,g3] [bb2,d3,f3] [ab2,c3,eb3] [g2,bb2,d3]>").s("triangle").slow(2).lpf(800).attack(0.5).release(2).gain(0.3)',
                16: 'note("<[c3,eb3,g3,bb3]>").s("triangle").slow(4).lpf(600).attack(1).release(4).room(0.5).gain(0.25)'
            },
            fx: {
                1: 'note("c5*8").s("sine").decay(0.03).fast(4).gain(0.2)',
                2: 'note("c5*4 ~ ~ ~").s("sine").decay(0.05).delay(0.5).fast(2).gain(0.2)',
                4: 'note("~ ~ ~ c5*4").s("sine").decay(0.05).delay(0.6).room(0.5).gain(0.2)'
            }
        };

        const roleExamples = examples[this.id] || examples.bass;
        return roleExamples[length] || roleExamples[4] || 'note("c3 e3 g3").s("sine").gain(0.3)';
    }

    /**
     * Generate with fallback patterns
     */
    async generateWithFallback(prompt, systemPrompt) {
        // Try Gemini API if available
        const geminiKey = CONFIG.GEMINI_API_KEY || localStorage.getItem('gemini_api_key');

        console.log(`[${this.id}] generateWithFallback called`);
        console.log(`[${this.id}] Gemini key available:`, !!geminiKey);

        if (geminiKey) {
            try {
                console.log(`[${this.id}] 🤖 Calling Gemini API...`);
                console.log(`[${this.id}] System prompt length:`, systemPrompt.length);
                console.log(`[${this.id}] User prompt:`, prompt);

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

                console.log(`[${this.id}] Gemini response status:`, response.status);

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        console.log(`[${this.id}] ✅ Gemini RAW response:`);
                        console.log(`[${this.id}] ========================`);
                        console.log(text);
                        console.log(`[${this.id}] ========================`);

                        // Show in chat UI
                        this.say(`🤖 Gemini: ${text.substring(0, 120)}${text.length > 120 ? '...' : ''}`);

                        return text;
                    } else {
                        console.warn(`[${this.id}] ⚠️ Gemini response empty or malformed:`, JSON.stringify(data).substring(0, 200));
                        this.say(`⚠️ Gemini response vide`);
                    }
                } else {
                    const error = await response.text();
                    console.error(`[${this.id}] ❌ Gemini API error (${response.status}):`, error.substring(0, 300));
                    this.say(`❌ Gemini error: ${response.status}`);
                }
            } catch (e) {
                console.error(`[${this.id}] ❌ Gemini API call failed:`, e.message);
                this.say(`❌ Gemini failed: ${e.message}`);
            }
        } else {
            console.log(`[${this.id}] ⚠️ No Gemini API key found`);
            this.say(`⚠️ Pas de clé Gemini - fallback local`);
        }

        // Fallback to demo patterns
        console.log(`[${this.id}] 📝 Using fallback demo pattern (Gemini unavailable)`);
        const fallbackPattern = this.getDemoPattern(prompt);
        this.say(`📝 Fallback: ${fallbackPattern.substring(0, 80)}...`);
        return fallbackPattern;
    }

    /**
     * Demo patterns when API is not available (using synths, no samples needed)
     */
    getDemoPattern(prompt) {
        const lowerPrompt = prompt.toLowerCase();

        const patterns = {
            drums: {
                default: 'stack(s("808bd ~ 808sd ~").gain(0.9), s("808ch*8").gain(0.3))',
                funky: 'stack(s("808bd ~ [808sd ~] [~ 808bd]").gain(0.9), s("808ch*8").gain(0.3), s("~ ~ 808cp ~").gain(0.4))',
                minimal: 'stack(s("808bd ~ ~ ~ 808sd ~ ~ ~").gain(0.7), s("808ch*4").gain(0.2))',
                intense: 'stack(s("808bd*2 ~ 808sd ~ 808bd ~ 808sd 808bd").gain(0.95), s("808ch*16").gain(0.4), s("808cp*2").gain(0.5))',
                ambient: 'stack(s("~ 808bd ~ 808sd").room(0.6).gain(0.5), s("808ch*4").room(0.5).gain(0.15))'
            },
            bass: {
                default: 'note("c2 [~ c2] eb2 g2").s("sawtooth").lpf(800).decay(0.2).gain(0.5)',
                funky: 'note("c2*2 ~ eb2 [g2 c3]").s("sawtooth").lpf(600).decay(0.15).gain(0.5)',
                minimal: 'note("c2 ~ ~ c2 ~ ~ ~ ~").s("sine").lpf(400).decay(0.3).gain(0.5)',
                intense: 'note("c2*4 eb2*2 g2*2").s("square").lpf(1200).gain(0.6)',
                ambient: 'note("<c2 g2>").s("sine").lpf(300).attack(0.5).release(2).gain(0.4)'
            },
            lead: {
                default: 'note("<c4 e4 g4 b4>").s("square").lpf(2000).decay(0.3).gain(0.4)',
                funky: 'note("[c4 ~ e4 ~]*2").s("square").lpf(3000).decay(0.1).gain(0.5)',
                minimal: 'note("c5 ~ ~ ~ e5 ~ ~ ~").s("sine").delay(0.5).gain(0.3)',
                intense: 'note("c4*4 e4*4 g4*4 b4*4").s("sawtooth").lpf(4000).gain(0.5)',
                ambient: 'note("<c5 e5 g5>").s("sine").lpf(1500).attack(1).release(3).delay(0.6).gain(0.3)'
            },
            pads: {
                default: 'note("<c3 e3 g3>").s("sawtooth").lpf(500).attack(0.5).release(2).gain(0.3)',
                funky: 'note("<c3 eb3 g3 bb3>").s("sawtooth").lpf(800).attack(0.2).gain(0.4)',
                minimal: 'note("<c3 g3>").s("sine").lpf(400).attack(2).release(4).gain(0.3)',
                intense: 'note("<c3 eb3 g3 b3>").s("sawtooth").lpf(2000).gain(0.5)',
                ambient: 'note("<c3 e3 g3 b3>").s("sine").lpf(600).attack(2).release(6).room(0.9).gain(0.25)'
            },
            fx: {
                default: 'note("c5*4").s("triangle").decay(0.05).delay(0.5).room(0.5).gain(0.2)',
                funky: 'note("c6*4").s("square").decay(0.02).delay(0.25).gain(0.2)',
                minimal: 'note("~ ~ ~ c5").s("sine").decay(0.3).room(0.8).gain(0.15)',
                intense: 'note("c5*8").s("triangle").decay(0.02).lpf(8000).gain(0.3)',
                ambient: 'note("<c6 g6>").s("sine").attack(1).release(4).room(0.9).gain(0.15)'
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
     * Clean generated code - sanitize common Gemini mistakes
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

        let cleanedCode = codeLines.join('\n').trim() || code.trim();

        // === SANITIZE COMMON GEMINI MISTAKES ===

        // Fix quoted function references: .every(2, "rev") → .every(2, rev)
        // Also handles: .sometimes("fast(2)") → .sometimes(fast(2))
        const functionNames = ['rev', 'fast', 'slow', 'ply', 'add', 'sub', 'mul', 'div', 'hurry', 'degrade', 'palindrome'];
        functionNames.forEach(fn => {
            // Match .every(N, "fn") or .every(N, "fn(args)")
            const quotedFnRegex = new RegExp(`\\.(every|sometimes|often|rarely|almostNever|almostAlways|first|last)\\s*\\(\\s*(\\d+)\\s*,\\s*["']${fn}(\\([^"']*\\))?["']\\s*\\)`, 'g');
            cleanedCode = cleanedCode.replace(quotedFnRegex, (match, method, n, args) => {
                return `.${method}(${n}, ${fn}${args || ''})`;
            });

            // Match .sometimes("fn") without number arg
            const quotedFnSimpleRegex = new RegExp(`\\.(sometimes|often|rarely)\\s*\\(\\s*["']${fn}(\\([^"']*\\))?["']\\s*\\)`, 'g');
            cleanedCode = cleanedCode.replace(quotedFnSimpleRegex, (match, method, args) => {
                return `.${method}(${fn}${args || ''})`;
            });
        });

        // Fix .every(N, "x => ...") patterns - remove quotes around arrow functions
        cleanedCode = cleanedCode.replace(/\.(every|sometimes)\s*\(\s*(\d+)\s*,\s*["']([^"']+=>[ ]*[^"']+)["']\s*\)/g, '.$1($2, $3)');

        // Remove any remaining invalid function calls that Gemini might generate
        // e.g., .mask(), .stutter() - just remove them
        cleanedCode = cleanedCode.replace(/\.(mask|stutter|slide|pan)\s*\([^)]*\)/g, '');

        // Fix double dots: ..slow() → .slow()
        cleanedCode = cleanedCode.replace(/\.\.+/g, '.');

        console.log(`[${this.id}] 🔧 Sanitized code:`, cleanedCode.substring(0, 100) + '...');

        return cleanedCode;
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

        // Musical context
        this.musicalContext = new MusicalContext();

        // Callbacks
        this.onAgentUpdate = null;
        this.onBandChat = null;
        this.onCodeChange = null;

        // Initialize agents
        this.initAgents();
    }

    // Musical context shortcuts
    setKey(key, scale) { this.musicalContext.setKey(key, scale); }
    setBPM(bpm) { this.musicalContext.setBPM(bpm); }
    setTension(value) { this.musicalContext.setTension(value); }
    setSection(section) { this.musicalContext.setSection(section); }

    /**
     * Calculate LCM (Least Common Multiple) for pattern synchronization
     */
    gcd(a, b) {
        return b === 0 ? a : this.gcd(b, a % b);
    }

    lcm(a, b) {
        return (a * b) / this.gcd(a, b);
    }

    /**
     * Calculate master loop length (LCM of all pattern lengths)
     */
    calculateMasterLoop() {
        const lengths = [...this.agents.values()]
            .filter(a => a.isActive && !a.isMuted && a.code)
            .map(a => a.patternLength || 4);

        if (lengths.length === 0) return 4;

        let result = lengths[0];
        for (let i = 1; i < lengths.length; i++) {
            result = this.lcm(result, lengths[i]);
        }

        // Limit to 32 bars max
        return Math.min(result, 32);
    }

    /**
     * Get loop visualization
     */
    getLoopVisualization() {
        const masterLength = this.calculateMasterLoop();
        const lines = [];

        lines.push(`Master Loop: ${masterLength} bars`);
        lines.push('');

        [...this.agents.values()]
            .filter(a => a.isActive && !a.isMuted && a.code)
            .forEach(agent => {
                const length = agent.patternLength || 4;
                const repetitions = masterLength / length;
                lines.push(`${agent.name}: ${length} bars (×${repetitions})`);
            });

        return lines.join('\n');
    }

    /**
     * Initialize all agents
     */
    initAgents() {
        // Default starting patterns - drums use Tidal names (808bd, 808sd, 808ch)
        const defaultPatterns = {
            drums: 'stack(s("808bd ~ 808sd ~").gain(0.9), s("808ch*8").gain(0.3))',
            bass: 'note("c2 [~ c2] eb2 g2").s("sawtooth").lpf(800).decay(0.2).gain(0.5)',
            lead: 'note("<c4 e4 g4 b4>").s("square").lpf(2000).decay(0.3).gain(0.4)',
            pads: 'note("<c3 e3 g3>").s("triangle").lpf(800).attack(0.3).release(1).gain(0.3)',
            fx: 'note("c5*4").s("sine").decay(0.05).delay(0.5).gain(0.2)'
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

        // Provide full context including musical context
        const context = {
            otherAgents: Object.fromEntries(this.agents),
            musicalContext: this.musicalContext
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
window.MusicalContext = MusicalContext;
window.PATTERN_LENGTH_PREFS = PATTERN_LENGTH_PREFS;
