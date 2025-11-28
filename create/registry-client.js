/**
 * PoHW Registry Client
 * Handles API communication with registry nodes for proof creation
 */

class RegistryClient {
    constructor(registryUrl = null) {
        // Default to production for production site, localhost for local
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
    }

    /**
     * Check node status
     */
    async checkNodeStatus() {
        try {
            const response = await fetch(`${this.registryUrl}/pohw/status`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return {
                online: true,
                status: data.status || 'active',
                latestHash: data.latest_hash,
                timestamp: data.timestamp,
                totalProofs: data.total_proofs,
                pendingBatch: data.pending_batch
            };
        } catch (error) {
            console.error(`[RegistryClient] Status check failed:`, error);
            return {
                online: false,
                error: error.message
            };
        }
    }

    /**
     * Submit attestation (create proof)
     */
    async submitAttestation(attestation) {
        try {
            const response = await fetch(`${this.registryUrl}/pohw/attest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(attestation),
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const receipt = await response.json();
            return receipt;
        } catch (error) {
            console.error('[RegistryClient] Attestation submission failed:', error);
            throw error;
        }
    }

    /**
     * Verify a proof by hash
     */
    async verifyProof(hash) {
        try {
            const response = await fetch(`${this.registryUrl}/pohw/verify/${encodeURIComponent(hash)}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('[RegistryClient] Verification failed:', error);
            throw error;
        }
    }
}

