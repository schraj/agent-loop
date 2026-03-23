import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card">
        <h1 class="login-title">Admin Portal</h1>
        <p class="login-subtitle">Sign in to your account</p>

        @if (error()) {
          <div class="login-error">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="username">Username</label>
            <input id="username" type="text" formControlName="username" autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input id="password" type="password" formControlName="password" autocomplete="current-password" />
          </div>
          <button type="submit" class="login-btn" [disabled]="loading()">
            @if (loading()) { Signing in... } @else { Sign In }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
    }
    .login-card {
      background: var(--color-white);
      border-radius: 0.75rem;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
    }
    .login-title {
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      margin-bottom: 0.25rem;
    }
    .login-subtitle {
      text-align: center;
      color: var(--color-gray-500);
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .login-error {
      background: var(--color-danger-light);
      color: var(--color-danger);
      border: 1px solid var(--color-danger-border);
      padding: 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-group label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.375rem;
      color: var(--color-gray-700);
    }
    .form-group input {
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--color-gray-300);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      transition: border-color 0.15s;
    }
    .form-group input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .login-btn {
      width: 100%;
      padding: 0.625rem;
      background: var(--color-primary);
      color: var(--color-white);
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 0.5rem;
    }
    .login-btn:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    .login-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.login(this.form.value.username!, this.form.value.password!);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Login failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
