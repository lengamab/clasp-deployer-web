#!/bin/bash

# ScriptFlow - Google Cloud Run Deployment Script
# This script deploys the application to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID}"
DEFAULT_SERVICE_NAME="scriptflow-deployer"
REGION="europe-west1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 ScriptFlow Cloud Run Deployment${NC}"
echo "=================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  GCP_PROJECT_ID not set${NC}"
    echo "Please enter your Google Cloud Project ID:"
    read -r PROJECT_ID
    export GCP_PROJECT_ID="$PROJECT_ID"
fi

# Prompt for Service Name
echo -e "${YELLOW}Target Service Name${NC} [Default: ${DEFAULT_SERVICE_NAME}]:"
read -r SERVICE_NAME_INPUT
SERVICE_NAME="${SERVICE_NAME_INPUT:-$DEFAULT_SERVICE_NAME}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${GREEN}📋 Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Service Name: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Image: $IMAGE_NAME"
echo ""

# Set the project
echo -e "${GREEN}🔧 Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo -e "${GREEN}🔌 Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build the container image
echo -e "${GREEN}🏗️  Building container image...${NC}"
gcloud builds submit --tag "$IMAGE_NAME"

# Deploy to Cloud Run
echo -e "${GREEN}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 8080 \
    --timeout 300

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format 'value(status.url)')

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo "=================================="
echo -e "${GREEN}🌐 Your application is now live at:${NC}"
echo -e "${YELLOW}$SERVICE_URL${NC}"
echo ""
echo -e "${GREEN}📝 Next steps:${NC}"
echo "  1. Visit your application URL above"
echo "  2. Configure any environment variables if needed:"
echo "     gcloud run services update $SERVICE_NAME --update-env-vars KEY=VALUE"
echo "  3. View logs:"
echo "     gcloud run logs read --service=$SERVICE_NAME --region=$REGION"
echo ""

