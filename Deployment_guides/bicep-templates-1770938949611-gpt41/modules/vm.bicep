// VM
param environment string
param location string
param resourcePrefix string
param vnetId string

resource vm 'Microsoft.Compute/virtualMachines@2023-03-01' = {
  name: '${resourcePrefix}-vm-${environment}'
  location: location
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_D2_v3'
    }
    networkProfile: {
      networkInterfaces: []
    }
  }
  tags: {
    environment: environment
    service: 'vm'
  }
}

output vmId string = vm.id
