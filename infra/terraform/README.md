# Terraform

```
envs/
  dev/      # one .tfvars + backend.tf per environment
  staging/
  prod/
modules/
  project/      # API enablement, IAM service accounts, org policy guardrails
  cloud-run/    # API service + custom domain mapping
  firestore/    # native-mode database (nam5), composite indexes
  storage/      # context, web, exports buckets with lifecycle + CORS
  networking/   # serverless VPC connector, HTTPS LB, Cloud Armor, managed SSL
  monitoring/   # log sinks, custom metrics, alert policies, dashboards
```

Backend state lives in a GCS bucket per environment (`tfstate-{env}`) with
state locking via Cloud Storage object versioning.

## First-time bootstrap

1. Create the three GCP projects manually (or via gcloud):
   `gcp-sales-coach-{dev,staging,prod}`
2. Enable Cloud Resource Manager, IAM, and Cloud Storage APIs in each.
3. Create a `tfstate-{env}` bucket per project with versioning on.
4. `cd envs/dev && terraform init && terraform plan && terraform apply`

After bootstrap the modules manage themselves.
