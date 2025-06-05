// Plan feature restrictions and utilities

const PLAN_FEATURES = {
  free: {
    features: ['basic_templates', 'email_sending', 'basic_analytics'],
    templates: { limit: 3 },
    letters: { limit: 100 },
    workflows: { limit: 1, concurrent: 1, defaults: 1, active: 0 }, // 1 workflow total, 1 default, 0 additional active
    stepTypes: ['email', 'physical']
  },
  professional: {
    features: ['basic_templates', 'email_sending', 'sms_sending', 'basic_analytics', 'workflows', 'wait_steps'],
    templates: { limit: 10 },
    letters: { limit: 1000 },
    workflows: { limit: 5, concurrent: 1, defaults: 1, active: 4 }, // 5 workflows total, 1 default, 4 active (but only 1 runs at a time)
    stepTypes: ['email', 'sms', 'physical', 'wait']
  },
  enterprise: {
    features: ['basic_templates', 'advanced_templates', 'email_sending', 'sms_sending', 'physical_mail', 'advanced_analytics', 'workflows', 'wait_steps', 'api_access', 'workflow_tagging'],
    templates: { limit: -1 }, // unlimited
    letters: { limit: -1 }, // unlimited
    workflows: { limit: -1, concurrent: -1, defaults: 1, active: -1 }, // unlimited workflows, 1 default, unlimited active, unlimited concurrent
    stepTypes: ['email', 'sms', 'physical', 'wait']
  }
}

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

export function getWorkflowLimits(plan) {
  return PLAN_FEATURES[plan]?.workflows || { limit: 0, concurrent: 0, defaults: 0, active: 0 }
}

export function canCreateWorkflow(plan, currentWorkflowCount) {
  const limits = getWorkflowLimits(plan)
  return limits.limit === -1 || currentWorkflowCount < limits.limit
}

export function canRunConcurrentWorkflows(plan, currentActiveWorkflows) {
  const limits = getWorkflowLimits(plan)
  return limits.concurrent === -1 || currentActiveWorkflows < limits.concurrent
}

export function getWorkflowUpgradeMessage(plan, currentCount) {
  const limits = getWorkflowLimits(plan)
  
  if (plan === 'free') {
    return `You've reached the limit of ${limits.limit} workflow. Upgrade to Professional for up to 5 workflows.`
  } else if (plan === 'professional') {
    return `You've reached the limit of ${limits.limit} workflows. Upgrade to Enterprise for unlimited workflows.`
  }
  
  return 'Upgrade to access more workflow features.'
}

export function getDefaultWorkflowLimits(plan) {
  return PLAN_FEATURES[plan]?.workflows?.defaults || 1
}

export function getActiveWorkflowLimits(plan) {
  return PLAN_FEATURES[plan]?.workflows?.active || 0
}

export function canSetAsDefault(plan, currentDefaultCount) {
  const limit = getDefaultWorkflowLimits(plan)
  return limit === -1 || currentDefaultCount < limit
}

export function canCreateActiveWorkflow(plan, currentActiveCount) {
  const limit = getActiveWorkflowLimits(plan)
  return limit === -1 || currentActiveCount < limit
}

export function getWorkflowMessage(plan) {
  const limits = getWorkflowLimits(plan)
  
  if (plan === 'free') {
    return `Free plan allows 1 workflow total.`
  } else if (plan === 'professional') {
    return `Professional plan: 1 default workflow + ${limits.active} active workflows (1 runs at a time).`
  } else if (plan === 'enterprise') {
    return `Enterprise plan: 1 default workflow + unlimited active workflows (unlimited concurrent execution).`
  }
  
  return 'Workflow limits apply based on your plan.'
}

export function getDefaultWorkflowMessage(plan) {
  if (plan === 'enterprise') {
    return 'Enterprise allows 1 default workflow for quick actions, plus unlimited active workflows for API/CSV assignments.'
  }
  
  return `Only 1 workflow can be set as default on the ${plan} plan.`
} 