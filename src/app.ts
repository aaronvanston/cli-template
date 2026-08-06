import packageJson from "../package.json" with { type: "json" };
import { createCli } from "./engine/index.ts";
import { apiModule } from "./modules/api/module.ts";
import { itemsModule } from "./modules/items/module.ts";
import { systemModule } from "./modules/system/module.ts";

export const app = createCli({
  meta: {
    description:
      "A Bun and TypeScript CLI scaffold for humans, scripts, and agents",
    homepage: "https://github.com/aaronvanston/cli-template",
    name: "cli-template",
    version: packageJson.version,
  },
  modules: [apiModule, itemsModule, systemModule],
});
