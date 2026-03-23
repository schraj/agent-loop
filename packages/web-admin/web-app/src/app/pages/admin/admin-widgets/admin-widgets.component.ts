import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { WidgetService } from '../../../services/widget.service';

@Component({
  selector: 'app-admin-widgets',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Widgets for Role</h1>
        <button class="btn btn-primary" (click)="toggleForm()">
          @if (showForm()) { Cancel } @else { New Widget }
        </button>
      </div>

      @if (error()) {
        <div class="error-msg">{{ error() }}</div>
      }

      @if (showForm()) {
        <form class="form-card" [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-row">
            <div class="form-group">
              <label>Title</label>
              <input type="text" formControlName="title" />
            </div>
            <div class="form-group">
              <label>Type</label>
              <select formControlName="widgetType">
                <option value="link">Link</option>
                <option value="action">Action</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 1rem;">
            <label>Description</label>
            <input type="text" formControlName="description" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Route (for link type)</label>
              <input type="text" formControlName="route" placeholder="/admin/users" />
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input type="number" formControlName="sortOrder" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid">
              @if (editingId()) { Update } @else { Create }
            </button>
            @if (editingId()) {
              <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel</button>
            }
          </div>
        </form>
      }

      <div class="widget-list">
        @for (widget of widgetService.roleWidgets(); track widget.id) {
          <div class="widget-item">
            <div class="widget-info">
              <strong>{{ widget.title }}</strong>
              <span class="widget-type-tag">{{ widget.widgetType }}</span>
              <p>{{ widget.description }}</p>
              @if (widget.config['route']) {
                <code>{{ widget.config['route'] }}</code>
              }
            </div>
            <div class="widget-actions">
              <button class="btn btn-sm" (click)="startEdit(widget)">Edit</button>
              <button class="btn btn-sm btn-danger" (click)="deleteWidget(widget.id)">Delete</button>
            </div>
          </div>
        } @empty {
          <p class="empty">No widgets configured for this role.</p>
        }
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
      border: 1px solid var(--color-gray-300); border-radius: 0.375rem; font-size: 0.875rem;
    }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--color-primary); }
    .form-actions { display: flex; gap: 0.5rem; }
    .widget-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .widget-item {
      background: var(--color-white); border-radius: 0.75rem; padding: 1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex; justify-content: space-between; align-items: center;
    }
    .widget-info p { font-size: 0.8125rem; color: var(--color-gray-500); margin-top: 0.25rem; }
    .widget-info code {
      font-size: 0.75rem; background: var(--color-gray-100); padding: 0.125rem 0.375rem;
      border-radius: 0.25rem; margin-top: 0.25rem; display: inline-block;
    }
    .widget-type-tag {
      font-size: 0.6875rem; text-transform: uppercase; font-weight: 600;
      background: var(--color-info-bg); color: var(--color-info-text);
      padding: 0.125rem 0.5rem; border-radius: 1rem; margin-left: 0.5rem;
    }
    .widget-actions { display: flex; gap: 0.375rem; flex-shrink: 0; }
    .empty { color: var(--color-gray-500); text-align: center; padding: 2rem; }
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
  `],
})
export class AdminWidgetsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly widgetService = inject(WidgetService);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly error = signal('');
  private roleId = '';

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    widgetType: ['link'],
    route: [''],
    sortOrder: [0],
  });

  ngOnInit(): void {
    this.roleId = this.activatedRoute.snapshot.paramMap.get('roleId')!;
    this.widgetService.loadWidgetsForRole(this.roleId);
  }

  toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) this.cancelEdit();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.error.set('');
    const v = this.form.value;
    const config: Record<string, unknown> = {};
    if (v.route) config['route'] = v.route;

    try {
      if (this.editingId()) {
        await this.widgetService.updateWidget(this.editingId()!, {
          title: v.title, description: v.description,
          widgetType: v.widgetType as any, config, sortOrder: v.sortOrder,
        }, this.roleId);
        this.cancelEdit();
      } else {
        await this.widgetService.createWidget(this.roleId, {
          title: v.title, description: v.description,
          widgetType: v.widgetType as any, config, sortOrder: v.sortOrder,
        });
        this.form.reset({ widgetType: 'link', sortOrder: 0 });
      }
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Operation failed');
    }
  }

  startEdit(widget: any): void {
    this.editingId.set(widget.id);
    this.form.patchValue({
      title: widget.title,
      description: widget.description,
      widgetType: widget.widgetType,
      route: (widget.config?.route as string) || '',
      sortOrder: widget.sortOrder,
    });
    this.showForm.set(true);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ widgetType: 'link', sortOrder: 0 });
    this.showForm.set(false);
  }

  async deleteWidget(id: string): Promise<void> {
    if (!confirm('Delete this widget?')) return;
    this.error.set('');
    try {
      await this.widgetService.deleteWidget(id, this.roleId);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Delete failed');
    }
  }
}
