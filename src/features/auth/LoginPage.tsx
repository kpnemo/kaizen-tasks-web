import { useState } from "react";
import { Link } from "react-router";
import { toApiError } from "@/api/errors";
import { Field } from "@/components/field";
import { KaizenMark } from "@/components/kaizen-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "./hooks";

export function LoginPage() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = login.error ? toApiError(login.error) : null;
  const fields = error?.fieldErrors() ?? {};

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="mb-10 flex items-center gap-2 text-primary">
        <KaizenMark />
        <span className="font-display text-2xl font-bold">Kaizen Tasks</span>
      </div>
      <h1>Log in</h1>
      <form
        className="mt-8 space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <Field id="email" label="Email" error={fields.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fields.email)}
            aria-describedby={fields.email ? "email-error" : undefined}
          />
        </Field>
        <Field id="password" label="Password" error={fields.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fields.password)}
            aria-describedby={fields.password ? "password-error" : undefined}
          />
        </Field>
        {error && error.code !== "VALIDATION_ERROR" ? (
          <p role="alert" className="font-semibold text-destructive">
            {error.message}
          </p>
        ) : null}
        <Button type="submit" className="w-full text-base" disabled={login.isPending}>
          Log in
        </Button>
      </form>
      <p className="mt-8 text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="font-semibold text-primary underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
