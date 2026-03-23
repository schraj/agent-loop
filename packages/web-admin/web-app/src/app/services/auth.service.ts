import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import { User, LoginResponse } from '../models/auth.model';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._currentUser()?.role?.name === 'admin');

  constructor(
    private readonly http: HttpClient,
    private readonly config: ConfigService,
    private readonly router: Router,
  ) {
    // Restore session from localStorage
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      try {
        this._token.set(token);
        this._currentUser.set(JSON.parse(userJson));
      } catch {
        this.clearSession();
      }
    }
  }

  get token(): string | null {
    return this._token();
  }

  async login(username: string, password: string): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.config.apiUrl}/api/auth/login`, { username, password })
    );
    this._token.set(res.token);
    this._currentUser.set(res.user);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    return res.user;
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  async refreshProfile(): Promise<void> {
    try {
      const user = await firstValueFrom(
        this.http.get<User>(`${this.config.apiUrl}/api/auth/me`)
      );
      this._currentUser.set(user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      this.logout();
    }
  }

  private clearSession(): void {
    this._token.set(null);
    this._currentUser.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
