/**
 * STRUDEL BAND - Audio Capture Module
 * Captures audio output and converts to format for Gemini Live API
 */

class AudioCapture {
    constructor() {
        this.audioContext = null;
        this.mediaStreamDestination = null;
        this.mediaRecorder = null;
        this.analyserNode = null;
        this.isCapturing = false;
        this.onAudioData = null;
        this.onAnalyzerData = null;

        // Resampling for Gemini (16kHz mono)
        this.targetSampleRate = CONFIG.AUDIO.sampleRate;
        this.captureInterval = CONFIG.AUDIO.captureInterval;
        this.captureTimer = null;

        // Audio buffer for streaming
        this.audioBuffer = [];
    }

    /**
     * Initialize audio capture from Strudel output
     */
    async init() {
        try {
            // Get or create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000 // Strudel's output rate
            });

            // Create analyser for visualization
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 256;
            this.analyserNode.smoothingTimeConstant = 0.8;

            // Create destination for capturing
            this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();

            console.log('[AudioCapture] Initialized');
            return true;
        } catch (error) {
            console.error('[AudioCapture] Init failed:', error);
            return false;
        }
    }

    /**
     * Connect Strudel's audio output to our capture pipeline
     * This should be called after Strudel initializes
     */
    connectStrudelOutput(strudelAudioNode) {
        if (!this.audioContext || !strudelAudioNode) {
            console.warn('[AudioCapture] Cannot connect - not initialized');
            return;
        }

        // Connect Strudel output to analyzer
        strudelAudioNode.connect(this.analyserNode);

        // Connect to capture destination
        strudelAudioNode.connect(this.mediaStreamDestination);

        console.log('[AudioCapture] Connected to Strudel output');
    }

    /**
     * Start capturing audio for streaming to Gemini
     */
    startCapture(onAudioData) {
        if (this.isCapturing) return;

        this.onAudioData = onAudioData;
        this.isCapturing = true;

        // Use ScriptProcessor for raw PCM access (deprecated but works)
        // In production, use AudioWorklet
        const bufferSize = CONFIG.AUDIO.bufferSize;
        this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        this.scriptProcessor.onaudioprocess = (event) => {
            if (!this.isCapturing) return;

            const inputData = event.inputBuffer.getChannelData(0);

            // Resample to 16kHz
            const resampledData = this.resample(inputData, this.audioContext.sampleRate, this.targetSampleRate);

            // Convert to 16-bit PCM
            const pcm16 = this.floatTo16BitPCM(resampledData);

            // Convert to base64
            const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

            // Send to callback
            if (this.onAudioData) {
                this.onAudioData(base64Audio);
            }
        };

        // Connect to script processor
        this.mediaStreamDestination.stream.getAudioTracks().forEach(track => {
            const source = this.audioContext.createMediaStreamSource(
                new MediaStream([track])
            );
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
        });

        console.log('[AudioCapture] Started capture');
    }

    /**
     * Stop capturing
     */
    stopCapture() {
        this.isCapturing = false;

        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.captureTimer) {
            clearInterval(this.captureTimer);
            this.captureTimer = null;
        }

        console.log('[AudioCapture] Stopped capture');
    }

    /**
     * Get analyzer data for visualization
     */
    getAnalyzerData() {
        if (!this.analyserNode) return null;

        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyserNode.getByteFrequencyData(dataArray);

        return dataArray;
    }

    /**
     * Get waveform data
     */
    getWaveformData() {
        if (!this.analyserNode) return null;

        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyserNode.getByteTimeDomainData(dataArray);

        return dataArray;
    }

    /**
     * Resample audio to target sample rate
     */
    resample(inputBuffer, fromSampleRate, toSampleRate) {
        const ratio = fromSampleRate / toSampleRate;
        const newLength = Math.round(inputBuffer.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, inputBuffer.length - 1);
            const t = srcIndex - srcIndexFloor;

            // Linear interpolation
            result[i] = inputBuffer[srcIndexFloor] * (1 - t) + inputBuffer[srcIndexCeil] * t;
        }

        return result;
    }

    /**
     * Convert float audio to 16-bit PCM
     */
    floatTo16BitPCM(float32Array) {
        const int16Array = new Int16Array(float32Array.length);

        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        return int16Array;
    }

    /**
     * Convert ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Analyze audio features (basic)
     */
    analyzeFeatures() {
        const frequencyData = this.getAnalyzerData();
        if (!frequencyData) return null;

        // Calculate average energy
        let totalEnergy = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            totalEnergy += frequencyData[i];
        }
        const avgEnergy = totalEnergy / frequencyData.length;

        // Split into frequency bands
        const third = Math.floor(frequencyData.length / 3);
        let lowEnergy = 0, midEnergy = 0, highEnergy = 0;

        for (let i = 0; i < third; i++) lowEnergy += frequencyData[i];
        for (let i = third; i < third * 2; i++) midEnergy += frequencyData[i];
        for (let i = third * 2; i < frequencyData.length; i++) highEnergy += frequencyData[i];

        return {
            energy: avgEnergy / 255,
            lowEnergy: lowEnergy / (third * 255),
            midEnergy: midEnergy / (third * 255),
            highEnergy: highEnergy / (third * 255),
            isLoud: avgEnergy > 150,
            isQuiet: avgEnergy < 50
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopCapture();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Export
window.AudioCapture = AudioCapture;
