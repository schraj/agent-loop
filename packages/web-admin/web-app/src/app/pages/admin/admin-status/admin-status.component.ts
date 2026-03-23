import { Component, inject, OnInit, signal } from '@angular/core';
import { StatusService } from '../../../services/status.service';
import { SystemStatus } from '../../../models/auth.model';

@Component({
  selector: 'app-admin-status',
  standalone: true,
  template: `
    <div class="status-page">
      <div class="page-header">
        <h1>System Status</h1>
        <button class="btn btn-secondary" (click)="refresh()">Refresh</button>
      </div>

      @if (status(); as s) {
        <div class="status-grid">
          <div class="status-card">
            <span class="status-label">Uptime</span>
            <span class="status-value">{{ formatUptime(s.uptime) }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Users</span>
            <span class="status-value">{{ s.userCount }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Roles</span>
            <span class="status-value">{{ s.roleCount }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Widgets</span>
            <span class="status-value">{{ s.widgetCount }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Database Size</span>
            <span class="status-value">{{ formatBytes(s.dbSizeBytes) }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Node Version</span>
            <span class="status-value">{{ s.nodeVersion }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Platform</span>
            <span class="status-value">{{ s.platform }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Heap Used</span>
            <span class="status-value">{{ formatBytes(s.memoryUsage.heapUsed) }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">RSS Memory</span>
            <span class="status-value">{{ formatBytes(s.memoryUsage.rss) }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Last Checked</span>
            <span class="status-value">{{ formatTime(s.timestamp) }}</span>
          </div>
        </div>
      } @else {
        <p class="loading">Loading status...</p>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .page-header h1 { font-size: 1.5rem; font-weight: 700; }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }
    .status-card {
      background: var(--color-white);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .status-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-gray-400);
      margin-bottom: 0.375rem;
    }
    .status-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-gray-900);
    }
    .loading { color: var(--color-gray-500); text-align: center; padding: 3rem; }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    .btn-secondary {
      background: var(--color-gray-200);
      color: var(--color-gray-700);
    }
    .btn-secondary:hover { background: var(--color-gray-300); }
  `],
})
export class AdminStatusComponent implements OnInit {
  private readonly statusService = inject(StatusService);
  readonly status = this.statusService.status;

  ngOnInit(): void { this.refresh(); }

  refresh(): void { this.statusService.loadStatus(); }

  formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString();
  }
}
