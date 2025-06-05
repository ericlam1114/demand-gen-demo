"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Workflow, BarChart3, Settings, FileText, Database, Building2, Home, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Workflows", href: "/workflows", icon: Workflow },
  { name: "Data Sources", href: "/upload", icon: Database },
  // { name: "Integration Guide", href: "/integration-guide", icon: Zap },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ collapsed = false }) {
  const pathname = usePathname();
  const { agency } = useAuth();

  return (
    <div
      className={cn(
        "bg-white border-r border-gray-200 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            {!collapsed && (
              <div className="text-left">
                <div className="text-lg font-bold text-blue-600">
                  {agency?.name || "Collections Pro"}
                </div>
                {agency?.plan && (
                  <div className="text-xs text-gray-500 capitalize">
                    {agency.plan} Plan
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={item.disabled ? (e) => e.preventDefault() : undefined}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                {!collapsed && (
                  <span className="truncate">
                    {item.name}
                    {item.disabled && " (Soon)"}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Agency Info */}
        {!collapsed && agency && (
        <div className="px-4 py-4 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Current Agency</div>
              <div className="text-sm font-medium text-gray-900 truncate">
                {agency.name}
            </div>
              <div className="text-xs text-gray-500 mt-1">
                {agency.max_users} users • {agency.max_letters_per_month?.toLocaleString()} letters/month
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
