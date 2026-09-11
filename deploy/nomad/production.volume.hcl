name      = "froment-software-production-data"
namespace = "production"
type      = "host"
plugin_id = "mkdir"

capability {
  access_mode     = "single-node-writer"
  attachment_mode = "file-system"
}

parameters {
  mode = "0750"
  uid  = 1000
  gid  = 1000
}
