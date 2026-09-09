import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1>Page not found</h1>
      <p className="mt-4 text-muted-foreground">
        Nothing lives at this address.{" "}
        <Link to="/tasks" className="text-primary underline">
          Go to your tasks
        </Link>
        .
      </p>
    </main>
  );
}
