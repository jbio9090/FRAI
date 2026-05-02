import { useForm } from '@inertiajs/react';
import { motion, useMotionValue, useMotionTemplate } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MotionButton = motion(Button);

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { data, setData, post, errors } = useForm({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    post(route('login'));
  }

  return (
    <form className={cn("flex flex-col gap-6", className)}
      onSubmit={submit} {...props}>

      <FieldGroup>
        <div className="w-full flex gap-2 items-center justify-center px-4 mb-2 mt-4 mx-auto">
          <img src="FRAI.svg" alt="FRAI website logo on the sidebar" className="max-h-13" />
          <h2 className="text-left font-display font-semibold text-3xl w-fit block">FRAI</h2>
        </div>

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>

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
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={data.password}
              onChange={e => setData('password', e.target.value)}
              className="pr-10"
              required
            />
            <Button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
              variant="ghost"
              size="icon-sm"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </Field>

        <Field>
          <div className="group relative">
            <MotionButton
              type="submit"
              onMouseMove={handleMouseMove}
              className="relative w-full bg-blue-600 hover:bg-blue-600 text-white border-none overflow-hidden"
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                className="pointer-events-none absolute hover:rounded-full -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                  background: useMotionTemplate`
                    radial-gradient(
                      300px circle at ${mouseX}px ${mouseY}px,
                      rgba(255, 255, 255, 0.15),
                      transparent 80%
                    )
                  `,
                }}
              />
              <span className='relative z-10 font-bold'>
                Login
              </span>
            </MotionButton>
          </div>
        </Field>
      </FieldGroup>
    </form>
  )
}