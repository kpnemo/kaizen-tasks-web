import { ArrowRight, MapPinOff } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** The 404 content. It brings no landmark of its own: NotFoundRoute puts it inside the shell's
 *  `main` for a signed-in user and inside a bare one otherwise. */
export function NotFoundPage() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MapPinOff />
        </EmptyMedia>
        <EmptyTitle>
          <h1>Page not found</h1>
        </EmptyTitle>
        <EmptyDescription className="text-base">Nothing lives at this address.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/tasks">
            <ArrowRight data-icon="inline-start" aria-hidden="true" />
            Go to your tasks
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
