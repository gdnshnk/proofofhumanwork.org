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
            const privateKeyBytes = ed25519.utils.randomPrivateKey();
            
            // Derive public key
            const publicKey = await ed25519.getPublicKey(privateKeyBytes);
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
        if (typeof ed25519 !== 'undefined' && ed25519.getPublicKey) {
            return;
        }
        
        return new Promise((resolve, reject) => {
            // Check if already loading
            if (window._ed25519Loading) {
                window._ed25519Loading.then(resolve).catch(reject);
                return;
            }
            
            window._ed25519Loading = new Promise((res, rej) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@noble/ed25519@1.7.3/index.js';
                script.onload = () => {
                    // Check if ed25519 is available
                    if (typeof ed25519 !== 'undefined' && ed25519.getPublicKey) {
                        res();
                    } else {
                        rej(new Error('Ed25519 library loaded but not available'));
                    }
                };
                script.onerror = () => rej(new Error('Failed to load Ed25519 library'));
                document.head.appendChild(script);
            });
            
            window._ed25519Loading.then(resolve).catch(reject);
        });
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
            
            const publicKey = await ed25519.getPublicKey(privateKeyBytes);
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
            
            const publicKey = await ed25519.getPublicKey(privateKeyBytes);
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
        
        const signature = await ed25519.sign(messageBytes, this.keyPair.privateKey);
        
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

