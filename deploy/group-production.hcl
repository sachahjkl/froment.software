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
