/*
  modules/virtualMachines.bicep
  Simple VM for workloads that must run on IaaS.
  Note: For production, prefer Azure Monitor Agent + Data Collection Rules.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object
param subnetId string
param adminUsername string
@secure()
param adminPassword string
param logAnalyticsWorkspaceId string

@description('VM size.')
param vmSize string = 'Standard_B2s'

var vmName = '${baseName}-vm1'

resource nic 'Microsoft.Network/networkInterfaces@2024-01-01' = {
  name: '${vmName}-nic'
  location: location
  tags: tags
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: {
            id: subnetId
          }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {
  name: vmName
  location: location
  tags: union(tags, {
    compute: 'vm'
  })
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      adminPassword: empty(adminPassword) ? null : adminPassword
      linuxConfiguration: empty(adminPassword) ? {
        disablePasswordAuthentication: true
      } : {
        disablePasswordAuthentication: false
      }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
}

output vmName string = vm.name
output vmId string = vm.id
