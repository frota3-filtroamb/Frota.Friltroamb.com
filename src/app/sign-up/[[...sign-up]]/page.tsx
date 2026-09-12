import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1625]">
      <SignUp
        path="/sign-up"
        routing="path"
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
      />
    </div>
  )
}