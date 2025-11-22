/**
 * Strudel Initialization - Robust sample loading
 * This script handles Strudel initialization with proper drum machine sample loading
 */

console.log("[Strudel] strudel-init.js loading...");

// Store loaded state
window._strudelLoaded = false;
window.strudelReady = false;

// Load drum machine samples manually from GitHub
async function loadDrumMachines() {
    const machinesUrl = "https://raw.githubusercontent.com/tidalcycles/tidal-drum-machines/main/machines.json";
    console.log("[Strudel] Fetching drum machines from:", machinesUrl);

    try {
        const response = await fetch(machinesUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const machines = await response.json();
        console.log("[Strudel] Loaded machines.json, found:", Object.keys(machines).length, "machines");

        // Get the strudel module
        const strudel = window.strudel;
        if (!strudel) {
            console.error("[Strudel] No strudel module found!");
            return false;
        }

        // Try to register samples using available methods
        let registered = 0;

        // Method 1: Use samples() function with the full object
        if (typeof strudel.samples === 'function') {
            try {
                // The samples() function can take a sample map directly
                await strudel.samples(machines);
                console.log("[Strudel] Loaded via samples() with object");
                return true;
            } catch (e) {
                console.log("[Strudel] samples() with object failed:", e.message);
            }
        }

        // Method 2: Use registerSound for each sample
        if (typeof strudel.registerSound === 'function') {
            for (const [machineName, machineData] of Object.entries(machines)) {
                const baseUrl = machineData.baseUrl || '';
                const samples = machineData.samples || {};

                for (const [sampleName, sampleData] of Object.entries(samples)) {
                    try {
                        // sampleData can be a string URL, array of URLs, or object with url property
                        let urls = [];
                        if (typeof sampleData === 'string') {
                            urls = [sampleData];
                        } else if (Array.isArray(sampleData)) {
                            urls = sampleData;
                        } else if (sampleData && sampleData.url) {
                            urls = Array.isArray(sampleData.url) ? sampleData.url : [sampleData.url];
                        }

                        if (urls.length > 0) {
                            // Prepend base URL if needed
                            const fullUrls = urls.map(u => {
                                if (u.startsWith('http')) return u;
                                return baseUrl + u;
                            });

                            strudel.registerSound(sampleName, fullUrls);
                            registered++;
                        }
                    } catch (e) {
                        // Silent fail for individual samples
                    }
                }
            }
            if (registered > 0) {
                console.log("[Strudel] Registered", registered, "sounds via registerSound()");
                return true;
            }
        }

        console.warn("[Strudel] Could not register samples");
        return false;

    } catch (e) {
        console.error("[Strudel] Failed to load drum machines:", e);
        return false;
    }
}

// Main initialization
async function initStrudelWithSamples() {
    console.log("[Strudel] Starting initialization...");

    try {
        // Dynamic import from CDN
        const cdnUrl = "https://cdn.jsdelivr.net/npm/@strudel/web@1.1.0/dist/index.mjs";
        console.log("[Strudel] Importing from:", cdnUrl);

        const module = await import(cdnUrl);
        console.log("[Strudel] Module imported successfully");

        // Store module globally
        window.strudel = module;

        // Initialize the REPL
        if (module.initStrudel) {
            console.log("[Strudel] Calling initStrudel()...");
            const result = await module.initStrudel();

            // Extract evaluate and stop functions
            window.evaluate = result.evaluate;
            window.hush = result.stop;

            console.log("[Strudel] initStrudel() completed");
        }

        // Load drum samples
        await loadDrumMachines();

        // Mark as ready
        window._strudelLoaded = true;
        window.strudelReady = true;

        console.log("🎉 Strudel Web ready with drum machines!");
        console.log("Available: 808bd, 808sd, 808ch, 808oh, 808cp, 909bd, 909sd, etc.");

    } catch (e) {
        console.error("[Strudel] Initialization failed:", e);
    }
}

// Start initialization
initStrudelWithSamples();
