namespace "staging" {
  capabilities = ["list-jobs", "parse-job", "read-job", "submit-job"]
}

host_volume "froment-software-staging-data" {
  policy = "write"
}
