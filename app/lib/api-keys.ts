import { supabase } from './supabaseClient';
import { customAlphabet } from 'nanoid';
import { logAuditEvent } from './audit-log';

// Generate secure API keys with custom alphabet (no ambiguous characters)
const generateApiKey = customAlphabet('0123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 32);

export interface APIKey {
  id: string;
  user_id: string;
  key_prefix: string; // First 8 chars visible (e.g., "sk_live_12345678...")
  key_hash: string; // SHA-256 hash of full key
  name: string;
  environment: 'test' | 'live';
  rate_limit_per_hour: number;
  rate_limit_per_day: number;
  usage_count: number;
  last_used_at?: string;
  expires_at?: string;
  revoked: boolean;
  created_at: string;
}

/**
 * Create a new API key for enterprise clients
 */
export async function createAPIKey(options: {
  user_id: string;
  name: string;
  environment?: 'test' | 'live';
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  expires_in_days?: number;
}): Promise<{ key: string; metadata: APIKey } | null> {
  try {
    const env = options.environment || 'test';
    const rawKey = `sk_${env}_${generateApiKey()}`;
    const keyPrefix = rawKey.substring(0, 16); // Show first 16 chars
    
    // Hash the key for storage (never store raw keys)
    const keyHash = await hashAPIKey(rawKey);

    const expiresAt = options.expires_in_days
      ? new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: options.user_id,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        name: options.name,
        environment: env,
        rate_limit_per_hour: options.rate_limit_per_hour || (env === 'test' ? 10 : 100),
        rate_limit_per_day: options.rate_limit_per_day || (env === 'test' ? 50 : 1000),
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating API key:', error);
      return null;
    }

    // Log audit event
    await logAuditEvent({
      user_id: options.user_id,
      action: 'api_key_created',
      metadata: {
        key_name: options.name,
        environment: env,
        key_prefix: keyPrefix,
      },
      resource_id: data.id,
      resource_type: 'api_key',
    });

    // Return the raw key (ONLY TIME IT'S VISIBLE) and metadata
    return {
      key: rawKey,
      metadata: data,
    };
  } catch (error) {
    console.error('Failed to create API key:', error);
    return null;
  }
}

/**
 * Verify an API key and check rate limits
 */
export async function verifyAPIKey(rawKey: string): Promise<{
  valid: boolean;
  key?: APIKey;
  error?: string;
}> {
  try {
    // Extract prefix to narrow search
    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = await hashAPIKey(rawKey);

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_prefix', keyPrefix)
      .eq('key_hash', keyHash)
      .eq('revoked', false)
      .single();

    if (error || !data) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // Check rate limits (done in middleware, but validate here too)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { count: hourlyCount } = await supabase
      .from('api_key_usage')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', data.id)
      .gte('created_at', oneHourAgo.toISOString());

    if (hourlyCount && hourlyCount >= data.rate_limit_per_hour) {
      return { valid: false, error: 'Hourly rate limit exceeded' };
    }

    return { valid: true, key: data };
  } catch (error) {
    console.error('API key verification error:', error);
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Log API key usage (called on each API request)
 */
export async function logAPIKeyUsage(options: {
  api_key_id: string;
  user_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms?: number;
  ip_address?: string;
  user_agent?: string;
}): Promise<void> {
  try {
    await supabase.from('api_key_usage').insert({
      api_key_id: options.api_key_id,
      user_id: options.user_id,
      endpoint: options.endpoint,
      method: options.method,
      status_code: options.status_code,
      response_time_ms: options.response_time_ms,
      ip_address: options.ip_address,
      user_agent: options.user_agent,
    });

    // Update last_used_at and usage_count
    await supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: supabase.rpc('increment_usage', { key_id: options.api_key_id }),
      })
      .eq('id', options.api_key_id);

    // Log audit event
    await logAuditEvent({
      user_id: options.user_id,
      action: 'api_key_used',
      metadata: {
        endpoint: options.endpoint,
        method: options.method,
        status_code: options.status_code,
      },
      resource_id: options.api_key_id,
      resource_type: 'api_key',
      ip_address: options.ip_address,
      user_agent: options.user_agent,
    });
  } catch (error) {
    console.error('Failed to log API key usage:', error);
  }
}

/**
 * Rotate an API key (revoke old, create new)
 */
export async function rotateAPIKey(oldKeyId: string, userId: string): Promise<{ key: string; metadata: APIKey } | null> {
  try {
    // Get old key details
    const { data: oldKey } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', oldKeyId)
      .eq('user_id', userId)
      .single();

    if (!oldKey) {
      return null;
    }

    // Revoke old key
    await supabase
      .from('api_keys')
      .update({ revoked: true })
      .eq('id', oldKeyId);

    // Create new key with same settings
    const newKey = await createAPIKey({
      user_id: userId,
      name: `${oldKey.name} (rotated)`,
      environment: oldKey.environment,
      rate_limit_per_hour: oldKey.rate_limit_per_hour,
      rate_limit_per_day: oldKey.rate_limit_per_day,
    });

    // Log audit event
    await logAuditEvent({
      user_id: userId,
      action: 'api_key_rotated',
      metadata: {
        old_key_id: oldKeyId,
        new_key_id: newKey?.metadata.id,
      },
      resource_id: newKey?.metadata.id,
      resource_type: 'api_key',
    });

    return newKey;
  } catch (error) {
    console.error('Failed to rotate API key:', error);
    return null;
  }
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ revoked: true })
      .eq('id', keyId)
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    return false;
  }
}

/**
 * Get all API keys for a user
 */
export async function getUserAPIKeys(userId: string): Promise<APIKey[]> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching API keys:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return [];
  }
}

/**
 * Hash API key using SHA-256 (Web Crypto API)
 */
async function hashAPIKey(key: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node environment (API routes)
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
