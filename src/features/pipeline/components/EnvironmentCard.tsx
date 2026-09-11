import { CircleCheck, CircleDashed, CircleX, type LucideIcon } from "lucide-react";
import type { PipelineEnvironment } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ENVIRONMENTS = {
  staging: { title: "Staging", branch: "develop" },
  production: { title: "Production", branch: "main" },
} as const;

export type EnvironmentName = keyof typeof ENVIRONMENTS;

/** Commits arrive as full SHAs; the room reads seven characters, as GitHub prints them. */
const shortSha = (sha: string) => sha.slice(0, 7);

/** The three states of an environment, each its own variant and icon, so colour is never the only
 *  signal: current is the quiet one, deploying is drawn in outline while the served commit catches
 *  up with the branch head, unreachable is destructive. */
const STATES: Record<
  PipelineEnvironment["state"],
  {
    variant: "secondary" | "outline" | "destructive";
    icon: LucideIcon;
    label: (b: string) => string;
  }
> = {
  current: {
    variant: "secondary",
    icon: CircleCheck,
    label: (branch) => `serving ${branch}'s head`,
  },
  deploying: { variant: "outline", icon: CircleDashed, label: () => "deploying" },
  unreachable: { variant: "destructive", icon: CircleX, label: () => "unreachable" },
};

function Served({
  label,
  half,
}: {
  label: string;
  half: { version: string; commit: string } | null;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        {half ? (
          <>
            <span className="font-medium">{half.version}</span>
            <code className="text-muted-foreground">{shortSha(half.commit)}</code>
          </>
        ) : (
          <span className="text-destructive">did not answer</span>
        )}
      </dd>
    </>
  );
}

function CheckBadge({ name, result }: { name: string; result: "ok" | "failed" }) {
  const ok = result === "ok";
  return (
    <Badge variant={ok ? "outline" : "destructive"}>
      {ok ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
      {name} {result}
    </Badge>
  );
}

/** One environment: what its API and web serve (version and short commit), the API's db and redis
 *  checks, and one line for its state (spec "The page", block 2). A half that did not answer says
 *  so in its own row; the card's state badge says what that means for the environment. */
export function EnvironmentCard({
  name,
  environment,
}: {
  name: EnvironmentName;
  environment: PipelineEnvironment;
}) {
  const { title, branch } = ENVIRONMENTS[name];
  const state = STATES[environment.state];
  const StateIcon = state.icon;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="text-xl">{title}</h3>
        </CardTitle>
        <CardDescription className="text-base">
          What Railway serves from <code>{branch}</code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 text-base">
          <Served label="API" half={environment.api} />
          <Served label="Web" half={environment.web} />
          {environment.api && (
            <>
              <dt className="text-muted-foreground">Checks</dt>
              <dd className="flex flex-wrap gap-2">
                <CheckBadge name="db" result={environment.api.db} />
                <CheckBadge name="redis" result={environment.api.redis} />
              </dd>
            </>
          )}
        </dl>
      </CardContent>
      <CardFooter>
        <Badge variant={state.variant}>
          <StateIcon aria-hidden="true" />
          {state.label(branch)}
        </Badge>
      </CardFooter>
    </Card>
  );
}
