"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Check for error in URL (e.g., MissingCSRF from NextAuth)
    // If error is MissingCSRF, it means login actually succeeded but NextAuth
    // redirected back with an error. Check if user is logged in and redirect.
    const urlError = searchParams.get("error")
    if (urlError === "MissingCSRF") {
      // Clear the error from URL
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/login")
      }
      
      // Check if user is actually logged in (login succeeded despite the error)
      fetch("/api/auth/session", { cache: "no-store" })
        .then((res) => res.json())
        .then((session) => {
          if (session?.user) {
            // User is logged in - redirect based on role
            if (session.user.role === "STAKEHOLDER") {
              router.push("/pwa/capture")
            } else {
              router.push("/")
            }
          }
        })
        .catch(() => {
          // If session check fails, just leave them on login page
        })
    } else if (urlError) {
      setError("An error occurred. Please try again.")
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/login")
      }
    }
  }, [searchParams, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      // Determine redirect URL based on user role
      // We'll get the session after sign-in to determine where to redirect
      const result = await signIn("credentials", {
        name,
        password,
        redirect: false,
        callbackUrl: "/", // Default, we'll override after checking session
      })

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Invalid name or password")
        } else if (result.error === "MissingCSRF") {
          // This shouldn't happen, but if it does, try again
          setError("Security error: Please try again.")
        } else {
          setError("Login failed. Please try again.")
        }
      } else if (result?.ok) {
        // Success - get session to determine redirect
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
        })
        const session = await sessionResponse.json()

        // Redirect based on user role
        if (session?.user?.role === "STAKEHOLDER") {
          router.push("/pwa/capture")
        } else {
          router.push("/")
        }
        // Don't set isSubmitting to false here since we're redirecting
        return
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            WifeApp
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <input
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoComplete="username"
              required
              className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300"
            />
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              WifeApp
            </h2>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
            Loading...
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}