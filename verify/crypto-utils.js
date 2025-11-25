/**
 * Crypto Utilities for PoHW Verification
 * Client-side hashing and canonicalization
 * NO PRIVATE KEYS - Verification only!
 */

/**
 * Canonicalize text content
 * Normalizes line endings, whitespace, etc.
 */
function canonicalizeText(text) {
    // Normalize line endings to LF (matches SDK)
    let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove trailing newlines
    normalized = normalized.replace(/\n+$/, '');
    
    // Remove trailing whitespace from each line
    normalized = normalized.replace(/[ \t]+$/gm, '');
    
    // Ensure single trailing newline (matches SDK)
    normalized += '\n';
    
    return normalized;
}

/**
 * Canonicalize JSON content
 * Sorts keys and removes whitespace
 */
function canonicalizeJSON(jsonString) {
    try {
        const obj = JSON.parse(jsonString);
        return JSON.stringify(obj, Object.keys(obj).sort());
    } catch (e) {
        // If not valid JSON, return as-is
        return jsonString;
    }
}

/**
 * Hash content using SHA-256
 * Returns hex string with 0x prefix
 */
async function hashSHA256(content) {
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    
    // Hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return '0x' + hashHex;
}

/**
 * Hash binary data (for files)
 */
async function hashBinary(data) {
    // data is ArrayBuffer or Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return '0x' + hashHex;
}

/**
 * Hash file content
 * Handles both text and binary files
 */
async function hashFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                
                // Try to read as text first (for text files)
                if (file.type.startsWith('text/') || 
                    file.name.endsWith('.txt') || 
                    file.name.endsWith('.md') || 
                    file.name.endsWith('.json') ||
                    file.name.endsWith('.js') ||
                    file.name.endsWith('.ts') ||
                    file.name.endsWith('.html') ||
                    file.name.endsWith('.css')) {
                    
                    const text = new TextDecoder().decode(arrayBuffer);
                    const canonicalized = canonicalizeText(text);
                    const hash = await hashSHA256(canonicalized);
                    resolve(hash);
                } else {
                    // Binary file - hash directly
                    const hash = await hashBinary(arrayBuffer);
                    resolve(hash);
                }
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Hash text content
 */
async function hashText(text) {
    const canonicalized = canonicalizeText(text);
    return await hashSHA256(canonicalized);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        canonicalizeText,
        canonicalizeJSON,
        hashSHA256,
        hashBinary,
        hashFile,
        hashText
    };
}

