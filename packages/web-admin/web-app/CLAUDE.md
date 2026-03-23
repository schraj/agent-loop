# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm start` — Start Angular dev server (localhost:4200)
- `npm run build` — Production build (output: dist/test-ang/)
- `npm run watch` — Dev build with file watching
- `npm test` — Run unit tests via Karma + Jasmine in Chrome
- Single test: modify `fdescribe`/`fit` in the spec file, then `npm test`

## Architecture

### Frontend (Angular 19)
- **Standalone components** throughout (no NgModules)
- Application bootstraps via `bootstrapApplication()` in `src/main.ts` with config from `src/app/app.config.ts`
- Zone change detection uses event coalescing for performance
- Modern Angular control flow syntax (`@for`, `@if`, `@switch`) instead of structural directives
- TypeScript strict mode with all Angular strict template/injection checks enabled
- Target: ES2022, module resolution: bundler
- Proxy config (`src/proxy.conf.json`) forwards `/api` requests to the API service during development

### Runtime Config
- `public/assets/config.json` — runtime config loaded at app startup via `APP_INITIALIZER`
- `ConfigService` fetches `config.json` and exposes `apiUrl`
- All services inject `ConfigService` and prepend `apiUrl` to HTTP calls
- Dev: `apiUrl` is `""` (relative URLs, works with proxy.conf.json)

### Authentication
- `AuthService` manages JWT tokens, user state, and login/logout
- Token stored in localStorage, restored on page reload
- `authInterceptor` (HttpInterceptorFn) attaches Bearer token to all requests, handles 401→logout
- `authGuard` and `adminGuard` (CanActivateFn) protect routes

### Signal-Based State Management
- All services use writable signals (`signal()`) for state, exposed as `.asReadonly()`
- Components use `inject()` for dependency injection (not constructor params) to allow property initializers
- Async CRUD methods use `firstValueFrom()` on HttpClient observables

### Routing
- Lazy-loaded routes via `loadComponent()` in `src/app/app.routes.ts`
- `withComponentInputBinding()` enabled
- Functional guards (`authGuard`, `adminGuard`) in `src/app/guards/`
- Admin routes nested under `/admin` with both authGuard and adminGuard

## Project Structure

```
src/app/
  models/          — User, Role, Widget, SystemStatus interfaces (auth.model.ts)
  services/        — AuthService, RoleService, UserService, WidgetService, StatusService, ConfigService
  guards/          — authGuard, adminGuard (CanActivateFn)
  interceptors/    — authInterceptor (HttpInterceptorFn)
  pages/
    login/         — Login form
    dashboard/     — Role-specific widget dashboard
    admin/
      admin-status/   — System status metrics
      admin-roles/    — Role CRUD
      admin-users/    — User CRUD with role assignment
      admin-widgets/  — Widget management per role
    not-found/     — 404 page
```

## Code Conventions

- 2-space indentation, single quotes for TypeScript (see `.editorconfig`)
- Component-scoped CSS; global styles in `src/styles.css`
- Test files colocated as `*.spec.ts` next to source files
- Tests use `TestBed` + `ComponentFixture` pattern with Jasmine
- Use `inject()` function for DI in components (not constructor injection) to support property initializers
- Reactive forms with `FormBuilder` and `Validators`

## NPM Registry

Uses a private Venmo Artifactory registry (configured in `.npmrc`). Run `npm install` with appropriate auth credentials.
