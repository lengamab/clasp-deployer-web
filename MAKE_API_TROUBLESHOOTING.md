# Make.com API Troubleshooting Guide

## Problem: "No scenarios found" or "Access denied" errors

### Root Cause
The Make.com API requires specific **scopes/permissions** for API tokens. Your token may lack the `scenarios:read` permission.

### Solution: Generate a New API Token with Full Permissions

1. **Go to Make.com API Settings:**
   - Visit: https://www.make.com/en/settings/api
   - Or navigate: Settings → API → API Tokens

2. **Create a New Token:**
   - Click "Create a new token"
   - **Name:** "Development Deployer" (or any name you prefer)
   - **Scopes:** Select **ALL** scopes, especially:
     - ✅ `scenarios:read`
     - ✅ `scenarios:write`
     - ✅ `organizations:read`
     - ✅ `teams:read`
   - Click "Save"

3. **Copy the Token:**
   - Make.com will display your new token **only once**
   - Copy it immediately

4. **Update Your Configuration:**
   - Open: `/Users/bricelengama/Documents/Marketing Opti/Cursor/clasp-deployer-web/.make-config.json`
   - Replace the `apiToken` value with your new token:
   ```json
   {
     "apiToken": "YOUR_NEW_TOKEN_HERE"
   }
   ```

5. **Restart the Server:**
   - Close the terminal running your server
   - Double-click "Development Deployer Web" shortcut to restart

### Verify the Fix

After restarting, the Make Manager should now load your scenarios from Make.com.

### Additional Notes

- **Multiple Config Files:** The app checks these locations in order:
  1. Environment variable: `MAKE_API_TOKEN`
  2. `clasp-deployer-web/.make-config.json` (apiToken)
  3. `make-scenarios/.makeconfig.json` (apiKey)

- **Test Your Token:** Visit http://localhost:3000/api/make/test to verify your token is valid

- **Region:** Your account is in the EU region (`eu1.make.com`). The app automatically detects this.

### Still Having Issues?

If you still see "Access denied" after generating a new token with full scopes:

1. Verify the token was copied correctly (no extra spaces)
2. Check that you selected ALL scopes when creating the token
3. Try logging out and back into Make.com, then generate a fresh token
4. Contact Make.com support if the issue persists



