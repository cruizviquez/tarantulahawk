#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
console.log('HF:', !!process.env.HUGGINGFACE_API_KEY, 'SUPA_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL, 'SUPA_SR:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
