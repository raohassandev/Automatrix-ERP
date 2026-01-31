#!/bin/bash
# ============================================================================
# AutoMatrix ERP - Automated Deployment to Google Apps Script
# ============================================================================
# Uses Google's clasp CLI to automatically deploy to Apps Script
# ============================================================================

set -e  # Exit on error

echo "🚀 AutoMatrix ERP - Automated Deployment"
echo "========================================"
echo ""

# Configuration
OUTPUT_DIR="build"
SCRIPT_FILE="Code.gs"
HTML_FILE="Index.html"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Step 1: Check prerequisites
# ============================================================================

echo "📋 Step 1: Checking prerequisites..."
echo ""

# Check if clasp is installed
if ! command -v clasp &> /dev/null; then
    echo -e "${RED}❌ clasp is not installed${NC}"
    echo ""
    echo "To install clasp (Google Apps Script CLI):"
    echo "  npm install -g @google/clasp"
    echo ""
    echo "Then login:"
    echo "  clasp login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ clasp is installed${NC}"

# Check if logged in
if ! clasp login --status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged into clasp${NC}"
    echo ""
    echo "Running clasp login..."
    clasp login
fi

echo -e "${GREEN}✅ Logged into Google Apps Script${NC}"
echo ""

# ============================================================================
# Step 2: Check if project is initialized
# ============================================================================

echo "📋 Step 2: Checking project configuration..."
echo ""

if [ ! -f ".clasp.json" ]; then
    echo -e "${YELLOW}⚠️  .clasp.json not found${NC}"
    echo ""
    echo "You need to initialize the project first:"
    echo "  1. Create a new Apps Script project or clone existing:"
    echo "     clasp create --type standalone --title \"AutoMatrix ERP\""
    echo "     OR"
    echo "     clasp clone <scriptId>"
    echo ""
    echo "  2. This will create .clasp.json with your script ID"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Project configured (.clasp.json found)${NC}"
echo ""

# Read script ID
SCRIPT_ID=$(cat .clasp.json | grep "scriptId" | cut -d'"' -f4)
echo "📌 Script ID: $SCRIPT_ID"
echo ""

# ============================================================================
# Step 3: Build deployment package
# ============================================================================

echo "🔨 Step 3: Building deployment package..."
echo ""

# Create build directory
mkdir -p "$OUTPUT_DIR"

# Run build script
if [ -f "scripts/deploy.sh" ]; then
    echo "Running build script..."
    bash scripts/deploy.sh > /dev/null 2>&1
    
    if [ -f "script.gs" ]; then
        # Copy to build directory with Apps Script naming
        cp script.gs "$OUTPUT_DIR/$SCRIPT_FILE"
        echo -e "${GREEN}✅ Backend code built: $SCRIPT_FILE${NC}"
    else
        echo -e "${RED}❌ Build failed: script.gs not generated${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Build script not found: scripts/deploy.sh${NC}"
    exit 1
fi

# Copy HTML file
if [ -f "src/client/Index.html" ]; then
    cp src/client/Index.html "$OUTPUT_DIR/$HTML_FILE"
    echo -e "${GREEN}✅ Frontend copied: $HTML_FILE${NC}"
else
    echo -e "${RED}❌ Frontend not found: src/client/Index.html${NC}"
    exit 1
fi

echo ""

# ============================================================================
# Step 4: Create appsscript.json if not exists
# ============================================================================

echo "📋 Step 4: Checking manifest file..."
echo ""

if [ ! -f "$OUTPUT_DIR/appsscript.json" ]; then
    cat > "$OUTPUT_DIR/appsscript.json" << 'EOF'
{
  "timeZone": "Asia/Kolkata",
  "dependencies": {
    "enabledAdvancedServices": []
  },
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_WITH_LINK"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
EOF
    echo -e "${GREEN}✅ Created appsscript.json manifest${NC}"
else
    echo -e "${GREEN}✅ Manifest file exists${NC}"
fi

echo ""

# ============================================================================
# Step 5: Copy .clasp.json to build directory
# ============================================================================

echo "📋 Step 5: Preparing deployment..."
echo ""

cp .clasp.json "$OUTPUT_DIR/"
echo -e "${GREEN}✅ Configuration copied${NC}"

# Show what will be deployed
echo ""
echo "📦 Files to deploy:"
echo "   1. $SCRIPT_FILE ($(wc -l < "$OUTPUT_DIR/$SCRIPT_FILE") lines)"
echo "   2. $HTML_FILE ($(wc -l < "$OUTPUT_DIR/$HTML_FILE") lines)"
echo "   3. appsscript.json"
echo ""

# ============================================================================
# Step 6: Deploy to Apps Script
# ============================================================================

echo "🚀 Step 6: Deploying to Google Apps Script..."
echo ""

# Change to build directory
cd "$OUTPUT_DIR"

# Push to Apps Script
if clasp push --force; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo ""
    echo -e "${RED}❌ Deployment failed${NC}"
    cd ..
    exit 1
fi

# Go back to root
cd ..

echo ""

# ============================================================================
# Step 7: Open in browser (optional)
# ============================================================================

echo "📋 Step 7: Post-deployment options..."
echo ""

read -p "Do you want to open the script in browser? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$OUTPUT_DIR"
    clasp open
    cd ..
    echo -e "${GREEN}✅ Opened in browser${NC}"
fi

echo ""

# ============================================================================
# Deployment Summary
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 Script ID: $SCRIPT_ID"
echo "🔗 Script URL: https://script.google.com/d/$SCRIPT_ID/edit"
echo ""
echo "📋 Next Steps:"
echo "   1. Open the script in Apps Script editor"
echo "   2. Run 'initializeSystem()' function once"
echo "   3. Deploy as Web App:"
echo "      - Click 'Deploy' → 'New deployment'"
echo "      - Type: Web app"
echo "      - Execute as: Me"
echo "      - Who has access: Anyone with Google account"
echo "   4. Copy the Web App URL and start using!"
echo ""
echo "🎉 Happy coding!"
echo ""
