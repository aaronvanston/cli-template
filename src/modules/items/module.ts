import { defineModule } from "../../engine/index.ts";
import { itemsCreateCommand, itemsListCommand } from "./commands.ts";

/**
 * A disposable example module.
 *
 * Keep it while learning the extension seam, then rename or delete this
 * directory when the generated CLI has its first real feature.
 */
export const itemsModule = defineModule({
  commands: [itemsListCommand, itemsCreateCommand],
  id: "items",
  summary: "Exercise the example resource API",
});
