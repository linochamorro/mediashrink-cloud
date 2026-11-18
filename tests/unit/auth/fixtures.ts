/** Entorno de prueba para auth: solo marcadores locales (G-3), sin secretos reales. */
export function authTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_TEST_ACCESS_SECRET',
    JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_TEST_REFRESH_SECRET',
    JWT_ACCESS_TTL: '900',
    JWT_REFRESH_TTL: '604800',
    RATE_LIMIT_AUTH_MAX: '100',
    RATE_LIMIT_AUTH_WINDOW_MS: '60000',
    AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
    S3_BUCKET_RAW: 'mediashrink-raw-local',
    S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
    SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
    DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
    ...overrides,
  };
}

export const LOCAL_USER = {
  userId: 'user_local_001',
  email: 'demo@example.com',
  createdAt: '2026-11-17T00:00:00.000Z',
} as const;
