import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { healthQueryOptions } from "@/api/health-query";
import { KaizenMark } from "@/components/kaizen-mark";
import { Badge } from "@/components/ui/badge";

/** One quiet line at the bottom of every page: who this app was made for, plus a second line
 *  printing the web and API versions so the room can see which release each environment runs
 *  (ADR 0004). When the API's version matches this build, the two commits are plain text of the
 *  same weight, one for each half. Only a mismatch changes shape: a destructive Badge with the
 *  API's own version, a warning icon and a visible note, so it reads by shape and words rather
 *  than by colour alone. The text stays `api v{version} {commit}` or `api {commit}` in one node,
 *  which the smoke test reads. */
export function WorkshopFooter() {
  const { data: health } = useQuery(healthQueryOptions);
  const apiMatches = health ? health.version === __APP_VERSION__ : undefined;
  return (
    <footer className="mx-auto w-full max-w-5xl px-6 py-6">
      <p className="flex items-center justify-center gap-2 border-t pt-6 text-sm text-muted-foreground">
        <KaizenMark className="size-4 text-primary" aria-hidden="true" />
        <span>
          Created for the <span className="font-semibold text-foreground/80">NICE</span> product
          workshop, September 2026
        </span>
      </p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-2 font-mono text-sm text-muted-foreground">
        <span>v{__APP_VERSION__}</span>
        <span aria-hidden="true">·</span>
        <span>web {__APP_COMMIT__}</span>
        {health ? (
          <>
            <span aria-hidden="true">·</span>
            {apiMatches ? (
              <span>{`api ${health.commit.slice(0, 7)}`}</span>
            ) : (
              <>
                <Badge variant="destructive">
                  <TriangleAlert aria-hidden="true" />
                  {`api v${health.version} ${health.commit.slice(0, 7)}`}
                </Badge>
                <span aria-hidden="true">·</span>
                <span className="text-base">web and API versions differ</span>
              </>
            )}
          </>
        ) : null}
      </p>
    </footer>
  );
}
