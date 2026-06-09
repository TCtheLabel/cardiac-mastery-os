# Claude Code Agent Instructions

## Objective
Build the MVP of Cardiac Mastery OS.

Focus exclusively on deliberate-practice workflows.

## MVP Scope

Build:
1. Home
2. Capture
3. Training Sessions
4. Mastery Tracking
5. AI Question Generation
6. AI Evaluation

Do Not Build:
- Authentication
- Payments
- Multi-user systems
- Social features
- Mobile apps
- PDF ingestion
- Video ingestion
- Voice transcription
- NotebookLM integration
- Knowledge graph
- Spaced repetition engine
- Advanced analytics

## Tech Stack

Frontend:
- Next.js
- TypeScript
- Tailwind
- shadcn/ui

Backend:
- Next.js API Routes

Database:
- Supabase Postgres

AI:
- OpenAI

Deployment:
- Vercel

## Constraints

Single-user application.

Optimize for simplicity.

Build the minimum viable experience that demonstrates the complete learning loop.

## Anti-Overengineering Rules

Do not:
- Create abstract architectures prematurely
- Build plugin systems
- Create event buses
- Add microservices
- Add role management
- Add permissions systems
- Add enterprise features

Prefer:
- Direct implementations
- Simple APIs
- Minimal database schema
- Fast iteration

## Success Criteria

A user can:

1. Capture a reflection
2. Generate a training session
3. Answer questions
4. Receive AI evaluation
5. Reflect
6. Track progress

End-to-end workflow must function cleanly and reliably.
