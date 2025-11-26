/**
 * Browser-based Process Tracker
 * Tracks user activity to generate process digests for PoHW proofs
 */

class BrowserProcessTracker {
    constructor() {
        this.sessionStart = null;
        this.inputEvents = [];
        this.editTimestamps = [];
        this.isTracking = false;
        this.metadata = {
            tool: 'web-browser',
            environment: this.detectEnvironment(),
            aiAssisted: false
        };
        
        // Human thresholds (from whitepaper)
        this.thresholds = {
            minDuration: 30 * 1000, // 30 seconds minimum
            minEntropy: 0.3, // Minimum input variation
            minTemporalCoherence: 0.2, // Human-like timing patterns
            maxInputRate: 20, // events per second (prevents automation)
            minEventInterval: 50 // milliseconds (prevents machine-speed input)
        };
    }

    /**
     * Detect browser environment
     */
    detectEnvironment() {
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        const language = navigator.language;
        
        let browser = 'unknown';
        let os = 'unknown';
        
        // Detect browser
        if (ua.includes('Chrome') && !ua.includes('Edg')) {
            browser = 'Chrome';
        } else if (ua.includes('Firefox')) {
            browser = 'Firefox';
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
            browser = 'Safari';
        } else if (ua.includes('Edg')) {
            browser = 'Edge';
        }
        
        // Detect OS
        if (platform.includes('Win')) {
            os = 'Windows';
        } else if (platform.includes('Mac')) {
            os = 'macOS';
        } else if (platform.includes('Linux')) {
            os = 'Linux';
        } else if (platform.includes('iPhone') || platform.includes('iPad')) {
            os = 'iOS';
        } else if (platform.includes('Android')) {
            os = 'Android';
        }
        
        return `${browser} on ${os} (${language})`;
    }

    /**
     * Start tracking session
     */
    startSession() {
        if (this.isTracking) {
            return; // Already tracking
        }
        
        this.sessionStart = Date.now();
        this.inputEvents = [];
        this.editTimestamps = [];
        this.isTracking = true;
        
        console.log('[ProcessTracker] Session started');
    }

    /**
     * Record an input event (typing, editing, etc.)
     */
    recordInput(eventType = 'input') {
        if (!this.isTracking) {
            this.startSession();
        }
        
        const now = Date.now();
        this.inputEvents.push({
            type: eventType,
            timestamp: now
        });
        this.editTimestamps.push(now);
        
        // Limit array size to prevent memory issues
        if (this.inputEvents.length > 10000) {
            this.inputEvents = this.inputEvents.slice(-5000);
            this.editTimestamps = this.editTimestamps.slice(-5000);
        }
    }

    /**
     * Calculate Shannon entropy of input intervals
     */
    calculateEntropy() {
        if (this.editTimestamps.length < 2) {
            return 0;
        }
        
        // Calculate intervals between events
        const intervals = [];
        for (let i = 1; i < this.editTimestamps.length; i++) {
            const interval = this.editTimestamps[i] - this.editTimestamps[i - 1];
            if (interval > 0) {
                intervals.push(interval);
            }
        }
        
        if (intervals.length === 0) {
            return 0;
        }
        
        // Bin intervals into buckets for entropy calculation
        const buckets = {};
        const bucketSize = 100; // 100ms buckets
        
        intervals.forEach(interval => {
            const bucket = Math.floor(interval / bucketSize);
            buckets[bucket] = (buckets[bucket] || 0) + 1;
        });
        
        // Calculate Shannon entropy
        const total = intervals.length;
        let entropy = 0;
        
        Object.values(buckets).forEach(count => {
            const probability = count / total;
            if (probability > 0) {
                entropy -= probability * Math.log2(probability);
            }
        });
        
        // Normalize to 0-1 range (assuming max entropy around 5-6 bits)
        return Math.min(entropy / 6, 1);
    }

    /**
     * Calculate temporal coherence (coefficient of variation)
     */
    calculateTemporalCoherence() {
        if (this.editTimestamps.length < 2) {
            return 0;
        }
        
        // Calculate intervals
        const intervals = [];
        for (let i = 1; i < this.editTimestamps.length; i++) {
            const interval = this.editTimestamps[i] - this.editTimestamps[i - 1];
            if (interval > 0) {
                intervals.push(interval);
            }
        }
        
        if (intervals.length === 0) {
            return 0;
        }
        
        // Calculate mean
        const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        
        if (mean === 0) {
            return 0;
        }
        
        // Calculate standard deviation
        const variance = intervals.reduce((sum, val) => {
            return sum + Math.pow(val - mean, 2);
        }, 0) / intervals.length;
        
        const stdDev = Math.sqrt(variance);
        
        // Coefficient of variation (CV)
        const cv = stdDev / mean;
        
        // Normalize: human-like CV is typically 0.3-0.7
        // Lower CV = more consistent (machine-like)
        // Higher CV = more random (also machine-like)
        // We want moderate CV (human-like)
        if (cv < 0.3) {
            return 0.3; // Too consistent
        } else if (cv > 1.0) {
            return 0.2; // Too random
        } else {
            // Map 0.3-1.0 to 0.3-0.7 (human-like range)
            return 0.3 + (cv - 0.3) * 0.4 / 0.7;
        }
    }

    /**
     * Check if metrics meet human thresholds
     */
    meetsThresholds(metrics) {
        const duration = metrics.duration;
        const entropy = metrics.entropy;
        const temporalCoherence = metrics.temporalCoherence;
        const inputEvents = metrics.inputEvents;
        
        // Calculate input rate
        const inputRate = duration > 0 ? (inputEvents / (duration / 1000)) : 0;
        
        // Check minimum interval (prevent machine-speed input)
        let minInterval = Infinity;
        if (this.editTimestamps.length >= 2) {
            for (let i = 1; i < this.editTimestamps.length; i++) {
                const interval = this.editTimestamps[i] - this.editTimestamps[i - 1];
                if (interval > 0 && interval < minInterval) {
                    minInterval = interval;
                }
            }
        }
        
        return (
            duration >= this.thresholds.minDuration &&
            entropy >= this.thresholds.minEntropy &&
            temporalCoherence >= this.thresholds.minTemporalCoherence &&
            inputRate <= this.thresholds.maxInputRate &&
            minInterval >= this.thresholds.minEventInterval
        );
    }

    /**
     * Generate process metrics
     */
    generateMetrics() {
        if (!this.isTracking || this.sessionStart === null) {
            return null;
        }
        
        const now = Date.now();
        const duration = now - this.sessionStart;
        const entropy = this.calculateEntropy();
        const temporalCoherence = this.calculateTemporalCoherence();
        const inputEvents = this.inputEvents.length;
        
        // Calculate timing statistics
        let timingVariance = 0;
        let averageInterval = 0;
        let minInterval = Infinity;
        let maxInterval = 0;
        
        if (this.editTimestamps.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.editTimestamps.length; i++) {
                const interval = this.editTimestamps[i] - this.editTimestamps[i - 1];
                if (interval > 0) {
                    intervals.push(interval);
                    if (interval < minInterval) minInterval = interval;
                    if (interval > maxInterval) maxInterval = interval;
                }
            }
            
            if (intervals.length > 0) {
                averageInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
                const mean = averageInterval;
                const variance = intervals.reduce((sum, val) => {
                    return sum + Math.pow(val - mean, 2);
                }, 0) / intervals.length;
                timingVariance = Math.sqrt(variance);
            }
        }
        
        const metrics = {
            sessionStart: new Date(this.sessionStart).toISOString(),
            sessionEnd: new Date(now).toISOString(),
            duration: duration,
            entropy: entropy,
            temporalCoherence: temporalCoherence,
            inputEvents: inputEvents,
            timingVariance: timingVariance,
            averageInterval: averageInterval,
            minInterval: minInterval === Infinity ? 0 : minInterval,
            maxInterval: maxInterval,
            metadata: this.metadata
        };
        
        metrics.meetsThresholds = this.meetsThresholds(metrics);
        
        return metrics;
    }

    /**
     * Generate process digest
     */
    async generateDigest() {
        const metrics = this.generateMetrics();
        
        if (!metrics) {
            return null;
        }
        
        // Create canonical JSON representation (exclude metadata for privacy)
        const digestData = {
            duration: metrics.duration,
            entropy: Math.round(metrics.entropy * 1000) / 1000, // Round to 3 decimals
            temporalCoherence: Math.round(metrics.temporalCoherence * 1000) / 1000,
            inputEvents: metrics.inputEvents,
            timingVariance: Math.round(metrics.timingVariance),
            averageInterval: Math.round(metrics.averageInterval),
            minInterval: metrics.minInterval,
            maxInterval: metrics.maxInterval
        };
        
        // Generate SHA-256 hash
        const canonicalJson = JSON.stringify(digestData, Object.keys(digestData).sort());
        const encoder = new TextEncoder();
        const data = encoder.encode(canonicalJson);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const digest = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return {
            digest: digest,
            metrics: metrics,
            meetsThresholds: metrics.meetsThresholds
        };
    }

    /**
     * Stop tracking
     */
    stopTracking() {
        this.isTracking = false;
    }

    /**
     * Reset session
     */
    reset() {
        this.sessionStart = null;
        this.inputEvents = [];
        this.editTimestamps = [];
        this.isTracking = false;
    }

    /**
     * Get current session duration
     */
    getSessionDuration() {
        if (!this.sessionStart) {
            return 0;
        }
        return Date.now() - this.sessionStart;
    }

    /**
     * Get input event count
     */
    getInputEventCount() {
        return this.inputEvents.length;
    }
}

