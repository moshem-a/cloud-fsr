variable "project_id" { type = string }
variable "region" { type = string }
variable "service_name" { type = string }
variable "allowed_email_domain" { type = string }
variable "image" {
  type    = string
  default = "us-central1-docker.pkg.dev/PROJECT_ID/scoach/api:latest"
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = var.service_name
  location = var.region

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 50
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name  = "ALLOWED_EMAIL_DOMAIN"
        value = var.allowed_email_domain
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        http_get { path = "/healthz" }
        initial_delay_seconds = 0
        period_seconds        = 5
        failure_threshold     = 5
      }
    }

    timeout = "3600s" # 60 min for live meeting WS

    annotations = {
      "run.googleapis.com/sessionAffinity" = "true"
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

output "url" {
  value = google_cloud_run_v2_service.api.uri
}
