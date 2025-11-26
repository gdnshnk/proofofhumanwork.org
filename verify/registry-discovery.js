/**
 * PoHW Registry Discovery System
 * Dynamically discovers and manages registry nodes
 */

class RegistryDiscovery {
    constructor() {
        this.discoverySources = [
            'https://proofofhumanwork.org/.well-known/registry-nodes.json',
            'https://gdn.sh/.well-known/registry-nodes.json'
        ];
        this.discoveredNodes = [];
        this.defaultNodes = [
            {
                id: 'gdn.sh',
                url: 'https://gdn.sh',
                name: 'gdn.sh (Primary Node)',
                operator: 'PoHW Foundation',
                status: 'active',
                verified: true,
                location: 'US'
            },
            {
                id: 'railway-prod',
                url: 'https://pohw-registry-node-production.up.railway.app',
                name: 'Production (Railway)',
                operator: 'PoHW Foundation',
                status: 'active',
                verified: true,
                location: 'US'
            }
        ];
    }

    /**
     * Discover registry nodes from multiple sources
     */
    async discoverNodes() {
        const allNodes = new Map();
        
        // Add default nodes
        this.defaultNodes.forEach(node => {
            allNodes.set(node.id, node);
        });

        // Try to discover from sources
        for (const source of this.discoverySources) {
            try {
                const response = await fetch(source, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.nodes && Array.isArray(data.nodes)) {
                        data.nodes.forEach(node => {
                            if (node.status === 'active') {
                                allNodes.set(node.id || node.url, {
                                    id: node.id || node.url,
                                    url: node.url,
                                    name: node.name || node.url,
                                    operator: node.operator || 'Unknown',
                                    status: node.status || 'active',
                                    verified: node.verified || false,
                                    location: node.location || 'Unknown'
                                });
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn(`Failed to discover from ${source}:`, error);
                // Continue to next source
            }
        }

        // Add localhost if on localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            allNodes.set('localhost', {
                id: 'localhost',
                url: 'http://localhost:3000',
                name: 'Local Development',
                operator: 'Local',
                status: 'active',
                verified: false,
                location: 'Local'
            });
        }

        this.discoveredNodes = Array.from(allNodes.values());
        return this.discoveredNodes;
    }

    /**
     * Check status of all discovered nodes
     */
    async checkAllNodesStatus() {
        const statusChecks = await Promise.allSettled(
            this.discoveredNodes.map(async (node) => {
                const client = new VerificationClient(node.url);
                const status = await client.checkNodeStatus();
                return {
                    ...node,
                    ...status
                };
            })
        );

        return statusChecks.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    ...this.discoveredNodes[index],
                    online: false,
                    error: result.reason?.message || 'Unknown error'
                };
            }
        });
    }

    /**
     * Get default registry URL based on environment
     */
    getDefaultRegistry() {
        // On localhost, prefer localhost registry
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        
        // Otherwise, prefer gdn.sh (primary node)
        const primary = this.discoveredNodes.find(n => n.id === 'gdn.sh');
        if (primary) {
            return primary.url;
        }
        
        // Fallback to first discovered node
        if (this.discoveredNodes.length > 0) {
            return this.discoveredNodes[0].url;
        }
        
        // Final fallback
        return 'https://gdn.sh';
    }
}

