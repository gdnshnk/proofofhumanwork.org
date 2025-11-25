/**
 * PoHW Verification Web App
 * Main application logic
 */

let verificationClient = new VerificationClient();

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
 * Setup registry selector
 */
function setupRegistrySelector() {
    // Initialize with default selected value
    verificationClient = new VerificationClient(registrySelect.value);
    console.log('[App] Initialized with registry:', registrySelect.value);
    
    registrySelect.addEventListener('change', (e) => {
        console.log('[App] Registry changed to:', e.target.value);
        verificationClient = new VerificationClient(e.target.value);
    });
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
        
        // Display results
        displayResults(result, hash, proofDetails, anchors, pavClaim);
        
    } catch (error) {
        console.error('Verification error:', error);
        showError(error.message || 'An error occurred during verification');
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
function displayResults(result, hash, proofDetails, anchors, pavClaim) {
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
    
    // Deterministic Verdict (Whitepaper Section 5.2)
    const verdictTypeEl = document.getElementById('verdict-type');
    verdictTypeEl.textContent = verdict.type.toUpperCase().replace('-', ' ');
    verdictTypeEl.className = `result-value verdict-type verdict-${verdict.type}`;
    document.getElementById('verdict-explanation').textContent = verdict.explanation;
    
    // Merkle proof section
    const merkleSection = document.getElementById('merkle-section');
    if (result.merkle_root || result.merkle_proof) {
        merkleSection.classList.remove('hidden');
        document.getElementById('merkle-root').textContent = result.merkle_root || '—';
        
        const proofPath = document.getElementById('proof-path');
        if (result.merkle_proof && result.merkle_proof.length > 0) {
            proofPath.innerHTML = result.merkle_proof.map((item, idx) => 
                `<div class="proof-path-item">${idx + 1}. ${item}</div>`
            ).join('');
        } else {
            proofPath.innerHTML = '<div class="proof-path-item">No proof path available</div>';
        }
    } else {
        merkleSection.classList.add('hidden');
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
        
        const derivedFrom = pavClaim['pav:derivedFrom'];
        if (derivedFrom) {
            const derivedValue = Array.isArray(derivedFrom) ? derivedFrom.join(', ') : derivedFrom;
            document.getElementById('pav-derived-from').textContent = derivedValue;
        } else {
            document.getElementById('pav-derived-from').textContent = '—';
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

