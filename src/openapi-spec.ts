import {ApplicationConfig} from '@loopback/core';
import {V4InsightsApplication} from './application';

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const config: ApplicationConfig = {
    rest: {
      port: +(process.env.INSIGHTS_API_PORT ?? 3141),
      host: process.env.INSIGHTS_API_HOST ?? 'localhost',
    },
  };
  const outFile = process.argv[2] ?? '';
  const app = new V4InsightsApplication(config);
  await app.boot();
  await app.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch(err => {
  console.error('Fail to export OpenAPI spec from the application.', err);
  process.exit(1);
});
