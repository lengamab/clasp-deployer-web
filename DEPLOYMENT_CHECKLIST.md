# ScriptFlow Deployment Checklist ✅

## Files Created for Deployment

✅ **Dockerfile** - Containerization configuration
✅ **.dockerignore** - Excludes unnecessary files from container
✅ **deploy-cloud-run.sh** - Automated deployment script
✅ **CLOUD_RUN_DEPLOYMENT.md** - Comprehensive deployment guide
✅ **server.js** - Updated to use PORT environment variable

## Deployment Options

### Option 1: Automated Script (Easiest) 🚀

```bash
cd clasp-deployer-web
export GCP_PROJECT_ID="your-project-id"
chmod +x deploy-cloud-run.sh
./deploy-cloud-run.sh
```

### Option 2: Manual CLI Deployment

```bash
# 1. Set project
gcloud config set project YOUR_PROJECT_ID

# 2. Enable APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# 3. Build image
cd clasp-deployer-web
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/scriptflow-deployer

# 4. Deploy
gcloud run deploy scriptflow-deployer \
  --image gcr.io/YOUR_PROJECT_ID/scriptflow-deployer \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --port 8080
```

### Option 3: Google Cloud Console (Web UI)

1. Go to: https://console.cloud.google.com/run/
2. Click "CREATE SERVICE"
3. Select "Continuously deploy from a repository (source or function)"
   OR "Deploy one revision from an existing container image"
4. Configure:
   - Service name: `scriptflow-deployer`
   - Region: `europe-west1` (Belgium)
   - Port: `8080`
   - Memory: `512 MiB`
   - Allow unauthenticated invocations

## Prerequisites Checklist

Before deploying, ensure you have:

- [ ] Google Cloud account
- [ ] Active GCP project with billing enabled
- [ ] gcloud CLI installed (for CLI deployment)
- [ ] Docker installed (for local testing - optional)
- [ ] Authenticated with gcloud: `gcloud auth login`

## Post-Deployment Tasks

After deployment:

1. **Test your application**
   - Visit the provided URL
   - Test all major features

2. **Set environment variables** (if needed)
   ```bash
   gcloud run services update scriptflow-deployer \
     --update-env-vars MAKE_API_TOKEN="your-token"
   ```

3. **Configure custom domain** (optional)
   - Cloud Run → Service → Manage Custom Domains

4. **Set up monitoring**
   - View logs: `gcloud run logs read --service=scriptflow-deployer --region=europe-west1`
   - Check metrics in Cloud Console

5. **Configure database persistence** (important!)
   - Current: SQLite (ephemeral - resets on restart)
   - Recommended: Cloud SQL or Firestore for production

## Important Notes

⚠️ **Database Persistence**: The SQLite database will reset on each deployment. For production use:
- Use Cloud SQL (PostgreSQL/MySQL)
- Use Firestore
- Mount Cloud Storage bucket

⚠️ **Environment Variables**: Store sensitive data (API keys) in Secret Manager

⚠️ **Cost**: Cloud Run has a generous free tier (2M requests/month)

## Troubleshooting

### Build fails
- Check Dockerfile syntax
- Ensure all dependencies in package.json

### Service won't start
- Check logs: `gcloud run logs read`
- Verify PORT environment variable
- Check that port 8080 is correct

### Database issues
- Remember: SQLite is ephemeral on Cloud Run
- Consider Cloud SQL for persistence

## Quick Commands Reference

```bash
# View logs
gcloud run logs read --service=scriptflow-deployer --region=europe-west1

# Update service
gcloud run services update scriptflow-deployer --memory=1Gi

# List services
gcloud run services list

# Describe service (get URL)
gcloud run services describe scriptflow-deployer --region=europe-west1

# Delete service
gcloud run services delete scriptflow-deployer --region=europe-west1
```

## Support Resources

- 📚 [Full Deployment Guide](./CLOUD_RUN_DEPLOYMENT.md)
- 🌐 [Cloud Run Documentation](https://cloud.google.com/run/docs)
- 💰 [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- 🔧 [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud/reference/run)

---

**Ready to deploy?** Choose your preferred option above and follow the steps! 🚀

