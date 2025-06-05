import { AlertTriangle, Crown, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function PlanRestrictionBanner({ 
  planName, 
  featureName, 
  upgradeMessage, 
  showUpgradeButton = true,
  className = "" 
}) {
  const handleUpgrade = () => {
    // In a real app, this would redirect to billing/upgrade page
    window.open('/pricing', '_blank')
  }

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-amber-800">Feature Restricted</h4>
            <Badge variant="outline" className="text-xs">
              {planName || 'Free'} Plan
            </Badge>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            {upgradeMessage}
          </p>
          {showUpgradeButton && (
            <button
              onClick={handleUpgrade}
              className="inline-flex items-center gap-2 bg-amber-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Crown className="w-4 h-4" />
              Upgrade Plan
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function PlanFeatureLock({ planName, featureName, children, upgradeMessage }) {
  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <Crown className="w-8 h-8 text-amber-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Upgrade Required</h3>
          <p className="text-sm text-gray-600 mb-4">
            {upgradeMessage}
          </p>
          <button
            onClick={() => window.open('/pricing', '_blank')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  )
} 