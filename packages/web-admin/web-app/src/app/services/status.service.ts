import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import { SystemStatus } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class StatusService {
  private readonly _status = signal<SystemStatus | null>(null);
  readonly status = this._status.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly config: ConfigService,
  ) {}

  async loadStatus(): Promise<void> {
    const status = await firstValueFrom(
      this.http.get<SystemStatus>(`${this.config.apiUrl}/api/status`)
    );
    this._status.set(status);
  }
}
