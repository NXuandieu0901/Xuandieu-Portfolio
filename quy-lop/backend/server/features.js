import { reportRoutes } from "./reports.js";
import { advanceRoutes } from "./advances.js";
import { expenseRoutes } from "./expenses.js";
import { migrateLedger, incomeRoutes } from "./ledger.js";
import { migrateMembers, memberRoutes } from "./members.js";
import { migrateSettings, settingsRoutes } from "./settings.js";
export function migrateFeatures(db) {
  migrateSettings(db);
  migrateMembers(db);
  migrateLedger(db);
}
export function featureRoutes(ctx) {
  return (
    settingsRoutes(ctx) ||
    memberRoutes(ctx) ||
    incomeRoutes(ctx) ||
    expenseRoutes(ctx) ||
    advanceRoutes(ctx) ||
    reportRoutes(ctx)
  );
}
