param name string
param location string
param githubRepository string
param tags object

resource site 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    stagingEnvironmentPolicy: 'Disabled'
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

resource deploymentIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-deploy'
  location: location
  tags: tags
}

resource githubTrust 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deploymentIdentity
  name: 'github-production'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    audiences: [
      'api://AzureADTokenExchange'
    ]
    subject: 'repo:${githubRepository}:environment:azure-static-web-apps'
  }
}

// Contributor is scoped to this one Static Web App, not its group/subscription.
// The pipeline cannot grant roles or provision other applications.
var contributorRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
resource deploymentAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(site.id, deploymentIdentity.id, contributorRole)
  scope: site
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: contributorRole
  }
}

output staticSiteName string = site.name
output id string = site.id
output url string = 'https://${site.properties.defaultHostname}'
output deploymentClientId string = deploymentIdentity.properties.clientId
