# Security Fix: Encryption Key Default Vulnerability

## Vulnerability Summary

**Severity:** HIGH  
**Category:** Cryptographic Secrets Management  
**File:** `src/modules/keys/keys-encryption.provider.ts`  
**Line:** 11-16 (original)

## Problem

The application was encrypting sensitive payment keys using a publicly-known default encryption key (`'default-key-change-in-production'`) when the `KEYS_ENCRYPTION_KEY` environment variable was not configured. This allowed attackers with database access to decrypt all stored payment keys.

**Original Code:**

```typescript
this.encryptionKey =
  this.configService.get<string>('KEYS_ENCRYPTION_KEY') || 'default-key-change-in-production';

if (this.encryptionKey === 'default-key-change-in-production') {
  console.warn('⚠️ WARNING: Using default encryption key...');
}
```

## Solution Implemented

Implemented **fail-fast** behavior in production environments:

1. **Production Mode** (`NODE_ENV=production`): Application throws an error on startup if `KEYS_ENCRYPTION_KEY` is not properly configured, preventing deployment with weak encryption.

2. **Development Mode**: Application continues to work with the default key but logs a clear warning.

3. **Key Strength Validation**: Warns if the configured key is less than 32 characters.

**Fixed Code:**

```typescript
const encryptionKey = this.configService.get<string>('KEYS_ENCRYPTION_KEY');
const isProduction = process.env.NODE_ENV === 'production';

// Fail-fast in production if no key is configured
if (!encryptionKey || encryptionKey === 'default-key-change-in-production') {
  if (isProduction) {
    throw new Error(
      'KEYS_ENCRYPTION_KEY environment variable must be set in production. ' +
        'Generate a secure random key (min 32 characters) before deploying. ' +
        "Example: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  // Development only - use default key with warning
  this.encryptionKey = 'default-key-change-in-production';
  console.warn('⚠️ WARNING: Using default encryption key for development...');
} else {
  // Validate key strength
  if (encryptionKey.length < 32) {
    console.warn(`⚠️ WARNING: KEYS_ENCRYPTION_KEY is less than 32 characters...`);
  }
  this.encryptionKey = encryptionKey;
}
```

## Testing

- ✅ Build: PASS
- ✅ Tests: 45/45 PASS (6/6 suites)
- ✅ Lint: 0 errors (212 pre-existing warnings)

## Deployment Instructions

### Before Deploying to Production:

1. **Generate a secure encryption key:**

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Example output: `a1b2c3d4e5f6...` (64 characters)

2. **Set the environment variable:**

   ```bash
   # In your .env file or deployment configuration
   KEYS_ENCRYPTION_KEY=a1b2c3d4e5f6...
   ```

3. **Verify production deployment:**

   ```bash
   NODE_ENV=production npm run start
   ```

   Application should start without errors if key is configured.

4. **If key is missing in production:**
   Application will fail to start with clear error message:
   ```
   Error: KEYS_ENCRYPTION_KEY environment variable must be set in production.
   ```

## Migration Notes

### Existing Deployments

If you have existing encrypted keys in the database:

- Keys encrypted with the default key will need to be re-encrypted
- Plan a maintenance window for key rotation
- Consider creating a migration script

### New Deployments

No migration needed - just generate a secure key before first deployment.

## Security Impact

### Before Fix

- **Risk:** HIGH - All encrypted payment keys could be decrypted by attackers
- **Exploit Scenario:** Database breach → decrypt payment keys → fraud/identity theft
- **Detection:** No immediate detection possible

### After Fix

- **Risk:** LOW - Production deployments require secure encryption key
- **Protection:** Application refuses to start without proper configuration
- **Defense in Depth:** Key strength validation provides additional protection

## Related Security Findings

This fix addresses the HIGH severity finding from the security review. Two MEDIUM severity findings remain:

1. **MEDIUM:** CORS configuration with credentials (separate fix needed)
2. **MEDIUM:** Webhook signature verification bypass (separate fix needed)

## Files Modified

- `src/modules/keys/keys-encryption.provider.ts` - Added fail-fast validation

## Verification

To verify the fix is working:

```bash
# Test 1: Development mode (should work with warning)
npm run start:dev
# Expected: Starts with warning about default key

# Test 2: Production mode without key (should fail)
NODE_ENV=production npm run start
# Expected: Error - KEYS_ENCRYPTION_KEY must be set

# Test 3: Production mode with key (should work)
NODE_ENV=production KEYS_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npm run start
# Expected: Starts successfully
```

---

**Date:** 2026-05-09  
**Status:** ✅ Fixed  
**Reviewed by:** Security Team
