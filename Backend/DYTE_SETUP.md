# Dyte Video Conferencing Setup Guide

## Overview
This application uses Dyte for video conferencing in training sessions. Follow this guide to properly configure Dyte integration.

## Required Environment Variables

Add these variables to your `.env` file in the Backend directory:

```env
# Dyte API Configuration
DYTE_API_KEY=your_api_key_here
DYTE_ORG_ID=your_org_id_here
DYTE_API_URL=https://api.dyte.io/v2

# Dyte Preset Names (IMPORTANT: Must match your Dyte organization presets)
DYTE_HOST_PRESET=host
DYTE_PARTICIPANT_PRESET=participant
```

## How to Get Your Dyte Credentials

1. **Sign up for Dyte**
   - Visit https://dyte.io and create an account
   - Complete the onboarding process

2. **Get API Credentials**
   - Go to your Dyte Dashboard
   - Navigate to Settings → API Keys
   - Copy your `Organization ID` and `API Key`

3. **Check Available Presets**
   - Dyte presets define participant permissions (audio, video, screen share, etc.)
   - Run the preset checker script to see your available presets:
   ```bash
   cd Backend
   node check-dyte-presets.js
   ```

4. **Configure Preset Names**
   - The checker script will list all available presets in your organization
   - Common preset names: `host`, `moderator`, `participant`, `viewer`, `webinar_presenter`, `group_call_host`
   - Update `DYTE_HOST_PRESET` and `DYTE_PARTICIPANT_PRESET` in your `.env` file to match the exact names from your organization

## Common Issues and Solutions

### Error: "422 Unprocessable Content" or "Preset not found"

**Cause**: The preset names in your `.env` file don't match the presets configured in your Dyte organization.

**Solution**:
1. Run `node check-dyte-presets.js` to see available presets
2. Update `DYTE_HOST_PRESET` and `DYTE_PARTICIPANT_PRESET` in `.env` to match exact preset names
3. Restart your server

**Example**:
```bash
# If your organization uses "group_call_host" instead of "host":
DYTE_HOST_PRESET=group_call_host
DYTE_PARTICIPANT_PRESET=group_call_participant
```

### Error: "Dyte authentication failed"

**Cause**: Invalid `DYTE_API_KEY` or `DYTE_ORG_ID`

**Solution**:
1. Verify credentials in your Dyte Dashboard
2. Ensure there are no extra spaces in your `.env` file
3. Check that you're using the correct organization

### Error: "getSessionById is not a function"

**Cause**: Training service not properly initialized

**Solution**: This should be fixed in the latest version. Ensure you're using the updated codebase.

## Testing Your Setup

1. **Health Check**
   ```bash
   # The server logs will show Dyte configuration on startup
   npm run dev
   ```
   Look for: `🔧 Dyte Service Configuration:` in the logs

2. **Preset Verification**
   ```bash
   node check-dyte-presets.js
   ```
   Should output:
   - Your configured presets
   - Confirmation that required presets exist

3. **Create a Test Training Session**
   - Login as an employer
   - Create a training program with a session
   - Try to join the session
   - If successful, the Dyte meeting should load

## Best Practices

1. **Never commit your `.env` file** - Keep API keys secure
2. **Use different Dyte organizations** for development and production
3. **Regularly rotate API keys** for security
4. **Monitor Dyte usage** in your dashboard for billing

## Support

- Dyte Documentation: https://docs.dyte.io
- Dyte Community: https://community.dyte.io
- Report issues in this repository's issue tracker
