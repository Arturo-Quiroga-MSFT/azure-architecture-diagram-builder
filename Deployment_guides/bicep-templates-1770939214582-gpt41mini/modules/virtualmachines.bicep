// virtualmachines.bicep

param location string
param environment string
param tags object
param vpnGatewayId string

resource vnet 'Microsoft.Network/virtualNetworks@2021-05-01' = {
  name: 'vm-vnet-${environment}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [ '10.2.0.0/16' ]
    }
    subnets: [
      {
        name: 'default'
        properties: {
          addressPrefix: '10.2.0.0/24'
        }
      }
    ]
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2021-05-01' = {
  name: 'imaging-vm-nic-${environment}'
  location: location
  tags: tags
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: {
            id: '${vnet.id}/subnets/default'
          }
          privateIPAllocationMethod: 'Dynamic'
        }
      }
    ]
  }
}

resource virtualMachine 'Microsoft.Compute/virtualMachines@2021-07-01' = {
  name: 'imaging-vm-${environment}'
  location: location
  tags: tags
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_DS1_v2'
    }
    storageProfile: {
      imageReference: {
        publisher: 'MicrosoftWindowsServer'
        offer: 'WindowsServer'
        sku: '2019-Datacenter'
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
      }
    }
    osProfile: {
      computerName: 'imagingvm'
      adminUsername: 'azureuser'
      adminPassword: 'P@ssword1234!' // Replace with secure method
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
  dependsOn: [nic]
}

output virtualMachineId string = virtualMachine.id
output virtualMachinePrivateIp string = nic.properties.ipConfigurations[0].properties.privateIPAddress