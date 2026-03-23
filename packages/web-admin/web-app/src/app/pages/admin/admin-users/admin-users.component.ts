import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { RoleService } from '../../../services/role.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Manage Users</h1>
        <button class="btn btn-primary" (click)="toggleForm()">
          @if (showForm()) { Cancel } @else { New User }
        </button>
      </div>

      @if (error()) {
        <div class="error-msg">{{ error() }}</div>
      }

      @if (showForm()) {
        <form class="form-card" [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-row">
            <div class="form-group">
              <label>Username</label>
              <input type="text" formControlName="username" />
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" formControlName="displayName" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Password @if (editingId()) { (leave blank to keep) }</label>
              <input type="password" formControlName="password" />
            </div>
            <div class="form-group">
              <label>Role</label>
              <select formControlName="roleId">
                @for (role of roleService.roles(); track role.id) {
                  <option [value]="role.id">{{ role.name }}</option>
                }
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid">
              @if (editingId()) { Update } @else { Create }
            </button>
            @if (editingId()) {
              <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel Edit</button>
            }
          </div>
        </form>
      }

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Display Name</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of userService.users(); track user.id) {
              <tr>
                <td><strong>{{ user.username }}</strong></td>
                <td>{{ user.displayName }}</td>
                <td><span class="role-tag">{{ user.role.name }}</span></td>
                <td>{{ formatDate(user.createdAt) }}</td>
                <td class="actions">
                  <button class="btn btn-sm" (click)="startEdit(user)">Edit</button>
                  <button class="btn btn-sm btn-danger" (click)="deleteUser(user.id, user.username)">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h1 { font-size: 1.5rem; font-weight: 700; }
    .error-msg {
      background: var(--color-danger-light); color: var(--color-danger);
      border: 1px solid var(--color-danger-border); padding: 0.75rem;
      border-radius: 0.375rem; font-size: 0.875rem; margin-bottom: 1rem;
    }
    .form-card {
      background: var(--color-white); padding: 1.5rem; border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem;
    }
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .form-group { flex: 1; }
    .form-group label {
      display: block; font-size: 0.8125rem; font-weight: 500;
      margin-bottom: 0.375rem; color: var(--color-gray-700);
    }
    .form-group input, .form-group select {
      width: 100%; padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-gray-300); border-radius: 0.375rem;
      font-size: 0.875rem;
    }
    .form-group input:focus, .form-group select:focus {
      outline: none; border-color: var(--color-primary);
    }
    .form-actions { display: flex; gap: 0.5rem; }
    .table-wrapper { overflow-x: auto; }
    .data-table {
      width: 100%; border-collapse: collapse; background: var(--color-white);
      border-radius: 0.75rem; overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .data-table th {
      text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--color-gray-500); background: var(--color-gray-50);
      border-bottom: 1px solid var(--color-gray-200);
    }
    .data-table td {
      padding: 0.75rem 1rem; font-size: 0.875rem;
      border-bottom: 1px solid var(--color-gray-100);
    }
    .actions { display: flex; gap: 0.375rem; }
    .role-tag {
      background: var(--color-info-bg); color: var(--color-info-text);
      padding: 0.125rem 0.5rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;
    }
    .btn {
      padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem;
      font-weight: 600; border: none; cursor: pointer;
    }
    .btn-primary { background: var(--color-primary); color: var(--color-white); }
    .btn-primary:hover { background: var(--color-primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { background: var(--color-gray-200); color: var(--color-gray-700); }
    .btn-sm { padding: 0.25rem 0.625rem; font-size: 0.75rem; }
    .btn-danger { background: var(--color-danger); color: var(--color-white); }
    .btn-danger:hover { opacity: 0.9; }
    @media (max-width: 640px) {
      .form-row { flex-direction: column; }
    }
  `],
})
export class AdminUsersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly userService = inject(UserService);
  readonly roleService = inject(RoleService);

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly error = signal('');

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    displayName: ['', Validators.required],
    password: ['', Validators.required],
    roleId: ['', Validators.required],
  });

  ngOnInit(): void {
    this.userService.loadUsers();
    this.roleService.loadRoles();
  }

  toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) this.cancelEdit();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.error.set('');
    const v = this.form.value;
    try {
      if (this.editingId()) {
        const data: any = { username: v.username, displayName: v.displayName, roleId: v.roleId };
        if (v.password) data.password = v.password;
        await this.userService.updateUser(this.editingId()!, data);
        this.cancelEdit();
      } else {
        await this.userService.createUser({
          username: v.username!, password: v.password!,
          displayName: v.displayName!, roleId: v.roleId!,
        });
        this.form.reset();
      }
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Operation failed');
    }
  }

  startEdit(user: any): void {
    this.editingId.set(user.id);
    this.form.patchValue({
      username: user.username,
      displayName: user.displayName,
      roleId: user.role.id,
    });
    // Make password optional for edits
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.showForm.set(true);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset();
    // Restore password required validator
    this.form.controls.password.setValidators(Validators.required);
    this.form.controls.password.updateValueAndValidity();
    this.showForm.set(false);
  }

  async deleteUser(id: string, username: string): Promise<void> {
    if (!confirm(`Delete user "${username}"?`)) return;
    this.error.set('');
    try {
      await this.userService.deleteUser(id);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Delete failed');
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
}
