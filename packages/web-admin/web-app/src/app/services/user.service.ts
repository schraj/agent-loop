import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import { UserListItem } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly _users = signal<UserListItem[]>([]);
  readonly users = this._users.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly config: ConfigService,
  ) {}

  async loadUsers(): Promise<void> {
    const users = await firstValueFrom(
      this.http.get<UserListItem[]>(`${this.config.apiUrl}/api/users`)
    );
    this._users.set(users);
  }

  async createUser(data: { username: string; password: string; displayName: string; roleId: string }): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.config.apiUrl}/api/users`, data)
    );
    await this.loadUsers();
  }

  async updateUser(id: string, data: { username?: string; password?: string; displayName?: string; roleId?: string }): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.config.apiUrl}/api/users/${id}`, data)
    );
    await this.loadUsers();
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.config.apiUrl}/api/users/${id}`)
    );
    await this.loadUsers();
  }
}
