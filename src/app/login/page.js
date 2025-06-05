"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Building2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect when user is fully authenticated
  useEffect(() => {
    if (!authLoading && user && profile) {
      console.log("[Login] User authenticated, redirecting to dashboard");
      router.push("/dashboard");
    }
  }, [user, profile, authLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("[Login] Form submitted");
    setLoading(true);
    setError("");

    try {
      const { error } = await signIn(email, password);
    
    if (error) {
        console.log("[Login] Sign in failed:", error.message);
        setError(error.message);
        setLoading(false);
      }
      // Don't set loading to false on success - let the redirect happen
    } catch (err) {
      console.error("[Login] Login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Don't render the form if already authenticated
  if (!authLoading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Collections Pro</h1>
          <p className="text-gray-600 mt-2">Sign in to your agency account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || authLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || authLoading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || authLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {/* Additional Links */}
        <div className="mt-6 text-center space-y-2">
          <Link 
            href="/forgot-password" 
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Forgot your password?
          </Link>
          
          <div className="text-sm text-gray-600">
            Need an account?{" "}
            <Link 
              href="/signup" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Contact sales
            </Link>
          </div>
        </div>

        {/* Demo Account Info */}
        <div className="mt-8 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Demo Accounts:
          </h3>
          <div className="space-y-1 text-xs text-gray-600">
            <div>
              <strong>Nexum Collections:</strong> admin@nexum.com / demo123
            </div>
            <div>
              <strong>DCI International:</strong> admin@dci.com / demo123
            </div>
          </div>
        </div>

        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
            <div>Auth State: {authLoading ? 'Loading' : 'Ready'}</div>
            <div>User: {user ? user.email : 'None'}</div>
            <div>Profile: {profile ? 'Loaded' : 'Not loaded'}</div>
          </div>
        )}
      </div>
    </div>
  );
} 
