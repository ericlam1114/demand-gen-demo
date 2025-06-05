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
        {/* Rest of your login form... */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form fields... */}
          <Button
            type="submit"
            disabled={loading || authLoading}
            className="w-full py-3"
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
        {/* {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
            <div>Auth State: {authLoading ? 'Loading' : 'Ready'}</div>
            <div>User: {user ? user.email : 'None'}</div>
            <div>Profile: {profile ? 'Loaded' : 'Not loaded'}</div>
          </div>
        )} */}
      </div>
    </div>
  );
}
