#!/bin/bash

# setup_deploy.sh - Setup and check deployment tools

echo "Checking deployment tools..."

# Check GitHub CLI
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI (gh) is installed."
    gh auth status
else
    echo "❌ GitHub CLI (gh) is not installed."
fi

# Check Vercel CLI
if npx vercel --version &> /dev/null; then
    echo "✅ Vercel CLI is installed."
    npx vercel whoami
else
    echo "❌ Vercel CLI is not installed."
fi

echo "Setup check complete."
