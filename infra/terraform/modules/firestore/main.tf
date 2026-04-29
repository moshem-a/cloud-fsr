variable "project_id" {
  type = string
}

variable "location" {
  type        = string
  description = "Firestore location (locked to nam5 by ADR 0005)"
  default     = "nam5"
}

resource "google_firestore_database" "default" {
  project          = var.project_id
  name             = "(default)"
  location_id      = var.location
  type             = "FIRESTORE_NATIVE"
  concurrency_mode = "OPTIMISTIC"

  # Once created, location_id cannot be changed.
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [location_id, type]
  }
}
