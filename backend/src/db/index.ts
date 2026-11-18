/**
 * Puerta pública de la capa de persistencia de MediaShrink Cloud (F01-T02).
 *
 * La tabla definitiva la aprovisiona Terraform en F04; las pruebas de
 * integración crean su propia tabla aislada y la destruyen en el teardown.
 */

export * from './client';
export * from './errors';
export * from './keys';
export * from './job-store';
export * from './types';
