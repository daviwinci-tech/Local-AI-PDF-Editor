#!/usr/bin/env bash
set -e

echo "========================================================"
echo " Local AI PDF Editor - Setup Script (Linux / macOS)"
echo "========================================================"

echo "[1/3] Creating Python Virtual Environment (venv)..."
python3 -m venv venv
source venv/bin/activate

echo "[2/3] Installing Python Dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "[3/3] Installing Frontend NPM Dependencies..."
npm install

echo "========================================================"
echo " Setup Completed Successfully!"
echo " Run ./start.sh to launch both backend and frontend."
echo "========================================================"
