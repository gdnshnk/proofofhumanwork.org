# Debugging Verification Issues

If verification shows "INVALID" even after selecting "Local Development", check:

## 1. Registry is Running
```bash
cd pohw-registry-node
npm start
```

Check if it's running:
```bash
curl http://localhost:3000/health
```

## 2. Browser Console (F12)
Open browser console and check for:
- `[App] Using registry:` - should show `http://localhost:3000`
- `[VerificationClient] Registry URL:` - should show `http://localhost:3000`
- `[VerificationClient] Full URL:` - should show `http://localhost:3000/pohw/verify/...`
- Any CORS errors
- Any network errors

## 3. Test Direct API Call
In browser console, run:
```javascript
fetch('http://localhost:3000/pohw/verify/bf521edae7cb2d13378e254b7cb329866b2fc7c1097bea54e9f60c24a04008ac')
  .then(r => r.json())
  .then(console.log)
```

Should return:
```json
{
  "valid": true,
  "signer": "did:pohw:test:verification-test-user",
  "timestamp": "2025-11-26T13:12:22.550Z",
  "registry": "proofofhumanwork.org"
}
```

## 4. Check Registry Selector
- Make sure "Local Development" is selected in the dropdown
- The dropdown should show: `http://localhost:3000`

## 5. Hard Refresh
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`
- Or clear browser cache

## 6. CORS Issues
If you see CORS errors, the registry needs to allow your origin. Check:
- Registry is running with CORS enabled (should be by default)
- You're accessing the verify page from `file://` (try using a local server instead)

## Test Hash
```
0xbf521edae7cb2d13378e254b7cb329866b2fc7c1097bea54e9f60c24a04008ac
```

