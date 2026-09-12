[[ if eq (var "environment" .) "staging" ]]
job "froment-software" {
  namespace   = [[ var "environment" . | quote ]]
  datacenters = ["homelab"]
  type        = "service"

  meta {
    image = [[ var "image" . | quote ]]
  }

  group "web" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "10s"
      healthy_deadline  = "2m"
      progress_deadline = "5m"
      auto_revert       = true
    }

    restart {
      attempts = 3
      interval = "10m"
      delay    = "15s"
      mode     = "fail"
    }

    reschedule {
      attempts       = 3
      interval       = "1h"
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "5m"
      unlimited      = false
    }

    network {
      mode = "host"

      port "http" {
        to = 3000
      }
    }

    volume "data" {
      type            = "host"
      source          = "froment-software-staging-data"
      attachment_mode = "file-system"
      access_mode     = "single-node-writer"
      sticky          = true
    }

    task "prepare" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = [[ var "image" . | quote ]]
        command      = "froment-software-prepare"
        network_mode = "services"
      }

      env {
        DATABASE_PATH    = "/var/lib/froment-software/froment.sqlite"
        BACKUP_DIRECTORY = "/var/lib/froment-software/backups"
      }

      volume_mount {
        volume      = "data"
        destination = "/var/lib/froment-software"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }

    task "web" {
      driver = "docker"

      config {
        image        = [[ var "image" . | quote ]]
        command      = "froment-software"
        network_mode = "services"
        ports        = ["http"]
      }

      env {
        APP_ENV                     = "staging"
        SITE_PHASE                  = "live"
        NODE_ENV                    = "production"
        PUBLIC_ORIGIN               = "https://[[ var "domain" . ]]"
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

      volume_mount {
        volume      = "data"
        destination = "/var/lib/froment-software"
      }

      service {
        name     = "froment-software-staging"
        provider = "nomad"
        port     = "http"
        tags = [
          "traefik.enable=true",
          "traefik.http.routers.froment-software-staging.entrypoints=websecure",
          "traefik.http.routers.froment-software-staging.middlewares=froment-software-staging-noindex",
          "traefik.http.routers.froment-software-staging.rule=Host(`[[ var "domain" . ]]`)",
          "traefik.http.routers.froment-software-staging.tls.certresolver=letsencrypt",
          "traefik.http.routers.froment-software-staging.tls.domains[0].main=[[ var "domain" . ]]",
          "traefik.http.middlewares.froment-software-staging-noindex.headers.customresponseheaders.X-Robots-Tag=noindex, nofollow",
        ]

        check {
          name     = "HTTP health"
          type     = "http"
          path     = "/api/health"
          interval = "10s"
          timeout  = "2s"

          check_restart {
            limit           = 3
            grace           = "30s"
            ignore_warnings = false
          }
        }
      }

      resources {
        cpu    = 1000
        memory = 1024
      }

      logs {
        max_files     = 5
        max_file_size = 20
      }

      kill_timeout = "30s"
    }
  }
}
[[ else ]]
job "froment-software" {
  namespace   = [[ var "environment" . | quote ]]
  datacenters = ["homelab"]
  type        = "service"

  meta {
    image = [[ var "image" . | quote ]]
  }

  group "web" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "checks"
      min_healthy_time  = "10s"
      healthy_deadline  = "2m"
      progress_deadline = "5m"
      auto_revert       = true
    }

    restart {
      attempts = 3
      interval = "10m"
      delay    = "15s"
      mode     = "fail"
    }

    reschedule {
      attempts       = 3
      interval       = "1h"
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "5m"
      unlimited      = false
    }

    network {
      mode = "host"

      port "http" {
        to = 3000
      }
    }

    volume "data" {
      type            = "host"
      source          = "froment-software-production-data"
      attachment_mode = "file-system"
      access_mode     = "single-node-writer"
      sticky          = true
    }

    task "prepare" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = [[ var "image" . | quote ]]
        command      = "froment-software-prepare"
        network_mode = "services"
      }

      env {
        DATABASE_PATH             = "/var/lib/froment-software/froment.sqlite"
        BACKUP_DIRECTORY          = "/var/lib/froment-software/backups"
        REQUIRE_EXISTING_DATABASE = "true"
      }

      volume_mount {
        volume      = "data"
        destination = "/var/lib/froment-software"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }

    task "web" {
      driver = "docker"

      config {
        image        = [[ var "image" . | quote ]]
        command      = "froment-software"
        network_mode = "services"
        ports        = ["http"]
      }

      env {
        APP_ENV                     = "production"
        SITE_PHASE                  = "construction"
        NODE_ENV                    = "production"
        PUBLIC_ORIGIN               = "https://[[ var "domain" . ]]"
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

      volume_mount {
        volume      = "data"
        destination = "/var/lib/froment-software"
      }

      service {
        name     = "froment-software-production"
        provider = "nomad"
        port     = "http"
        tags = [
          "traefik.enable=true",
          "traefik.http.routers.froment-software-production.entrypoints=websecure",
          "traefik.http.routers.froment-software-production.rule=Host(`[[ var "domain" . ]]`)",
          "traefik.http.routers.froment-software-production.tls.certresolver=letsencrypt",
          "traefik.http.routers.froment-software-production.tls.domains[0].main=[[ var "domain" . ]]",
        ]

        check {
          name     = "HTTP health"
          type     = "http"
          path     = "/api/health"
          interval = "10s"
          timeout  = "2s"

          check_restart {
            limit           = 3
            grace           = "30s"
            ignore_warnings = false
          }
        }
      }

      resources {
        cpu    = 1000
        memory = 1024
      }

      logs {
        max_files     = 5
        max_file_size = 20
      }

      kill_timeout = "30s"
    }
  }
}
[[ end ]]
