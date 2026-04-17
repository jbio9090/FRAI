import { useForm } from '@inertiajs/react';
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { motion, useMotionValue, useMotionTemplate } from "framer-motion"

const MotionButton = motion(Button);

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { data, setData, post, errors } = useForm({
    email: '',
    password: '',
  });

  // 1. Setup motion values for mouse position
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // 2. Handle mouse movement to update coordinates
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
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
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
          <Input id="password"
            type="password"
            value={data.password}
            onChange={e => setData('password', e.target.value)}
            required />
        </Field>
        
        <Field>
          <div className="group relative">
            <MotionButton 
              type="submit"
              onMouseMove={handleMouseMove}
              className="relative w-full bg-blue-600 hover:bg-blue-600 text-white border-none overflow-hidden"
              whileTap={{ scale: 0.98 }}
            >
              {/* 3. The Animated Gradient Layer */}
              <motion.div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
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