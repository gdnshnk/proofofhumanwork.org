# Troubleshooting "Load failed" / "INVALID" Issues

## If verification shows "INVALID" or "Load failed":

### 1. **Restart the Registry** (IMPORTANT!)
The registry needs to be restarted after CORS changes:
```bash
# Stop the registry (Ctrl+C)
# Then restart:
cd pohw-registry-node
npm start
```

### 2. **Check Registry is Running**
```bash
curl http://localhost:3000/health
```
Should return: `{"status":"ok",...}`

### 3. **Check Browser Console (F12)**
Look for:
- `[VerificationClient] Making request to:` - should show `http://localhost:3000/pohw/verify/...`
- `[VerificationClient] Response status:` - should be `200`
- Any CORS errors
- Any network errors

### 4. **Test Direct API Call in Browser Console**
```javascript
fetch('http://localhost:3000/pohw/verify/bf521edae7cb2d13378e254b7cb329866b2fc7c1097bea54e9f60c24a04008ac')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

### 5. **If Using file:// Protocol**
If you're opening the HTML file directly (file://), CORS will block requests. Instead:
- Use a local web server:
  ```bash
  cd proofofhumanwork.org/verify
  python3 -m http.server 8000
  # Then open: http://localhost:8000
  ```

### 6. **Verify Registry Selector**
- Make sure "Local Development" is selected
- The dropdown should show: `http://localhost:3000`

### 7. **Hard Refresh**
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

## Common Errors:

### "Cannot connect to registry"
- Registry is not running
- Wrong port (should be 3000)
- Firewall blocking

### CORS Error
- Registry needs to be restarted
- Using file:// protocol (use local server instead)

### "Proof not found"
- Wrong hash
- Proof not submitted to this registry
- Wrong registry selected

