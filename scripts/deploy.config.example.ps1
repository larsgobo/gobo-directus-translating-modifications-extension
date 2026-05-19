# Copy to deploy.config.ps1 and fill in your VPS details (same as custom-directus-gobo secrets).

$DeploySshHost = "your-vps-ip"
$DeploySshUser = "root"
$DeploySshPort = 22
# $DeploySshKeyPath = "$env:USERPROFILE\.ssh\id_ed25519"

# Docker Swarm volume for /directus/extensions (from: docker service inspect gobo-dk-gtm_directus)
$DeployDirectusVolumeName = "gobo-dk-gtm_directus_extensions"

# Staging folder on VPS host before copying into the volume
$DeployExtTmpPath = "/root/ext-tmp"
