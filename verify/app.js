/**
 * PoHW Verification Web App
 * Main application logic
 */

// Initialize with default (will be updated by setupRegistrySelector)
let verificationClient = new VerificationClient();
let registryDiscovery = new RegistryDiscovery();

// DOM Elements
const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const hashInput = document.getElementById('hash-input');
const contentTextarea = document.getElementById('content-textarea');
const registrySelect = document.getElementById('registry-select');
const verifyButton = document.getElementById('verify-button');
const resultsSection = document.getElementById('results-section');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupFileUpload();
    setupVerifyButton();
    setupRegistrySelector();
});

/**
 * Tab switching
 */
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Clear results
            hideResults();
        });
    });
}

/**
 * File upload handling
 */
function setupFileUpload() {
    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

/**
 * Handle file selection
 */
function handleFileSelect(file) {
    const fileInfo = document.getElementById('file-info');
    fileInfo.classList.remove('hidden');
    fileInfo.innerHTML = `
        <div class="file-info-item">
            <span><strong>File:</strong> ${file.name}</span>
        </div>
        <div class="file-info-item">
            <span><strong>Size:</strong> ${formatFileSize(file.size)}</span>
        </div>
        <div class="file-info-item">
            <span><strong>Type:</strong> ${file.type || 'Unknown'}</span>
        </div>
    `;
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Setup verify button
 */
function setupVerifyButton() {
    verifyButton.addEventListener('click', async () => {
        await performVerification();
    });
    
    // Allow Enter key in inputs
    hashInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performVerification();
        }
    });
    
    contentTextarea.addEventListener('keypress', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            performVerification();
        }
    });
}

/**
 * Setup registry selector with dynamic discovery
 */
async function setupRegistrySelector() {
    // Discover registry nodes
    try {
        const nodes = await registryDiscovery.discoverNodes();
        console.log('[App] Discovered', nodes.length, 'registry nodes');
        
        // Populate dropdown
        registrySelect.innerHTML = '';
        nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.url;
            option.textContent = node.name;
            option.dataset.nodeId = node.id;
            option.dataset.operator = node.operator;
            option.dataset.verified = node.verified ? 'true' : 'false';
            registrySelect.appendChild(option);
        });
        
        // Check node statuses
        const nodesWithStatus = await registryDiscovery.checkAllNodesStatus();
        updateNodeStatusDisplay(nodesWithStatus);
        
        // Set default registry
        const defaultUrl = registryDiscovery.getDefaultRegistry();
        registrySelect.value = defaultUrl;
        verificationClient = new VerificationClient(defaultUrl);
        console.log('[App] Initialized with default registry:', defaultUrl);
        
    } catch (error) {
        console.error('[App] Registry discovery failed:', error);
        // Fallback to hardcoded defaults
        registrySelect.innerHTML = `
            <option value="https://gdn.sh">gdn.sh (Primary)</option>
            <option value="https://pohw-registry-node-production.up.railway.app">Production (Railway)</option>
        `;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const localOption = document.createElement('option');
            localOption.value = 'http://localhost:3000';
            localOption.textContent = 'Local Development';
            registrySelect.insertBefore(localOption, registrySelect.firstChild);
        }
        registrySelect.value = registrySelect.options[0].value;
        verificationClient = new VerificationClient(registrySelect.value);
    }
    
    // Setup custom registry input
    setupCustomRegistryInput();
    
    // Handle registry change
    registrySelect.addEventListener('change', async (e) => {
        const selectedUrl = e.target.value;
        console.log('[App] Registry changed to:', selectedUrl);
        
        // Warn if trying to use localhost from production site
        if (selectedUrl.includes('localhost') && 
            window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
            alert('⚠️ Localhost registry will not work from production site.\n\nPlease:\n1. Use a public registry, OR\n2. Access via http://localhost:8000/verify/');
            return;
        }
        
        verificationClient.setRegistryUrl(selectedUrl);
        
        // Update node status
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption) {
            updateSingleNodeStatus(selectedUrl);
        }
    });
}

/**
 * Setup custom registry input
 */
function setupCustomRegistryInput() {
    const addBtn = document.getElementById('add-custom-registry');
    const customInput = document.getElementById('custom-registry-input');
    const customUrlInput = document.getElementById('custom-registry-url');
    const addCustomBtn = document.getElementById('add-custom-btn');
    const cancelBtn = document.getElementById('cancel-custom-btn');
    
    if (!addBtn || !customInput) return;
    
    addBtn.addEventListener('click', () => {
        customInput.classList.remove('hidden');
        customUrlInput.focus();
    });
    
    cancelBtn?.addEventListener('click', () => {
        customInput.classList.add('hidden');
        customUrlInput.value = '';
    });
    
    addCustomBtn?.addEventListener('click', () => {
        const url = customUrlInput.value.trim();
        if (!url) return;
        
        // Validate URL
        try {
            new URL(url);
            
            // Add to dropdown
            const option = document.createElement('option');
            option.value = url;
            option.textContent = `Custom: ${new URL(url).hostname}`;
            option.dataset.nodeId = 'custom';
            registrySelect.appendChild(option);
            registrySelect.value = url;
            
            verificationClient.setRegistryUrl(url);
            customInput.classList.add('hidden');
            customUrlInput.value = '';
            
            // Check status
            updateSingleNodeStatus(url);
        } catch (e) {
            alert('Invalid URL. Please enter a valid URL (e.g., https://example.com)');
        }
    });
    
    customUrlInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCustomBtn?.click();
        }
    });
}

/**
 * Update node status display
 */
function updateNodeStatusDisplay(nodes) {
    const statusEl = document.getElementById('node-status');
    if (!statusEl) return;
    
    const selectedUrl = registrySelect.value;
    const selectedNode = nodes.find(n => n.url === selectedUrl);
    
    if (selectedNode) {
        if (selectedNode.online) {
            statusEl.innerHTML = `
                <span class="status-indicator online"></span>
                <span class="status-text">Online</span>
                ${selectedNode.responseTime ? `<span class="status-response">${selectedNode.responseTime.toFixed(0)}ms</span>` : ''}
            `;
            statusEl.className = 'node-status online';
        } else {
            statusEl.innerHTML = `
                <span class="status-indicator offline"></span>
                <span class="status-text">Offline</span>
            `;
            statusEl.className = 'node-status offline';
        }
    } else {
        statusEl.innerHTML = '';
        statusEl.className = 'node-status';
    }
}

/**
 * Update single node status
 */
async function updateSingleNodeStatus(url) {
    const statusEl = document.getElementById('node-status');
    if (!statusEl) return;
    
    statusEl.innerHTML = '<span class="status-text">Checking...</span>';
    statusEl.className = 'node-status checking';
    
    try {
        const client = new VerificationClient(url);
        const status = await client.checkNodeStatus();
        
        if (status.online) {
            statusEl.innerHTML = `
                <span class="status-indicator online"></span>
                <span class="status-text">Online</span>
                ${status.responseTime ? `<span class="status-response">${status.responseTime.toFixed(0)}ms</span>` : ''}
            `;
            statusEl.className = 'node-status online';
        } else {
            statusEl.innerHTML = `
                <span class="status-indicator offline"></span>
                <span class="status-text">Offline</span>
            `;
            statusEl.className = 'node-status offline';
        }
    } catch (error) {
        statusEl.innerHTML = `
            <span class="status-indicator offline"></span>
            <span class="status-text">Error</span>
        `;
        statusEl.className = 'node-status offline';
    }
}

/**
 * Perform verification
 */
async function performVerification() {
    // Get active tab
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    
    let hash = null;
    
    try {
        // Show loading state
        setLoading(true);
        hideResults();
        
        // Get hash based on active tab
        if (activeTab === 'file') {
            if (!fileInput.files || fileInput.files.length === 0) {
                showError('Please select a file to verify');
                setLoading(false);
                return;
            }
            hash = await hashFile(fileInput.files[0]);
        } else if (activeTab === 'hash') {
            const hashValue = hashInput.value.trim();
            if (!hashValue) {
                showError('Please enter a hash to verify');
                setLoading(false);
                return;
            }
            hash = hashValue.startsWith('0x') ? hashValue : '0x' + hashValue;
        } else if (activeTab === 'content') {
            const content = contentTextarea.value.trim();
            if (!content) {
                showError('Please enter content to verify');
                setLoading(false);
                return;
            }
            hash = await hashText(content);
        }
        
        if (!hash) {
            showError('Failed to generate hash');
            setLoading(false);
            return;
        }
        
        // Ensure we're using the current registry selection
        const currentRegistry = registrySelect.value;
        verificationClient = new VerificationClient(currentRegistry);
        console.log('[App] Using registry:', currentRegistry);
        
        // Verify with registry
        const result = await verificationClient.verifyProof(hash);
        
        // Get additional proof details
        const proofDetails = await verificationClient.getProof(hash);
        
        // Get batch anchors if available
        let anchors = null;
        if (proofDetails && proofDetails.batch_id) {
            anchors = await verificationClient.getBatchAnchors(proofDetails.batch_id);
        }
        
        // Get PAV claim (PAV Ontology Extension)
        const pavClaim = await verificationClient.getPAVClaim(hash);
        
        // Get reputation for the signer DID
        let reputation = null;
        if (result.signer || result.did) {
            try {
                const did = result.signer || result.did;
                reputation = await verificationClient.getReputation(did);
            } catch (error) {
                console.warn('Could not fetch reputation:', error);
            }
        }
        
        // Check if multiple proofs exist (only if verification was successful)
        let allProofsData = null;
        if (result.valid) {
            try {
                allProofsData = await verificationClient.getAllProofs(hash, { limit: 1 });
                if (allProofsData && allProofsData.total > 1) {
                    console.log(`[App] Found ${allProofsData.total} proofs for this hash`);
                }
            } catch (error) {
                console.warn('[App] Could not fetch all proofs:', error);
            }
        }
        
        // Display results
        displayResults(result, hash, proofDetails, anchors, pavClaim, reputation, allProofsData);
        
    } catch (error) {
        console.error('Verification error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            registry: verificationClient.registryUrl,
            hash: hash
        });
        
        // More specific error messages
        if (error.message && error.message.includes('Failed to fetch')) {
            showError(`Cannot connect to registry at ${verificationClient.registryUrl}. Make sure the registry is running.`);
        } else if (error.message && error.message.includes('CORS')) {
            showError('CORS error: The registry may not allow requests from this origin.');
        } else {
            showError(error.message || 'An error occurred during verification');
        }
    } finally {
        setLoading(false);
    }
}

/**
 * Determine verdict type based on proof data (Whitepaper Section 5.2)
 * Returns: 'human-authored', 'human-approved', 'ai-assisted', or 'indeterminate'
 */
function determineVerdict(result, pavClaim) {
    if (!result.valid) {
        return {
            type: 'indeterminate',
            explanation: 'Proof not found or invalid'
        };
    }

    // Check for process digest and entropy proof (human-authored indicators)
    const hasProcessDigest = pavClaim && pavClaim['pav:processDigest'];
    const hasEntropyProof = pavClaim && pavClaim['pav:entropyProof'];
    const hasTemporalCoherence = pavClaim && pavClaim['pav:temporalCoherence'];
    
    // Check for environment attestation
    const envAttestation = pavClaim && pavClaim['pav:environmentAttestation'];
    const isHumanOnly = envAttestation && (
        (Array.isArray(envAttestation) && envAttestation.some(e => e.toLowerCase().includes('human-only'))) ||
        (typeof envAttestation === 'string' && envAttestation.toLowerCase().includes('human-only'))
    );
    const isAIAssisted = envAttestation && (
        (Array.isArray(envAttestation) && envAttestation.some(e => e.toLowerCase().includes('ai-assisted'))) ||
        (typeof envAttestation === 'string' && envAttestation.toLowerCase().includes('ai-assisted'))
    );

    // Human-authored: Has process digest, entropy proof, and human-only mode
    if (hasProcessDigest && hasEntropyProof && isHumanOnly) {
        return {
            type: 'human-authored',
            explanation: 'Verified human work with process evidence and human-only attestation'
        };
    }

    // Human-approved: Has signer (DID) but may have AI assistance
    if (result.signer || result.did) {
        if (isAIAssisted) {
            return {
                type: 'ai-assisted',
                explanation: 'Human-approved work with AI assistance disclosed'
            };
        } else if (hasProcessDigest || hasEntropyProof) {
            return {
                type: 'human-approved',
                explanation: 'Verified human signature with process evidence'
            };
        } else {
            return {
                type: 'human-approved',
                explanation: 'Verified human signature (limited process evidence)'
            };
        }
    }

    // Indeterminate: Valid proof but insufficient evidence
    return {
        type: 'indeterminate',
        explanation: 'Proof is valid but lacks sufficient evidence to determine authorship type'
    };
}

/**
 * Display verification results
 */
function displayResults(result, hash, proofDetails, anchors, pavClaim, reputation, allProofsData = null) {
    resultsSection.classList.remove('hidden');
    
    // Determine verdict (Whitepaper requirement)
    const verdict = determineVerdict(result, pavClaim);
    
    // Status badge
    const statusBadge = document.getElementById('status-badge');
    if (result.valid) {
        statusBadge.textContent = 'VALID';
        statusBadge.className = 'status-badge valid';
    } else {
        statusBadge.textContent = 'INVALID';
        statusBadge.className = 'status-badge invalid';
    }
    
    // Basic results
    document.getElementById('result-status').textContent = result.valid ? 'VALID PROOF' : (result.error || 'INVALID');
    document.getElementById('result-signer').textContent = result.signer || result.did || '—';
    document.getElementById('result-timestamp').textContent = result.timestamp ? formatTimestamp(result.timestamp) : '—';
    document.getElementById('result-hash').textContent = hash;
    document.getElementById('result-registry').textContent = result.registry || verificationClient.registryUrl;
    
    // Show "View All Proofs" section if multiple proofs exist
    const allProofsSection = document.getElementById('all-proofs-section');
    if (allProofsData && allProofsData.total > 1 && result.valid) {
        allProofsSection.classList.remove('hidden');
        document.getElementById('proofs-count').textContent = `${allProofsData.total} proofs found`;
        setupAllProofsView(hash, allProofsData);
    } else {
        allProofsSection.classList.add('hidden');
    }
    
    // Deterministic Verdict (Whitepaper Section 5.2)
    const verdictTypeEl = document.getElementById('verdict-type');
    verdictTypeEl.textContent = verdict.type.toUpperCase().replace('-', ' ');
    verdictTypeEl.className = `result-value verdict-type verdict-${verdict.type}`;
    document.getElementById('verdict-explanation').textContent = verdict.explanation;
    
    // Merkle proof section - always show for transparency
    const merkleSection = document.getElementById('merkle-section');
    merkleSection.classList.remove('hidden');
    
    // Batch status
    const batchStatus = result.batch_status || 'pending';
    const statusElement = document.getElementById('batch-status');
    if (batchStatus === 'batched') {
        statusElement.textContent = 'Batched';
        statusElement.className = 'result-value status-batched';
    } else {
        statusElement.textContent = 'Pending Batching';
        statusElement.className = 'result-value status-pending';
    }
    
    // Batch ID (only show if batched)
    const batchIdItem = document.getElementById('batch-id-item');
    const batchIdElement = document.getElementById('batch-id');
    if (result.batch_id) {
        batchIdItem.classList.remove('hidden');
        batchIdElement.textContent = result.batch_id;
    } else {
        batchIdItem.classList.add('hidden');
    }
    
    // Batch size (only show if batched)
    const batchSizeItem = document.getElementById('batch-size-item');
    const batchSizeElement = document.getElementById('batch-size');
    if (result.batch_size !== undefined) {
        batchSizeItem.classList.remove('hidden');
        batchSizeElement.textContent = `${result.batch_size.toLocaleString()} proofs`;
    } else {
        batchSizeItem.classList.add('hidden');
    }
    
    // Position in batch (only show if batched)
    const merkleIndexItem = document.getElementById('merkle-index-item');
    const merkleIndexElement = document.getElementById('merkle-index');
    if (result.merkle_index !== undefined && result.batch_size !== undefined) {
        merkleIndexItem.classList.remove('hidden');
        merkleIndexElement.textContent = `Proof #${(result.merkle_index + 1).toLocaleString()} of ${result.batch_size.toLocaleString()}`;
    } else {
        merkleIndexItem.classList.add('hidden');
    }
    
    // Merkle root (only show if batched)
    const merkleRootItem = document.getElementById('merkle-root-item');
    const merkleRootElement = document.getElementById('merkle-root');
    if (result.merkle_root) {
        merkleRootItem.classList.remove('hidden');
        merkleRootElement.textContent = result.merkle_root;
    } else {
        merkleRootItem.classList.add('hidden');
    }
    
    // Proof path (only show if batched)
    const proofPathItem = document.getElementById('proof-path-item');
    const proofPath = document.getElementById('proof-path');
    if (result.merkle_proof && result.merkle_proof.length > 0) {
        proofPathItem.classList.remove('hidden');
        proofPath.innerHTML = result.merkle_proof.map((item, idx) => 
            `<div class="proof-path-item">${idx + 1}. ${item}</div>`
        ).join('');
    } else {
        proofPathItem.classList.add('hidden');
    }
    
    // Pending count (always show for transparency)
    const pendingCountItem = document.getElementById('pending-count-item');
    const pendingCountElement = document.getElementById('pending-count');
    if (result.pending_count !== undefined) {
        pendingCountItem.classList.remove('hidden');
        pendingCountElement.textContent = `${result.pending_count.toLocaleString()} proofs pending batching`;
    } else {
        pendingCountItem.classList.add('hidden');
    }
    
    // Blockchain anchors section
    const anchorsSection = document.getElementById('anchors-section');
    if (anchors && anchors.anchors && anchors.anchors.length > 0) {
        anchorsSection.classList.remove('hidden');
        const anchorsList = document.getElementById('anchors-list');
        
        anchorsList.innerHTML = anchors.anchors.map(anchor => {
            const explorerUrl = anchor.explorer_url || getExplorerUrl(anchor.chain, anchor.txHash);
            return `
                <div class="anchor-item">
                    <div class="anchor-item-header">
                        <span class="anchor-chain">${anchor.chain.toUpperCase()}</span>
                        ${explorerUrl ? `<a href="${explorerUrl}" target="_blank" class="anchor-link">View on Explorer →</a>` : ''}
                    </div>
                    <div class="anchor-tx">${anchor.txHash || anchor.tx || '—'}</div>
                    ${anchor.block ? `<div class="anchor-tx">Block: ${anchor.block}</div>` : ''}
                </div>
            `;
        }).join('');
    } else {
        anchorsSection.classList.add('hidden');
    }
    
    // PAV Ontology Section (always show, even if data is missing)
    // Use data from result if PAV claim is not available
    if (pavClaim) {
        // Core Provenance
        document.getElementById('pav-created-by').textContent = pavClaim['pav:createdBy'] || '—';
        document.getElementById('pav-created-on').textContent = pavClaim['pav:createdOn'] ? formatTimestamp(pavClaim['pav:createdOn']) : '—';
    } else if (result.valid) {
        // Fallback to result data if PAV claim not available
        document.getElementById('pav-created-by').textContent = result.signer || result.did || '—';
        document.getElementById('pav-created-on').textContent = result.timestamp ? formatTimestamp(result.timestamp) : '—';
    } else {
        document.getElementById('pav-created-by').textContent = '—';
        document.getElementById('pav-created-on').textContent = '—';
    }
    
    if (pavClaim) {
        
        // Handle derivedFrom - check if it's structured (from proof record) or simple (from PAV claim)
        const proofRecord = result.proof;
        let derivedFromDisplay = '—';
        let derivedFromElement = document.getElementById('pav-derived-from');
        
        if (proofRecord && proofRecord.derived_from) {
            try {
                const derivedFrom = typeof proofRecord.derived_from === 'string' 
                    ? JSON.parse(proofRecord.derived_from)
                    : proofRecord.derived_from;
                
                // Check if structured format
                if (Array.isArray(derivedFrom) && derivedFrom.length > 0 && typeof derivedFrom[0] === 'object') {
                    // Structured format - create HTML with source references only (privacy-preserving)
                    // Per whitepaper Section 6.5: "No behavioral or process telemetry ever leaves the local device"
                    // We show source references, not quoted text
                    let html = '';
                    derivedFrom.forEach((m, i) => {
                        const typeLabel = m.sourceType === 'other' && m.otherType 
                            ? `${m.sourceType} (${m.otherType})` 
                            : m.sourceType;
                        
                        html += `<div style="margin-bottom: 0.75rem;">`;
                        html += `<div style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 0.25rem;">${i + 1}.</div>`;
                        
                        // Source reference (with link if URL or DOI)
                        if (m.sourceType === 'url' || m.sourceType === 'doi') {
                            const linkUrl = m.source.startsWith('doi:') 
                                ? `https://doi.org/${m.source.substring(4)}` 
                                : m.source;
                            html += `<div style="font-size: 0.8rem; color: var(--accent-green); font-family: 'IBM Plex Mono', monospace; margin-left: 1rem; margin-bottom: 0.25rem;">`;
                            html += `→ <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-green); text-decoration: none;">${m.source}</a>`;
                            html += `</div>`;
                        } else {
                            // PoHW hash or other - no link
                            html += `<div style="font-size: 0.8rem; color: var(--accent-green); font-family: 'IBM Plex Mono', monospace; margin-left: 1rem; margin-bottom: 0.25rem;">→ ${m.source}</div>`;
                        }
                        
                        html += `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 1rem;">Type: ${typeLabel}</div>`;
                        
                        // Add content address if available (per whitepaper Section 7.3)
                        // This allows retrieval of archived content without storing it in registry
                        if (m.contentAddress) {
                            const addressType = m.contentAddress.type === 'ipfs' ? 'IPFS' : 'Arweave';
                            html += `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 1rem; margin-top: 0.25rem;">`;
                            html += `<span>${addressType}: </span>`;
                            html += `<a href="${m.contentAddress.url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-green); text-decoration: none; font-family: 'IBM Plex Mono', monospace;">`;
                            html += `${m.contentAddress.value.length > 40 ? m.contentAddress.value.substring(0, 40) + '...' : m.contentAddress.value}`;
                            html += `</a>`;
                            html += `</div>`;
                        }
                        
                        html += `</div>`;
                    });
                    derivedFromDisplay = html;
                    if (derivedFromElement) {
                        derivedFromElement.innerHTML = derivedFromDisplay;
                    }
                } else {
                    // Simple format
                    derivedFromDisplay = Array.isArray(derivedFrom) ? derivedFrom.join(', ') : derivedFrom;
                    if (derivedFromElement) {
                        derivedFromElement.textContent = derivedFromDisplay;
                    }
                }
            } catch (e) {
                console.warn('[Verify] Error parsing derived_from from proof record:', e);
                // Fallback to PAV claim value (should be string/array of strings per PAV ontology)
                const derivedFrom = pavClaim['pav:derivedFrom'];
                if (derivedFrom) {
                    // PAV claim should only contain source references (strings), not objects
                    if (Array.isArray(derivedFrom)) {
                        derivedFromDisplay = derivedFrom.map(s => typeof s === 'string' ? s : String(s)).join(', ');
                    } else if (typeof derivedFrom === 'string') {
                        derivedFromDisplay = derivedFrom;
                    } else {
                        // Unexpected: object in PAV claim (shouldn't happen per ontology)
                        console.warn('[Verify] pav:derivedFrom contains unexpected type:', typeof derivedFrom);
                        derivedFromDisplay = 'Invalid format';
                    }
                    if (derivedFromElement) {
                        derivedFromElement.textContent = derivedFromDisplay;
                    }
                } else if (derivedFromElement) {
                    derivedFromElement.textContent = '—';
                }
            }
        } else {
            // Fallback to PAV claim value (should be string/array of strings per PAV ontology)
            const derivedFrom = pavClaim['pav:derivedFrom'];
            if (derivedFrom) {
                // PAV claim should only contain source references (strings), not objects
                if (Array.isArray(derivedFrom)) {
                    derivedFromDisplay = derivedFrom.map(s => typeof s === 'string' ? s : String(s)).join(', ');
                } else if (typeof derivedFrom === 'string') {
                    derivedFromDisplay = derivedFrom;
                } else {
                    // Unexpected: object in PAV claim (shouldn't happen per ontology)
                    console.warn('[Verify] pav:derivedFrom contains unexpected type:', typeof derivedFrom);
                    derivedFromDisplay = 'Invalid format';
                }
                if (derivedFromElement) {
                    derivedFromElement.textContent = derivedFromDisplay;
                }
            } else if (derivedFromElement) {
                derivedFromElement.textContent = '—';
            }
        }
        
        // Content Archive URI (pohw:claimURI) - per whitepaper Section 7.3
        const claimURI = pavClaim['pohw:claimURI'];
        const claimURIEl = document.getElementById('pav-claim-uri');
        if (claimURI && claimURIEl) {
            let displayURI = claimURI;
            let linkUrl = '';
            
            // Parse URI format (ipfs://, ar://, or plain CID/TX ID)
            if (claimURI.startsWith('ipfs://')) {
                const cid = claimURI.substring(7);
                displayURI = cid;
                linkUrl = `https://ipfs.io/ipfs/${cid}`;
            } else if (claimURI.startsWith('ar://')) {
                const txId = claimURI.substring(5);
                displayURI = txId;
                linkUrl = `https://arweave.net/${txId}`;
            } else if (claimURI.startsWith('Qm') || claimURI.startsWith('baf')) {
                // IPFS CID without prefix
                displayURI = claimURI;
                linkUrl = `https://ipfs.io/ipfs/${claimURI}`;
            } else {
                // Assume Arweave TX ID
                displayURI = claimURI;
                linkUrl = `https://arweave.net/${claimURI}`;
            }
            
            claimURIEl.innerHTML = `
                <div style="font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; color: var(--accent-green); word-break: break-all; margin-bottom: 0.25rem;">
                    ${displayURI.length > 60 ? displayURI.substring(0, 60) + '...' : displayURI}
                </div>
                <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: var(--accent-green); text-decoration: none;">
                    ${claimURI.startsWith('ipfs://') || claimURI.startsWith('Qm') || claimURI.startsWith('baf') ? 'View on IPFS' : 'View on Arweave'}
                </a>
            `;
        } else if (claimURIEl) {
            claimURIEl.textContent = '—';
        }
        
        // Environment Attestations
        document.getElementById('pav-device').textContent = pavClaim['pav:authoredOnDevice'] || '—';
        const envAttestation = pavClaim['pav:environmentAttestation'];
        if (envAttestation) {
            const envValue = Array.isArray(envAttestation) ? envAttestation.join(', ') : envAttestation;
            document.getElementById('pav-environment').textContent = envValue;
        } else {
            document.getElementById('pav-environment').textContent = '—';
        }
        
        // Process Layer Evidence
        document.getElementById('pav-process-digest').textContent = pavClaim['pav:processDigest'] || '—';
        document.getElementById('pav-entropy').textContent = pavClaim['pav:entropyProof'] || '—';
        document.getElementById('pav-coherence').textContent = pavClaim['pav:temporalCoherence'] || '—';
        document.getElementById('pav-compound-hash').textContent = pavClaim['pohw:compoundHash'] || '—';
        
        // Cryptographic Attestations
        // Signature is only in PAV claim, not in result
        document.getElementById('pav-signature').textContent = pavClaim['pav:signature'] || '—';
        
        // Use Merkle proof from result if PAV claim doesn't have it
        const merkleInclusion = pavClaim['pav:merkleInclusion'] || 
            (result.merkle_proof && result.merkle_proof.length > 0 ? result.merkle_proof.join(', ') : null);
        document.getElementById('pav-merkle-inclusion').textContent = merkleInclusion || '—';
    } else {
        // Show all fields as "—" if PAV claim not available, but try to use result data
        // Signature is only available in PAV claim
        document.getElementById('pav-signature').textContent = '—';
        
        // Use Merkle proof from result if available
        if (result.valid && result.merkle_proof && result.merkle_proof.length > 0) {
            document.getElementById('pav-merkle-inclusion').textContent = result.merkle_proof.join(', ');
        } else {
            document.getElementById('pav-merkle-inclusion').textContent = '—';
        }
        
        // All other PAV fields show "—" if not in PAV claim
        document.getElementById('pav-derived-from').textContent = '—';
        document.getElementById('pav-device').textContent = '—';
        document.getElementById('pav-environment').textContent = '—';
        document.getElementById('pav-process-digest').textContent = '—';
        document.getElementById('pav-entropy').textContent = '—';
        document.getElementById('pav-coherence').textContent = '—';
        document.getElementById('pav-compound-hash').textContent = '—';
    }
    
    // Additional PAV fields (Verification & Compliance)
    document.getElementById('pav-assistance').textContent = pavClaim?.['pav:assistanceProfile'] || '—';
    document.getElementById('pav-tier').textContent = pavClaim?.['pav:verificationTier'] || '—';
    document.getElementById('pav-revocation').textContent = pavClaim?.['pav:revocationState'] || '—';
    
    // Registry Anchor (can be a link)
    const registryAnchor = pavClaim?.['pav:registryAnchor'];
    if (registryAnchor) {
        const anchorEl = document.getElementById('pav-registry-anchor');
        anchorEl.innerHTML = `<a href="${registryAnchor}" target="_blank" class="anchor-link">${registryAnchor}</a>`;
    } else {
        document.getElementById('pav-registry-anchor').textContent = '—';
    }
    
    // Compliance Profile (can be a link)
    const complianceProfile = pavClaim?.['pav:complianceProfile'];
    if (complianceProfile) {
        const complianceEl = document.getElementById('pav-compliance');
        complianceEl.innerHTML = `<a href="${complianceProfile}" target="_blank" class="anchor-link">${complianceProfile}</a>`;
    } else {
        document.getElementById('pav-compliance').textContent = '—';
    }
    
    // Reputation Section
    const reputationSection = document.getElementById('reputation-section');
    if (reputation && reputation.reputation) {
        reputationSection.classList.remove('hidden');
        const rep = reputation.reputation;
        document.getElementById('reputation-score').textContent = rep.score ? Math.floor(rep.score) : '—';
        const tier = rep.tier ? rep.tier.toUpperCase() : '—';
        document.getElementById('reputation-tier').textContent = tier;
        document.getElementById('reputation-tier').className = `result-value reputation-tier tier-${rep.tier || 'unknown'}`;
        document.getElementById('reputation-trust').textContent = rep.trustLevel ? (rep.trustLevel * 100).toFixed(1) + '%' : '—';
        document.getElementById('reputation-proofs').textContent = rep.successfulProofs || 0;
        document.getElementById('reputation-anomalies').textContent = rep.anomalies || 0;
    } else {
        reputationSection.classList.add('hidden');
    }
    
    // Challenge Section (show if proof is valid)
    const challengeSection = document.getElementById('challenge-section');
    if (result.valid && hash) {
        challengeSection.classList.remove('hidden');
        loadChallenges(hash);
    } else {
        challengeSection.classList.add('hidden');
    }
    
    // Error section
    const errorSection = document.getElementById('error-section');
    if (result.error && !result.valid) {
        errorSection.classList.remove('hidden');
        document.getElementById('error-message').textContent = result.error;
    } else {
        errorSection.classList.add('hidden');
    }
}

/**
 * Get blockchain explorer URL
 */
function getExplorerUrl(chain, txHash) {
    if (!txHash) return null;
    
    const explorers = {
        bitcoin: `https://blockstream.info/testnet/tx/${txHash}`,
        ethereum: `https://sepolia.etherscan.io/tx/${txHash}`,
        mainnet: {
            bitcoin: `https://blockstream.info/tx/${txHash}`,
            ethereum: `https://etherscan.io/tx/${txHash}`
        }
    };
    
    return explorers[chain] || null;
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString();
    } catch (e) {
        return timestamp;
    }
}

/**
 * Show error message
 */
function showError(message) {
    resultsSection.classList.remove('hidden');
    const errorSection = document.getElementById('error-section');
    errorSection.classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
    
    // Set status to invalid
    const statusBadge = document.getElementById('status-badge');
    statusBadge.textContent = 'ERROR';
    statusBadge.className = 'status-badge invalid';
    document.getElementById('result-status').textContent = 'ERROR';
}

/**
 * Hide results
 */
function hideResults() {
    resultsSection.classList.add('hidden');
}

/**
 * Set loading state
 */
function setLoading(loading) {
    verifyButton.disabled = loading;
    const buttonText = verifyButton.querySelector('.button-text');
    const buttonLoader = verifyButton.querySelector('.button-loader');
    
    if (loading) {
        buttonText.textContent = 'VERIFYING...';
        buttonLoader.classList.remove('hidden');
    } else {
        buttonText.textContent = 'VERIFY PROOF';
        buttonLoader.classList.add('hidden');
    }
}

/**
 * Setup "View All Proofs" functionality with search/filter
 */
let currentProofsFilters = {
    did: '',
    tier: 'all',
    from: null,
    to: null,
    sort: 'newest',
    verifiedOnly: false,
    limit: 50,
    offset: 0
};

let currentHashForProofs = null;

function setupAllProofsView(hash, initialData) {
    currentHashForProofs = hash;
    
    // Load initial proofs
    loadAllProofs(hash, currentProofsFilters);
    
    // Setup search/filter handlers
    setupProofsSearchFilter();
}

function setupProofsSearchFilter() {
    const searchInput = document.getElementById('proof-search-did');
    const tierFilter = document.getElementById('proof-filter-tier');
    const sortSelect = document.getElementById('proof-sort');
    const verifiedCheckbox = document.getElementById('proof-filter-verified');
    const fromDate = document.getElementById('proof-filter-from');
    const toDate = document.getElementById('proof-filter-to');
    const clearBtn = document.getElementById('clear-filters-btn');
    
    // Search by DID (debounced)
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentProofsFilters.did = e.target.value.trim();
            currentProofsFilters.offset = 0; // Reset to first page
            loadAllProofs(currentHashForProofs, currentProofsFilters);
        }, 300);
    });
    
    // Tier filter
    tierFilter?.addEventListener('change', (e) => {
        currentProofsFilters.tier = e.target.value;
        currentProofsFilters.offset = 0;
        loadAllProofs(currentHashForProofs, currentProofsFilters);
    });
    
    // Sort
    sortSelect?.addEventListener('change', (e) => {
        currentProofsFilters.sort = e.target.value;
        currentProofsFilters.offset = 0;
        loadAllProofs(currentHashForProofs, currentProofsFilters);
    });
    
    // Verified only
    verifiedCheckbox?.addEventListener('change', (e) => {
        currentProofsFilters.verifiedOnly = e.target.checked;
        if (e.target.checked) {
            // If verified only, filter to green/blue
            currentProofsFilters.tier = 'all'; // Will filter in loadAllProofs
            tierFilter.value = 'all';
        }
        currentProofsFilters.offset = 0;
        loadAllProofs(currentHashForProofs, currentProofsFilters);
    });
    
    // Date filters
    fromDate?.addEventListener('change', (e) => {
        currentProofsFilters.from = e.target.value || null;
        currentProofsFilters.offset = 0;
        loadAllProofs(currentHashForProofs, currentProofsFilters);
    });
    
    toDate?.addEventListener('change', (e) => {
        currentProofsFilters.to = e.target.value || null;
        currentProofsFilters.offset = 0;
        loadAllProofs(currentHashForProofs, currentProofsFilters);
    });
    
    // Clear filters
    clearBtn?.addEventListener('click', () => {
        currentProofsFilters = {
            did: '',
            tier: 'all',
            from: null,
            to: null,
            sort: 'newest',
            verifiedOnly: false,
            limit: 50,
            offset: 0
        };
        
        searchInput.value = '';
        tierFilter.value = 'all';
        sortSelect.value = 'newest';
        verifiedCheckbox.checked = false;
        fromDate.value = '';
        toDate.value = '';
        
        loadAllProofs(currentHashForProofs, currentProofsFilters);
    });
}

async function loadAllProofs(hash, filters) {
    if (!hash) return;
    
    const proofsList = document.getElementById('proofs-list');
    const proofsCount = document.getElementById('proofs-count');
    const pagination = document.getElementById('proofs-pagination');
    
    proofsList.innerHTML = '<div class="loading-proofs">Loading proofs...</div>';
    
    try {
        // Apply verified-only filter client-side if needed
        let apiFilters = { ...filters };
        if (filters.verifiedOnly) {
            // We'll filter client-side, but also set tier to help
            // The API will return all, we filter to green/blue
        }
        
        const data = await verificationClient.getAllProofs(hash, apiFilters);
        
        // Apply verified-only filter if needed (client-side for accurate count)
        let filteredProofs = data.proofs;
        let total = data.total;
        
        if (filters.verifiedOnly) {
            filteredProofs = filteredProofs.filter(p => p.tier === 'green' || p.tier === 'blue');
            // For verified-only, we need to fetch all and filter to get accurate count
            // For now, estimate based on current page
            if (data.has_more || filters.offset > 0) {
                // If there are more pages, we can't know exact count without fetching all
                // Show approximate count
                total = filteredProofs.length + (data.has_more ? ' (showing filtered)' : '');
            } else {
                total = filteredProofs.length;
            }
        }
        proofsCount.textContent = `${total} proof${total !== 1 ? 's' : ''} found`;
        
        // Display proofs
        if (filteredProofs.length === 0) {
            proofsList.innerHTML = '<div class="no-proofs">No proofs match your filters.</div>';
            pagination.classList.add('hidden');
        } else {
            proofsList.innerHTML = filteredProofs.map((proof, index) => {
                const tierClass = `tier-${proof.tier || 'grey'}`;
                const tierLabel = (proof.tier || 'grey').charAt(0).toUpperCase() + (proof.tier || 'grey').slice(1);
                return `
                    <div class="proof-item ${tierClass}">
                        <div class="proof-header">
                            <span class="proof-number">Proof #${filters.offset + index + 1}</span>
                            <span class="proof-tier ${tierClass}">${tierLabel}</span>
                        </div>
                        <div class="proof-details">
                            <div class="proof-detail-item">
                                <span class="proof-label">Signer DID:</span>
                                <span class="proof-value">${proof.did}</span>
                            </div>
                            <div class="proof-detail-item">
                                <span class="proof-label">Timestamp:</span>
                                <span class="proof-value">${formatTimestamp(proof.timestamp)}</span>
                            </div>
                            ${proof.batch_id ? `
                            <div class="proof-detail-item">
                                <span class="proof-label">Batch ID:</span>
                                <span class="proof-value">${proof.batch_id}</span>
                            </div>
                            ` : ''}
                        </div>
                        <button class="view-proof-btn" onclick="viewProofDetails('${proof.did}', '${proof.timestamp}')">View Details</button>
                    </div>
                `;
            }).join('');
            
            // Setup pagination (use numeric total for pagination)
            const numericTotal = typeof total === 'number' ? total : data.total;
            setupPagination(numericTotal, filters.limit, filters.offset);
        }
    } catch (error) {
        console.error('Error loading all proofs:', error);
        proofsList.innerHTML = `<div class="error-proofs">Error loading proofs: ${error.message}</div>`;
        pagination.classList.add('hidden');
    }
}

function setupPagination(total, limit, offset) {
    const pagination = document.getElementById('proofs-pagination');
    if (total <= limit) {
        pagination.classList.add('hidden');
        return;
    }
    
    pagination.classList.remove('hidden');
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    
    let paginationHTML = '<div class="pagination-controls">';
    
    // Previous button
    if (offset > 0) {
        paginationHTML += `<button class="pagination-btn" onclick="changeProofsPage(${offset - limit})">← Previous</button>`;
    }
    
    // Page numbers
    const maxPagesToShow = 10;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="changeProofsPage(0)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageOffset = (i - 1) * limit;
        paginationHTML += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changeProofsPage(${pageOffset})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
        const lastPageOffset = (totalPages - 1) * limit;
        paginationHTML += `<button class="pagination-btn" onclick="changeProofsPage(${lastPageOffset})">${totalPages}</button>`;
    }
    
    // Next button
    if (offset + limit < total) {
        paginationHTML += `<button class="pagination-btn" onclick="changeProofsPage(${offset + limit})">Next →</button>`;
    }
    
    paginationHTML += '</div>';
    pagination.innerHTML = paginationHTML;
}

// Global function for pagination (called from onclick)
window.changeProofsPage = function(newOffset) {
    currentProofsFilters.offset = newOffset;
    loadAllProofs(currentHashForProofs, currentProofsFilters);
    // Scroll to proofs section
    document.getElementById('all-proofs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Global function for viewing proof details
window.viewProofDetails = function(did, timestamp) {
    // Filter to show this specific proof
    currentProofsFilters.did = did;
    currentProofsFilters.offset = 0;
    loadAllProofs(currentHashForProofs, currentProofsFilters);
    
    // Scroll to the proof
    setTimeout(() => {
        const proofItems = document.querySelectorAll('.proof-item');
        proofItems.forEach(item => {
            if (item.textContent.includes(did)) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                item.style.border = '2px solid var(--accent-green)';
                setTimeout(() => {
                    item.style.border = '';
                }, 2000);
            }
        });
    }, 100);
};

/**
 * Challenge/Dispute Resolution Functions
 */

// Setup challenge UI handlers
document.addEventListener('DOMContentLoaded', () => {
    const submitChallengeBtn = document.getElementById('submit-challenge-btn');
    const viewChallengesBtn = document.getElementById('view-challenges-btn');
    const cancelChallengeBtn = document.getElementById('cancel-challenge-btn');
    const submitChallengeSubmit = document.getElementById('submit-challenge-submit');
    
    if (submitChallengeBtn) {
        submitChallengeBtn.addEventListener('click', () => {
            const form = document.getElementById('challenge-form');
            form.classList.remove('hidden');
        });
    }
    
    if (cancelChallengeBtn) {
        cancelChallengeBtn.addEventListener('click', () => {
            const form = document.getElementById('challenge-form');
            form.classList.add('hidden');
            // Clear form
            document.getElementById('challenger-did').value = '';
            document.getElementById('challenge-reason').value = 'suspected_ai_generated';
            document.getElementById('challenge-description').value = '';
        });
    }
    
    if (viewChallengesBtn) {
        viewChallengesBtn.addEventListener('click', () => {
            const hashInput = document.getElementById('hash-input');
            const hash = hashInput ? hashInput.value.trim() : null;
            if (hash) {
                loadChallenges(hash, true);
            }
        });
    }
    
    if (submitChallengeSubmit) {
        submitChallengeSubmit.addEventListener('click', async () => {
            await submitChallenge();
        });
    }
});

/**
 * Load challenges for a proof hash
 */
async function loadChallenges(hash, showList = false) {
    try {
        const registryUrl = verificationClient.getRegistryUrl();
        if (!registryUrl) {
            console.error('No registry URL available');
            return;
        }
        
        // Normalize hash
        let normalizedHash = hash;
        if (!normalizedHash.startsWith('0x')) {
            normalizedHash = '0x' + normalizedHash;
        }
        
        const response = await fetch(`${registryUrl}/pohw/proofs/${normalizedHash}/challenges`);
        if (!response.ok) {
            if (response.status === 404) {
                // No challenges yet
                document.getElementById('challenge-count').textContent = '0';
                return;
            }
            throw new Error(`Failed to load challenges: ${response.statusText}`);
        }
        
        const data = await response.json();
        const challenges = data.challenges || [];
        
        document.getElementById('challenge-count').textContent = challenges.length.toString();
        
        if (showList && challenges.length > 0) {
            displayChallenges(challenges);
        }
    } catch (error) {
        console.error('Error loading challenges:', error);
        document.getElementById('challenge-count').textContent = '—';
    }
}

/**
 * Display challenges list
 */
function displayChallenges(challenges) {
    const challengeList = document.getElementById('challenge-list');
    const challengeListItem = document.getElementById('challenge-list-item');
    
    if (challenges.length === 0) {
        challengeListItem.style.display = 'none';
        return;
    }
    
    challengeListItem.style.display = 'block';
    
    const statusLabels = {
        'pending': 'Pending',
        'responded': 'Responded',
        'resolved': 'Resolved',
        'dismissed': 'Dismissed'
    };
    
    const reasonLabels = {
        'suspected_ai_generated': 'Suspected AI-Generated',
        'suspected_plagiarism': 'Suspected Plagiarism',
        'suspected_fraud': 'Suspected Fraud',
        'entropy_discrepancy': 'Entropy Discrepancy',
        'rate_limit_anomaly': 'Rate Limit Anomaly',
        'process_metrics_inconsistent': 'Process Metrics Inconsistent',
        'other': 'Other'
    };
    
    challengeList.innerHTML = challenges.map(challenge => `
        <div class="challenge-item">
            <div class="challenge-item-header">
                <span class="challenge-item-reason">${reasonLabels[challenge.reason] || challenge.reason}</span>
                <span class="challenge-item-status">${statusLabels[challenge.status] || challenge.status}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.5rem;">
                Challenger: ${challenge.challenger_did}
            </div>
            <div style="color: var(--text-primary);">
                ${challenge.description}
            </div>
            ${challenge.author_response ? `
                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color); color: var(--text-secondary); font-size: 0.8rem;">
                    <strong>Author Response:</strong> ${challenge.author_response}
                </div>
            ` : ''}
            ${challenge.resolution ? `
                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color); color: var(--accent-green); font-size: 0.8rem;">
                    <strong>Resolution:</strong> ${challenge.resolution} ${challenge.resolution_notes ? `- ${challenge.resolution_notes}` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
}

/**
 * Submit a challenge
 */
async function submitChallenge() {
    try {
        const hashInput = document.getElementById('hash-input');
        const challengerDid = document.getElementById('challenger-did').value.trim();
        const reason = document.getElementById('challenge-reason').value;
        const description = document.getElementById('challenge-description').value.trim();
        
        if (!hashInput || !hashInput.value.trim()) {
            alert('Please verify a proof first');
            return;
        }
        
        if (!challengerDid) {
            alert('Please enter your DID');
            return;
        }
        
        if (!description) {
            alert('Please enter a description');
            return;
        }
        
        const hash = hashInput.value.trim();
        let normalizedHash = hash;
        if (!normalizedHash.startsWith('0x')) {
            normalizedHash = '0x' + normalizedHash;
        }
        
        const registryUrl = verificationClient.getRegistryUrl();
        if (!registryUrl) {
            alert('No registry URL available');
            return;
        }
        
        const response = await fetch(`${registryUrl}/pohw/proofs/${normalizedHash}/challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                challenger_did: challengerDid,
                reason: reason,
                description: description
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit challenge');
        }
        
        const data = await response.json();
        alert(`Challenge submitted successfully! Challenge ID: ${data.challenge_id}`);
        
        // Hide form and reload challenges
        document.getElementById('challenge-form').classList.add('hidden');
        document.getElementById('challenger-did').value = '';
        document.getElementById('challenge-reason').value = 'suspected_ai_generated';
        document.getElementById('challenge-description').value = '';
        
        // Reload challenges
        await loadChallenges(normalizedHash);
    } catch (error) {
        console.error('Error submitting challenge:', error);
        alert(`Error: ${error.message}`);
    }
}

