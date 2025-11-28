/**
 * PoHW Proof Creator Web App
 * Main application logic for creating proofs
 */

// Initialize - will be set up in DOMContentLoaded
let keyManager;
let registryClient;
let registryDiscovery;
let processTracker;

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
const linkSourceBtn = document.getElementById('link-source-btn');
const sourceMappingsList = document.getElementById('source-mappings-list');
const sourceMappingsItems = document.getElementById('source-mappings-items');
const sourceLinkModal = document.getElementById('source-link-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const cancelSourceBtn = document.getElementById('cancel-source-btn');
const saveSourceBtn = document.getElementById('save-source-btn');
const sourceTypeSelect = document.getElementById('source-type');
const sourceValueInput = document.getElementById('source-value');
const otherTypeInput = document.getElementById('other-identifier-type');
const otherTypeInputContainer = document.getElementById('other-type-input');
const contentAddressSection = document.getElementById('content-address-section');
const contentAddressType = document.getElementById('content-address-type');
const contentAddressValue = document.getElementById('content-address-value');
const contentAddressHint = document.getElementById('content-address-hint');
const selectedTextPreview = document.getElementById('selected-text-preview');
const claimUriType = document.getElementById('claim-uri-type');
const claimUriValue = document.getElementById('claim-uri-value');
const claimUriHint = document.getElementById('claim-uri-hint');

// Store source mappings
let sourceMappings = [];
let currentSelection = null;

const registrySelect = document.getElementById('registry-select');
const createButton = document.getElementById('create-button');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize managers (check if classes are available)
        if (typeof PoHWKeyManager !== 'undefined') {
            keyManager = new PoHWKeyManager();
        } else {
            console.error('[App] PoHWKeyManager not available');
            return;
        }
        
        if (typeof RegistryClient !== 'undefined') {
            registryClient = new RegistryClient();
        } else {
            console.error('[App] RegistryClient not available');
            return;
        }
        
        if (typeof RegistryDiscovery !== 'undefined') {
            registryDiscovery = new RegistryDiscovery();
        } else {
            console.warn('[App] RegistryDiscovery not available, will use fallback');
            registryDiscovery = null;
        }
        
        if (typeof BrowserProcessTracker !== 'undefined') {
            processTracker = new BrowserProcessTracker();
        } else {
            console.error('[App] BrowserProcessTracker not available');
            return;
        }
        
        setupKeyManagement();
        setupProcessTracking();
        setupSourceMapping();
        setupCreateButton();
        
        // Load existing keys first (important for identity persistence)
        await loadExistingKeys();
        
        // Then load registry selector
        await setupRegistrySelector();
    } catch (error) {
        console.error('[App] Initialization error:', error);
        // Still try to show fallback registry options (gdn.sh first)
        if (registrySelect) {
            registrySelect.innerHTML = `
                <option value="https://gdn.sh">gdn.sh (Primary)</option>
                <option value="https://pohw-registry-node-production.up.railway.app">Production (Railway)</option>
            `;
            registrySelect.value = 'https://gdn.sh';
        }
        // Still try to load keys even if other initialization failed
        if (keyManager) {
            try {
                await loadExistingKeys();
            } catch (e) {
                console.error('[App] Failed to load keys after initialization error:', e);
            }
        }
    }
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
    if (!keyStatusText || !didDisplay || !didValue || !exportKeysBtn || !createButton) {
        console.warn('[App] Key status elements not found');
        return;
    }
    
    if (hasKeys && did) {
        keyStatusText.textContent = 'Keys loaded';
        keyStatusText.className = 'key-status-text success';
        didDisplay.style.display = 'flex';
        didValue.textContent = did;
        exportKeysBtn.style.display = 'inline-block';
        createButton.disabled = false;
        console.log('[App] Key status updated: keys loaded, DID:', did);
    } else {
        keyStatusText.textContent = 'No keys loaded';
        keyStatusText.className = 'key-status-text';
        didDisplay.style.display = 'none';
        exportKeysBtn.style.display = 'none';
        createButton.disabled = true;
        console.log('[App] Key status updated: no keys loaded');
    }
}

/**
 * Load existing keys
 */
async function loadExistingKeys() {
    if (!keyManager) {
        console.warn('[App] KeyManager not initialized, cannot load keys');
        return;
    }
    
    try {
        // Check if keys exist in storage first
        const hasStoredKeys = await keyManager.hasKeys();
        if (!hasStoredKeys) {
            console.log('[App] No existing keys found in storage');
            updateKeyStatus(false);
            return;
        }
        
        // Wait for Ed25519 library to be available before loading keys
        let waitAttempts = 0;
        const maxWaitAttempts = 100; // 10 seconds (increased timeout)
        
        while ((typeof window.ed25519 === 'undefined' || !window.ed25519.getPublicKey) && waitAttempts < maxWaitAttempts) {
            if (window.ed25519LoadError) {
                console.warn('[App] Ed25519 library failed to load, will retry loading keys later');
                // Don't give up immediately - library might still load
                await new Promise(resolve => setTimeout(resolve, 100));
                waitAttempts++;
                continue;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            waitAttempts++;
        }
        
        if (typeof window.ed25519 === 'undefined' || !window.ed25519.getPublicKey) {
            console.warn('[App] Ed25519 library not available after waiting, cannot load existing keys');
            // Still update UI to show no keys (don't leave it in limbo)
            updateKeyStatus(false);
            return;
        }
        
        // Now try to load keys
        const keys = await keyManager.loadKeys();
        if (keys && keys.did) {
            updateKeyStatus(true, keys.did);
            console.log('[App] ✅ Successfully loaded existing keys for DID:', keys.did);
        } else {
            console.log('[App] Keys found in storage but failed to load');
            updateKeyStatus(false);
        }
    } catch (error) {
        console.error('[App] Error loading existing keys:', error);
        // Update UI to show no keys on error
        updateKeyStatus(false);
    }
}

/**
 * Setup registry selector
 */
async function setupRegistrySelector() {
    // Always ensure we have fallback options (gdn.sh first as primary)
    const fallbackOptions = () => {
        registrySelect.innerHTML = '';
        const options = [
            { value: 'https://gdn.sh', text: 'gdn.sh (Primary)' },
            { value: 'https://pohw-registry-node-production.up.railway.app', text: 'Production (Railway)' }
        ];
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            options.unshift({ value: 'http://localhost:3000', text: 'Local Development' });
        }
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            registrySelect.appendChild(option);
        });
        
        return options[0].value;
    };
    
    // Ensure registrySelect exists
    if (!registrySelect) {
        console.error('[App] registrySelect element not found');
        return;
    }
    
    try {
        // Check if RegistryDiscovery is available
        if (!registryDiscovery || typeof RegistryDiscovery === 'undefined') {
            console.warn('[App] RegistryDiscovery not available, using fallback options');
            const defaultUrl = fallbackOptions();
            registrySelect.value = defaultUrl;
            if (typeof RegistryClient !== 'undefined') {
                registryClient = new RegistryClient(defaultUrl);
            }
            // Try to check status anyway
            if (registryClient) {
                try {
                    const status = await registryClient.checkNodeStatus();
                    updateNodeStatus(status);
                } catch (e) {
                    console.warn('[App] Could not check node status:', e);
                }
            }
            return;
        }
        
        const nodes = await registryDiscovery.discoverNodes();
        console.log('[App] Discovered', nodes.length, 'registry nodes');
        
        if (nodes && nodes.length > 0) {
            registrySelect.innerHTML = '';
            
            // Ensure gdn.sh is always included (add it first if not in discovered nodes)
            const hasGdnSh = nodes.some(n => n.url === 'https://gdn.sh' || n.url.includes('gdn.sh'));
            if (!hasGdnSh) {
                const gdnOption = document.createElement('option');
                gdnOption.value = 'https://gdn.sh';
                gdnOption.textContent = 'gdn.sh (Primary)';
                registrySelect.appendChild(gdnOption);
            }
            
            nodes.forEach(node => {
                // Skip if already added (gdn.sh)
                if (node.url === 'https://gdn.sh' || node.url.includes('gdn.sh')) {
                    return;
                }
                const option = document.createElement('option');
                option.value = node.url;
                option.textContent = node.name;
                registrySelect.appendChild(option);
            });
            
            // Check all nodes status (like verify page)
            let nodesWithStatus = [];
            if (registryDiscovery.checkAllNodesStatus) {
                try {
                    nodesWithStatus = await registryDiscovery.checkAllNodesStatus();
                    // Update dropdown with status indicators
                    updateNodeOptionsWithStatus(nodesWithStatus);
                } catch (e) {
                    console.warn('[App] Could not check all nodes status:', e);
                }
            }
            
            // Prefer gdn.sh as default, otherwise use discovery default
            let defaultUrl = registryDiscovery.getDefaultRegistry();
            const gdnShOption = Array.from(registrySelect.options).find(opt => opt.value === 'https://gdn.sh');
            if (gdnShOption) {
                defaultUrl = 'https://gdn.sh';
            }
            
            registrySelect.value = defaultUrl;
            if (typeof RegistryClient !== 'undefined') {
                registryClient = new RegistryClient(defaultUrl);
            }
            
            // Check selected node status (like verify page)
            if (nodesWithStatus.length > 0) {
                // Update status display based on selected node
                updateNodeStatusDisplay(nodesWithStatus);
            } else {
                // No status from discovery, check directly
                try {
                    const status = await registryClient.checkNodeStatus();
                    updateNodeStatus(status);
                } catch (e) {
                    console.warn('[App] Could not check node status:', e);
                    updateNodeStatus({ online: false, error: 'Status check failed' });
                }
            }
        } else {
            // No nodes discovered, use fallback
            console.warn('[App] No nodes discovered, using fallback options');
            const defaultUrl = fallbackOptions();
            registrySelect.value = defaultUrl;
            if (typeof RegistryClient !== 'undefined') {
                registryClient = new RegistryClient(defaultUrl);
            }
            try {
                const status = await registryClient.checkNodeStatus();
                updateNodeStatus(status);
            } catch (e) {
                console.warn('[App] Could not check node status:', e);
            }
        }
        
    } catch (error) {
        console.error('[App] Registry discovery failed:', error);
        // Always provide fallback options
        const defaultUrl = fallbackOptions();
        registrySelect.value = defaultUrl;
        if (typeof RegistryClient !== 'undefined') {
            registryClient = new RegistryClient(defaultUrl);
        }
        
        // Try to check status
        try {
            const status = await registryClient.checkNodeStatus();
            updateNodeStatus(status);
        } catch (e) {
            console.warn('[App] Could not check node status:', e);
            updateNodeStatus({ online: false, error: 'Status check failed' });
        }
    }
    
    // Add change listener (only once)
    registrySelect.removeEventListener('change', handleRegistryChange);
    registrySelect.addEventListener('change', handleRegistryChange);
}

/**
 * Handle registry selection change
 */
async function handleRegistryChange(e) {
    const selectedUrl = e.target.value;
    if (!selectedUrl) return;
    
    if (!registryClient) {
        if (typeof RegistryClient !== 'undefined') {
            registryClient = new RegistryClient(selectedUrl);
        } else {
            console.error('[App] RegistryClient not available');
            updateNodeStatus({ online: false, error: 'Registry client not available' });
            return;
        }
    } else {
        registryClient.setRegistryUrl(selectedUrl);
    }
    
    try {
        const status = await registryClient.checkNodeStatus();
        updateNodeStatus(status);
        
        // Also update dropdown indicator if we have status
        if (registrySelect) {
            const option = Array.from(registrySelect.options).find(opt => opt.value === selectedUrl);
            if (option) {
                const statusIcon = status.online ? '🟢' : '🔴';
                const originalText = option.textContent.replace(/^[🟢🔴]\s*/, '');
                option.textContent = `${statusIcon} ${originalText}`;
            }
        }
    } catch (e) {
        console.warn('[App] Could not check node status:', e);
        updateNodeStatus({ online: false, error: 'Status check failed' });
    }
}

/**
 * Update node options with status indicators (like verify page)
 */
function updateNodeOptionsWithStatus(nodesWithStatus) {
    if (!registrySelect || !nodesWithStatus || nodesWithStatus.length === 0) return;
    
    Array.from(registrySelect.options).forEach(option => {
        const node = nodesWithStatus.find(n => n.url === option.value);
        if (node) {
            const statusIcon = node.online ? '🟢' : '🔴';
            const originalText = option.textContent.replace(/^[🟢🔴]\s*/, ''); // Remove existing status icon
            option.textContent = `${statusIcon} ${originalText}`;
        }
    });
}

/**
 * Update node status display (like verify page - shows selected node status)
 */
function updateNodeStatusDisplay(nodes) {
    const statusEl = document.getElementById('node-status');
    if (!statusEl || !registrySelect) return;
    
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
 * Update single node status (for direct status checks)
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
 * Setup source mapping
 */
function setupSourceMapping() {
    // Track text selection in textarea - use multiple events for faster response
    if (contentTextarea) {
        // Use selectionchange for immediate feedback
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === contentTextarea) {
                handleTextSelection();
            }
        });
        contentTextarea.addEventListener('mouseup', handleTextSelection);
        contentTextarea.addEventListener('keyup', handleTextSelection);
        contentTextarea.addEventListener('select', handleTextSelection);
    }
    
    // Show/hide link button based on selection
    if (linkSourceBtn) {
        linkSourceBtn.addEventListener('click', showSourceLinkModal);
    }
    
    if (saveSourceBtn) {
        saveSourceBtn.addEventListener('click', saveSourceMapping);
    }
    
    if (cancelSourceBtn) {
        cancelSourceBtn.addEventListener('click', hideSourceLinkModal);
    }
    
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideSourceLinkModal);
    }
    
    // Update source type hint
    if (sourceTypeSelect) {
        sourceTypeSelect.addEventListener('change', updateSourceHint);
    }
    
    // Update content address section visibility
    if (contentAddressType) {
        contentAddressType.addEventListener('change', updateContentAddressSection);
    }
    
    // Update claim URI section visibility
    if (claimUriType) {
        claimUriType.addEventListener('change', updateClaimUriSection);
    }
    
    // Close modal on outside click
    if (sourceLinkModal) {
        sourceLinkModal.addEventListener('click', (e) => {
            if (e.target === sourceLinkModal) {
                hideSourceLinkModal();
            }
        });
    }
}

/**
 * Handle text selection in textarea
 */
function handleTextSelection() {
    if (!contentTextarea) return;
    
    const start = contentTextarea.selectionStart;
    const end = contentTextarea.selectionEnd;
    const selectedText = contentTextarea.value.substring(start, end);
    
    // Only update if selection actually changed
    if (selectedText.length > 0 && start !== end) {
        // Check if this is a new selection (different from current)
        const isNewSelection = !currentSelection || 
            currentSelection.start !== start || 
            currentSelection.end !== end;
        
        if (isNewSelection) {
            currentSelection = {
                text: selectedText,
                start: start,
                end: end
            };
            if (linkSourceBtn) {
                linkSourceBtn.style.display = 'inline-block';
                // Add a subtle animation to draw attention
                linkSourceBtn.style.opacity = '0';
                requestAnimationFrame(() => {
                    if (linkSourceBtn) {
                        linkSourceBtn.style.transition = 'opacity 0.2s';
                        linkSourceBtn.style.opacity = '1';
                    }
                });
            }
        }
    } else {
        currentSelection = null;
        if (linkSourceBtn) {
            linkSourceBtn.style.display = 'none';
        }
    }
}

/**
 * Show source link modal
 */
function showSourceLinkModal() {
    if (!currentSelection || !selectedTextPreview || !sourceValueInput || !sourceTypeSelect) return;
    
    selectedTextPreview.textContent = `"${currentSelection.text}"`;
    selectedTextPreview.style.maxHeight = '100px';
    selectedTextPreview.style.overflow = 'auto';
    sourceValueInput.value = '';
    if (otherTypeInput) {
        otherTypeInput.value = '';
    }
    if (contentAddressType) {
        contentAddressType.value = '';
    }
    if (contentAddressValue) {
        contentAddressValue.value = '';
    }
    sourceTypeSelect.value = 'pohw-hash';
    updateSourceHint();
    
    if (sourceLinkModal) {
        sourceLinkModal.classList.remove('hidden');
        // Small delay to ensure modal is visible before focusing
        setTimeout(() => {
            sourceValueInput.focus();
        }, 100);
    }
}

/**
 * Hide source link modal
 */
function hideSourceLinkModal() {
    if (sourceLinkModal) {
        sourceLinkModal.classList.add('hidden');
    }
    currentSelection = null;
    if (contentTextarea) {
        contentTextarea.focus();
    }
}

/**
 * Update source type hint and placeholder
 */
function updateSourceHint() {
    const hint = document.getElementById('source-hint');
    if (!hint || !sourceTypeSelect || !sourceValueInput) return;
    
    const type = sourceTypeSelect.value;
    
    // Update placeholder text based on source type
    switch(type) {
        case 'pohw-hash':
            sourceValueInput.placeholder = 'Enter PoHW proof hash (e.g., 0x6bf8a1...)';
            hint.textContent = 'For PoHW proofs, enter the hash starting with 0x';
            break;
        case 'url':
            sourceValueInput.placeholder = 'Enter website URL (e.g., https://example.com/article)';
            hint.textContent = 'Enter the full URL including https://';
            break;
        case 'doi':
            sourceValueInput.placeholder = 'Enter DOI (e.g., doi:10.1234/example or 10.1234/example)';
            hint.textContent = 'Enter DOI with or without doi: prefix';
            break;
        case 'other':
            sourceValueInput.placeholder = 'Enter identifier value';
            hint.textContent = 'Enter the identifier value, then specify the type below';
            break;
    }
    
    // Show/hide "Other" identifier type input
    if (otherTypeInputContainer && otherTypeInput) {
        if (type === 'other') {
            otherTypeInputContainer.style.display = 'block';
            otherTypeInput.value = ''; // Clear when switching to other
        } else {
            otherTypeInputContainer.style.display = 'none';
            otherTypeInput.value = ''; // Clear when switching away
        }
    }
    
    // Show/hide content address section (only for PoHW hashes)
    updateContentAddressSection();
}

/**
 * Update content address section visibility and hints
 */
function updateContentAddressSection() {
    if (!contentAddressSection || !contentAddressType || !contentAddressValue || !contentAddressHint) return;
    
    const sourceType = sourceTypeSelect ? sourceTypeSelect.value : '';
    const addressType = contentAddressType.value;
    
    // Only show for PoHW hashes
    if (sourceType === 'pohw-hash') {
        contentAddressSection.style.display = 'block';
        
        // Show/hide input based on selection
        if (addressType === 'ipfs' || addressType === 'arweave') {
            contentAddressValue.style.display = 'block';
            
            if (addressType === 'ipfs') {
                contentAddressValue.placeholder = 'Enter IPFS CID (e.g., QmXxx... or ipfs://QmXxx...)';
                contentAddressHint.textContent = 'Optional: IPFS CID allows verifiers to retrieve the archived content. Format: QmXxx... or ipfs://QmXxx...';
            } else if (addressType === 'arweave') {
                contentAddressValue.placeholder = 'Enter Arweave Transaction ID (e.g., xxx... or ar://xxx...)';
                contentAddressHint.textContent = 'Optional: Arweave ID provides permanent content storage. Format: Transaction ID or ar://xxx...';
            }
        } else {
            contentAddressValue.style.display = 'none';
            contentAddressValue.value = '';
            contentAddressHint.textContent = 'Optional: If the cited author archived their content, add the IPFS CID or Arweave ID to enable content retrieval';
        }
    } else {
        contentAddressSection.style.display = 'none';
        contentAddressType.value = '';
        contentAddressValue.value = '';
    }
}

/**
 * Save source mapping
 */
function saveSourceMapping() {
    if (!currentSelection || !sourceTypeSelect || !sourceValueInput) return;
    
    const sourceType = sourceTypeSelect.value;
    let sourceValue = sourceValueInput.value.trim();
    
    if (!sourceValue) {
        alert('Please enter a source value');
        return;
    }
    
    // For "Other" type, require identifier type specification
    if (sourceType === 'other') {
        const otherType = otherTypeInput ? otherTypeInput.value.trim() : '';
        if (!otherType) {
            alert('Please specify the identifier type (e.g., ISBN, arXiv, GitHub commit)');
            if (otherTypeInput) {
                otherTypeInput.focus();
            }
            return;
        }
        // Store the identifier type with the source
        sourceValue = `${otherType}:${sourceValue}`;
    }
    
    // Validate based on type
    if (sourceType === 'pohw-hash' && !sourceValue.startsWith('0x')) {
        if (confirm('PoHW hashes should start with 0x. Use this value anyway?')) {
            // User confirmed, continue
        } else {
            return;
        }
    }
    
    if (sourceType === 'doi' && !sourceValue.startsWith('doi:')) {
        if (sourceValue.match(/^10\./)) {
            sourceValue = 'doi:' + sourceValue;
        } else if (!sourceValue.startsWith('doi:')) {
            sourceValue = 'doi:' + sourceValue;
        }
    }
    
    // Get content address if provided (for PoHW hashes only)
    let contentAddress = null;
    if (sourceType === 'pohw-hash' && contentAddressType && contentAddressValue) {
        const addressType = contentAddressType.value;
        const addressValue = contentAddressValue.value.trim();
        
        if (addressType && addressValue) {
            // Normalize the address format
            let normalizedAddress = addressValue;
            
            if (addressType === 'ipfs') {
                // Remove ipfs:// prefix if present, keep CID
                normalizedAddress = addressValue.replace(/^ipfs:\/\//, '');
                contentAddress = {
                    type: 'ipfs',
                    value: normalizedAddress,
                    url: `https://ipfs.io/ipfs/${normalizedAddress}`
                };
            } else if (addressType === 'arweave') {
                // Remove ar:// prefix if present, keep transaction ID
                normalizedAddress = addressValue.replace(/^ar:\/\//, '');
                contentAddress = {
                    type: 'arweave',
                    value: normalizedAddress,
                    url: `https://arweave.net/${normalizedAddress}`
                };
            }
        }
    }
    
    // Check if this text range already has a mapping
    const existingIndex = sourceMappings.findIndex(m => 
        m.start === currentSelection.start && m.end === currentSelection.end
    );
    
    const mapping = {
        text: currentSelection.text,
        source: sourceValue,
        sourceType: sourceType,
        start: currentSelection.start,
        end: currentSelection.end
    };
    
    // Store the other identifier type if specified
    if (sourceType === 'other' && otherTypeInput) {
        mapping.otherType = otherTypeInput.value.trim();
    }
    
    // Store content address if provided (for PoHW hashes)
    if (contentAddress) {
        mapping.contentAddress = contentAddress;
    }
    
    if (existingIndex >= 0) {
        sourceMappings[existingIndex] = mapping;
    } else {
        sourceMappings.push(mapping);
    }
    
    updateSourceMappingsDisplay();
    hideSourceLinkModal();
    
    // Clear selection
    if (contentTextarea) {
        contentTextarea.setSelectionRange(0, 0);
        handleTextSelection();
    }
}

/**
 * Update source mappings display
 */
function updateSourceMappingsDisplay() {
    if (!sourceMappingsList || !sourceMappingsItems) return;
    
    if (sourceMappings.length === 0) {
        sourceMappingsList.style.display = 'none';
        return;
    }
    
    sourceMappingsList.style.display = 'block';
    sourceMappingsItems.innerHTML = '';
    
    sourceMappings.forEach((mapping, index) => {
        const item = document.createElement('div');
        item.className = 'source-mapping-item';
        
        // For "other" type, show the identifier type if available
        const typeLabel = mapping.sourceType === 'other' && mapping.otherType 
            ? `${mapping.sourceType} (${mapping.otherType})` 
            : mapping.sourceType;
        
        // Build content address display if available
        let contentAddressDisplay = '';
        if (mapping.contentAddress) {
            const addressType = mapping.contentAddress.type === 'ipfs' ? 'IPFS' : 'Arweave';
            contentAddressDisplay = `
                <div class="content-address-display" style="margin-top: 0.5rem;">
                    <span class="content-address-label" style="font-size: 0.75rem; color: var(--text-secondary);">${addressType}:</span>
                    <a href="${mapping.contentAddress.url}" target="_blank" class="content-address-link" style="color: var(--accent-green); font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; text-decoration: none; margin-left: 0.25rem;">
                        ${mapping.contentAddress.value.length > 30 ? mapping.contentAddress.value.substring(0, 30) + '...' : mapping.contentAddress.value}
                    </a>
                </div>
            `;
        }
        
        item.innerHTML = `
            <div class="source-mapping-text">
                <span class="source-text-preview">"${mapping.text.length > 50 ? mapping.text.substring(0, 50) + '...' : mapping.text}"</span>
                <span class="source-link">→ ${mapping.source}</span>
                <span class="source-type-badge">${typeLabel}</span>
                ${contentAddressDisplay}
            </div>
            <button type="button" class="remove-source-btn" data-index="${index}">Remove</button>
        `;
        sourceMappingsItems.appendChild(item);
    });
    
    // Add remove handlers
    sourceMappingsItems.querySelectorAll('.remove-source-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            sourceMappings.splice(index, 1);
            updateSourceMappingsDisplay();
        });
    });
}

/**
 * Setup create button
 */
function setupCreateButton() {
    if (!createButton) {
        console.error('[App] Create button not found');
        return;
    }
    
    // Remove any existing listeners
    createButton.removeEventListener('click', createProof);
    // Add click listener
    createButton.addEventListener('click', createProof);
    console.log('[App] Create button setup complete');
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
        if (!keyManager || !keyManager.getDID()) {
            showError('Please generate or import keys first');
            setLoading(false);
            return;
        }
        
        // Check if registry is selected
        if (!registrySelect || !registrySelect.value) {
            showError('Please select a registry node');
            setLoading(false);
            return;
        }
        
        // Check if registry client is available
        if (!registryClient) {
            if (typeof RegistryClient !== 'undefined' && registrySelect.value) {
                registryClient = new RegistryClient(registrySelect.value);
            } else {
                showError('Registry client not initialized. Please refresh the page.');
                setLoading(false);
                return;
            }
        }
        
        // Get content from textarea
        if (!contentTextarea) {
            showError('Content textarea not found');
            setLoading(false);
            return;
        }
        
        const text = contentTextarea.value.trim();
        if (!text) {
            showError('Please enter content');
            setLoading(false);
            return;
        }
        
        let hash = await hashText(text);
        
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
        
        // Add derivedFrom (source mappings for citations/quotes) if provided
        if (sourceMappings.length > 0) {
            // Send structured source mappings
            attestation.derivedFrom = sourceMappings.map(m => {
                const mapping = {
                    text: m.text,
                    source: m.source,
                    sourceType: m.sourceType,
                    position: {
                        start: m.start,
                        end: m.end
                    }
                };
                
                // Include otherType if present
                if (m.otherType) {
                    mapping.otherType = m.otherType;
                }
                
                // Include contentAddress if present (per whitepaper Section 7.3)
                if (m.contentAddress) {
                    mapping.contentAddress = m.contentAddress;
                }
                
                return mapping;
            });
        }
        
        // Add claimURI (pohw:claimURI) for user's own content address (per whitepaper Section 7.3)
        if (claimUriType && claimUriValue) {
            const addressType = claimUriType.value;
            const addressValue = claimUriValue.value.trim();
            
            if (addressType && addressValue) {
                // Normalize the address format
                let normalizedAddress = addressValue;
                let claimUri = '';
                
                if (addressType === 'ipfs') {
                    // Remove ipfs:// prefix if present, keep CID
                    normalizedAddress = addressValue.replace(/^ipfs:\/\//, '');
                    claimUri = `ipfs://${normalizedAddress}`;
                } else if (addressType === 'arweave') {
                    // Remove ar:// prefix if present, keep transaction ID
                    normalizedAddress = addressValue.replace(/^ar:\/\//, '');
                    claimUri = `ar://${normalizedAddress}`;
                }
                
                if (claimUri) {
                    attestation.claimURI = claimUri;
                }
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

