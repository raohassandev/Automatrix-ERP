#!/bin/bash
# ============================================================================
# AutoMatrix ERP - Quick Setup for clasp
# ============================================================================
# Interactive setup script for automated deployment
# ============================================================================

set -e

echo "🎯 AutoMatrix ERP - clasp Setup Wizard"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Step 1: Check Node.js
# ============================================================================

echo "📋 Step 1: Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo ""
    echo "Or use package manager:"
    echo "  macOS:   brew install node"
    echo "  Ubuntu:  sudo apt install nodejs npm"
    echo ""
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js installed: $NODE_VERSION${NC}"
echo ""

# ============================================================================
# Step 2: Check/Install clasp
# ============================================================================

echo "📋 Step 2: Checking clasp (Google Apps Script CLI)..."

if ! command -v clasp &> /dev/null; then
    echo -e "${YELLOW}⚠️  clasp is not installed${NC}"
    echo ""
    read -p "Do you want to install clasp now? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing clasp globally..."
        npm install -g @google/clasp
        echo -e "${GREEN}✅ clasp installed${NC}"
    else
        echo -e "${RED}❌ clasp is required for automated deployment${NC}"
        echo "Install manually: npm install -g @google/clasp"
        exit 1
    fi
else
    CLASP_VERSION=$(clasp --version)
    echo -e "${GREEN}✅ clasp installed: $CLASP_VERSION${NC}"
fi

echo ""

# ============================================================================
# Step 3: Login to Google
# ============================================================================

echo "📋 Step 3: Checking Google login status..."

if ! clasp login --status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged into Google Apps Script${NC}"
    echo ""
    echo "This will open a browser window for authentication..."
    read -p "Press Enter to continue..."
    
    clasp login
    echo -e "${GREEN}✅ Logged in successfully${NC}"
else
    echo -e "${GREEN}✅ Already logged in${NC}"
fi

echo ""

# ============================================================================
# Step 4: Project Setup
# ============================================================================

echo "📋 Step 4: Project Setup"
echo ""

if [ -f ".clasp.json" ]; then
    echo -e "${YELLOW}⚠️  .clasp.json already exists${NC}"
    SCRIPT_ID=$(cat .clasp.json | grep "scriptId" | cut -d'"' -f4)
    echo "Current Script ID: $SCRIPT_ID"
    echo ""
    read -p "Do you want to use existing configuration? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        rm .clasp.json
        echo "Removed existing configuration"
    else
        echo -e "${GREEN}✅ Using existing configuration${NC}"
        echo ""
        echo "🎉 Setup complete! Run './scripts/auto-deploy.sh' to deploy"
        exit 0
    fi
fi

echo ""
echo "Choose setup option:"
echo "  1) Create new Apps Script project"
echo "  2) Connect to existing Apps Script project"
echo "  3) Connect to Google Sheets (script bound to sheet)"
echo ""

read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "Creating new standalone Apps Script project..."
        clasp create --type standalone --title "AutoMatrix ERP"
        echo -e "${GREEN}✅ Project created${NC}"
        ;;
    2)
        echo ""
        echo "To find your Script ID:"
        echo "  1. Open your Apps Script project"
        echo "  2. Look at the URL: https://script.google.com/d/SCRIPT_ID/edit"
        echo ""
        read -p "Enter Script ID: " script_id
        
        cat > .clasp.json << EOF
{
  "scriptId": "$script_id",
  "rootDir": "build"
}
EOF
        
        echo -e "${GREEN}✅ Configuration created${NC}"
        ;;
    3)
        echo ""
        echo "To find your Sheet ID:"
        echo "  1. Open your Google Sheet"
        echo "  2. Look at the URL: https://docs.google.com/spreadsheets/d/SHEET_ID/edit"
        echo ""
        read -p "Enter Sheet ID: " sheet_id
        
        clasp create --type sheets --title "AutoMatrix ERP" --parentId "$sheet_id"
        echo -e "${GREEN}✅ Project created and bound to sheet${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""

# ============================================================================
# Step 5: Enable Apps Script API
# ============================================================================

echo "📋 Step 5: Checking Apps Script API..."
echo ""
echo -e "${YELLOW}⚠️  Important: Make sure Apps Script API is enabled${NC}"
echo ""
echo "Visit: https://script.google.com/home/usersettings"
echo "Enable: Google Apps Script API"
echo ""
read -p "Press Enter when done..."

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""

# ============================================================================
# Summary
# ============================================================================

if [ -f ".clasp.json" ]; then
    SCRIPT_ID=$(cat .clasp.json | grep "scriptId" | cut -d'"' -f4)
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Setup Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📌 Script ID: $SCRIPT_ID"
    echo "🔗 Script URL: https://script.google.com/d/$SCRIPT_ID/edit"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Run automated deployment:"
    echo "     ./scripts/auto-deploy.sh"
    echo ""
    echo "  2. Open in Apps Script editor and run 'initializeSystem()'"
    echo ""
    echo "  3. Deploy as Web App:"
    echo "     Deploy → New deployment → Web app"
    echo ""
    echo "🚀 Ready to deploy!"
    echo ""
fi
