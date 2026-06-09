# Architecture

## System Overview

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

## Folder Structure

src/
├── app/
├── components/
├── features/
│   ├── capture/
│   ├── training/
│   ├── evaluation/
│   └── mastery/
├── lib/
├── services/
├── types/
└── api/

## Core Data Flow

Capture
→ Store Source
→ Generate Questions
→ Create Session
→ User Response
→ AI Evaluation
→ Reflection
→ Update Mastery

## AI Workflow

Input:
- Reflection
- Case note
- Article summary
- Insight

Generation:
- Topic extraction
- Question creation
- Difficulty balancing

Evaluation:
- Strengths
- Missed concepts
- Suggested improvements
- Core principle learned

Output:
- Updated mastery state

## Database Entities

### TrainingSources
- id
- content
- sourceType
- createdAt

### TrainingSessions
- id
- sourceId
- topic
- createdAt

### Questions
- id
- sessionId
- category
- prompt

### Responses
- id
- questionId
- response

### Evaluations
- id
- responseId
- strengths
- missedConcepts
- improvements
- principle

### MasteryTopics
- id
- topic
- confidenceScore
- sessionCount
- weakAreas

## Route Structure

/
/capture
/training
/training/[sessionId]
/mastery

API:
/api/generate-session
/api/generate-question
/api/evaluate-response
/api/mastery

## Design Principles

1. One primary action per screen
2. Minimal cognitive load
3. Deliberate-practice first
4. Judgment over memorization
5. Reflection integrated into workflow
6. Future-ready for multi-user expansion
7. Maintain architectural simplicity
