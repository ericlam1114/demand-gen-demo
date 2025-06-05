// Plan feature restrictions and utilities

export const PLAN_TIERS = {
  free: {
    name: 'Free',
    features: {
      email: true,
      physical_mail: true,
      sms: false,
      workflows: false,
      templates: true,
      dashboard: true,
      analytics: 'basic',
      integrations: false,
      team_members: 1,
      monthly_letters: 100
    },
    color: 'green'
  },
  professional: {
    name: 'Professional', 
    features: {
      email: true,
      physical_mail: true,
      sms: true,
      workflows: true,
      templates: true,
      dashboard: true,
      analytics: 'advanced',
      integrations: true,
      team_members: 5,
      monthly_letters: 2500
    },
    color: 'blue'
  },
  enterprise: {
    name: 'Enterprise',
    features: {
      email: true,
      physical_mail: true,
      sms: true,
      workflows: true,
      templates: true,
      dashboard: true,
      analytics: 'advanced',
      integrations: true,
      white_label: true,
      custom_integrations: true,
      priority_support: true,
      team_members: 'unlimited',
      monthly_letters: 'unlimited'
    },
    color: 'purple'
  }
}

// Helper function to get plan restrictions
export function getPlanFeatures(planName) {
  const normalizedPlan = planName?.toLowerCase() || 'free'
  return PLAN_TIERS[normalizedPlan] || PLAN_TIERS.free
}

// Check if feature is available for plan
export function hasFeature(planName, featureName) {
  const plan = getPlanFeatures(planName)
  return plan.features[featureName] === true
}

// Check if plan can access feature with level
export function getFeatureLevel(planName, featureName) {
  const plan = getPlanFeatures(planName)
  return plan.features[featureName]
}

// Check if user has reached limits
export function checkLimits(planName, current, type) {
  const plan = getPlanFeatures(planName)
  const limit = plan.features[type]
  
  if (limit === 'unlimited') return { allowed: true, remaining: 'unlimited' }
  if (typeof limit === 'number') {
    return {
      allowed: current < limit,
      remaining: Math.max(0, limit - current),
      limit
    }
  }
  return { allowed: false, remaining: 0, limit: 0 }
}

// Get upgrade suggestions
export function getUpgradeMessage(currentPlan, featureName) {
  const messages = {
    sms: {
      free: 'Upgrade to Professional to send SMS messages in workflows',
      professional: 'SMS is included in your plan'
    },
    workflows: {
      free: 'Upgrade to Professional to create automated workflows with follow-ups',
      professional: 'Workflows are included in your plan'
    },
    integrations: {
      free: 'Upgrade to Professional to access API integrations',
      professional: 'Integrations are included in your plan'
    }
  }
  
  return messages[featureName]?.[currentPlan?.toLowerCase()] || 
         `This feature requires a higher plan. Consider upgrading for full access.`
}

// Workflow step type restrictions
export function getAllowedStepTypes(planName) {
  const plan = getPlanFeatures(planName)
  const stepTypes = []
  
  if (plan.features.email) stepTypes.push('email')
  if (plan.features.physical_mail) stepTypes.push('physical')
  if (plan.features.sms) stepTypes.push('sms')
  if (plan.features.workflows) stepTypes.push('wait', 'condition')
  
  return stepTypes
}

// Get restriction component props
export function getRestrictionProps(planName, featureName) {
  const hasAccess = hasFeature(planName, featureName)
  const upgradeMessage = getUpgradeMessage(planName, featureName)
  
  return {
    hasAccess,
    upgradeMessage,
    disabled: !hasAccess,
    planName,
    featureName
  }
} 