# Make.com API Setup Guide

To fetch real scenarios from your Make.com account, you need to configure your API token.

## Step 1: Get Your Make.com API Token

1. Go to [Make.com Settings → API](https://www.make.com/en/settings/api)
2. Click "Create a new token" or use an existing token
3. Copy the token (you'll only see it once!)

## Step 2: Configure the Token

You have two options:

### Option A: Config File (Recommended)

1. Copy the example config file:
   ```bash
   cp .make-config.json.example .make-config.json
   ```

2. Edit `.make-config.json` and replace `YOUR_MAKE_COM_API_TOKEN_HERE` with your actual token:
   ```json
   {
     "apiToken": "your-actual-token-here"
   }
   ```

3. Restart your server

### Option B: Environment Variable

Set the environment variable before starting the server:

```bash
export MAKE_API_TOKEN=your-actual-token-here
node server.js
```

Or add it to your desktop shortcut script:
```bash
export MAKE_API_TOKEN=your-actual-token-here
node server.js
```

## Step 3: Verify It Works

1. Restart your server
2. Open the Make Manager
3. Click "Browse Make.com" tab
4. You should see all your scenarios from Make.com!

## Security Note

⚠️ **Never commit your `.make-config.json` file to git!** It contains your API token.

The `.gitignore` file should already exclude it, but double-check to be safe.



