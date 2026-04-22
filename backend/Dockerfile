# TAI-AEGIS backend — Kali Linux base with full recon toolkit.
#
# Optimized for Render free tier (512 MB RAM, 4 GB image limit). The image is
# slimmed by:
#   - using --no-install-recommends everywhere
#   - rm -rf /var/lib/apt/lists at the end of every apt layer
#   - splitting OS deps from Python deps so pip cache hits across rebuilds
#   - excluding heavy GUI / wireless / forensic tools
#
# To switch tools: edit the SECURITY_TOOLS arg below. Each addition costs RAM
# at runtime if invoked concurrently — keep this list to what you actually use.

FROM kalilinux/kali-rolling

# Core OS + Python toolchain (cached layer — rebuilds only if this list changes)
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        ca-certificates \
        curl \
        wget \
        git \
        tzdata \
 && rm -rf /var/lib/apt/lists/*

# Kali security tools — recon / OSINT / web scanning oriented.
# (Skipped: GUI tools, wireless, exploitation frameworks, forensics — wrong
# fit for a server-side recon API and they blow past the 4 GB image limit.)
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        theharvester \
        nmap \
        masscan \
        whois \
        dnsutils \
        dnsrecon \
        whatweb \
        nikto \
        wpscan \
        amass \
        gobuster \
        sublist3r \
        subfinder \
        nuclei \
        recon-ng \
        host \
        traceroute \
        netcat-traditional \
 && rm -rf /var/lib/apt/lists/* \
 && apt-get clean

# Python deps — install into an isolated venv to avoid colliding with
# Debian-managed Python packages (apt theharvester etc. ship their own
# pinned `packaging`, `requests`, etc. that pip can't safely uninstall).
WORKDIR /app
ENV VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"
RUN python3 -m venv "${VIRTUAL_ENV}" \
 && /opt/venv/bin/pip install --no-cache-dir --upgrade pip
# Build context = backend/ (matches render.yaml rootDir + dockerContext).
COPY requirements.txt ./requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Application code
COPY . ./

# Render injects PORT (typically 10000); default to 8000 for local docker run.
ENV PORT=8000 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HARVESTER_BIN=/usr/bin/theHarvester
EXPOSE 8000

# Shell form so $PORT expands at runtime — and exec to keep PID 1 clean for signals.
CMD exec /opt/venv/bin/uvicorn main:app --host 0.0.0.0 --port ${PORT}
