import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import { RoleListItem } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly _roles = signal<RoleListItem[]>([]);
  readonly roles = this._roles.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly config: ConfigService,
  ) {}

  async loadRoles(): Promise<void> {
    const roles = await firstValueFrom(
      this.http.get<RoleListItem[]>(`${this.config.apiUrl}/api/roles`)
    );
    this._roles.set(roles);
  }

  async createRole(name: string, description: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.config.apiUrl}/api/roles`, { name, description })
    );
    await this.loadRoles();
  }

  async updateRole(id: string, data: { name?: string; description?: string }): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.config.apiUrl}/api/roles/${id}`, data)
    );
    await this.loadRoles();
  }

  async deleteRole(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.config.apiUrl}/api/roles/${id}`)
    );
    await this.loadRoles();
  }
}
