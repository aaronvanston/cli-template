import { defineModule } from "../../engine/index.ts";
import { apiClientProvider, apiConfigurationCheck } from "./client.ts";
import { apiCommand, apiDescribeCommand, apiListCommand } from "./commands.ts";

export const apiModule = defineModule({
  commands: [apiCommand, apiListCommand, apiDescribeCommand],
  healthChecks: [
    {
      name: "API base URL",
      run: apiConfigurationCheck,
    },
    {
      name: "API credentials",
      run() {
        const configured = Boolean(process.env.CLI_TEMPLATE_TOKEN);
        return {
          detail: configured
            ? "CLI_TEMPLATE_TOKEN is set"
            : "No token configured; public endpoints still work",
          name: "API credentials",
          status: configured ? ("pass" as const) : ("warn" as const),
          ...(configured
            ? {}
            : {
                fix: "Set CLI_TEMPLATE_TOKEN when the service requires auth.",
              }),
        };
      },
    },
  ],
  id: "api",
  services: [apiClientProvider],
  summary: "Explore and call the configured API",
});
