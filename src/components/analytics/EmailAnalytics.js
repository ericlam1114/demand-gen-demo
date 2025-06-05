import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Mail, 
  Eye, 
  MousePointer, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Calendar,
  User
} from 'lucide-react'

export function EmailAnalytics({ dateRange = 30 }) {
  const [analytics, setAnalytics] = useState({
    summary: {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      spam: 0
    },
    rates: {
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0
    },
    recentEvents: [],
    topPerformers: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - dateRange)

      // Get summary stats
      const { data: letters, error: lettersError } = await supabase
        .from('letters')
        .select(`
          id,
          status,
          sent_at,
          opened_at,
          clicked_at,
          bounced_at,
          delivered_at,
          open_count,
          click_count,
          debtors (name, email),
          templates (name)
        `)
        .eq('channel', 'email')
        .gte('sent_at', startDate.toISOString())
        .order('sent_at', { ascending: false })

      if (lettersError) throw lettersError

      // Get recent events
      const { data: events, error: eventsError } = await supabase
        .from('email_events')
        .select(`
          *,
          letters (
            debtors (name, email),
            templates (name)
          )
        `)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(10)

      if (eventsError) throw eventsError

      // Calculate summary
      const summary = letters.reduce((acc, letter) => {
        acc.sent++
        if (letter.status === 'delivered' || letter.opened_at || letter.clicked_at) acc.delivered++
        if (letter.opened_at) acc.opened++
        if (letter.clicked_at) acc.clicked++
        if (letter.status === 'bounced') acc.bounced++
        if (letter.status === 'spam') acc.spam++
        return acc
      }, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, spam: 0 })

      // Calculate rates
      const rates = {
        deliveryRate: summary.sent > 0 ? (summary.delivered / summary.sent * 100) : 0,
        openRate: summary.delivered > 0 ? (summary.opened / summary.delivered * 100) : 0,
        clickRate: summary.opened > 0 ? (summary.clicked / summary.opened * 100) : 0,
        bounceRate: summary.sent > 0 ? (summary.bounced / summary.sent * 100) : 0
      }

      // Find top performers by engagement
      const topPerformers = letters
        .filter(letter => letter.open_count > 0 || letter.click_count > 0)
        .sort((a, b) => 
          ((b.open_count || 0) + (b.click_count || 0)) - 
          ((a.open_count || 0) + (a.click_count || 0))
        )
        .slice(0, 5)

      setAnalytics({
        summary,
        rates,
        recentEvents: events || [],
        topPerformers
      })

    } catch (error) {
      console.error('Error fetching email analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ icon: Icon, title, value, subtitle, color = "blue" }) => (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg bg-${color}-100 mr-4`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  )

  const formatRate = (rate) => `${rate.toFixed(1)}%`
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString()
  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString()

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'open': return <Eye className="w-4 h-4 text-blue-600" />
      case 'click': return <MousePointer className="w-4 h-4 text-purple-600" />
      case 'bounce': return <XCircle className="w-4 h-4 text-red-600" />
      case 'spam_report': return <AlertTriangle className="w-4 h-4 text-orange-600" />
      default: return <Mail className="w-4 h-4 text-gray-600" />
    }
  }

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'delivered': return 'text-green-600'
      case 'open': return 'text-blue-600'
      case 'click': return 'text-purple-600'
      case 'bounce': return 'text-red-600'
      case 'spam_report': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-12 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Mail}
          title="Emails Sent"
          value={analytics.summary.sent.toLocaleString()}
          subtitle={`${formatRate(analytics.rates.deliveryRate)} delivered`}
          color="blue"
        />
        <StatCard
          icon={Eye}
          title="Opens"
          value={analytics.summary.opened.toLocaleString()}
          subtitle={`${formatRate(analytics.rates.openRate)} open rate`}
          color="green"
        />
        <StatCard
          icon={MousePointer}
          title="Clicks"
          value={analytics.summary.clicked.toLocaleString()}
          subtitle={`${formatRate(analytics.rates.clickRate)} click rate`}
          color="purple"
        />
        <StatCard
          icon={AlertTriangle}
          title="Bounces"
          value={analytics.summary.bounced.toLocaleString()}
          subtitle={`${formatRate(analytics.rates.bounceRate)} bounce rate`}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Recent Email Activity
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {analytics.recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    {getEventIcon(event.event_type)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {event.letters?.debtors?.name || event.email_address}
                      </p>
                      <p className="text-xs text-gray-500">
                        {event.letters?.templates?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium capitalize ${getEventColor(event.event_type)}`}>
                      {event.event_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              {analytics.recentEvents.length === 0 && (
                <p className="text-center text-gray-500 py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <User className="w-5 h-5 mr-2 text-green-600" />
              Most Engaged Recipients
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {analytics.topPerformers.map((letter, index) => (
                <div key={letter.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {letter.debtors?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {letter.templates?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {(letter.open_count || 0) + (letter.click_count || 0)} interactions
                    </p>
                    <p className="text-xs text-gray-500">
                      {letter.open_count || 0} opens, {letter.click_count || 0} clicks
                    </p>
                  </div>
                </div>
              ))}
              {analytics.topPerformers.length === 0 && (
                <p className="text-center text-gray-500 py-4">No engagement data yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SendGrid Integration Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              Enhanced with SendGrid Analytics
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              Email tracking is powered by SendGrid's native analytics for accurate open rates, 
              click tracking, bounce detection, and spam reporting. All events are automatically 
              synced in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 