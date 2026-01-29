import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useForm } from '@inertiajs/react';
import { Alert } from "./ui/alert";


export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { data, setData, post, errors, processing } = useForm({
    email: '',
    password: '',
  });


  function submit(e) {
    e.preventDefault();
    post(route('login'));
  }

  return (
    <form className={cn("flex flex-col gap-6", className)}
      onSubmit={submit} {...props}>

      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>
        
        {/* Show field error */}
        {errors.email && (
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-sm">
            {errors.email}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email"
            type="email"
            placeholder="m@example.com"
            value={data.email}
            onChange={e => setData('email', e.target.value)}
            required />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
          </div>
          <Input id="password"
            type="password"
            value={data.password}
            onChange={e => setData('password', e.target.value)}
            required />
        </Field>
        <Field>
          <Button type="submit">Login</Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
