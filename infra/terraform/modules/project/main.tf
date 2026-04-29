variable "project_id" {
  type = string
}

locals {
  enabled_services = [
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firestore.googleapis.com",
    "firebaserules.googleapis.com",
    "storage.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "speech.googleapis.com",
    "aiplatform.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "cloudtrace.googleapis.com",
    "vpcaccess.googleapis.com",
    "certificatemanager.googleapis.com",
    "admin.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each = toset(local.enabled_services)
  project  = var.project_id
  service  = each.value

  disable_on_destroy = false
}

# Service accounts
resource "google_service_account" "api_runtime" {
  account_id   = "api-runtime"
  display_name = "Cloud Run API runtime identity"
  project      = var.project_id
}

resource "google_service_account" "cicd" {
  account_id   = "cicd"
  display_name = "Cloud Build CI/CD"
  project      = var.project_id
}

resource "google_service_account" "web_deployer" {
  account_id   = "web-deployer"
  display_name = "Pushes built SPA bundle to GCS"
  project      = var.project_id
}

# api-runtime IAM
locals {
  api_runtime_roles = [
    "roles/datastore.user",
    "roles/aiplatform.user",
    "roles/speech.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/cloudtrace.agent",
    "roles/monitoring.metricWriter",
  ]
}

resource "google_project_iam_member" "api_runtime" {
  for_each = toset(local.api_runtime_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.api_runtime.email}"
}

output "api_runtime_sa" {
  value = google_service_account.api_runtime.email
}

output "cicd_sa" {
  value = google_service_account.cicd.email
}
