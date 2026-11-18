/**
 * Almacén de usuarios (F01-T03).
 *
 * La interfaz permite sustituir la implementación en memoria por un adaptador
 * DynamoDB en F04 sin cambiar la lógica de autenticación. El correo se guarda
 * normalizado; el `userId` es opaco y es la clave de aislamiento (PR-07).
 */

export interface UserRecord {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface NewUser extends UserRecord {}

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('El correo ya está registrado');
    this.name = 'EmailAlreadyExistsError';
  }
}

export interface UserStore {
  create(user: NewUser): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
}

import { normalizeEmail } from './identity';

export class InMemoryUserStore implements UserStore {
  private readonly byEmail = new Map<string, UserRecord>();
  private readonly byId = new Map<string, UserRecord>();

  async create(user: NewUser): Promise<UserRecord> {
    const email = normalizeEmail(user.email);
    // Comprobación y escritura sin `await` entre ellas: el registro es atómico.
    if (this.byEmail.has(email)) throw new EmailAlreadyExistsError();

    const stored: UserRecord = { ...user, email };
    this.byEmail.set(email, stored);
    this.byId.set(stored.userId, stored);
    return { ...stored };
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const found = this.byEmail.get(normalizeEmail(email));
    return found === undefined ? null : { ...found };
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const found = this.byId.get(userId);
    return found === undefined ? null : { ...found };
  }
}
