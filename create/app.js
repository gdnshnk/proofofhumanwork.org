/**
 * PoHW Proof Creator Web App
 * Main application logic for creating proofs
 */

// Initialize
let keyManager = new PoHWKeyManager();
let registryClient = new RegistryClient();
let registryDiscovery = new RegistryDiscovery();
let processTracker = new BrowserProcessTracker();

// DOM Elements
const generateKeysBtn = document.getElementById('generate-keys-btn');
const importKeysBtn = document.getElementById('import-keys-btn');
const exportKeysBtn = document.getElementById('export-keys-btn');
const importKeysInput = document.getElementById('import-keys-input');
const importKeysTextarea = document.getElementById('import-keys-textarea');
const importPassword = document.getElementById('import-password');
const confirmImportBtn = document.getElementById('confirm-import-btn');
const cancelImportBtn = document.getElementById('cancel-import-btn');
const keyStatusText = document.getElementById('key-status-text');
const didDisplay = document.getElementById('did-display');
const didValue = document.getElementById('did-value');

const contentTextarea = document.getElementById('content-textarea');

const registrySelect = document.getElementById('registry-select');
const createButton = document.getElementById('create-button');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setupKeyManagement();
    setupProcessTracking();
    await setupRegistrySelector();
    setupCreateButton();
    await loadExistingKeys();
});


/**
 * Setup key management
 */
function setupKeyManagement() {
    generateKeysBtn.addEventListener('click', async () => {
        try {
            setLoading(true);
            generateKeysBtn.disabled = true;
            const originalText = generateKeysBtn.textContent;
            generateKeysBtn.textContent = 'Loading library...';
            
            // Check for load error
            if (window.ed25519LoadError) {
                throw new Error(window.ed25519LoadError);
            }
            
            // Wait for ed25519 library to be available (up to 5 seconds)
            let waitAttempts = 0;
            const maxWaitAttempts = 50; // 5 seconds
            
            while ((typeof window.ed25519 === 'undefined' || !window.ed25519.getPublicKey) && waitAttempts < maxWaitAttempts) {
                if (window.ed25519LoadError) {
                    throw new Error(window.ed25519LoadError);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                waitAttempts++;
                
                // Update button text to show progress
                if (waitAttempts % 10 === 0) {
                    generateKeysBtn.textContent = `Loading library... (${waitAttempts * 100}ms)`;
                }
            }
            
            if (typeof window.ed25519 === 'undefined' || !window.ed25519.getPublicKey) {
                throw new Error('Ed25519 library failed to load. Please refresh the page and try again. If the problem persists, check your internet connection.');
            }
            
            generateKeysBtn.textContent = 'Generating keys...';
            const { did } = await keyManager.generateKeys();
            updateKeyStatus(true, did);
            showSuccess('Keys generated successfully!');
        } catch (error) {
            console.error('Key generation error:', error);
            const errorMsg = error.message || 'Unknown error';
            showError('Failed to generate keys: ' + errorMsg + '\n\nPlease check the browser console (F12) for details.');
        } finally {
            setLoading(false);
            generateKeysBtn.disabled = false;
            generateKeysBtn.textContent = 'Generate New Keys';
        }
    });
    
    importKeysBtn.addEventListener('click', () => {
        importKeysInput.classList.remove('hidden');
        importKeysTextarea.focus();
    });
    
    confirmImportBtn.addEventListener('click', async () => {
        try {
            const privateKeyHex = importKeysTextarea.value.trim();
            if (!privateKeyHex) {
                showError('Please enter a private key');
                return;
            }
            
            setLoading(true);
            const { did } = await keyManager.importKeys(privateKeyHex);
            updateKeyStatus(true, did);
            importKeysInput.classList.add('hidden');
            importKeysTextarea.value = '';
            showSuccess('Keys imported successfully!');
        } catch (error) {
            showError('Failed to import keys: ' + error.message);
        } finally {
            setLoading(false);
        }
    });
    
    cancelImportBtn.addEventListener('click', () => {
        importKeysInput.classList.add('hidden');
        importKeysTextarea.value = '';
    });
    
    exportKeysBtn.addEventListener('click', () => {
        try {
            const keys = keyManager.exportKeys();
            const text = `Private Key (hex): ${keys.privateKey}\nPublic Key (hex): ${keys.publicKey}\nDID: ${keys.did}`;
            
            // Copy to clipboard
            navigator.clipboard.writeText(text).then(() => {
                showSuccess('Keys copied to clipboard!');
            }).catch(() => {
                // Fallback: show in alert
                alert('Keys:\n\n' + text);
            });
        } catch (error) {
            showError('Failed to export keys: ' + error.message);
        }
    });
}

/**
 * Update key status display
 */
function updateKeyStatus(hasKeys, did = null) {
    if (hasKeys && did) {
        keyStatusText.textContent = 'Keys loaded';
        keyStatusText.className = 'key-status-text success';
        didDisplay.style.display = 'flex';
        didValue.textContent = did;
        exportKeysBtn.style.display = 'inline-block';
        createButton.disabled = false;
    } else {
        keyStatusText.textContent = 'No keys loaded';
        keyStatusText.className = 'key-status-text';
        didDisplay.style.display = 'none';
        exportKeysBtn.style.display = 'none';
        createButton.disabled = true;
    }
}

/**
 * Load existing keys
 */
async function loadExistingKeys() {
    try {
        const keys = await keyManager.loadKeys();
        if (keys) {
            updateKeyStatus(true, keys.did);
        }
    } catch (error) {
        console.warn('Could not load existing keys:', error);
    }
}

/**
 * Setup registry selector
 */
async function setupRegistrySelector() {
    try {
        const nodes = await registryDiscovery.discoverNodes();
        console.log('[App] Discovered', nodes.length, 'registry nodes');
        
        registrySelect.innerHTML = '';
        nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.url;
            option.textContent = node.name;
            registrySelect.appendChild(option);
        });
        
        const defaultUrl = registryDiscovery.getDefaultRegistry();
        registrySelect.value = defaultUrl;
        registryClient = new RegistryClient(defaultUrl);
        
        // Check node status
        const status = await registryClient.checkNodeStatus();
        updateNodeStatus(status);
        
    } catch (error) {
        console.error('[App] Registry discovery failed:', error);
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
        registryClient = new RegistryClient(registrySelect.value);
    }
    
    registrySelect.addEventListener('change', async (e) => {
        const selectedUrl = e.target.value;
        registryClient.setRegistryUrl(selectedUrl);
        const status = await registryClient.checkNodeStatus();
        updateNodeStatus(status);
    });
}

/**
 * Update node status display
 */
function updateNodeStatus(status) {
    const statusEl = document.getElementById('node-status');
    if (!statusEl) return;
    
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
}

/**
 * Setup process tracking
 */
function setupProcessTracking() {
    // Only set up if elements exist
    if (!contentTextarea) {
        console.warn('[ProcessTracker] Content elements not found, skipping setup');
        return;
    }
    
    // Start tracking immediately when page loads (for any interaction)
    try {
        processTracker.startSession();
    } catch (error) {
        console.warn('[ProcessTracker] Failed to start session:', error);
    }
    
    // Start tracking when user interacts with content input
    contentTextarea.addEventListener('focus', () => {
        try {
            if (!processTracker.isTracking) {
                processTracker.startSession();
            }
            updateProcessStatus();
        } catch (error) {
            console.warn('[ProcessTracker] Focus handler error:', error);
        }
    });
    
    // Track typing in textarea
    contentTextarea.addEventListener('input', () => {
        try {
            if (!processTracker.isTracking) {
                processTracker.startSession();
            }
            processTracker.recordInput('typing');
            updateProcessStatus();
        } catch (error) {
            console.warn('[ProcessTracker] Input handler error:', error);
        }
    });
    
    // Track any keypress in textarea (even if no input event)
    contentTextarea.addEventListener('keydown', () => {
        try {
            if (!processTracker.isTracking) {
                processTracker.startSession();
            }
            processTracker.recordInput('keydown');
        } catch (error) {
            console.warn('[ProcessTracker] Keydown handler error:', error);
        }
    });
    
    
    // Update status periodically
    setInterval(() => {
        try {
            if (processTracker.isTracking) {
                updateProcessStatus();
            }
        } catch (error) {
            // Silently ignore interval errors
        }
    }, 2000);
}

/**
 * Update process tracking status display
 */
function updateProcessStatus() {
    // This could show a small indicator of tracking status
    // For now, we'll just log it
    const duration = processTracker.getSessionDuration();
    const events = processTracker.getInputEventCount();
    
    if (duration > 0 && events > 0) {
        console.log(`[ProcessTracker] Session: ${Math.round(duration/1000)}s, Events: ${events}`);
    }
}

/**
 * Setup create button
 */
function setupCreateButton() {
    createButton.addEventListener('click', createProof);
}

/**
 * Create proof
 */
async function createProof() {
    try {
        setLoading(true);
        hideResults();
        hideError();
        
        // Check if keys are loaded
        if (!keyManager.getDID()) {
            showError('Please generate or import keys first');
            setLoading(false);
            return;
        }
        
        // Get content from textarea
        const text = contentTextarea.value.trim();
        if (!text) {
            showError('Please enter content');
            setLoading(false);
            return;
        }
        
        const hash = await hashText(text);
        
        if (!hash) {
            showError('Failed to generate hash');
            setLoading(false);
            return;
        }
        
        // Ensure hash has 0x prefix
        if (!hash.startsWith('0x')) {
            hash = '0x' + hash;
        }
        
        // Get DID
        const did = keyManager.getDID();
        
        // Ensure process tracking is started
        if (!processTracker.isTracking) {
            processTracker.startSession();
        }
        
        // Generate process digest if tracking
        let processDigest = null;
        let processMetrics = null;
        let compoundHash = null;
        let entropyProof = null;
        let temporalCoherence = null;
        
        // Always try to generate process digest, even with minimal data
        if (processTracker.getInputEventCount() > 0 || processTracker.isTracking) {
            const digestResult = await processTracker.generateDigest();
            if (digestResult && digestResult.digest) {
                processDigest = digestResult.digest;
                processMetrics = {
                    duration: digestResult.metrics.duration,
                    entropy: digestResult.metrics.entropy,
                    temporalCoherence: digestResult.metrics.temporalCoherence,
                    inputEvents: digestResult.metrics.inputEvents,
                    meetsThresholds: digestResult.meetsThresholds
                };
                // Always format entropy and temporal coherence according to whitepaper format
                // Format: zkp:entropy>X and zkp:coherence>X (even if low values)
                entropyProof = digestResult.metrics.entropy !== undefined 
                    ? `zkp:entropy>${digestResult.metrics.entropy.toFixed(3)}` 
                    : null;
                temporalCoherence = digestResult.metrics.temporalCoherence !== undefined
                    ? `zkp:coherence>${digestResult.metrics.temporalCoherence.toFixed(3)}`
                    : null;
                
                // Generate compound hash (content + process)
                const compoundData = hash + processDigest;
                const encoder = new TextEncoder();
                const compoundBytes = encoder.encode(compoundData);
                const compoundHashBuffer = await crypto.subtle.digest('SHA-256', compoundBytes);
                const compoundHashArray = Array.from(new Uint8Array(compoundHashBuffer));
                compoundHash = '0x' + compoundHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }
        }
        
        // Always detect and send environment (not conditional)
        const environment = processTracker.detectEnvironment();
        const platform = navigator.platform;
        const screenInfo = `${screen.width}x${screen.height}`;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const authoredOnDevice = `${platform} (${screenInfo})`;
        const environmentAttestation = [
            `browser: ${environment}`,
            `timezone: ${timezone}`,
            processMetrics && processMetrics.meetsThresholds ? 'human-only' : 'web-interface'
        ];
        
        // Create claim object
        const timestamp = new Date().toISOString();
        const claim = {
            hash: hash,
            did: did,
            timestamp: timestamp
        };
        
        // Add process data to claim if available
        if (processDigest) {
            claim.processDigest = processDigest;
            if (compoundHash) {
                claim.compoundHash = compoundHash;
            }
        }
        
        // Canonicalize and sign claim
        const canonicalClaim = JSON.stringify(claim, Object.keys(claim).sort());
        const signature = await keyManager.sign(canonicalClaim);
        
        // Determine assistance profile - respect user's explicit declaration
        // Per whitepaper Section 8.5: "AI-assist disclosure is treated as an ethical extension"
        // User's explicit declaration takes precedence for transparency and ethical compliance
        const assistanceProfileSelect = document.getElementById('assistance-profile');
        const userSelectedProfile = assistanceProfileSelect ? assistanceProfileSelect.value : null;
        
        let assistanceProfile = 'human-only'; // Default
        
        // If user explicitly selected AI-assisted or AI-generated, respect that declaration
        // This ensures transparency and ethical compliance (EU AI Act, etc.)
        if (userSelectedProfile === 'AI-assisted' || userSelectedProfile === 'AI-generated') {
            assistanceProfile = userSelectedProfile;
        } else if (processMetrics) {
            // Only auto-determine if user selected "human-only" or didn't select
            // Determine from actual process data
            if (processMetrics.meetsThresholds) {
                // Meets human thresholds = human-only
                assistanceProfile = 'human-only';
            } else {
                // Doesn't meet thresholds - check how far off
                const entropy = processMetrics.entropy || 0;
                const duration = processMetrics.duration || 0;
                const inputEvents = processMetrics.inputEvents || 0;
                
                // Very low metrics = likely AI-generated
                if (entropy < 0.1 && duration < 5000 && inputEvents < 5) {
                    assistanceProfile = 'AI-generated';
                } else {
                    // Some activity but not meeting thresholds = AI-assisted
                    assistanceProfile = 'AI-assisted';
                }
            }
        } else {
            // No process data - use user selection or default
            assistanceProfile = userSelectedProfile || 'human-only';
        }
        
        console.log('[App] Assistance profile determined:', {
            assistanceProfile: assistanceProfile,
            userSelection: userSelectedProfile,
            hasProcessMetrics: !!processMetrics,
            meetsThresholds: processMetrics?.meetsThresholds,
            respectsUserDeclaration: (userSelectedProfile === 'AI-assisted' || userSelectedProfile === 'AI-generated')
        });
        
        // Always send processMetrics if available (server should accept them regardless of thresholds)
        // This ensures entropy and temporal coherence are always displayed
        const shouldSendProcessMetrics = !!processMetrics;
        
        // Prepare attestation request (always include environment, conditionally include process data)
        // IMPORTANT: Always send assistanceProfile to work with production server
        const attestation = {
            hash: hash,
            signature: signature,
            did: did,
            timestamp: timestamp,
            // Always include environment attestation
            authoredOnDevice: authoredOnDevice,
            environmentAttestation: environmentAttestation,
            // ALWAYS include assistance profile (required for production server)
            // This must match the actual data
            assistanceProfile: assistanceProfile,
            // Include process digest and compound hash (always safe to send)
            ...(processDigest && {
                processDigest: processDigest,
                compoundHash: compoundHash
            }),
            // Always send processMetrics if available (server accepts them regardless of thresholds)
            ...(shouldSendProcessMetrics && {
                processMetrics: processMetrics
            })
        };
        
        // Add derivedFrom (source hashes for citations/quotes) if provided
        const derivedFromInput = document.getElementById('derived-from');
        if (derivedFromInput && derivedFromInput.value.trim()) {
            // Parse source hashes (one per line, remove empty lines)
            const sourceHashes = derivedFromInput.value.trim()
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && line.startsWith('0x'));
            
            if (sourceHashes.length > 0) {
                attestation.derivedFrom = sourceHashes.length === 1 ? sourceHashes[0] : sourceHashes;
            }
        }
        
        if (processMetrics && !processMetrics.meetsThresholds) {
            console.log('[App] Process metrics do not meet thresholds. Metrics will still be sent and displayed. Assistance profile:', assistanceProfile);
        }
        
        console.log('[App] Attestation data:', {
            hasProcessDigest: !!processDigest,
            hasEnvironment: !!authoredOnDevice,
            assistanceProfile: assistanceProfile,
            processMetrics: processMetrics
        });
        
        // Submit to registry
        const currentRegistry = registrySelect.value;
        registryClient.setRegistryUrl(currentRegistry);
        
        console.log('[App] Submitting attestation:', attestation);
        const receipt = await registryClient.submitAttestation(attestation);
        
        console.log('[App] Receipt received:', receipt);
        
        // Display results
        displayResults({
            hash: hash,
            did: did,
            timestamp: timestamp,
            registry: currentRegistry,
            receipt: receipt.receipt_hash || receipt.hash || receipt.proof_hash || hash
        });
        
    } catch (error) {
        console.error('Proof creation error:', error);
        showError(error.message || 'An error occurred while creating the proof');
    } finally {
        setLoading(false);
    }
}

/**
 * Display results
 */
function displayResults(result) {
    resultsSection.classList.remove('hidden');
    
    document.getElementById('result-status').textContent = 'PROOF CREATED';
    document.getElementById('result-hash').textContent = result.hash;
    document.getElementById('result-signer').textContent = result.did;
    document.getElementById('result-timestamp').textContent = formatTimestamp(result.timestamp);
    document.getElementById('result-registry').textContent = result.registry;
    document.getElementById('result-receipt').textContent = result.receipt;
    
    // Setup copy buttons
    document.getElementById('copy-hash-btn').onclick = () => {
        navigator.clipboard.writeText(result.hash);
        showSuccess('Hash copied to clipboard!');
    };
    
    document.getElementById('copy-receipt-btn').onclick = () => {
        navigator.clipboard.writeText(result.receipt);
        showSuccess('Receipt copied to clipboard!');
    };
    
    // Setup verify link
    const verifyLink = document.getElementById('verify-link');
    verifyLink.href = `../verify/?hash=${encodeURIComponent(result.hash)}`;
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
 * Show error
 */
function showError(message) {
    errorSection.classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Show success message (temporary)
 */
function showSuccess(message) {
    // Create temporary success message
    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.textContent = message;
    document.body.appendChild(successEl);
    
    setTimeout(() => {
        successEl.remove();
    }, 3000);
}

/**
 * Hide results
 */
function hideResults() {
    resultsSection.classList.add('hidden');
}

/**
 * Hide error
 */
function hideError() {
    errorSection.classList.add('hidden');
}

/**
 * Set loading state
 */
function setLoading(loading) {
    createButton.disabled = loading;
    const buttonText = createButton.querySelector('.button-text');
    const buttonLoader = createButton.querySelector('.button-loader');
    
    if (loading) {
        buttonText.textContent = 'CREATING...';
        buttonLoader.classList.remove('hidden');
    } else {
        buttonText.textContent = 'Create Proof';
        buttonLoader.classList.add('hidden');
    }
}

