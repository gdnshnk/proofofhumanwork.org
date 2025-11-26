/**
 * PoHW Registry Client for Proof Creation
 * Handles API communication with registry nodes for submitting proofs
 */

class RegistryClient {
    constructor(registryUrl = null) {
        // Default to localhost for development, production for production
        const defaultUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : 'https://pohw-registry-node-production.up.railway.app';
        
        this.registryUrl = (registryUrl || defaultUrl).replace(/\/$/, ''); // Remove trailing slash
    }

    /**
     * Update registry URL dynamically
     */
    setRegistryUrl(url) {
        this.registryUrl = url.replace(/\/$/, '');
        console.log('[RegistryClient] Registry URL updated to:', this.registryUrl);
    }

    /**
     * Submit attestation (create proof)
     * @param {Object} attestation - Attestation data
     * @returns {Promise<Object>} Receipt with proof hash
     */
    async submitAttestation(attestation) {
        const url = `${this.registryUrl}/pohw/attest`;
        
        console.log('[RegistryClient] Submitting attestation:', {
            hash: attestation.hash,
            did: attestation.did,
            registry: this.registryUrl
        });
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(attestation)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('[RegistryClient] Attestation submitted:', data);
            return data;
        } catch (error) {
            console.error('[RegistryClient] Error submitting attestation:', error);
            throw new Error(`Failed to submit attestation: ${error.message}`);
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
     * Check node status and health
     * @returns {Promise<Object>} Node status
     */
    async checkNodeStatus() {
        try {
            const startTime = performance.now();
            const response = await fetch(`${this.registryUrl}/pohw/status`);
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            
            if (!response.ok) {
                return {
                    online: false,
                    responseTime,
                    error: `HTTP ${response.status}`
                };
            }
            
            const data = await response.json();
            return {
                online: true,
                responseTime,
                ...data
            };
        } catch (error) {
            return {
                online: false,
                responseTime: null,
                error: error.message
            };
        }
    }
}

