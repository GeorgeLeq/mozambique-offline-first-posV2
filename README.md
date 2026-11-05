# Mozambique Retail POS + Local Llama AI

Offline-first POS for small shops in Mozambique. It runs locally, works without internet, and uses Llama through Ollama for natural POS commands.

## Tech stack

- React + Vite
- TypeScript
- Tauri desktop app
- SQLite local storage
- Ollama + Llama 3.2 1B
- Supabase for optional cloud sync

## What it does

- sales and checkout without internet
- local stock tracking
- cashier and shift support
- SQLite storage for fast offline work
- desktop app via Tauri
- local AI with Llama 3.2 1B / pos-parser

## Hackathon challenge

This app is built for the Meta AI hackathon focus: local retail AI that understands everyday store commands.

Examples:

- "Sell 2kg of rice"
- "Add 10 water bottles to cart"
- "What is the stock of flour?"
- "Show today sales"
- "Which product is selling fastest?"

## Install

### Web dev mode

```bash
npm install
npm run dev
```

### Tauri dev mode

```bash
npm install
npm run tauri dev
```

### Tauri production build

```bash
npm install
npm run build
npm run tauri build
```

## Llama setup

### Optional: Baseten cloud fallback

This app can also use Baseten as an optional cloud AI fallback when local Ollama is unavailable. This is completely optional.

If you want to use your own Baseten key, open the file:

- `src/lib/ai/unified/basetenClient.ts`

Then update the values there:

```ts
// User-provided API key from Baseten
export const DEFAULT_BASETEN_API_KEY = '';
export const DEFAULT_BASETEN_ENDPOINT = '';
export const DEFAULT_BASETEN_MODEL = 'meta-models/muse-spark-open';
```

You can leave these blank if you do not want to use the cloud fallback, or replace them with your own Baseten credentials.

### Install Ollama

Download from: https://ollama.com/download

Check:

```bash
ollama --version
```

### Pull Llama 3.2 1B

```bash
ollama pull llama3.2:1b
```

### Create custom model: pos-parser

If you have a GGUF file like `Llama-3.2-1B-Instruct-Q4_K_M.gguf`:

```cmd
cd path\to\your\gguf\folder
(echo FROM ./Llama-3.2-1B-Instruct-Q4_K_M.gguf & echo PARAMETER num_ctx 512 & echo PARAMETER num_thread 4 & echo PARAMETER num_predict 120) > Modelfile
ollama create pos-parser -f Modelfile
```

Test it:

```bash
ollama run pos-parser
```

## Shortcut phrases for Llama

### English

- "Add 2 bags of rice to cart"
- "Sell 3 bottles of water"
- "Show total sale"
- "What is the stock of rice?"
- "Show low stock items"
- "What did we sell today?"
- "Open cashier"
- "Close shift"
- "Summary of store"
- "Remove last item"

### Portuguese

- "Adicionar 2 sacos de arroz"
- "Vender 3 garrafas de água"
- "Mostrar total da venda"
- "Qual é o stock de arroz?"
- "Mostrar produtos com pouco stock"
- "O que vendemos hoje?"
- "Abrir caixa"
- "Fechar turno"
- "Resumo da loja"
- "Remover último item"

## Quick start

```bash
npm install
npm run tauri dev
ollama pull llama3.2:1b
ollama run pos-parser
```

This app is built to stay usable offline, while still giving store owners a simple AI assistant for everyday POS work.
