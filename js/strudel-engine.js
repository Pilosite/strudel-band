/**
 * STRUDEL BAND - Strudel Engine
 * Handles Strudel.js integration for live coding audio
 */

class StrudelEngine {
    constructor() {
        this.isPlaying = false;
        this.currentCode = '';
        this.tempo = CONFIG.STRUDEL.defaultTempo;

        // Strudel functions (will be set after embed loads)
        this.evaluate = null;
        this.hush = null;

        // Audio nodes for capture
        this.audioContext = null;
        this.masterNode = null;

        // Callbacks
        this.onPlay = null;
        this.onStop = null;
        this.onError = null;
        this.onEvaluate = null;
    }

    /**
     * Initialize Strudel engine
     */
    async init() {
        return new Promise((resolve, reject) => {
            // Wait for Strudel embed to load
            const checkStrudel = () => {
                if (typeof window.strudel !== 'undefined') {
                    this.setupStrudelFunctions();
                    resolve(true);
                } else if (typeof window.evaluate !== 'undefined') {
                    // Functions might be global
                    this.evaluate = window.evaluate;
                    this.hush = window.hush;
                    resolve(true);
                } else {
                    // Keep checking
                    setTimeout(checkStrudel, 100);
                }
            };

            // Start checking after a short delay
            setTimeout(checkStrudel, 500);

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.evaluate) {
                    console.warn('[StrudelEngine] Strudel not loaded, using mock mode');
                    this.setupMockMode();
                    resolve(true);
                }
            }, 10000);
        });
    }

    /**
     * Setup Strudel functions from embed
     */
    setupStrudelFunctions() {
        // The strudel embed exposes these globally
        this.evaluate = window.evaluate || ((code) => {
            console.log('[StrudelEngine] Would evaluate:', code);
        });

        this.hush = window.hush || (() => {
            console.log('[StrudelEngine] Would hush');
        });

        console.log('[StrudelEngine] Strudel functions ready');
    }

    /**
     * Mock mode for testing without Strudel
     */
    setupMockMode() {
        this.evaluate = (code) => {
            console.log('[StrudelEngine:Mock] Evaluate:', code);
            this.currentCode = code;
            this.isPlaying = true;
            if (this.onEvaluate) this.onEvaluate(code);
        };

        this.hush = () => {
            console.log('[StrudelEngine:Mock] Hush');
            this.isPlaying = false;
            if (this.onStop) this.onStop();
        };
    }

    /**
     * Play/evaluate code
     */
    play(code) {
        if (!code || code.trim() === '') {
            console.warn('[StrudelEngine] No code to play');
            return false;
        }

        try {
            // Clean code
            const cleanCode = this.sanitizeCode(code);

            // Set tempo if needed
            const codeWithTempo = this.applyTempo(cleanCode);

            // Evaluate
            if (this.evaluate) {
                this.evaluate(codeWithTempo);
                this.currentCode = codeWithTempo;
                this.isPlaying = true;

                if (this.onPlay) this.onPlay(codeWithTempo);
                if (this.onEvaluate) this.onEvaluate(codeWithTempo);

                console.log('[StrudelEngine] Playing:', codeWithTempo);
                return true;
            }
        } catch (error) {
            console.error('[StrudelEngine] Play error:', error);
            if (this.onError) this.onError(error);
            return false;
        }

        return false;
    }

    /**
     * Stop all sound
     */
    stop() {
        try {
            if (this.hush) {
                this.hush();
            }
            this.isPlaying = false;
            if (this.onStop) this.onStop();
            console.log('[StrudelEngine] Stopped');
        } catch (error) {
            console.error('[StrudelEngine] Stop error:', error);
        }
    }

    /**
     * Toggle play/stop
     */
    toggle(code) {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play(code);
        }
    }

    /**
     * Set tempo/BPM
     */
    setTempo(bpm) {
        this.tempo = bpm;
        // If playing, re-evaluate with new tempo
        if (this.isPlaying && this.currentCode) {
            this.play(this.currentCode);
        }
    }

    /**
     * Apply tempo to code
     */
    applyTempo(code) {
        // Check if code already has cpm/bpm
        if (code.includes('.cpm(') || code.includes('.bpm(')) {
            return code;
        }

        // Add tempo at the end
        return `${code}.cpm(${this.tempo / 2})`;
    }

    /**
     * Sanitize code for safety
     */
    sanitizeCode(code) {
        // Remove any potentially harmful code
        let clean = code;

        // Remove script tags
        clean = clean.replace(/<script[^>]*>.*?<\/script>/gi, '');

        // Remove eval calls (except our own)
        clean = clean.replace(/\beval\s*\(/g, '');

        // Remove fetch/XMLHttpRequest
        clean = clean.replace(/\bfetch\s*\(/g, '');
        clean = clean.replace(/\bXMLHttpRequest\b/g, '');

        return clean.trim();
    }

    /**
     * Validate Strudel code
     */
    validateCode(code) {
        if (!code || typeof code !== 'string') {
            return { valid: false, error: 'No code provided' };
        }

        // Check for basic Strudel patterns
        const hasPattern = /^(s|note|sound|stack|sequence|cat|fastcat|slowcat)\s*\(/.test(code.trim()) ||
                          code.includes('.s(') ||
                          code.includes('.note(');

        if (!hasPattern) {
            return { valid: false, error: 'Code does not appear to be valid Strudel' };
        }

        // Check for balanced parentheses
        let depth = 0;
        for (const char of code) {
            if (char === '(') depth++;
            if (char === ')') depth--;
            if (depth < 0) {
                return { valid: false, error: 'Unbalanced parentheses' };
            }
        }
        if (depth !== 0) {
            return { valid: false, error: 'Unbalanced parentheses' };
        }

        return { valid: true };
    }

    /**
     * Get audio context for analysis
     */
    getAudioContext() {
        return this.audioContext || (window.Tone?.context);
    }
}

// Export
window.StrudelEngine = StrudelEngine;
