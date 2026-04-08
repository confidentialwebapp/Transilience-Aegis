<div align="center">
   
   <!-- Animated Logo Effect -->
   <img src="logo.png" alt="Transillience Aegis Logo" width="280" style="filter: drop-shadow(0 0 10px rgba(0,255,255,0.5));">
   
   <br><br>
   
   <!-- Epic Badges Row -->
   <a href="https://github.com/confidentialwebapp/Transillience-Aegis/actions/workflows/docker-release.yml">
      <img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/confidentialwebapp/Transillience-Aegis/docker-release.yml?style=for-the-badge&logo=github-actions&logoColor=white&color=00ff88">
   </a>
   <a href="https://github.com/confidentialwebapp/Transillience-Aegis/releases">
      <img alt="Latest Release" src="https://img.shields.io/github/v/release/confidentialwebapp/Transillience-Aegis?style=for-the-badge&logo=github&logoColor=white&color=ff6b6b">
   </a>
   <a href="#">
      <img alt="License" src="https://img.shields.io/badge/License-MIT-ff00ff?style=for-the-badge&logo=open-source-initiative&logoColor=white">
   </a>
   <a href="#">
      <img alt="Python" src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white">
   </a>
   
   <br><br>
   
   <!-- Cool Title with Neon Effect -->
   <h1>
      <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=30&pause=1000&color=00FF88&center=true&vCenter=true&width=600&height=60&lines=Transillience+Aegis;Dark+Web+OSINT+Platform;AI-Powered+Investigations" alt="Typing SVG" />
   </h1>
   
   <!-- Tagline -->
   <p align="center">
      <em>🔍 Illuminate the shadows. AI-powered dark web intelligence at your fingertips.</em>
   </p>
   
   <!-- Quick Navigation -->
   <a href="#features"><img src="https://img.shields.io/badge/Features-00d4ff?style=flat-square"></a>
   <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-ff00ff?style=flat-square"></a>
   <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-00ff88?style=flat-square"></a>
   <a href="#installation"><img src="https://img.shields.io/badge/Installation-ff6b6b?style=flat-square"></a>
   
   <br><br>
   
   <!-- Star Count (Visual) -->
   <img src="https://img.shields.io/github/stars/confidentialwebapp/Transillience-Aegis?style=social&color=ffd700">
   
</div>

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## 🌟 Features

<table>
<tr>
<td width="50%">

### 🤖 AI-Powered Intelligence
- **Smart Query Refinement** – LLMs optimize your search queries
- **Intelligent Filtering** – AI filters relevant results automatically  
- **Multi-Model Support** – OpenAI, Claude, Gemini, Ollama, LlamaCPP

</td>
<td width="50%">

### 🔒 Privacy & Security
- **Tor Integration** – Anonymous routing via SOCKS5 proxy
- **Local Processing** – Use Ollama/LlamaCPP for on-premise AI
- **Docker Isolation** – Clean, sandboxed deployment

</td>
</tr>
<tr>
<td width="50%">

### 🌐 Dark Web Coverage
- **16+ Search Engines** – Ahmia, OnionLand, Torgle, and more
- **Parallel Scraping** – High-speed onion site crawling
- **Real-time Results** – Live investigation dashboard

</td>
<td width="50%">

### 📝 Investigation Tools
- **Custom Reports** – Save investigations to file
- **History Tracking** – Revisit past searches anytime
- **Streamlit UI** – Modern, responsive web interface

</td>
</tr>
</table>

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## 🏗️ Architecture

<details>
<summary><b>🔥 Click to Expand System Architecture</b></summary>
<br>

```mermaid
flowchart TD
    A[🔍 User Query] -->|Input| B["🌐 Streamlit Web UI<br/>Port 8501"]
    B -->|Raw Query| C["🤖 LLM Refinement Engine"]
    
    subgraph LLM["🧠 LLM Providers"]
        L1[OpenAI GPT]
        L2[Anthropic Claude]
        L3[Google Gemini]
        L4[OpenRouter]
        L5[🦙 Ollama Local]
        L6[🦙 LlamaCPP Local]
    end
    
    C -.->|API Call| LLM
    C -->|Optimized Query| D["🔒 Tor Proxy<br/>SOCKS5://127.0.0.1:9050"]
    D -->|Route| E["🕸️ Search Engine Matrix"]
    
    subgraph SE["🔍 16+ Dark Web Engines"]
        S1[Ahmia]
        S2[OnionLand]
        S3[Torgle]
        S4[Amnesia]
        S5[Kaizer]
        S6[Tor66]
        S7[DeepSearches]
    end
    
    E --> SE
    SE -->|.onion URLs| F["⚡ Parallel Scraper"]
    F -->|Raw Content| G["🎯 LLM Result Filter"]
    G -->|Ranked Data| H["📊 AI Summary Engine"]
    H -->|Final Report| I["📄 Investigation Report"]
    
    HM["💓 Health Monitor"] -.->|Watch| E
    HM -.->|Watch| G
    HM -.->|Watch| H
```

</details>

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## � Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/confidentialwebapp/Transillience-Aegis.git
cd Transillience-Aegis

# 2. Start Tor service
tor &

# 3. Launch with Docker (Recommended)
docker-compose up

# 4. Open browser → http://localhost:8501
```

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## 📦 Installation

### Prerequisites

> 🧅 **Tor Required**
> ```bash
> # Linux/WSL
> sudo apt install tor && sudo service tor start
> 
> # macOS
> brew install tor && brew services start tor
> ```

### 🐳 Docker (Recommended)

```bash
# Pull latest image
docker pull transillience-aegis:latest

# Run container
docker run --rm \
   -v "$(pwd)/.env:/app/.env" \
   --add-host=host.docker.internal:host-gateway \
   -p 8501:8501 \
   transillience-aegis:latest
```

<details>
<summary>💡 <b>Persistence Tip</b> (Click to expand)</summary>

```bash
# Save investigations across restarts
docker run --rm \
   -v "$(pwd)/.env:/app/.env" \
   -v "$(pwd)/investigations:/app/investigations" \
   --add-host=host.docker.internal:host-gateway \
   -p 8501:8501 \
   transillience-aegis:latest
```
</details>

### 🐍 Python Development

```bash
# Requirements: Python 3.10+
pip install -r requirements.txt

# Launch UI
streamlit run ui.py
```

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## 🎯 Usage Guide

| Step | Action | Result |
|------|--------|--------|
| 1 | 🔌 Ensure Tor is running | `service tor start` |
| 2 | 🚀 Launch application | Docker or `streamlit run ui.py` |
| 3 | 📝 Enter search query | Natural language input |
| 4 | 🤖 AI refines query | Optimized for dark web |
| 5 | 🕸️ Parallel search | 16+ engines queried |
| 6 | 📊 View filtered results | AI-ranked relevance |
| 7 | 💾 Save investigation | To `investigations/` folder |

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## ⚠️ Legal Disclaimer

> **🔒 For Educational & Lawful Use Only**
> 
> This tool is intended for **authorized OSINT investigations** and **cybersecurity research**. 
> 
> - ✅ Compliance with local laws is **your responsibility**
> - ✅ Institutional policies must be followed
> - ✅ API terms of service apply to LLM queries
> 
> <sub>By using this tool, you accept full responsibility for your actions. The authors assume no liability for misuse.</sub>

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## 🤝 Contributing

We welcome contributions! Follow these steps:

```bash
# 1. Fork the repo
# 2. Create feature branch
git checkout -b feature/amazing-feature

# 3. Commit changes
git commit -m "✨ Add amazing feature"

# 4. Push to branch
git push origin feature/amazing-feature

# 5. Open Pull Request 🎉
```

**Issues welcome for:**
- 🐛 Bug reports
- 💡 Feature requests  
- ❓ Usage questions
- 🔧 Minor improvements

<br>

<!-- Cool Divider -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&height=2&section=header" width="100%">

<br>

## 🙏 Acknowledgements

<table>
<tr>
<td>

**Inspiration**
- 💡 [Thomas Roccia](https://x.com/fr0gger_) – *Perplexity of the Dark Web* concept

**Resources**
- 📚 [OSINT-Assistant](https://github.com/AXRoux/OSINT-Assistant) – LLM prompts

</td>
<td align="right">

**Built by**
<br><br>
<img src="logo.png" width="80">
<br>
<b>Transillience Aegis</b>

</td>
</tr>
</table>

<br>

<div align="center">
   
   <!-- Footer -->
   <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer">
   
   <sub>🛡️ Illuminating the dark web, one query at a time.</sub>
   
</div>
