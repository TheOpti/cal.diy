import { fileURLToPath } from "node:url";

/** @type {import("dependency-cruiser").IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "warn",
      comment: "Cycles make changes harder to isolate and can cause initialization-order bugs.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved",
      severity: "warn",
      comment: "Check missing generated files, workspace installation, and the selected tsconfig.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-deprecated-core",
      severity: "warn",
      from: {},
      to: { dependencyTypes: ["core"], path: "^(sys|punycode|domain|node:sys|node:punycode|node:domain)$" },
    },
  ],
  options: {
    doNotFollow: { path: "(^|/)node_modules/" },
    exclude: {
      path: [
        "(^|/)(node_modules|\\.next|\\.turbo|dist|build|coverage|public|test-results|playwright-report)/",
        "\\.generated\\.[cm]?[jt]sx?$",
        "(^|/)packages/prisma/(generated|zod|enums)/",
        "(^|/)apps/api/v2/generated/",
      ].join("|"),
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: fileURLToPath(new URL("./apps/web/tsconfig.json", import.meta.url)) },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: {
      archi: {
        collapsePattern: "^(apps/[^/]+|packages/[^/]+)",
      },
    },
  },
};
