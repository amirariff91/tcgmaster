---
name: new-api-route
description: Scaffold a new Next.js API route with consistent patterns
disable-model-invocation: true
---

# New API Route Generator

Create a new API route in `app/api/` with:
- TypeScript types
- Zod validation schema
- Error handling wrapper
- Supabase client setup

## Usage
/new-api-route <path> [method]

## Example
/new-api-route users/[id]/favorites POST
