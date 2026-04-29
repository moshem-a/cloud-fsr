variable "project_id" {
  type        = string
  description = "GCP project id (e.g. gcp-sales-coach-dev)"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "firestore_location" {
  type    = string
  default = "nam5" # locked by ADR 0005
}

variable "allowed_email_domain" {
  type    = string
  default = "google.com"
}

variable "domain_name" {
  type        = string
  description = "Public hostname for the SPA (e.g. dev.salescoach.cloud.google)"
}

# Sprint 0: empty wiring. Modules become real in Sprint 1+ when we provision.
module "project" {
  source     = "../../modules/project"
  project_id = var.project_id
}

module "firestore" {
  source     = "../../modules/firestore"
  project_id = var.project_id
  location   = var.firestore_location
  depends_on = [module.project]
}

module "storage" {
  source       = "../../modules/storage"
  project_id   = var.project_id
  region       = var.region
  env          = "dev"
  cors_origins = ["https://${var.domain_name}", "http://localhost:5173"]
  depends_on   = [module.project]
}

module "cloud_run" {
  source             = "../../modules/cloud-run"
  project_id         = var.project_id
  region             = var.region
  service_name       = "scoach-api-dev"
  allowed_email_domain = var.allowed_email_domain
  depends_on         = [module.project]
}
