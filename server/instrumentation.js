const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
  process.env.OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'aadb-token-server';
  const attributes = [
    process.env.OTEL_RESOURCE_ATTRIBUTES || '',
    `service.version=${process.env.APP_VERSION || 'development'}`,
    `deployment.environment.name=${process.env.NODE_ENV || 'production'}`,
  ].filter(Boolean);
  process.env.OTEL_RESOURCE_ATTRIBUTES = attributes.join(',');

  try {
    const { useAzureMonitor } = require('@azure/monitor-opentelemetry');
    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString },
      instrumentationOptions: {
        http: {
          disableIncomingRequestInstrumentation: true,
        },
        console: { enabled: false },
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'aadb-token-server',
      event: 'telemetry_initialization_failed',
      errorType: error?.name || 'Error',
    }));
  }
}