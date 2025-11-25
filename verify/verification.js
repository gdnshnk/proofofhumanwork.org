/**
 * PoHW Verification Client
 * Handles API communication with registry nodes
 * NO PRIVATE KEYS - Verification only!
 */

class VerificationClient {
    constructor(registryUrl = 'https://pohw-registry-node-production.up.railway.app') {
        this.registryUrl = registryUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    /**
     * Verify a proof by hash
     * @param {string} hash - Content hash (with or without 0x prefix)
     * @returns {Promise<Object>} Verification result
     */
    async verifyProof(hash) {
        // API now handles both with and without 0x prefix, so we can pass it as-is
        // But we'll normalize to remove 0x for URL encoding safety
        const normalizedHash = hash.startsWith('0x') ? hash.substring(2) : hash;
        const url = `${this.registryUrl}/pohw/verify/${normalizedHash}`;
        
        console.log('[VerificationClient] Verifying hash:', hash);
        console.log('[VerificationClient] Normalized hash:', normalizedHash);
        console.log('[VerificationClient] Registry URL:', this.registryUrl);
        console.log('[VerificationClient] Full URL:', url);
        
        try {
            const response = await fetch(url);
            
            console.log('[VerificationClient] Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log('[VerificationClient] Error response:', errorText);
                
                if (response.status === 404) {
                    return {
                        valid: false,
                        error: 'Proof not found in registry'
                    };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('[VerificationClient] Verification result:', data);
            return data;
        } catch (error) {
            console.error('[VerificationClient] Error:', error);
            return {
                valid: false,
                error: error.message || 'Failed to verify proof'
            };
        }
    }

    /**
     * Get proof details by hash
     * @param {string} hash - Content hash
     * @returns {Promise<Object>} Proof details
     */
    async getProof(hash) {
        const normalizedHash = hash.startsWith('0x') ? hash.substring(2) : hash;
        
        try {
            const response = await fetch(`${this.registryUrl}/pohw/proof/${normalizedHash}`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching proof:', error);
            return null;
        }
    }

    /**
     * Get registry status
     * @returns {Promise<Object>} Registry status
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.registryUrl}/pohw/status`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching status:', error);
            return null;
        }
    }

    /**
     * Get batch anchors (blockchain transactions)
     * @param {string} batchId - Batch ID
     * @returns {Promise<Object>} Anchor information
     */
    async getBatchAnchors(batchId) {
        try {
            const response = await fetch(`${this.registryUrl}/pohw/batch/${batchId}/anchors`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching anchors:', error);
            return null;
        }
    }

    /**
     * Get PAV claim (if available)
     * @param {string} hash - Content hash
     * @returns {Promise<Object>} PAV claim object
     */
    async getPAVClaim(hash) {
        const normalizedHash = hash.startsWith('0x') ? hash.substring(2) : hash;
        
        try {
            // Use /pohw/claim/:hash endpoint for PAV claim (JSON-LD format)
            const response = await fetch(`${this.registryUrl}/pohw/claim/${normalizedHash}`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching PAV claim:', error);
            return null;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationClient;
}

