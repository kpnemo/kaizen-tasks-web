import { TriangleAlert, UserPlus } from "lucide-react";
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
import { useRegister } from "./hooks";

/** The sign-up screen, the same Card as LoginPage. The heading stays an h1 ("Create your account"
 *  is in the selector contract, as are the three labels and the button "Create account"). A
 *  duplicate email and validation details land on their fields; anything else is one destructive
 *  Alert, never both at once. The password rule stays visible beside its error. */
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
    <main className="grid min-h-svh place-items-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card className="gap-4">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <KaizenMark />
              <span className="font-display text-2xl font-bold">Kaizen Tasks</span>
            </div>
            <CardTitle asChild className="text-3xl">
              <h1>Create your account</h1>
            </CardTitle>
            <CardDescription className="text-base">
              Big tasks, broken into steps you choose.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-6"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                register.mutate({ email, password, displayName });
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
                <Field
                  id="password"
                  label="Password"
                  hint="At least 8 characters"
                  error={fields.password}
                >
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(fields.password)}
                  />
                </Field>
                <Field id="displayName" label="Display name" error={fields.displayName}>
                  <Input
                    id="displayName"
                    autoComplete="nickname"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    aria-invalid={Boolean(fields.displayName)}
                  />
                </Field>
              </FieldGroup>
              {error && error.code !== "VALIDATION_ERROR" && error.code !== "CONFLICT" ? (
                <Alert variant="destructive" className="text-base">
                  <TriangleAlert aria-hidden="true" />
                  <AlertTitle>Could not create your account</AlertTitle>
                  <AlertDescription className="text-base">{error.message}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={register.isPending}>
                {register.isPending ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <UserPlus data-icon="inline-start" aria-hidden="true" />
                )}
                Create account
              </Button>
            </form>
          </CardContent>
          <CardFooter className="gap-1 text-muted-foreground">
            Already have an account?
            <Button variant="link" asChild className="px-1 underline">
              <Link to="/login">Log in</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
