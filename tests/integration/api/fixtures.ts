/**
 * Fixture de integración HTTP + DynamoDB real en `aws/aws-emulator`.
 * Levanta una tabla aislada por archivo de prueba y la destruye al terminar.
 */

import { createApiApp } from '../../../backend/src/api/app';
import { createDynamoJobListStore } from '../../../backend/src/api/job-list-store';
import { createDynamoJobTransitionStore } from '../../../backend/src/api/job-transition';
import { createDynamoUserStore } from '../../../backend/src/db/user-store-adapter';
import { createJobStore } from '../../../backend/src/db/job-store';
import { loadConfig } from '../../../backend/src/config/index';
import { createTestTable, type TestTable } from '../db/table-fixture';
import {
  apiTestEnv,
  getJson,
  postJson,
  RecordingPublisher,
} from '../../unit/api/fixtures';

export interface ApiIntegrationEnv {
  table: TestTable;
  publisher: RecordingPublisher;
  app: ReturnType<typeof createApiApp>;
  register(email: string): Promise<{ token: string; userId: string }>;
  createJob(token: string): Promise<Record<string, unknown>>;
}

export async function createApiIntegrationEnv(tag: string): Promise<ApiIntegrationEnv> {
  const table = await createTestTable(tag);
  const { tableName, documentClient } = table;
  const publisher = new RecordingPublisher();
  const config = loadConfig(apiTestEnv({ DYNAMODB_TABLE_JOBS: tableName }));
  const users = createDynamoUserStore({ tableName, client: documentClient });
  const jobs = createJobStore({ tableName, client: documentClient });
  const lister = createDynamoJobListStore({ tableName, client: documentClient });
  const jobTransition = createDynamoJobTransitionStore({ tableName, client: documentClient });

  const app = createApiApp({ config, users, jobs, publisher, jobLister: lister, jobTransition });

  return {
    table,
    publisher,
    app,
    register: async (email: string) => {
      const response = await postJson(app, '/auth/register', {
        email,
        password: 'Segura1234',
      });
      if (response.status !== 201) {
        throw new Error(`No se pudo registrar el usuario de prueba (${response.status})`);
      }
      const body = (await response.json()) as { accessToken: string; user: { userId: string } };
      return { token: body.accessToken, userId: body.user.userId };
    },
    createJob: async (token: string) => {
      const response = await postJson(
        app,
        '/jobs',
        {
          preset: 'HIGH',
          files: [{ fileName: 'foto.jpg', contentType: 'image/jpeg', sizeBytes: 1024 }],
        },
        token,
      );
      if (response.status !== 201) {
        throw new Error(`No se pudo crear el lote de prueba (${response.status})`);
      }
      const body = (await response.json()) as { job: Record<string, unknown> };
      return body.job;
    },
  };
}

export { getJson, postJson };
