import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import { Widget } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class WidgetService {
  private readonly _myWidgets = signal<Widget[]>([]);
  private readonly _roleWidgets = signal<Widget[]>([]);

  readonly myWidgets = this._myWidgets.asReadonly();
  readonly roleWidgets = this._roleWidgets.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly config: ConfigService,
  ) {}

  async loadMyWidgets(): Promise<void> {
    const widgets = await firstValueFrom(
      this.http.get<Widget[]>(`${this.config.apiUrl}/api/my-widgets`)
    );
    this._myWidgets.set(widgets);
  }

  async loadWidgetsForRole(roleId: string): Promise<void> {
    const widgets = await firstValueFrom(
      this.http.get<Widget[]>(`${this.config.apiUrl}/api/roles/${roleId}/widgets`)
    );
    this._roleWidgets.set(widgets);
  }

  async createWidget(roleId: string, data: Partial<Widget>): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.config.apiUrl}/api/roles/${roleId}/widgets`, data)
    );
    await this.loadWidgetsForRole(roleId);
  }

  async updateWidget(id: string, data: Partial<Widget>, roleId: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.config.apiUrl}/api/widgets/${id}`, data)
    );
    await this.loadWidgetsForRole(roleId);
  }

  async deleteWidget(id: string, roleId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.config.apiUrl}/api/widgets/${id}`)
    );
    await this.loadWidgetsForRole(roleId);
  }
}
