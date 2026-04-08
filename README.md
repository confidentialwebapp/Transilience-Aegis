# Transillience Aegis

> AI-powered dark web OSINT platform for authorized intelligence investigations.

[![Build Status](https://img.shields.io/github/actions/workflow/status/confidentialwebapp/Transillience-Aegis/docker-release.yml?style=flat-square&label=build)](https://github.com/confidentialwebapp/Transillience-Aegis/actions/workflows/docker-release.yml)
[![Latest Release](https://img.shields.io/github/v/release/confidentialwebapp/Transillience-Aegis?style=flat-square)](https://github.com/confidentialwebapp/Transillience-Aegis/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)

---

## Overview

Transillience Aegis is an OSINT (Open Source Intelligence) platform designed for cybersecurity professionals and authorized investigators. It combines Tor-based anonymous routing with large language model intelligence to search, scrape, filter, and summarize content across 16+ dark web search engines — all through a clean Streamlit web interface.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [Legal Disclaimer](#legal-disclaimer)
- [Acknowledgements](#acknowledgements)

---

## Features

### AI-Powered Intelligence
- **Query Refinement** — LLMs automatically optimize raw search queries for dark web context.
- **Intelligent Filtering** — AI ranks and filters results by relevance before presenting them.
- **Multi-Model Support** — Integrates with OpenAI, Anthropic Claude, Google Gemini, OpenRouter, Ollama, and LlamaCPP.

### Privacy & Security
- **Tor Integration** — All traffic is routed anonymously via SOCKS5 proxy.
- **Local AI Processing** — Use Ollama or LlamaCPP for fully on-premise, zero-egress AI inference.
- **Docker Isolation** — Containerized deployment ensures a clean, sandboxed runtime environment.

### Dark Web Coverage
- **16+ Search Engines** — Covers Ahmia, OnionLand, Torgle, Amnesia, Kaizer, Tor66, DeepSearches, and more.
- **Parallel Scraping** — High-throughput concurrent crawling of `.onion` sites.
- **Real-Time Dashboard** — Live results streamed into the investigation interface.

### Investigation Tools
- **Custom Reports** — Export investigation results to structured files.
- **Search History** — Revisit and resume past investigations at any time.
- **Streamlit UI** — Responsive, browser-based interface requiring no frontend setup.

---

## Architecture

```
User Query
    │
    ▼
Streamlit Web UI (port 8501)
    │
    ▼
LLM Refinement Engine ──────► [OpenAI / Claude / Gemini / Ollama / LlamaCPP]
    │
    ▼
Tor Proxy (SOCKS5://127.0.0.1:9050)
    │
    ▼
Search Engine Matrix
    ├── Ahmia          ├── Amnesia
    ├── OnionLand      ├── Kaizer
    ├── Torgle         ├── Tor66
    └── DeepSearches   └── (+ 9 more)
    │
    ▼
Parallel Scraper
    │
    ▼
LLM Result Filter
    │
    ▼
AI Summary Engine
    │
    ▼
Investigation Report
```

A health monitor runs alongside the pipeline, watching each stage (search, filter, summary) and surfacing failures in real time.

---

## Prerequisites

- **Python** 3.10 or higher (for local development)
- **Docker & Docker Compose** (recommended for deployment)
- **Tor** service running locally

### Install Tor

```bash
# Linux / WSL
sudo apt install tor && sudo service tor start

# macOS
brew install tor && brew services start tor
```

---

## Installation

### Option 1 — Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/confidentialwebapp/Transillience-Aegis.git
cd Transillience-Aegis

# 2. Start Tor
sudo service tor start   # Linux
# brew services start tor  # macOS

# 3. Launch the application
docker-compose up
```

Open your browser at `http://localhost:8501`.

**Persisting investigations across container restarts:**

```bash
docker run --rm \
  -v "$(pwd)/.env:/app/.env" \
  -v "$(pwd)/investigations:/app/investigations" \
  --add-host=host.docker.internal:host-gateway \
  -p 8501:8501 \
  transillience-aegis:latest
```

---

### Option 2 — Python (Local Development)

```bash
# 1. Clone and enter the repository
git clone https://github.com/confidentialwebapp/Transillience-Aegis.git
cd Transillience-Aegis

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start Tor (see above)

# 4. Launch the UI
streamlit run ui.py
```

---

## Usage

| Step | Action | Notes |
|------|--------|-------|
| 1 | Confirm Tor is running | `sudo service tor status` |
| 2 | Start the application | Docker or `streamlit run ui.py` |
| 3 | Enter your search query | Natural language accepted |
| 4 | AI refines the query | Automatically optimized |
| 5 | Parallel search executes | Queries 16+ engines concurrently |
| 6 | Review filtered results | AI-ranked by relevance |
| 7 | Save the investigation | Exported to `investigations/` |

---

## Configuration

Copy `.env.example` to `.env` and populate the relevant API keys:

```env
# LLM Provider (choose one or configure multiple)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here

# For local inference (no key required)
OLLAMA_BASE_URL=http://localhost:11434
LLAMACPP_BASE_URL=http://localhost:8080

# Tor proxy (default)
TOR_PROXY=socks5://127.0.0.1:9050
```

---

## Contributing

Contributions are welcome. Please follow the standard fork-and-PR workflow:

```bash
# 1. Fork the repository on GitHub

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit
git commit -m "feat: describe your change"

# 4. Push to your fork
git push origin feature/your-feature-name

# 5. Open a Pull Request against main
```

**Issue types accepted:**
- Bug reports
- Feature requests
- Documentation improvements
- Usage questions

---

## Legal Disclaimer

This tool is intended exclusively for **authorized OSINT investigations** and **lawful cybersecurity research**.

- You are solely responsible for ensuring your use complies with all applicable local, national, and international laws.
- You must have explicit authorization before investigating any target system or individual.
- LLM API usage is subject to each provider's terms of service.
- The authors and maintainers of this project accept no liability for any misuse or unlawful application of this software.

**By using Transillience Aegis, you accept full responsibility for your actions.**

---

## Acknowledgements

- [OSINT-Assistant](https://github.com/AXRoux/OSINT-Assistant) — LLM prompt references

---

<sub>Transillience Aegis — Illuminating the dark web for authorized investigators.</sub>
