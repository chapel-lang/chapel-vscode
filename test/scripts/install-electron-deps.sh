#!/usr/bin/env bash
# Installs the libraries Electron needs to run VS Code headless on Debian/Ubuntu.
set -euo pipefail

apt-get update
apt-get install -y --no-install-recommends \
  xvfb xauth libnss3 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libgbm1 \
  libxss1 libxkbfile1 libsecret-1-0 libdrm2 libxcomposite1 libxdamage1 \
  libxrandr2 libxkbcommon0
# Debian trixie renamed libasound2 for the 64-bit time_t transition
apt-get install -y --no-install-recommends libasound2t64 ||
  apt-get install -y --no-install-recommends libasound2
