import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RoleService } from '../../../services/role.service';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Manage Roles</h1>
        <button class="btn btn-primary" (click)="showForm.set(!showForm())">
          @if (showForm()) { Cancel } @else { New Role }
        </button>
      </div>

      @if (error()) {
        <div class="error-msg">{{ error() }}</div>
      }

      @if (showForm()) {
        <form class="inline-form" [formGroup]="form" (ngSubmit)="onSubmit()">
          <input type="text" formControlName="name" placeholder="Role name" />
          <input type="text" formControlName="description" placeholder="Description" />
          <button type="submit" class="btn btn-primary" [disabled]="form.invalid">
            @if (editingId()) { Update } @else { Create }
          </button>
          @if (editingId()) {
            <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel Edit</button>
          }
        </form>
      }

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Users</th>
              <th>Widgets</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (role of roleService.roles(); track role.id) {
              <tr>
                <td><strong>{{ role.name }}</strong></td>
                <td>{{ role.description }}</td>
                <td>{{ role.user_count }}</td>
                <td>{{ role.widget_count }}</td>
                <td class="actions">
                  <a [routerLink]="['/admin/roles', role.id, 'widgets']" class="btn btn-sm">Widgets</a>
                  @if (role.name !== 'admin') {
                    <button class="btn btn-sm" (click)="startEdit(role)">Edit</button>
                    <button class="btn btn-sm btn-danger" (click)="deleteRole(role.id, role.name)">Delete</button>
                  }
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
    .inline-form {
      display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .inline-form input {
      padding: 0.5rem 0.75rem; border: 1px solid var(--color-gray-300);
      border-radius: 0.375rem; font-size: 0.875rem; flex: 1; min-width: 150px;
    }
    .inline-form input:focus { outline: none; border-color: var(--color-primary); }
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
    .btn {
      padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem;
      font-weight: 600; border: none; cursor: pointer; text-decoration: none;
      display: inline-block;
    }
    .btn-primary { background: var(--color-primary); color: var(--color-white); }
    .btn-primary:hover { background: var(--color-primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { background: var(--color-gray-200); color: var(--color-gray-700); }
    .btn-sm { padding: 0.25rem 0.625rem; font-size: 0.75rem; }
    .btn-danger { background: var(--color-danger); color: var(--color-white); }
    .btn-danger:hover { opacity: 0.9; }
  `],
})
export class AdminRolesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly roleService = inject(RoleService);

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly error = signal('');

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.roleService.loadRoles();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.error.set('');
    try {
      if (this.editingId()) {
        await this.roleService.updateRole(this.editingId()!, {
          name: this.form.value.name,
          description: this.form.value.description,
        });
        this.cancelEdit();
      } else {
        await this.roleService.createRole(this.form.value.name!, this.form.value.description || '');
        this.form.reset();
      }
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Operation failed');
    }
  }

  startEdit(role: any): void {
    this.editingId.set(role.id);
    this.form.patchValue({ name: role.name, description: role.description });
    this.showForm.set(true);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset();
    this.showForm.set(false);
  }

  async deleteRole(id: string, name: string): Promise<void> {
    if (!confirm(`Delete role "${name}"?`)) return;
    this.error.set('');
    try {
      await this.roleService.deleteRole(id);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Delete failed');
    }
  }
}
