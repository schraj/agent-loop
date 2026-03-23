import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WidgetService } from '../../services/widget.service';
import { Widget } from '../../models/auth.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <h1>Welcome, {{ auth.currentUser()?.displayName }}</h1>
        <p class="role-badge">{{ auth.currentUser()?.role?.name }}</p>
      </div>

      @if (loading()) {
        <p class="loading">Loading widgets...</p>
      } @else if (widgets().length === 0) {
        <div class="empty-state">
          <p>No tasks assigned to your role yet.</p>
        </div>
      } @else {
        <div class="widget-grid">
          @for (widget of widgets(); track widget.id) {
            <div class="widget-card" (click)="onWidgetClick(widget)" [class.clickable]="widget.widgetType === 'link'">
              <div class="widget-icon">
                @switch (widget.widgetType) {
                  @case ('link') { &#128279; }
                  @case ('action') { &#9889; }
                  @case ('info') { &#8505;&#65039; }
                }
              </div>
              <h3 class="widget-title">{{ widget.title }}</h3>
              <p class="widget-desc">{{ widget.description }}</p>
              <span class="widget-type">{{ widget.widgetType }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard { padding: 1rem 0; }
    .dashboard-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .dashboard-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
    }
    .role-badge {
      background: var(--color-primary);
      color: var(--color-white);
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .loading {
      color: var(--color-gray-500);
      text-align: center;
      padding: 3rem;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      background: var(--color-white);
      border-radius: 0.75rem;
      color: var(--color-gray-500);
    }
    .widget-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .widget-card {
      background: var(--color-white);
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: box-shadow 0.15s, transform 0.15s;
    }
    .widget-card.clickable {
      cursor: pointer;
    }
    .widget-card.clickable:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateY(-2px);
    }
    .widget-icon {
      font-size: 1.5rem;
      margin-bottom: 0.75rem;
    }
    .widget-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
    }
    .widget-desc {
      font-size: 0.8125rem;
      color: var(--color-gray-500);
      margin-bottom: 0.75rem;
    }
    .widget-type {
      font-size: 0.6875rem;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--color-gray-400);
      letter-spacing: 0.05em;
    }
  `],
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly widgetService = inject(WidgetService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly widgets = this.widgetService.myWidgets;

  async ngOnInit(): Promise<void> {
    try {
      await this.widgetService.loadMyWidgets();
    } finally {
      this.loading.set(false);
    }
  }

  onWidgetClick(widget: Widget): void {
    if (widget.widgetType === 'link' && widget.config['route']) {
      this.router.navigate([widget.config['route'] as string]);
    }
  }
}
