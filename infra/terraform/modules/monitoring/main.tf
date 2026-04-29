variable "project_id" { type = string }
variable "service_name" { type = string }
variable "notification_emails" {
  type    = list(string)
  default = []
}

# ─────────── Log-based metrics ───────────

# Hint pipeline latency: extracted from the `hint pipeline timing` log line in
# apps/api/src/routes/ws.meeting.ts (handleFinalLine).
resource "google_logging_metric" "hint_latency_ms" {
  project = var.project_id
  name    = "scoach/hint_latency_ms"
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.service_name}\" AND jsonPayload.msg=\"hint pipeline timing\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
    display_name = "scoach hint pipeline latency"
  }

  value_extractor = "EXTRACT(jsonPayload.hintLatencyMs)"
  bucket_options {
    exponential_buckets {
      num_finite_buckets = 32
      growth_factor      = 1.4
      scale              = 100
    }
  }
}

resource "google_logging_metric" "hint_llm_ms" {
  project = var.project_id
  name    = "scoach/hint_llm_ms"
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.service_name}\" AND jsonPayload.msg=\"hint pipeline timing\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
    display_name = "scoach Vertex Gemini hint LLM latency"
  }

  value_extractor = "EXTRACT(jsonPayload.hintLlmMs)"
  bucket_options {
    exponential_buckets {
      num_finite_buckets = 32
      growth_factor      = 1.4
      scale              = 100
    }
  }
}

resource "google_logging_metric" "stt_errors" {
  project = var.project_id
  name    = "scoach/stt_errors"
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.service_name}\" AND jsonPayload.msg=\"STT error\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "scoach STT error count"
  }
}

resource "google_logging_metric" "ws_connections_opened" {
  project = var.project_id
  name    = "scoach/ws_connections_opened"
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.service_name}\" AND jsonPayload.msg=~\"replay scheduled|real-time pipeline started\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "scoach WS connections opened"
  }
}

# ─────────── Notification channels ───────────

resource "google_monitoring_notification_channel" "email" {
  for_each     = toset(var.notification_emails)
  project      = var.project_id
  display_name = "Email — ${each.key}"
  type         = "email"
  labels       = { email_address = each.key }
}

# ─────────── Alert policies ───────────

resource "google_monitoring_alert_policy" "hint_latency_p95" {
  project      = var.project_id
  display_name = "scoach: hint latency p95 > 3.5s for 10m"
  combiner     = "OR"

  conditions {
    display_name = "p95 hint latency"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.hint_latency_ms.name}\" AND resource.type=\"cloud_run_revision\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 3500
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }

  notification_channels = [for c in google_monitoring_notification_channel.email : c.id]
  alert_strategy { auto_close = "1800s" }
}

resource "google_monitoring_alert_policy" "stt_errors_burst" {
  project      = var.project_id
  display_name = "scoach: STT errors > 10/5m"
  combiner     = "OR"

  conditions {
    display_name = "STT error rate"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.stt_errors.name}\" AND resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [for c in google_monitoring_notification_channel.email : c.id]
  alert_strategy { auto_close = "1800s" }
}

# ─────────── Dashboard ───────────

resource "google_monitoring_dashboard" "live_pipeline" {
  project        = var.project_id
  dashboard_json = jsonencode({
    displayName = "SuperCloud Sales Coach — Live pipeline"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 6, height = 4
          widget = {
            title = "Hint pipeline p50 / p95 / p99 (ms)"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.hint_latency_ms.name}\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_PERCENTILE_95"
                        crossSeriesReducer = "REDUCE_MAX"
                      }
                    }
                  }
                  plotType = "LINE"
                }
              ]
              yAxis = { label = "ms", scale = "LINEAR" }
            }
          }
        },
        {
          xPos = 6, width = 6, height = 4
          widget = {
            title = "Vertex Gemini LLM time (ms)"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.hint_llm_ms.name}\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_PERCENTILE_95"
                        crossSeriesReducer = "REDUCE_MAX"
                      }
                    }
                  }
                  plotType = "LINE"
                }
              ]
            }
          }
        },
        {
          yPos = 4, width = 6, height = 4
          widget = {
            title = "STT errors / minute"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.stt_errors.name}\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                      }
                    }
                  }
                  plotType = "STACKED_BAR"
                }
              ]
            }
          }
        },
        {
          xPos = 6, yPos = 4, width = 6, height = 4
          widget = {
            title = "WebSocket connections opened / minute"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ws_connections_opened.name}\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                      }
                    }
                  }
                  plotType = "STACKED_AREA"
                }
              ]
            }
          }
        }
      ]
    }
  })
}
