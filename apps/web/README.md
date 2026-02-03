# Automatrix ERP - Next.js Application

This directory contains the main Next.js application for the Automatrix ERP system.

## Setup

Refer to the root [README.md](../../README.md) for overall project setup instructions.

## Running Locally

1) Create env file

```bash
cp .env.example .env.local
```

2) Install + start

```bash
pnpm install
pnpm dev
```

## Key Areas

-   **UI Components**: `components/`
-   **Application Logic**: `src/`
-   **API Endpoints**: `src/app/api/`
-   **Database Schema**: `prisma/schema.prisma`

## Build & Test

```bash
pnpm build
pnpm test
```
