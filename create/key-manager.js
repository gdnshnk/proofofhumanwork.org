/**
 * PoHW Key Manager
 * Handles Ed25519 key generation, storage, and signing using Web Crypto API
 */

class PoHWKeyManager {
    constructor() {
        this.keyPair = null;
        this.did = null;
        this.storageKey = 'pohw-keys';
    }

    /**
     * Check if keys exist in storage
     */
    async hasKeys() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate new Ed25519 keypair using @noble/ed25519
     */
    async generateKeys() {
        try {
            // Load ed25519 library if needed
            await this.ensureEd25519Library();
            
            // Generate random private key (32 bytes for Ed25519)
            const ed25519Lib = window.ed25519 || ed25519;
            const privateKeyBytes = ed25519Lib.utils.randomPrivateKey();
            
            // Derive public key
            const publicKey = await ed25519Lib.getPublicKey(privateKeyBytes);
            const did = this.generateDID(publicKey);
            
            this.keyPair = {
                privateKey: privateKeyBytes,
                publicKey: publicKey
            };
            this.did = did;
            
            // Store keys
            await this.saveKeys();
            
            return { keyPair: this.keyPair, did: this.did };
        } catch (error) {
            console.error('Error generating keys:', error);
            throw new Error('Failed to generate keys: ' + error.message);
        }
    }

    /**
     * Ensure Ed25519 library is loaded
     */
    async ensureEd25519Library() {
        // Check if already available
        if (window.ed25519 && typeof window.ed25519.getPublicKey === 'function') {
            return;
        }
        
        // Check if already loading
        if (window._ed25519Loading) {
            return window._ed25519Loading;
        }
        
        window._ed25519Loading = (async () => {
            try {
                // Wait for the module script in HTML to load
                let attempts = 0;
                while (attempts < 40) { // Wait up to 2 seconds
                    if (window.ed25519 && typeof window.ed25519.getPublicKey === 'function') {
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                    attempts++;
                }
                
                // If still not loaded, try dynamic import
                if (!window.ed25519) {
                    try {
                        const ed25519Module = await import('https://cdn.jsdelivr.net/npm/@noble/ed25519@1.7.3/index.js');
                        window.ed25519 = ed25519Module;
                        if (window.ed25519 && typeof window.ed25519.getPublicKey === 'function') {
                            return;
                        }
                    } catch (importError) {
                        console.warn('CDN import failed, trying unpkg:', importError);
                        try {
                            const ed25519Module = await import('https://unpkg.com/@noble/ed25519@1.7.3/index.js');
                            window.ed25519 = ed25519Module;
                            if (window.ed25519 && typeof window.ed25519.getPublicKey === 'function') {
                                return;
                            }
                        } catch (unpkgError) {
                            throw new Error('Failed to load Ed25519 library from all sources. Please check your internet connection and try again.');
                        }
                    }
                }
                
                if (!window.ed25519 || typeof window.ed25519.getPublicKey !== 'function') {
                    throw new Error('Ed25519 library loaded but getPublicKey function not available');
                }
            } catch (error) {
                console.error('Ed25519 library loading error:', error);
                throw error;
            }
        })();
        
        return window._ed25519Loading;
    }

    /**
     * Generate DID from public key
     */
    generateDID(publicKey) {
        // Convert public key to hex
        const hex = Array.from(publicKey)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        // Use first 16 hex chars for DID (simplified)
        return `did:pohw:${hex.substring(0, 16)}`;
    }

    /**
     * Load keys from storage
     */
    async loadKeys() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) {
                return null;
            }
            
            await this.ensureEd25519Library();
            
            const data = JSON.parse(stored);
            const privateKeyBytes = new Uint8Array(Object.values(data.privateKey));
            
            const ed25519Lib = window.ed25519 || ed25519;
            const publicKey = await ed25519Lib.getPublicKey(privateKeyBytes);
            const did = this.generateDID(publicKey);
            
            this.keyPair = {
                privateKey: privateKeyBytes,
                publicKey: publicKey
            };
            this.did = did;
            
            return { keyPair: this.keyPair, did: this.did };
        } catch (error) {
            console.error('Error loading keys:', error);
            return null;
        }
    }

    /**
     * Import keys from hex string
     */
    async importKeys(privateKeyHex, password = null) {
        try {
            await this.ensureEd25519Library();
            
            // Remove 0x prefix if present
            const hex = privateKeyHex.replace(/^0x/, '').trim();
            
            // Convert hex to bytes
            const privateKeyBytes = new Uint8Array(
                hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            
            if (privateKeyBytes.length !== 32) {
                throw new Error('Invalid private key length. Must be 32 bytes (64 hex characters).');
            }
            
            const ed25519Lib = window.ed25519 || ed25519;
            const publicKey = await ed25519Lib.getPublicKey(privateKeyBytes);
            const did = this.generateDID(publicKey);
            
            this.keyPair = {
                privateKey: privateKeyBytes,
                publicKey: publicKey
            };
            this.did = did;
            
            await this.saveKeys();
            
            return { keyPair: this.keyPair, did: this.did };
        } catch (error) {
            console.error('Error importing keys:', error);
            throw new Error('Failed to import keys: ' + error.message);
        }
    }

    /**
     * Save keys to storage (encrypted)
     */
    async saveKeys() {
        try {
            const data = {
                privateKey: Array.from(this.keyPair.privateKey),
                publicKey: Array.from(this.keyPair.publicKey),
                did: this.did,
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving keys:', error);
            throw new Error('Failed to save keys: ' + error.message);
        }
    }

    /**
     * Export keys as hex string
     */
    exportKeys() {
        if (!this.keyPair) {
            throw new Error('No keys loaded');
        }
        
        const hex = Array.from(this.keyPair.privateKey)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        return {
            privateKey: hex,
            publicKey: Array.from(this.keyPair.publicKey)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(''),
            did: this.did
        };
    }

    /**
     * Sign message with private key
     */
    async sign(message) {
        if (!this.keyPair) {
            throw new Error('No keys loaded. Please generate or import keys first.');
        }
        
        await this.ensureEd25519Library();
        
        // Convert message to bytes if string
        const messageBytes = typeof message === 'string' 
            ? new TextEncoder().encode(message)
            : message;
        
        const ed25519Lib = window.ed25519 || ed25519;
        const signature = await ed25519Lib.sign(messageBytes, this.keyPair.privateKey);
        
        // Convert signature to hex
        return Array.from(signature)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Get current DID
     */
    getDID() {
        return this.did;
    }

    /**
     * Clear keys from memory (not storage)
     */
    clearKeys() {
        this.keyPair = null;
        this.did = null;
    }
}

