import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  apiUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig = { apiUrl: '' };

  constructor(private readonly http: HttpClient) {}

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  load(): Promise<void> {
    return firstValueFrom(this.http.get<AppConfig>('/assets/config.json'))
      .then((config) => { this.config = config; });
  }
}
