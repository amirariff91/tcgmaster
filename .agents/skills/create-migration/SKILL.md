---
name: create-migration
description: Create a new Supabase migration with proper naming and structure
disable-model-invocation: true
---

# Create Supabase Migration

Generate a new migration file in `supabase/migrations/` with:
- Timestamped filename (YYYYMMDDHHMMSS_description.sql)
- Proper SQL structure with comments
- Rollback commands in comments

## Usage
/create-migration <description>

## Example
/create-migration add-user-preferences-table
