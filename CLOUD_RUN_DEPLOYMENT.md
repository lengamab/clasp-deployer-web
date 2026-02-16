# Google Cloud Run Deployment Guide

This guide will help you deploy ScriptFlow to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account**: Sign up at [cloud.google.com](https://cloud.google.com)
2. **Google Cloud Project**: Create a project in the [GCP Console](https://console.cloud.google.com)
3. **gcloud CLI**: Install from [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)
4. **Docker** (optional): Only needed for local testing

## Quick Deployment (Recommended)

### Option 1: Using the Deployment Script

1. **Set your GCP Project ID**:
   ```bash
   export GCP_PROJECT_ID="your-project-id"
   ```

2. **Run the deployment script**:
   ```bash
   cd clasp-deployer-web
   chmod +x deploy-cloud-run.sh
   ./deploy-cloud-run.sh
   ```

3. **Access your deployed application**:
   The script will output your application URL when complete.

### Option 2: Manual Deployment via GCP Console

1. **Navigate to Cloud Run**: Go to [console.cloud.google.com/run](https://console.cloud.google.com/run)

2. **Click "Create Service"**

3. **Configure the service**:
   - Container image URL: Click "Set up with Cloud Build"
   - Source: Select "GitHub" or upload from local
   - Build type: Dockerfile
   - Dockerfile location: `clasp-deployer-web/Dockerfile`

4. **Service settings**:
   - Service name: `scriptflow-deployer`
   - Region: `europe-west1` (Belgium) or choose closest to your users
   - Authentication: Allow unauthenticated invocations
   - Container port: `8080`
   - Memory: `512 MiB`
   - CPU: `1`
   - Min instances: `0`
   - Max instances: `10`

5. **Click "Create"** and wait for deployment

### Option 3: Manual Deployment via CLI

1. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable required APIs**:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   ```

3. **Build and push container image**:
   ```bash
   cd clasp-deployer-web
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/scriptflow-deployer
   ```

4. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy scriptflow-deployer \
     --image gcr.io/YOUR_PROJECT_ID/scriptflow-deployer \
     --platform managed \
     --region europe-west1 \
     --allow-unauthenticated \
     --memory 512Mi \
     --cpu 1 \
     --port 8080
   ```

5. **Get the service URL**:
   ```bash
   gcloud run services describe scriptflow-deployer \
     --platform managed \
     --region europe-west1 \
     --format 'value(status.url)'
   ```

## Environment Variables

If you need to set environment variables (e.g., for API keys):

```bash
gcloud run services update scriptflow-deployer \
  --update-env-vars MAKE_API_TOKEN="your-token",OTHER_VAR="value"
```

Or in the GCP Console:
1. Go to Cloud Run
2. Select your service
3. Click "Edit & Deploy New Revision"
4. Go to "Variables & Secrets" tab
5. Add your environment variables

## Persistent Storage

Cloud Run is stateless. Your SQLite database will be reset on each deployment. For production:

1. **Option A - Cloud SQL**: Use Cloud SQL for PostgreSQL/MySQL
2. **Option B - Cloud Storage**: Store the SQLite file in Cloud Storage
3. **Option C - Firestore**: Use Firestore as your database

To mount Cloud Storage:
```bash
gcloud run services update scriptflow-deployer \
  --execution-environment gen2 \
  --add-volume name=database,type=cloud-storage,bucket=your-bucket-name \
  --add-volume-mount volume=database,mount-path=/app/data
```

## Custom Domain

1. **In GCP Console**:
   - Go to Cloud Run → Select Service → "Manage Custom Domains"
   - Click "Add Mapping"
   - Follow the instructions to verify your domain

2. **Via CLI**:
   ```bash
   gcloud run domain-mappings create \
     --service scriptflow-deployer \
     --domain your-domain.com \
     --region europe-west1
   ```

## Monitoring & Logs

### View Logs
```bash
gcloud run logs read --service=scriptflow-deployer --region=europe-west1
```

Or in the Console:
- Cloud Run → Select Service → "Logs" tab

### Monitor Performance
- Cloud Run → Select Service → "Metrics" tab

### Set Up Alerts
- Cloud Monitoring → Alerting → Create Policy

## Cost Estimation

Cloud Run pricing (as of 2024):
- **Free tier**: 2 million requests/month
- **CPU**: $0.00002400/vCPU-second
- **Memory**: $0.00000250/GiB-second
- **Requests**: $0.40/million requests

Estimated cost for low traffic: ~$0-5/month

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure `better-sqlite3` builds correctly (included in Dockerfile)

### Service Won't Start
- Check logs: `gcloud run logs read --service=scriptflow-deployer`
- Verify PORT environment variable is being used
- Check that port 8080 is exposed

### Database Issues
- Remember: SQLite database is ephemeral on Cloud Run
- Consider using Cloud SQL or Firestore for production

### Authentication Issues
- Check IAM permissions
- Verify service account has necessary roles

## Updating Your Deployment

To deploy updates:

```bash
# Rebuild and deploy
./deploy-cloud-run.sh

# Or manually
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/scriptflow-deployer
gcloud run deploy scriptflow-deployer --image gcr.io/YOUR_PROJECT_ID/scriptflow-deployer
```

## Rolling Back

To rollback to a previous revision:

1. **List revisions**:
   ```bash
   gcloud run revisions list --service=scriptflow-deployer
   ```

2. **Route traffic to specific revision**:
   ```bash
   gcloud run services update-traffic scriptflow-deployer \
     --to-revisions=REVISION_NAME=100
   ```

## Security Best Practices

1. **Use Secret Manager** for sensitive data:
   ```bash
   # Create secret
   echo -n "your-secret-value" | gcloud secrets create my-secret --data-file=-
   
   # Grant access to Cloud Run service account
   gcloud secrets add-iam-policy-binding my-secret \
     --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   
   # Update service to use secret
   gcloud run services update scriptflow-deployer \
     --update-secrets=MAKE_API_TOKEN=my-secret:latest
   ```

2. **Enable authentication** if needed:
   ```bash
   gcloud run services update scriptflow-deployer --no-allow-unauthenticated
   ```

3. **Set up VPC** for internal services:
   ```bash
   gcloud run services update scriptflow-deployer \
     --vpc-connector=your-vpc-connector
   ```

## Support

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud Run Limits](https://cloud.google.com/run/quotas)

## Next Steps

1. Set up continuous deployment with Cloud Build
2. Configure custom domain
3. Set up monitoring and alerting
4. Implement database persistence
5. Configure authentication and authorization

