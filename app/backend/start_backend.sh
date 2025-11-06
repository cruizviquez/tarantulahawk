#!/bin/bash
# start_backend.sh - Start TarantulaHawk Python API

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure we run from this script's directory (app/backend)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}🕷️  Starting TarantulaHawk Backend API${NC}"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pip install -r requirements.txt

# Load environment variables
if [ -f ".env.backend" ]; then
    export $(cat .env.backend | xargs)
else
    echo -e "${YELLOW}Warning: .env.backend not found, using defaults${NC}"
    export NEXTJS_API_URL=http://localhost:3000/api
fi

# Determine port (Render provides PORT env var)
PORT=${PORT:-8000}

# Start FastAPI server
echo -e "${GREEN}Starting API server on http://0.0.0.0:${PORT}${NC}"
echo -e "${GREEN}API docs available at http://0.0.0.0:${PORT}/api/docs${NC}"

# Run with uvicorn (from api/ directory, module path is relative)
cd api
uvicorn enhanced_main_api:app --host 0.0.0.0 --port ${PORT} --reload

# Or if using the credit-aware routes wrapper:
# python -c "
# from fastapi import FastAPI
# from routes.credit_aware_routes import router
# app = FastAPI()
# app.include_router(router, prefix='/api')
# import uvicorn
# uvicorn.run(app, host='0.0.0.0', port=8000)
# "
