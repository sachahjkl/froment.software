      env {
        APP_ENV                     = "staging"
        SITE_PHASE                  = "live"
        NODE_ENV                    = "production"
        PUBLIC_ORIGIN               = "https://staging.froment.software"
        DATABASE_PATH               = "/var/lib/froment-software/froment.sqlite"
        TRUSTED_PROXY_ADDRESSES     = "172.18.0.1"
        OTEL_EXPORTER_OTLP_ENDPOINT = "http://otel-collector:4318"
        OTEL_LOGS_EXPORTER          = "otlp"
        OTEL_TRACES_EXPORTER        = "otlp"
      }

      template {
        data = <<EOH
{{ with nomadVar "nomad/jobs/froment-software" }}
{{ range $key, $value := . }}{{ $key }}={{ $value | toJSON }}
{{ end }}{{ end }}
EOH

        destination          = "secrets/runtime.env"
        env                  = true
        error_on_missing_key = true
        change_mode          = "restart"
      }
