# Build, Test & Development Commands

## Development Commands

- `yarn dev` - Start development server for web app
- `yarn dev:all` - Start web, website, and console apps
- `yarn dev:api` - Start web app with API proxy and API
- `yarn dev:console` - Start web app with console
- `yarn dx` - Start development with database setup

## Build Commands

- `yarn build` - Build all packages and apps
- `yarn build:ai` - Build AI package specifically
- `yarn clean` - Remove build artifacts (node_modules, .next, .turbo, dist)

## Lint & Type Check

- `yarn lint` - Run Biome across the codebase
- `yarn lint:fix` - Run Biome and apply safe fixes
- `yarn lint:report` - Generate Biome lint report
- `yarn type-check` - Run TypeScript type checking
- `yarn format` - Format code with Biome

## Dependency Analysis

Dependency-cruiser is configured in `.dependency-cruiser.mjs`. Run commands from
the repository root after `yarn install`, using a Node version supported by the
installed dependency-cruiser (18.7 requires Node ^20.12, ^22, or >=24).

- `yarn deps:check` - Analyze the web app and packages; report cycles, unresolved imports, and deprecated Node modules.
- `yarn deps:json` - Save the full graph to `dependency-report.json`.
- `yarn deps:graph` - Save a package-level Graphviz graph to `dependency-report.dot`.
- `yarn deps:api` - Analyze API v2 with its own TypeScript aliases.

Rules initially have warning severity: findings do not fail CI. These commands
are opt-in and are not part of the build or lint pipeline. Review findings before
promoting any rule to an error or introducing a known-violations baseline.

The default scope uses `apps/web/tsconfig.json`; dependency-cruiser uses one
TypeScript configuration per invocation. API v2 and other apps with different
aliases need separate runs with `--ts-config` (use an absolute path on Windows).
API v2 uses `.dependency-cruiser.api.mjs` to resolve its configuration path portably.
Cross-workspace imports resolve
through the installed Yarn workspace links. Missing generated Prisma files can
appear as unresolved imports; the analysis does not generate them.

Type-only imports are included. External dependencies are not traversed.
Build output, public assets, and generated files matched by the configuration
are excluded. Tests remain included. Report files and optional cache are ignored
by Git.

For a focused investigation (dependencies are still followed):

```bash
yarn depcruise packages/lib --output-type err
yarn depcruise apps/web packages --focus "^packages/features/bookings/" --output-type mermaid --output-to dependency-report.bookings.mmd
yarn depcruise apps/api/v2/src --config .dependency-cruiser.api.mjs --output-type json --output-to dependency-report.api.json
```

Optionally, with Graphviz installed, render the architecture graph:

```bash
dot -Tsvg dependency-report.dot -o dependency-report.svg
```

See the [dependency-cruiser CLI documentation](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md).

## Testing Commands

### Unit Tests

- `yarn test` - Run unit tests (vitest)
- `yarn test <filename>` - Run tests for specific file
- `yarn test <filename> -t "<testName>"` - Run specific test by name for specific file
- `yarn tdd` - Run tests in watch mode
- `yarn test:ui` - Run tests with UI interface

### Integration Tests

- `VITEST_MODE=integration yarn test` - Run integration tests (vitest)
- `VITEST_MODE=integration yarn test <filename>` - Run integration tests for specific file
- `VITEST_MODE=integration yarn test <filename> -t "<testName>"` - Run specific integration test by name for specific file


### End-to-End Tests

- `yarn e2e` - Run end-to-end tests (Playwright)
- `yarn e2e <filename>` - Run E2E tests for specific file
- `yarn e2e <filename> --grep "<testName>"` - Run specific E2E test by name
- `yarn e2e:app-store` - Run app store E2E tests
- `yarn e2e:embed` - Run embed E2E tests
- `yarn test-e2e` - Run database seed + E2E tests

## Database Commands

- `yarn prisma` - Run Prisma CLI commands
- `yarn db-seed` - Seed database with test data
- `yarn db-deploy` - Deploy database migrations
- `yarn db-studio` - Open Prisma Studio
- `psql "postgresql://postgres:@localhost:5432/calendso"` - Connect to local PostgreSQL database

## App Store Commands

- `yarn create-app` - Create new app store integration
- `yarn edit-app` - Edit existing app
- `yarn delete-app` - Delete app
- `yarn app-store:build` - Build app store
- `yarn app-store:watch` - Watch app store for changes

## Useful Development Patterns

### Running Single Tests

```bash
# Unit test specific file
yarn vitest run packages/lib/some-file.test.ts

# Integration test specific file
VITEST_MODE=integration yarn test routing-form-response-denormalized.integration-test.ts

# E2E test specific file
yarn e2e tests/booking-flow.e2e.ts

# Run specific test by name
yarn e2e tests/booking-flow.e2e.ts --grep "should create booking"
```

### Environment Setup

- Copy `.env.example` to `.env` and configure
- Copy `.env.appStore.example` to `.env.appStore` for app store development
- Run `yarn dx` for initial development setup with database
