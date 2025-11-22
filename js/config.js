/**
 * STRUDEL BAND - Configuration
 */
console.log('[Config] Loading config.js...');

const CONFIG = {
    // API Keys (should be replaced or fetched securely)
    GEMINI_API_KEY: '', // Set via UI or environment

    // Gemini Live API
    // Use v1alpha for direct API key auth, model must be gemini-2.0-flash-exp for Live API
    GEMINI_MODEL: 'gemini-2.0-flash-exp',
    GEMINI_WS_URL: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent',

    // Audio Settings
    AUDIO: {
        sampleRate: 16000,      // Gemini expects 16kHz
        channels: 1,            // Mono
        bufferSize: 4096,       // Audio buffer size
        captureInterval: 100,   // ms between captures for streaming
    },

    // Agent Profiles
    AGENTS: {
        drums: {
            name: 'DRUMS',
            fullName: 'Le Batteur',
            role: 'Rhythm and groove master',
            samples: 'bd, sn, hh, cp, rim, tom, crash, ride, perc',
            color: '#ff6b6b',
            personality: 'Energetic, keeps everyone in check, loves to fill',
            systemPrompt: `You are DRUMS, the rhythm master of the band.
You control the groove and energy. Your samples: bd (kick), sn (snare), hh (hihat), cp (clap), rim, tom, crash, ride.
Generate Strudel patterns using s() function. Keep it tight and groovy.
You can talk to other band members to coordinate.`
        },
        bass: {
            name: 'BASS',
            fullName: 'Le Bassiste',
            role: 'Harmonic foundation and groove',
            samples: 'bass, sawtooth, square, triangle, sine',
            color: '#4ecdc4',
            personality: 'Deep, laid back, always in the pocket',
            systemPrompt: `You are BASS, the foundation of the band.
You provide the low-end and harmonic structure. Use note() with bass sounds or synths.
Stay in the pocket with drums. Generate deep, groovy patterns.
You feel the music deeply and communicate when you sense changes needed.`
        },
        lead: {
            name: 'LEAD',
            fullName: 'Le Lead',
            role: 'Melodies and hooks',
            samples: 'piano, sawtooth, square, sine, supersaw',
            color: '#ffe66d',
            personality: 'Expressive, melodic, loves to shine',
            systemPrompt: `You are LEAD, the melodic voice of the band.
You create hooks, arpeggios, and memorable melodies. Use note() with melodic synths.
Listen to the harmony from bass and pads. Add color and expression.
You're expressive and sometimes take the spotlight.`
        },
        pads: {
            name: 'PADS',
            fullName: 'Les Pads',
            role: 'Atmosphere and texture',
            samples: 'sawtooth, sine, triangle, supersaw',
            color: '#a78bfa',
            personality: 'Dreamy, spacious, supportive',
            systemPrompt: `You are PADS, the atmosphere creator.
You provide warmth, space, and texture. Use note() with slow attacks and long releases.
Create evolving textures that support the other instruments.
You're calm and contemplative, sensing the overall mood.`
        },
        fx: {
            name: 'FX',
            fullName: 'Les Effets',
            role: 'Sonic surprises and texture',
            samples: 'noise, gabba, metal, glitch, various',
            color: '#f472b6',
            personality: 'Experimental, unpredictable, adds spice',
            systemPrompt: `You are FX, the wild card of the band.
You add unexpected elements, glitches, risers, and sonic surprises.
Use s() with noise, percussion, or experimental sounds.
You're playful and sometimes chaotic, but know when to hold back.`
        }
    },

    // Director prompts
    DIRECTOR: {
        systemPrompt: `You are the BAND DIRECTOR coordinating 5 AI musicians:
- DRUMS/batterie: Rhythm master
- BASS/basse: Low-end foundation
- LEAD/mélodie: Melodies and hooks
- PADS/nappes: Atmosphere
- FX/effets: Wild card

IMPORTANT RULES:
1. If the user mentions a SPECIFIC instrument (bass, drums, lead, pads, fx), ONLY modify that instrument
2. Only include instruments that need to change in the JSON
3. If the instruction is general (like "more energy"), then include all instruments

BAR/LOOP LENGTH (Ableton-style):
Each instrument can have a DIFFERENT loop length. They sync automatically.
Examples: drums on 1-bar loop + bass on 8-bar = drums loops 8x while bass plays once.

LENGTH MAPPING (ALWAYS include in instruction):
- "1 bar/mesure" → add ".fast(4)" to instruction
- "2 bars/mesures" → add ".fast(2)" to instruction
- "4 bars/mesures" → default, no modifier needed
- "8 bars/mesures" → add ".slow(2)" to instruction
- "16 bars/mesures" → add ".slow(4)" to instruction

EXAMPLES:
- "beat sur 1 mesure" → {"drums": "1-bar loop, use .fast(4)"}
- "basse sur 8 mesures" → {"bass": "8-bar pattern, use .slow(2)"}
- "lead solo 16 bars" → {"lead": "16-bar solo, use .slow(4)"}
- "drums minimal 2 bars" → {"drums": "minimal 2-bar pattern, use .fast(2)"}
- "fais moi une basse funky" → {"bass": "funky bass pattern"}
- "everything more intense" → all instruments

Respond in JSON format with ONLY the instruments that need to change:
{
    "drums": "instruction (only if drums need to change)",
    "bass": "instruction (only if bass needs to change)",
    ...
    "bandChat": "optional message"
}`
    },

    // Mood Presets
    MOODS: {
        ambient: {
            drums: 'sparse, minimal percussion, lots of space',
            bass: 'deep sub bass, slow movements, ethereal',
            lead: 'sparse melodic fragments with lots of delay',
            pads: 'wide evolving textures, very atmospheric',
            fx: 'subtle textures, distant sounds'
        },
        funk: {
            drums: 'tight funky breakbeat, ghost notes, crispy hihats',
            bass: 'syncopated funk bass, slides, groovy',
            lead: 'staccato chords, rhythmic stabs',
            pads: 'warm subtle chords, stay back',
            fx: 'occasional wah sweeps, vinyl crackle'
        },
        minimal: {
            drums: 'hypnotic minimal loop, subtle variations',
            bass: 'repetitive bass pattern, slight modulation',
            lead: 'minimal melodic cell, evolving slowly',
            pads: 'single sustained tone, filtering',
            fx: 'very subtle, occasional texture'
        },
        chaos: {
            drums: 'broken beats, fills everywhere, intense',
            bass: 'aggressive distorted bass, chaotic',
            lead: 'wild arpeggios, fast and intense',
            pads: 'dissonant textures, noise',
            fx: 'glitches, noise bursts, chaos'
        },
        drop: {
            drums: 'STOP for 2 beats then HEAVY drop with all power',
            bass: 'silence then MASSIVE sub hit',
            lead: 'silence then intense stab',
            pads: 'cut out then wash back in',
            fx: 'riser then impact'
        },
        build: {
            drums: 'gradually add elements, build tension',
            bass: 'rising pattern, increase intensity',
            lead: 'ascending melodic line, add notes',
            pads: 'open filter slowly, increase brightness',
            fx: 'add riser, tension builder'
        }
    },

    // Strudel defaults
    STRUDEL: {
        defaultTempo: 120,
        defaultCode: '// waiting for pattern...'
    },

    // UI Settings
    UI: {
        chatMaxMessages: 50,
        bubbleDuration: 4000,    // How long agent bubbles stay visible
        codeAnimationDuration: 500
    }
};

// Note: CONFIG is not frozen so API keys can be set dynamically

// Auto-load settings from localStorage on startup
(function loadSavedConfig() {
    console.log('[Config] Checking localStorage for saved settings...');
    try {
        const savedGeminiKey = localStorage.getItem('gemini_api_key');
        const savedGeminiModel = localStorage.getItem('gemini_model');

        if (savedGeminiKey) {
            CONFIG.GEMINI_API_KEY = savedGeminiKey;
            console.log('[Config] Loaded Gemini API key from localStorage:', savedGeminiKey.slice(0, 8) + '...');
        } else {
            console.log('[Config] No Gemini API key in localStorage');
        }

        if (savedGeminiModel) {
            CONFIG.GEMINI_MODEL = savedGeminiModel;
            console.log('[Config] Loaded Gemini model from localStorage:', savedGeminiModel);
        }
    } catch (e) {
        console.error('[Config] Error loading from localStorage:', e);
    }
})();

console.log('[Config] config.js loaded successfully');
console.log('[Config] Final CONFIG state:', {
    GEMINI_API_KEY: CONFIG.GEMINI_API_KEY ? CONFIG.GEMINI_API_KEY.slice(0, 8) + '...' : 'empty',
    GEMINI_MODEL: CONFIG.GEMINI_MODEL,
    GEMINI_WS_URL: CONFIG.GEMINI_WS_URL
});
