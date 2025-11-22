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
        console.log('[StrudelEngine] init() called');
        return new Promise((resolve, reject) => {
            let checkCount = 0;
            const maxChecks = 3;

            // Check what Strudel globals are available
            const checkStrudel = () => {
                checkCount++;
                console.log(`[StrudelEngine] Checking for Strudel (attempt ${checkCount}/${maxChecks})...`);

                // Log available strudel-related globals for debugging
                const strudelGlobals = Object.keys(window).filter(k =>
                    k.toLowerCase().includes('strudel') ||
                    k === 'evaluate' ||
                    k === 'hush' ||
                    k === 'repl' ||
                    k === 'strudelRepl'
                );
                if (strudelGlobals.length > 0) {
                    console.log('[StrudelEngine] Found globals:', strudelGlobals);
                }

                // Check for our custom Strudel module setup
                if (typeof window.strudelRepl !== 'undefined') {
                    console.log('[StrudelEngine] Found window.strudelRepl!');
                    this.setupStrudelFromModule();
                    resolve(true);
                } else if (typeof window.strudel !== 'undefined') {
                    console.log('[StrudelEngine] Found window.strudel!');
                    this.setupStrudelFunctions();
                    resolve(true);
                } else if (typeof window.evaluate !== 'undefined') {
                    console.log('[StrudelEngine] Found window.evaluate!');
                    this.evaluate = window.evaluate;
                    this.hush = window.hush;
                    resolve(true);
                } else if (checkCount < maxChecks) {
                    setTimeout(checkStrudel, 500);
                } else {
                    console.warn('[StrudelEngine] Strudel not found, using mock mode');
                    this.setupMockMode();
                    resolve(true);
                }
            };

            // Start checking after a short delay for script to load
            console.log('[StrudelEngine] Starting Strudel detection in 500ms...');
            setTimeout(checkStrudel, 500);
        });
    }

    /**
     * Setup Strudel from our module import
     */
    setupStrudelFromModule() {
        const repl = window.strudelRepl;

        this.evaluate = async (code) => {
            console.log('[StrudelEngine] Evaluating:', code);
            try {
                await repl.evaluate(code);
            } catch (e) {
                console.error('[StrudelEngine] Eval error:', e);
                if (this.onError) this.onError(e);
            }
        };

        this.hush = () => {
            console.log('[StrudelEngine] Hushing...');
            repl.stop();
        };

        // Get audio context for capture
        if (window.getStrudelAudioContext) {
            this.audioContext = window.getStrudelAudioContext();
        }

        console.log('[StrudelEngine] Strudel module functions ready');
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
        console.log('[StrudelEngine] play() called');
        console.log('[StrudelEngine] Input code:', code?.substring(0, 100) + '...');

        if (!code || code.trim() === '') {
            console.warn('[StrudelEngine] No code to play');
            return false;
        }

        console.log('[StrudelEngine] evaluate function available:', !!this.evaluate);
        console.log('[StrudelEngine] hush function available:', !!this.hush);

        try {
            // Clean code
            const cleanCode = this.sanitizeCode(code);
            console.log('[StrudelEngine] Sanitized code:', cleanCode?.substring(0, 100) + '...');

            // Set tempo if needed
            const codeWithTempo = this.applyTempo(cleanCode);
            console.log('[StrudelEngine] Code with tempo:', codeWithTempo);

            // Evaluate
            if (this.evaluate) {
                console.log('[StrudelEngine] Calling evaluate()...');
                this.evaluate(codeWithTempo);
                this.currentCode = codeWithTempo;
                this.isPlaying = true;

                if (this.onPlay) this.onPlay(codeWithTempo);
                if (this.onEvaluate) this.onEvaluate(codeWithTempo);

                console.log('[StrudelEngine] evaluate() completed successfully');
                return true;
            } else {
                console.error('[StrudelEngine] No evaluate function! Strudel not loaded properly');
                return false;
            }
        } catch (error) {
            console.error('[StrudelEngine] Play error:', error);
            console.error('[StrudelEngine] Error stack:', error.stack);
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
