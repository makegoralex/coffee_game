#!/bin/bash
set -e

cd /var/www/coffee-game

echo "===> Fetching latest code"
git fetch origin

echo "===> Resetting to origin/main"
git reset --hard origin/main

echo "===> Installing dependencies"
npm install

echo "===> Building project"
npm run build

echo "===> Deploy complete"
