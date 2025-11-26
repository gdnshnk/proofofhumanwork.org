/**
 * PoHW Proof Creator Web App
 * Main application logic for creating proofs
 */

// Initialize
let keyManager = new PoHWKeyManager();
let registryClient = new RegistryClient();
let registryDiscovery = new RegistryDiscovery();

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

const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const contentTextarea = document.getElementById('content-textarea');
const fileList = document.getElementById('file-list');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

const registrySelect = document.getElementById('registry-select');
const createButton = document.getElementById('create-button');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupFileUpload();
    setupKeyManagement();
    await setupRegistrySelector();
    setupCreateButton();
    await loadExistingKeys();
});

/**
 * Setup tabs
 */
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            
            // Update buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tab}-tab`).classList.add('active');
        });
    });
}

/**
 * Setup file upload
 */
function setupFileUpload() {
    uploadArea.addEventListener('click', () => fileInput.click());
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
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleFiles(files);
    });
}

/**
 * Handle file selection
 */
function handleFiles(files) {
    fileList.innerHTML = '';
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        `;
        fileList.appendChild(fileItem);
    });
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
 * Setup key management
 */
function setupKeyManagement() {
    generateKeysBtn.addEventListener('click', async () => {
        try {
            setLoading(true);
            generateKeysBtn.disabled = true;
            
            // Wait a bit for ed25519 library to load if needed
            if (typeof window.ed25519 === 'undefined') {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const { did } = await keyManager.generateKeys();
            updateKeyStatus(true, did);
            showSuccess('Keys generated successfully!');
        } catch (error) {
            console.error('Key generation error:', error);
            showError('Failed to generate keys: ' + error.message + '. Please check the browser console for details.');
        } finally {
            setLoading(false);
            generateKeysBtn.disabled = false;
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
        
        // Get content based on active tab
        const activeTab = document.querySelector('.tab-button.active').dataset.tab;
        let content = null;
        let hash = null;
        
        if (activeTab === 'file') {
            if (!fileInput.files || fileInput.files.length === 0) {
                showError('Please select a file');
                setLoading(false);
                return;
            }
            // For now, handle single file (can extend to multiple)
            const file = fileInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            hash = await hashBinary(new Uint8Array(arrayBuffer));
        } else if (activeTab === 'text') {
            const text = contentTextarea.value.trim();
            if (!text) {
                showError('Please enter content');
                setLoading(false);
                return;
            }
            hash = await hashText(text);
        }
        
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
        
        // Create claim object
        const timestamp = new Date().toISOString();
        const claim = {
            hash: hash,
            did: did,
            timestamp: timestamp
        };
        
        // Canonicalize and sign claim
        const canonicalClaim = JSON.stringify(claim, Object.keys(claim).sort());
        const signature = await keyManager.sign(canonicalClaim);
        
        // Prepare attestation request
        const attestation = {
            hash: hash,
            signature: signature,
            did: did,
            timestamp: timestamp
        };
        
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

