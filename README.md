# Delta — AI-Powered Technical Learning & Change Engine

Delta is a terminal-native, monospaced learning platform designed for engineers to master rapidly changing technical domains. It automatically tracks technical changes, builds competency graphs, computes learning deltas, and generates sandboxed coding challenges to prove mastery.

## Features

- **Competency Graph Generator**: Maps skill prerequisites, optional modules, and specialization nodes using Groq LLMs.
- **Technical Change Analyzer**: Scrapes and analyzes release notes, documentation updates, and technical announcements.
- **Learning Delta Engine**: Calculates exact skill gaps and effort estimates when tech stacks update.
- **Adaptive Code Sandbox**: Generates and executes coding challenges using Piston execution sandboxes with automated test assertion & counterexample analysis.
- **Monochrome Terminal Design**: Monospaced Berkeley Mono aesthetics with zero distraction.

## Getting Started

First, install dependencies:

```bash
npm install
```

Set up environment variables in `.env.local`:

```env
GROQ_API_KEY=your_groq_api_key
BRIGHT_DATA_API_KEY=your_bright_data_api_key
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to launch Delta.

## Architecture

- **Framework**: Next.js 15 App Router
- **Database & Auth**: Drizzle ORM (SQLite / Better-Auth)
- **AI & Engine**: Groq SDK (Llama 3.3 70B)
- **Code Execution**: Piston Sandbox API
- **Scraper**: Cheerio HTML parser with fallback strategies

