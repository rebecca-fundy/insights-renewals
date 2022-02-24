import fs from 'fs';
import {ApplicationConfig, V4InsightsApplication} from './application';
// const dotenv = require('dotenv').config();
export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new V4InsightsApplication(options);
  await app.boot();
  await app.start();
  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  console.log(`Try ${url}/ping`);
  return app;
}

if (require.main === module) {
  // Run the application\
  const config = {
    rest: {
      port: +(process.env.INSIGHTS_API_PORT ?? 3141),
      host: process.env.INSIGHTS_API_HOST,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },

      // Enable HTTPS
      protocol: 'https',
      key: fs.readFileSync('/etc/apache2/ssl/STAR_fundycentral.key'),
      cert: fs.readFileSync('/etc/apache2/ssl/STAR_fundycentral_com.crt'),
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
