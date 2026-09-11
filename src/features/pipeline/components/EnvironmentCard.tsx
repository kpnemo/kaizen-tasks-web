import type { PipelineEnvironment } from "@/api/models";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const NAMES = { staging: "Staging", production: "Production" } as const;
const BRANCHES = { staging: "develop", production: "main" } as const;

/** One environment: what its API and web serve. */
export function EnvironmentCard({
  name,
  environment,
}: {
  name: keyof typeof NAMES;
  environment: PipelineEnvironment;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="text-xl">{NAMES[name]}</h3>
        </CardTitle>
        <CardDescription className="text-base">serves {BRANCHES[name]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-base">
        <p>api {environment.api?.version ?? "unreachable"}</p>
        <p>web {environment.web?.version ?? "unreachable"}</p>
      </CardContent>
    </Card>
  );
}
