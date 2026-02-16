# 🚀 Quick Start: Deploy to Google Cloud Run

## Fastest Way to Deploy (5 minutes)

### Step 1: Install gcloud CLI (if not installed)

**Mac:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Windows:**
Download from: https://cloud.google.com/sdk/docs/install

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
```

### Step 2: Authenticate & Set Up

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID (replace with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com
```

### Step 3: Deploy with One Command

```bash
cd clasp-deployer-web
./deploy-cloud-run.sh
```

That's it! Your app will be live in ~5 minutes. 🎉

---

## Alternative: Deploy via Google Cloud Console (No CLI needed)

1. **Go to Cloud Run**: https://console.cloud.google.com/run/

2. **Click "CREATE SERVICE"**

3. **Choose deployment method**:
   - Select "Continuously deploy from a repository" 
   - OR upload your source code

4. **Configure service**:
   - Service name: `scriptflow-deployer`
   - Region: `europe-west1`
   - Authentication: ✅ Allow unauthenticated
   - Container port: `8080`
   - Memory: `512 MiB`
   - CPU: `1`

5. **Click "CREATE"** and wait 3-5 minutes

6. **Get your URL** from the service details page

---

## Verify Deployment

After deployment, test your app:

```bash
# Get your service URL
gcloud run services describe scriptflow-deployer \
  --region=europe-west1 \
  --format='value(status.url)'

# Test it
curl YOUR_SERVICE_URL
```

Or simply open the URL in your browser! 🌐

---

## Common Issues & Solutions

### ❌ "Project not found"
**Solution:** Create a project at https://console.cloud.google.com/

### ❌ "Billing not enabled"
**Solution:** Enable billing for your project (Cloud Run has a free tier!)

### ❌ "Permission denied"
**Solution:** Make sure you're authenticated: `gcloud auth login`

### ❌ "Build failed"
**Solution:** Check logs: `gcloud builds list --limit=1`

---

## What Was Deployed?

Your ScriptFlow application is now:
- ✅ Running in a secure container
- ✅ Auto-scaling (scales to 0 when not in use)
- ✅ Accessible via HTTPS
- ✅ Highly available across multiple zones
- ✅ Monitored with Cloud Logging

---

## Next Steps

1. **Custom Domain**: Cloud Run → Manage Custom Domains
2. **Environment Variables**: Cloud Run → Edit & Deploy → Variables
3. **Database**: Consider Cloud SQL for persistent data
4. **Monitoring**: View logs and metrics in Cloud Console

---

## Need Help?

- 📚 [Full Deployment Guide](./CLOUD_RUN_DEPLOYMENT.md)
- ✅ [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- 🌐 [Cloud Run Docs](https://cloud.google.com/run/docs)

**Questions?** Check the full deployment guide for detailed troubleshooting.

