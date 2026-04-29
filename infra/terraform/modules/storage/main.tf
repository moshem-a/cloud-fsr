variable "project_id" { type = string }
variable "region" { type = string }
variable "env" { type = string }
variable "cors_origins" { type = list(string) }

# Web bundle (served via CDN)
resource "google_storage_bucket" "web" {
  name                        = "gcp-sales-coach-${var.env}-web"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

# Context uploads (PDFs, DOCX, etc) — 90-day TTL
resource "google_storage_bucket" "context" {
  name                        = "gcp-sales-coach-${var.env}-context"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  lifecycle_rule {
    condition { age = 90 }
    action { type = "Delete" }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "HEAD", "PUT", "POST", "OPTIONS"]
    response_header = ["Content-Type", "x-goog-resumable"]
    max_age_seconds = 3600
  }
}

# PDF summary exports — 30-day TTL
resource "google_storage_bucket" "exports" {
  name                        = "gcp-sales-coach-${var.env}-exports"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  lifecycle_rule {
    condition { age = 30 }
    action { type = "Delete" }
  }
}

output "web_bucket" { value = google_storage_bucket.web.name }
output "context_bucket" { value = google_storage_bucket.context.name }
output "exports_bucket" { value = google_storage_bucket.exports.name }
