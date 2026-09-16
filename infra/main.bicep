targetScope = 'subscription'

@description('Local azd environment name. Use a separate name for each marketplace deployment.')
@minLength(3)
@maxLength(24)
param environmentName string

@description('Azure region selected by the customer.')
param location string

@description('The adopting GitHub owner/repository, not the template publisher.')
@minLength(3)
param githubRepository string

@description('Explicit acknowledgement that this profile creates a public demo site.')
@allowed([
  'public-demo'
])
param publication string

var resourceToken = uniqueString(subscription().id, githubRepository, environmentName)
var tags = {
  'azd-env-name': environmentName
  'marketplace-repository': githubRepository
  'marketplace-publication': publication
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}-${resourceToken}'
  location: location
  tags: tags
}

module web 'static-site.bicep' = {
  name: 'marketplace-web'
  scope: resourceGroup
  params: {
    name: 'swa-${environmentName}-${resourceToken}'
    location: location
    githubRepository: githubRepository
    tags: tags
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_STATIC_WEB_APP_NAME string = web.outputs.staticSiteName
output AZURE_STATIC_WEB_APP_ID string = web.outputs.id
output AZURE_CLIENT_ID string = web.outputs.deploymentClientId
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_WEB_URL string = web.outputs.url
