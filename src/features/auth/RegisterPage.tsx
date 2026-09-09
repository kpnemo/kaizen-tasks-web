import { useState } from "react";
import { Link } from "react-router";
import { toApiError } from "@/api/errors";
import { Field } from "@/components/field";
import { KaizenMark } from "@/components/kaizen-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister } from "./hooks";

export function RegisterPage() {
  const register = useRegister();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const error = register.error ? toApiError(register.error) : null;
  // A duplicate email comes back as CONFLICT; it belongs on the email field.
  const fields: Record<string, string> =
    error?.code === "CONFLICT" ? { email: error.message } : (error?.fieldErrors() ?? {});

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="mb-10 flex items-center gap-2 text-primary">
        <KaizenMark />
        <span className="font-display text-2xl font-bold">Kaizen Tasks</span>
      </div>
      <h1>Create your account</h1>
      <form
        className="mt-8 space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          register.mutate({ email, password, displayName });
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
        <Field id="password" label="Password" hint="At least 8 characters" error={fields.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fields.password)}
            aria-describedby={fields.password ? "password-error" : "password-hint"}
          />
        </Field>
        <Field id="displayName" label="Display name" error={fields.displayName}>
          <Input
            id="displayName"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-invalid={Boolean(fields.displayName)}
            aria-describedby={fields.displayName ? "displayName-error" : undefined}
          />
        </Field>
        {error && error.code !== "VALIDATION_ERROR" && error.code !== "CONFLICT" ? (
          <p role="alert" className="font-semibold text-destructive">
            {error.message}
          </p>
        ) : null}
        <Button type="submit" className="w-full text-base" disabled={register.isPending}>
          Create account
        </Button>
      </form>
      <p className="mt-8 text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
