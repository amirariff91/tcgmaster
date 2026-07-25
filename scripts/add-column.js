const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Since we cannot run raw DDL through the JS client, we'll store verified state in Redis for now
console.log('Skipping PG migration - will use Redis for URL verification status');
