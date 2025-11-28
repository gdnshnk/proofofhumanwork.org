/**
 * Registry Node Discovery
 * Discovers and manages registry nodes dynamically
 */

class RegistryDiscovery {
    constructor() {
        this.knownNodes = [
            {
                id: 'gdn-primary',
                name: 'gdn.sh (Primary)',
                url: 'https://gdn.sh',
                operator: 'PoHW Foundation',
                verified: true,
                primary: true
            },
            {
                id: 'production-railway',
                name: 'Production (Railway)',
                url: 'https://pohw-registry-node-production.up.railway.app',
                operator: 'PoHW Foundation',
                verified: true,
                primary: false
            }
        ];
        
        // Add localhost node if on localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.knownNodes.unshift({
                id: 'local-dev',
                name: 'Local Development',
                url: 'http://localhost:3000',
                operator: 'Local',
                verified: false,
                primary: false
            });
        }
    }

    /**
     * Discover registry nodes
     * Returns list of known nodes (can be extended with dynamic discovery)
     */
    async discoverNodes() {
        try {
            // Try to discover nodes from a discovery endpoint (if available)
            // For now, return known nodes
            const nodes = [...this.knownNodes];
            
            // Optionally try to fetch from a discovery service
            try {
                const response = await fetch('https://proofofhumanwork.org/registry/nodes.json', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                if (response.ok) {
                    const discovered = await response.json();
                    if (Array.isArray(discovered)) {
                        // Merge discovered nodes with known nodes
                        discovered.forEach(node => {
                            if (!nodes.find(n => n.url === node.url)) {
                                nodes.push(node);
                            }
                        });
                    }
                }
            } catch (e) {
                // Discovery service not available, use known nodes only
                console.log('[RegistryDiscovery] Discovery service not available, using known nodes');
            }
            
            return nodes;
        } catch (error) {
            console.error('[RegistryDiscovery] Discovery failed:', error);
            return this.knownNodes; // Fallback to known nodes
        }
    }

    /**
     * Check status of all nodes
     */
    async checkAllNodesStatus() {
        const nodes = await this.discoverNodes();
        const statusPromises = nodes.map(async (node) => {
            try {
                const status = await this.checkNodeStatus(node.url);
                return {
                    ...node,
                    status: status.status || 'unknown',
                    active: status.status === 'active',
                    latestHash: status.latest_hash,
                    timestamp: status.timestamp,
                    totalProofs: status.total_proofs
                };
            } catch (error) {
                return {
                    ...node,
                    status: 'offline',
                    active: false,
                    error: error.message
                };
            }
        });
        
        return Promise.all(statusPromises);
    }

    /**
     * Check status of a single node
     */
    async checkNodeStatus(nodeUrl) {
        try {
            const url = `${nodeUrl}/pohw/status`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`[RegistryDiscovery] Status check failed for ${nodeUrl}:`, error);
            throw error;
        }
    }

    /**
     * Get default registry URL
     */
    getDefaultRegistry() {
        // Prefer primary node, fallback to first available
        const primary = this.knownNodes.find(n => n.primary);
        if (primary) {
            return primary.url;
        }
        
        // If on localhost, prefer local
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const local = this.knownNodes.find(n => n.url.includes('localhost'));
            if (local) {
                return local.url;
            }
        }
        
        // Fallback to first node
        return this.knownNodes[0]?.url || 'https://gdn.sh';
    }

    /**
     * Add custom node
     */
    addCustomNode(url, name = null) {
        const node = {
            id: `custom-${Date.now()}`,
            name: name || url,
            url: url.replace(/\/$/, ''), // Remove trailing slash
            operator: 'Custom',
            verified: false,
            primary: false
        };
        
        // Check if already exists
        if (!this.knownNodes.find(n => n.url === node.url)) {
            this.knownNodes.push(node);
        }
        
        return node;
    }

    /**
     * Remove custom node
     */
    removeCustomNode(url) {
        this.knownNodes = this.knownNodes.filter(n => 
            !(n.url === url && n.operator === 'Custom')
        );
    }
}

