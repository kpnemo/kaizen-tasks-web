import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CardDescription } from "@/components/ui/card";
import { EmptyContent, EmptyDescription } from "@/components/ui/empty";
import { Table, TableCaption } from "@/components/ui/table";

// The room reads this app on a projector, so anything a user must read is text-base (18px at the
// root globals.css sets). The registry ships these primitives at text-sm; the local edit raises
// their base once so no caller has to pass `className="text-base"` (the shell PR did the same for
// Badge). Vitest runs with `css: false`, so the assertions read the class list, not a computed size.

describe("projector scale of the reading primitives", () => {
  it("ships Table and its caption at text-base", () => {
    const { container } = render(
      <Table>
        <TableCaption>caption</TableCaption>
      </Table>,
    );
    const table = container.querySelector('[data-slot="table"]');
    expect(table).toHaveClass("text-base");
    expect(table).not.toHaveClass("text-sm");
    const caption = container.querySelector('[data-slot="table-caption"]');
    expect(caption).toHaveClass("text-base");
    expect(caption).not.toHaveClass("text-sm");
  });

  it("ships Alert and AlertDescription at text-base", () => {
    const { container } = render(
      <Alert>
        <AlertTitle>title</AlertTitle>
        <AlertDescription>description</AlertDescription>
      </Alert>,
    );
    const alert = container.querySelector('[data-slot="alert"]');
    expect(alert).toHaveClass("text-base");
    expect(alert).not.toHaveClass("text-sm");
    const description = container.querySelector('[data-slot="alert-description"]');
    expect(description).toHaveClass("text-base");
    expect(description).not.toHaveClass("text-sm");
  });

  it("ships CardDescription at text-base", () => {
    const { container } = render(<CardDescription>description</CardDescription>);
    const description = container.querySelector('[data-slot="card-description"]');
    expect(description).toHaveClass("text-base");
    expect(description).not.toHaveClass("text-sm");
  });

  it("ships EmptyDescription and EmptyContent at text-base", () => {
    const { container } = render(
      <>
        <EmptyDescription>description</EmptyDescription>
        <EmptyContent>content</EmptyContent>
      </>,
    );
    const description = container.querySelector('[data-slot="empty-description"]');
    expect(description).toHaveClass("text-base/relaxed");
    expect(description).not.toHaveClass("text-sm/relaxed");
    const content = container.querySelector('[data-slot="empty-content"]');
    expect(content).toHaveClass("text-base");
    expect(content).not.toHaveClass("text-sm");
  });

  it("keeps Badge at text-base with size-4 icons", () => {
    const { container } = render(<Badge>chip</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("text-base");
    expect(badge).toHaveClass("[&>svg]:size-4");
    expect(badge).not.toHaveClass("text-sm");
  });
});
