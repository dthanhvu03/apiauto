#!/bin/bash
# Setup script for Threads HTML Parser

echo "Setting up virtual environment..."
python3 -m venv venv

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Setup complete!"
echo ""
echo "To use the parser:"
echo "  1. Activate virtual environment: source venv/bin/activate"
echo "  2. Run parser: python3 threads_parser.py"
echo ""
