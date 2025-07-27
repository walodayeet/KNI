'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/Button'
import { ChartBarIcon, ClockIcon, CpuChipIcon, SignalIcon } from '@heroicons/react/24/outline'

interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  fcp?: number // First Contentful Paint
  ttfb?: number // Time to First Byte
  
  // Custom metrics
  domContentLoaded?: number
  loadComplete?: number
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
  connectionType?: string
  effectiveType?: string
  
  // Performance scores
  performanceScore?: number
  recommendations?: string[]
}

interface PerformanceMonitorProps {
  enabled?: boolean
  showWidget?: boolean
  reportInterval?: number // in milliseconds
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void
  thresholds?: {
    lcp?: number
    fid?: number
    cls?: number
    memoryUsage?: number
  }
}

const DEFAULT_THRESHOLDS = {
  lcp: 2500, // 2.5 seconds
  fid: 100, // 100 milliseconds
  cls: 0.1, // 0.1
  memoryUsage: 80, // 80%
}

export default function PerformanceMonitor({
  enabled = true,
  showWidget = process.env.NODE_ENV === 'development',
  reportInterval = 30000, // 30 seconds
  onMetricsUpdate,
  thresholds = DEFAULT_THRESHOLDS,
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({})
  const [isVisible, setIsVisible] = useState(false)
  const [alerts, setAlerts] = useState<string[]>([])
  const intervalRef = useRef<NodeJS.Timeout>()
  const observerRef = useRef<PerformanceObserver>()

  const collectMetrics = useCallback(async () => {
    if (!enabled || typeof window === 'undefined') return

    try {
      const newMetrics: PerformanceMetrics = {}
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      // Core Web Vitals and timing metrics
      if (navigation) {
        newMetrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
        newMetrics.loadComplete = navigation.loadEventEnd - navigation.loadEventStart
        newMetrics.ttfb = navigation.responseStart - navigation.requestStart
      }

      // Memory usage (if available)
      if ('memory' in performance) {
        const memory = (performance as any).memory
        newMetrics.memoryUsage = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100),
        }
      }

      // Network information (if available)
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        newMetrics.connectionType = connection.type
        newMetrics.effectiveType = connection.effectiveType
      }

      // Calculate performance score
      newMetrics.performanceScore = calculatePerformanceScore(newMetrics)
      newMetrics.recommendations = generateRecommendations(newMetrics, thresholds)

      setMetrics(newMetrics)
      onMetricsUpdate?.(newMetrics)

      // Check for performance alerts
      checkPerformanceAlerts(newMetrics, thresholds)

      // Log metrics for monitoring
      logger.info('Performance metrics collected', {
        metrics: newMetrics,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      })

    } catch (error) {
      logger.error('Failed to collect performance metrics', { error })
    }
  }, [enabled, onMetricsUpdate, thresholds])

  const setupWebVitalsObserver = useCallback(() => {
    if (!enabled || typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    try {
      // Observe Core Web Vitals
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metricName = entry.name
          const value = entry.value || (entry as any).processingStart

          setMetrics(prev => ({
            ...prev,
            [metricName.toLowerCase()]: value,
          }))

          // Log individual web vital
          logger.info(`Web Vital: ${metricName}`, {
            value,
            rating: getWebVitalRating(metricName, value),
            url: window.location.href,
          })
        }
      })

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
      observerRef.current = observer

    } catch (error) {
      logger.error('Failed to setup Web Vitals observer', { error })
    }
  }, [enabled])

  const checkPerformanceAlerts = useCallback((metrics: PerformanceMetrics, thresholds: typeof DEFAULT_THRESHOLDS) => {
    const newAlerts: string[] = []

    if (metrics.lcp && metrics.lcp > thresholds.lcp!) {
      newAlerts.push(`LCP is ${Math.round(metrics.lcp)}ms (threshold: ${thresholds.lcp}ms)`)
    }

    if (metrics.fid && metrics.fid > thresholds.fid!) {
      newAlerts.push(`FID is ${Math.round(metrics.fid)}ms (threshold: ${thresholds.fid}ms)`)
    }

    if (metrics.cls && metrics.cls > thresholds.cls!) {
      newAlerts.push(`CLS is ${metrics.cls.toFixed(3)} (threshold: ${thresholds.cls})`)
    }

    if (metrics.memoryUsage && metrics.memoryUsage.percentage > thresholds.memoryUsage!) {
      newAlerts.push(`Memory usage is ${metrics.memoryUsage.percentage}% (threshold: ${thresholds.memoryUsage}%)`)
    }

    setAlerts(newAlerts)

    // Log alerts
    if (newAlerts.length > 0) {
      logger.warn('Performance alerts triggered', {
        alerts: newAlerts,
        metrics,
        url: window.location.href,
      })
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Initial metrics collection
    collectMetrics()
    setupWebVitalsObserver()

    // Set up periodic collection
    intervalRef.current = setInterval(collectMetrics, reportInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [enabled, collectMetrics, setupWebVitalsObserver, reportInterval])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getMetricColor = (metric: string, value: number): string => {
    const rating = getWebVitalRating(metric, value)
    switch (rating) {
      case 'good': return 'text-green-600'
      case 'needs-improvement': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (!enabled || !showWidget) {
    return null
  }

  return (
    <>
      {/* Performance Widget Toggle */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(!isVisible)}
          className="rounded-full p-3 shadow-lg"
          variant="outline"
          title="Performance Monitor"
        >
          <ChartBarIcon className="h-5 w-5" />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>
      </div>

      {/* Performance Widget */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Performance
              </h3>
              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
                className="p-1"
              >
                ✕
              </Button>
            </div>

            {/* Performance Score */}
            {metrics.performanceScore && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Overall Score</span>
                  <span className={`text-lg font-bold ${getScoreColor(metrics.performanceScore)}`}>
                    {Math.round(metrics.performanceScore)}/100
                  </span>
                </div>
              </div>
            )}

            {/* Core Web Vitals */}
            <div className="space-y-3 mb-4">
              <h4 className="text-sm font-medium text-gray-700">Core Web Vitals</h4>
              
              {metrics.lcp && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    LCP
                  </span>
                  <span className={getMetricColor('largest-contentful-paint', metrics.lcp)}>
                    {Math.round(metrics.lcp)}ms
                  </span>
                </div>
              )}

              {metrics.fid && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    <SignalIcon className="h-4 w-4 mr-1" />
                    FID
                  </span>
                  <span className={getMetricColor('first-input', metrics.fid)}>
                    {Math.round(metrics.fid)}ms
                  </span>
                </div>
              )}

              {metrics.cls && (
                <div className="flex items-center justify-between text-sm">
                  <span>CLS</span>
                  <span className={getMetricColor('layout-shift', metrics.cls)}>
                    {metrics.cls.toFixed(3)}
                  </span>
                </div>
              )}
            </div>

            {/* Memory Usage */}
            {metrics.memoryUsage && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Memory Usage</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center">
                      <CpuChipIcon className="h-4 w-4 mr-1" />
                      Used
                    </span>
                    <span>{formatBytes(metrics.memoryUsage.used)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        metrics.memoryUsage.percentage > 80 ? 'bg-red-500' :
                        metrics.memoryUsage.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${metrics.memoryUsage.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    {metrics.memoryUsage.percentage}% of {formatBytes(metrics.memoryUsage.total)}
                  </div>
                </div>
              </div>
            )}

            {/* Connection Info */}
            {(metrics.connectionType || metrics.effectiveType) && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Connection</h4>
                <div className="text-sm text-gray-600">
                  {metrics.effectiveType && (
                    <div>Type: {metrics.effectiveType.toUpperCase()}</div>
                  )}
                  {metrics.connectionType && (
                    <div>Connection: {metrics.connectionType}</div>
                  )}
                </div>
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-700 mb-2">⚠️ Performance Alerts</h4>
                <div className="space-y-1">
                  {alerts.map((alert, index) => (
                    <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {alert}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {metrics.recommendations && metrics.recommendations.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-blue-700 mb-2">💡 Recommendations</h4>
                <div className="space-y-1">
                  {metrics.recommendations.map((rec, index) => (
                    <div key={index} className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2">
              <Button
                onClick={collectMetrics}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                Refresh
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(metrics, null, 2))
                }}
                size="sm"
                variant="ghost"
                className="flex-1"
              >
                Copy Data
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  let score = 100
  let factors = 0

  // LCP scoring (0-40 points)
  if (metrics.lcp) {
    factors++
    if (metrics.lcp > 4000) score -= 40
    else if (metrics.lcp > 2500) score -= 20
    else if (metrics.lcp > 1200) score -= 10
  }

  // FID scoring (0-30 points)
  if (metrics.fid) {
    factors++
    if (metrics.fid > 300) score -= 30
    else if (metrics.fid > 100) score -= 15
    else if (metrics.fid > 50) score -= 5
  }

  // CLS scoring (0-20 points)
  if (metrics.cls) {
    factors++
    if (metrics.cls > 0.25) score -= 20
    else if (metrics.cls > 0.1) score -= 10
    else if (metrics.cls > 0.05) score -= 5
  }

  // Memory usage scoring (0-10 points)
  if (metrics.memoryUsage) {
    factors++
    if (metrics.memoryUsage.percentage > 90) score -= 10
    else if (metrics.memoryUsage.percentage > 80) score -= 5
  }

  return Math.max(0, Math.min(100, score))
}

function generateRecommendations(metrics: PerformanceMetrics, thresholds: typeof DEFAULT_THRESHOLDS): string[] {
  const recommendations: string[] = []

  if (metrics.lcp && metrics.lcp > thresholds.lcp!) {
    recommendations.push('Optimize images and reduce server response time to improve LCP')
  }

  if (metrics.fid && metrics.fid > thresholds.fid!) {
    recommendations.push('Reduce JavaScript execution time and break up long tasks')
  }

  if (metrics.cls && metrics.cls > thresholds.cls!) {
    recommendations.push('Set size attributes on images and reserve space for dynamic content')
  }

  if (metrics.memoryUsage && metrics.memoryUsage.percentage > thresholds.memoryUsage!) {
    recommendations.push('Consider reducing memory usage by optimizing data structures')
  }

  if (metrics.ttfb && metrics.ttfb > 600) {
    recommendations.push('Improve server response time or use a CDN')
  }

  return recommendations
}

function getWebVitalRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    'largest-contentful-paint': [2500, 4000],
    'first-input': [100, 300],
    'layout-shift': [0.1, 0.25],
    'first-contentful-paint': [1800, 3000],
  }

  const [good, poor] = thresholds[metric] || [0, 0]
  
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}