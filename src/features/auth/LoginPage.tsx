import { LogIn, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toApiError } from "@/api/errors";
import { Field } from "@/components/field";
import { KaizenMark } from "@/components/kaizen-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useLogin } from "./hooks";

/** The sign-in screen: one Card centred in the viewport, so the whole form sits inside the
 *  projector's fold. The heading keeps its h1 through `CardTitle asChild` (the selector contract
 *  pins heading "Log in"), field errors come from the API through `Field`, and an error that
 *  belongs to no field is one destructive Alert; the two never mount together. */
export function LoginPage() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = login.error ? toApiError(login.error) : null;
  const fields = error?.fieldErrors() ?? {};

  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card className="gap-4">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <KaizenMark />
              <span className="font-display text-2xl font-bold">Kaizen Tasks</span>
            </div>
            <CardTitle asChild className="text-3xl">
              <h1>Log in</h1>
            </CardTitle>
            <CardDescription className="text-base">Pick up where you left off.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-6"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                login.mutate({ email, password });
              }}
            >
              <FieldGroup className="gap-5">
                <Field id="email" label="Email" error={fields.email}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(fields.email)}
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
                  />
                </Field>
              </FieldGroup>
              {error && error.code !== "VALIDATION_ERROR" ? (
                <Alert variant="destructive">
                  <TriangleAlert aria-hidden="true" />
                  <AlertTitle>Could not log in</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <LogIn data-icon="inline-start" aria-hidden="true" />
                )}
                Log in
              </Button>
            </form>
          </CardContent>
          <CardFooter className="gap-1 text-muted-foreground">
            New here?
            <Button variant="link" asChild className="px-1 underline">
              <Link to="/register">Create an account</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
