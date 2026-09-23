      env {
        APP_ENV                 = "production"
        SITE_PHASE              = "live"
        NODE_ENV                = "production"
        PUBLIC_ORIGIN           = "https://backoffice.froment.software"
        DATABASE_PATH           = "/var/lib/froment-software/froment.sqlite"
        ENTERPRISE_NAME         = "Froment Software"
        ENTERPRISE_LOGO_URL     = "/brand/default.svg"
        TRUSTED_PROXY_ADDRESSES = "172.18.0.1"
      }

      template {
        data = <<EOH
{{ with nomadVar "nomad/jobs/backoffice" }}
{{ range $key, $value := . }}{{ $key }}={{ $value | toJSON }}
{{ end }}{{ end }}
EOH

        destination          = "secrets/runtime.env"
        env                  = true
        error_on_missing_key = true
        change_mode          = "restart"
      }
