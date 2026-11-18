/**
 * Generador reproducible de `frontend/src/api/types.generated.ts` (F01-T01).
 *
 * Lee el catálogo canónico y emite tipos planos (sin imports), de modo que el
 * frontend los consume sin añadir dependencias ni redefinir tipos de producto.
 * La salida es determinista: mismo catálogo ⇒ mismo archivo byte a byte.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATALOG,
  CATALOG_HASH,
  CONTRACTS_VERSION,
  type ContractSpec,
  type FieldMap,
  type FieldType,
} from './catalog';

const MODULE_PATH = fileURLToPath(import.meta.url);
export const GENERATED_PATH = resolve(
  dirname(MODULE_PATH),
  '../../../frontend/src/api/types.generated.ts',
);

function emitFields(fields: FieldMap, indent: string): string {
  const childIndent = `${indent}  `;
  const lines = Object.entries(fields).map(([name, spec]) => {
    const optional = spec.optional === true ? '?' : '';
    const nullable = spec.nullable === true ? ' | null' : '';
    return `${childIndent}${name}${optional}: ${emitType(spec.type, childIndent)}${nullable};`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}

function emitType(type: FieldType, indent: string): string {
  switch (type.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return type.values.map((value) => JSON.stringify(value)).join(' | ');
    case 'literal':
      return JSON.stringify(type.value);
    case 'array':
      return `Array<${emitType(type.items, indent)}>`;
    case 'object':
      return emitFields(type.fields, indent);
  }
}

function emitContract(name: string, spec: ContractSpec): string {
  const body = spec.root !== undefined ? emitType(spec.root, '') : emitFields(spec.fields ?? {}, '');
  return `/** v${spec.version} · ${spec.description} */\nexport type ${name} = ${body};`;
}

/** Texto completo y determinista del archivo de tipos generado. */
export function generateTypes(): string {
  const header = [
    '/**',
    ' * ARCHIVO GENERADO — NO EDITAR A MANO.',
    ' * Fuente canónica: <PROJECT_ROOT>/backend/src/contracts/catalog.ts',
    ` * Contratos v${CONTRACTS_VERSION} · hash SHA-256 del catálogo: ${CATALOG_HASH}`,
    ' * Regenerar: npm run generate:types --workspace=@mediashrink/backend',
    ' */',
  ].join('\n');

  const blocks = Object.entries(CATALOG).map(([name, spec]) => emitContract(name, spec));
  return `${header}\n\n${blocks.join('\n\n')}\n`;
}

/** Escribe el archivo generado y devuelve su ruta. */
export function writeGeneratedTypes(path: string = GENERATED_PATH): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, generateTypes(), 'utf8');
  return path;
}

const invokedDirectly =
  (process.argv[1] !== undefined && resolve(process.argv[1]) === MODULE_PATH) ||
  process.argv.includes('--write');

if (invokedDirectly) {
  const path = writeGeneratedTypes();
  process.stdout.write(`Tipos generados: ${path}\n`);
}
