export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

export interface UserListItem {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  role: { id: string; name: string };
}

export interface Widget {
  id: string;
  roleId: string;
  title: string;
  description: string;
  widgetType: 'action' | 'info' | 'link';
  config: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string;
  user_count: number;
  widget_count: number;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface SystemStatus {
  uptime: number;
  dbSizeBytes: number;
  userCount: number;
  roleCount: number;
  widgetCount: number;
  nodeVersion: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  platform: string;
  timestamp: string;
}
