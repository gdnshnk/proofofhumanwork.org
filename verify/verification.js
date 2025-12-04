/**
 * PoHW Verification Client
 * Handles API communication with registry nodes
 * NO PRIVATE KEYS - Verification only!
 */

class VerificationClient {
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
        console.log('[VerificationClient] Registry URL updated to:', this.registryUrl);
    }

    /**
     * Verify a proof by hash
     * @param {string} hash - Content hash (with or without 0x prefix)
     * @returns {Promise<Object>} Verification result
     */
    async verifyProof(hash) {
        // Check if trying to use localhost from production site
        if (this.registryUrl.includes('localhost') && 
            window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
            return {
                valid: false,
                error: 'Cannot access localhost from production site. Please use Production (Railway) registry or access via localhost:8000'
            };
        }
        
        // API now handles both with and without 0x prefix, so we can pass it as-is
        // But we'll normalize to remove 0x for URL encoding safety
        const normalizedHash = hash.startsWith('0x') ? hash.substring(2) : hash;
        const url = `${this.registryUrl}/pohw/verify/${normalizedHash}`;
        
        console.log('[VerificationClient] Verifying hash:', hash);
        console.log('[VerificationClient] Normalized hash:', normalizedHash);
        console.log('[VerificationClient] Registry URL:', this.registryUrl);
        console.log('[VerificationClient] Full URL:', url);
        
        try {
            console.log('[VerificationClient] Making request to:', url);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                mode: 'cors'
            });
            
            console.log('[VerificationClient] Response status:', response.status);
            console.log('[VerificationClient] Response headers:', [...response.headers.entries()]);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[VerificationClient] Error response:', errorText);
                
                if (response.status === 404) {
                    return {
                        valid: false,
                        error: 'Proof not found in registry'
                    };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('[VerificationClient] Verification result:', data);
            return data;
        } catch (error) {
            console.error('[VerificationClient] Fetch error:', error);
            console.error('[VerificationClient] Error name:', error.name);
            console.error('[VerificationClient] Error message:', error.message);
            
            // More specific error messages
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                return {
                    valid: false,
                    error: `Cannot connect to registry at ${this.registryUrl}. Make sure the registry is running and accessible.`
                };
            }
            
            return {
                valid: false,
                error: error.message || 'Failed to verify proof'
            };
        }
    }

    /**
     * Get proof details by hash
     * @param {string} hash - Content hash
     * @returns {Promise<Object>} Proof details (full proof record)
     */
    async getProof(hash) {
        const normalizedHash = hash.startsWith('0x') ? hash.substring(2) : hash;
        
        try {
            // Try to get full proof record from verification endpoint first (includes proof record)
            const verifyResponse = await fetch(`${this.registryUrl}/pohw/verify/${normalizedHash}`);
            if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                if (verifyData.proof) {
                    // Return the proof record from verification response
                    return verifyData.proof;
                }
            }
            
            // Fallback: Try to get from proof endpoint (may only have Merkle data)
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
     * Get all proofs for a hash (with filtering)
     * @param {string} hash - Content hash
     * @param {Object} filters - Filter options (did, tier, from, to, sort, limit, offset)
     * @returns {Promise<Object>} All proofs with pagination
     */
    async getAllProofs(hash, filters = {}) {
        const normalizedHash = hash.startsWith('0x') ? hash.substring(2) : hash;
        
        // Build query string
        const params = new URLSearchParams();
        if (filters.did) params.append('did', filters.did);
        if (filters.tier && filters.tier !== 'all') params.append('tier', filters.tier);
        if (filters.from) params.append('from', filters.from);
        if (filters.to) params.append('to', filters.to);
        if (filters.sort) params.append('sort', filters.sort);
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());
        
        const queryString = params.toString();
        const url = `${this.registryUrl}/pohw/proofs/${normalizedHash}${queryString ? '?' + queryString : ''}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching all proofs:', error);
            throw error;
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

    /**
     * Get reputation for a DID
     * @param {string} did - DID identifier
     * @returns {Promise<Object>} Reputation data
     */
    async getReputation(did) {
        try {
            const encodedDid = encodeURIComponent(did);
            const response = await fetch(`${this.registryUrl}/pohw/reputation/${encodedDid}`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching reputation:', error);
            return null;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationClient;
}


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

    /**
     * Get reputation for a DID
     * @param {string} did - DID identifier
     * @returns {Promise<Object>} Reputation data
     */
    async getReputation(did) {
        try {
            const encodedDid = encodeURIComponent(did);
            const response = await fetch(`${this.registryUrl}/pohw/reputation/${encodedDid}`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching reputation:', error);
            return null;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationClient;
}


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

    /**
     * Get reputation for a DID
     * @param {string} did - DID identifier
     * @returns {Promise<Object>} Reputation data
     */
    async getReputation(did) {
        try {
            const encodedDid = encodeURIComponent(did);
            const response = await fetch(`${this.registryUrl}/pohw/reputation/${encodedDid}`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching reputation:', error);
            return null;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationClient;
}


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

    /**
     * Get reputation for a DID
     * @param {string} did - DID identifier
     * @returns {Promise<Object>} Reputation data
     */
    async getReputation(did) {
        try {
            const encodedDid = encodeURIComponent(did);
            const response = await fetch(`${this.registryUrl}/pohw/reputation/${encodedDid}`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching reputation:', error);
            return null;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationClient;
}


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

    /**
     * Get reputation for a DID
     * @param {string} did - DID identifier
     * @returns {Promise<Object>} Reputation data
     */
    async getReputation(did) {
        try {
            const encodedDid = encodeURIComponent(did);
            const response = await fetch(`${this.registryUrl}/pohw/reputation/${encodedDid}`);
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching reputation:', error);
            return null;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationClient;
}

