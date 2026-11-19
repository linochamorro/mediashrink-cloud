/** Entorno local del seed: marcadores G-3, sin secretos reales ni rutas absolutas. */

export function seedTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_SEED_ACCESS_SECRET',
    JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_SEED_REFRESH_SECRET',
    AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
    AWS_REGION: 'us-east-1',
    AWS_SHARED_CREDENTIALS_FILE: './.local/aws-emulator/emulator_credentials',
    AWS_CONFIG_FILE: './.local/aws-emulator/config',
    AWS_EC2_METADATA_DISABLED: 'true',
    USE_SSL: 'true',
    CA_BUNDLE_PATH: './.local/aws-emulator/ca.pem',
    S3_BUCKET_RAW: 'mediashrink-raw-local',
    S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
    SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
    DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
    ...overrides,
  };
}
