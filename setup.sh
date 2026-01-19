#!/bin/bash

# Forever Stories - Setup Script
# This script sets up the complete development environment

set -e  # Exit on error

echo "🚀 Forever Stories - Setup Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ No .env file found. Creating from .env.example...${NC}"
    cp .env.example .env
    
    echo ""
    echo -e "${YELLOW}📝 IMPORTANT: Please edit the .env file and add your API keys:${NC}"
    echo "   - ANTHROPIC_API_KEY (required for AI features)"
    echo "   - JWT_SECRET (generate a secure random string)"
    echo "   - ENCRYPTION_KEY (generate a 32-character hex string)"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
fi

# Validate critical environment variables
if ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env 2>/dev/null; then
    echo -e "${YELLOW}⚠ Warning: ANTHROPIC_API_KEY not set in .env file${NC}"
    echo "The app will run but AI features will not work without a valid API key."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p uploads
mkdir -p frontend
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Build and start services
echo "🏗️  Building Docker containers..."
docker-compose build

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓ All services are running!${NC}"
else
    echo -e "${RED}❌ Some services failed to start. Check logs with: docker-compose logs${NC}"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "=================================="
echo "Service URLs:"
echo "=================================="
echo "🔹 API Server:    http://localhost:3001"
echo "🔹 Database:      localhost:5432"
echo "🔹 Redis:         localhost:6379"
echo ""
echo "=================================="
echo "Useful Commands:"
echo "=================================="
echo "📊 View logs:         docker-compose logs -f"
echo "🔄 Restart services:  docker-compose restart"
echo "🛑 Stop services:     docker-compose down"
echo "🗑️  Clean everything:  docker-compose down -v"
echo ""
echo "=================================="
echo "Testing the API:"
echo "=================================="
echo "curl http://localhost:3001/health"
echo ""
echo "Happy coding! 🚀"
