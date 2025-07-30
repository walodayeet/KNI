'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon, BugAntIcon } from '@heroicons/react/24/outline'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showReportButton?: boolean
  level?: 'page' | 'component' | 'critical'
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId?: string
  isReporting?: boolean
  reportSent?: boolean
  retryCount: number
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = []

  constructor(props: Props) {
    super(props)
    this.state = { 
      hasError: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      hasError: true,
      error,
      errorId,
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Enhanced error logging with context
    const errorContext = {
      errorId: this.state.errorId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      level: this.props.level || 'component',
      retryCount: this.state.retryCount,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
    }

    // Log to monitoring service
    logger.error('React Error Boundary caught an error', errorContext)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Report to external error tracking service
    this.reportError(errorContext)
  }

  override componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
  }

  private getUserId(): string | null {
    try {
      // Try to get user ID from various sources
      const userCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user_id='))
        ?.split('=')[1]
      
      return userCookie || localStorage.getItem('user_id') || null
    } catch {
      return null
    }
  }

  private getSessionId(): string | null {
    try {
      return sessionStorage.getItem('session_id') || null
    } catch {
      return null
    }
  }

  private async reportError(errorContext: any) {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorContext),
      })
    } catch (reportError) {
      console.error('Failed to report error:', reportError)
    }
  }

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1
    
    // Limit retry attempts
    if (newRetryCount > 3) {
      return
    }

    this.setState({
      hasError: false,
      retryCount: newRetryCount,
    })

    // Add exponential backoff for retries
    const timeout = setTimeout(() => {
      // Force re-render after a delay
      this.forceUpdate()
    }, Math.pow(2, newRetryCount) * 1000)

    this.retryTimeouts.push(timeout)
  }

  private handleReportBug = async () => {
    this.setState({ isReporting: true })

    try {
      const reportData = {
        errorId: this.state.errorId,
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userFeedback: 'User reported this error manually',
      }

      await fetch('/api/errors/user-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      })

      this.setState({ reportSent: true })
    } catch (error) {
      console.error('Failed to send bug report:', error)
    } finally {
      this.setState({ isReporting: false })
    }
  }

  private getErrorSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    const { level } = this.props
    const { retryCount } = this.state

    if (level === 'critical' || retryCount > 2) {return 'critical'}
    if (level === 'page' || retryCount > 1) {return 'high'}
    if (retryCount > 0) {return 'medium'}
    return 'low'
  }

  private renderErrorUI() {
    const { level = 'component', showReportButton = true } = this.props
    const { error, errorId, isReporting, reportSent, retryCount } = this.state
    const severity = this.getErrorSeverity()

    const severityColors = {
      low: 'bg-yellow-50 border-yellow-200',
      medium: 'bg-orange-50 border-orange-200',
      high: 'bg-red-50 border-red-200',
      critical: 'bg-red-100 border-red-300',
    }

    const iconColors = {
      low: 'text-yellow-600',
      medium: 'text-orange-600',
      high: 'text-red-600',
      critical: 'text-red-700',
    }

    if (level === 'component') {
      return (
        <div className={`rounded-lg border-2 p-4 ${severityColors[severity]}`}>
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className={`h-6 w-6 ${iconColors[severity]} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                Component Error
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                This component encountered an error and couldn't render properly.
              </p>
              <div className="mt-3 flex space-x-2">
                {retryCount < 3 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={this.handleRetry}
                    className="flex items-center space-x-1"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    <span>Retry</span>
                  </Button>
                )}
                {showReportButton && !reportSent && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={this.handleReportBug}
                    disabled={isReporting || false}
                    className="flex items-center space-x-1"
                  >
                    <BugAntIcon className="h-4 w-4" />
                    <span>{isReporting ? 'Reporting...' : 'Report Bug'}</span>
                  </Button>
                )}
                {reportSent && (
                  <span className="text-sm text-green-600 font-medium">
                    ✓ Bug reported
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full">
          <div className={`bg-white shadow-xl rounded-lg border-2 ${severityColors[severity]} overflow-hidden`}>
            <div className="px-6 py-8">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full">
                <ExclamationTriangleIcon className={`w-8 h-8 ${iconColors[severity]}`} />
              </div>
              
              <div className="mt-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  {severity === 'critical' ? 'Critical Error' : 'Something went wrong'}
                </h1>
                <p className="mt-2 text-gray-600">
                  {severity === 'critical' 
                    ? 'A critical error has occurred. Please contact support if this persists.'
                    : 'We apologize for the inconvenience. Please try one of the options below.'}
                </p>
                
                {errorId && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-500">
                      Error ID: <code className="font-mono">{errorId}</code>
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 space-y-3">
                {retryCount < 3 && (
                  <Button
                    onClick={this.handleRetry}
                    className="w-full flex items-center justify-center space-x-2"
                    variant="primary"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                    <span>Try Again</span>
                  </Button>
                )}
                
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center space-x-2"
                  variant="outline"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                  <span>Refresh Page</span>
                </Button>
                
                <Button
                  onClick={() => window.location.href = '/'}
                  className="w-full flex items-center justify-center space-x-2"
                  variant="outline"
                >
                  <HomeIcon className="h-5 w-5" />
                  <span>Go Home</span>
                </Button>
                
                {showReportButton && (
                  <Button
                    onClick={this.handleReportBug}
                    disabled={(isReporting || reportSent) || false}
                    className="w-full flex items-center justify-center space-x-2"
                    variant="outline"
                  >
                    <BugAntIcon className="h-5 w-5" />
                    <span>
                      {(() => {
                        if (reportSent) {return 'Bug Reported ✓';}
                        if (isReporting) {return 'Reporting...';}
                        return 'Report Bug';
                      })()}
                    </span>
                  </Button>
                )}
              </div>
              
              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    🔧 Developer Details
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-red-50 rounded-md">
                      <h4 className="text-sm font-medium text-red-800">Error Message:</h4>
                      <p className="text-sm text-red-700 font-mono">{error.message}</p>
                    </div>
                    {error.stack && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <h4 className="text-sm font-medium text-gray-800">Stack Trace:</h4>
                        <pre className="text-xs text-gray-600 font-mono overflow-auto whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return this.renderErrorUI()
    }

    return this.props.children
  }
}

export default ErrorBoundary

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: { componentStack?: string }) => {
    const errorContext = {
      errorId: `hook_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: 'useErrorHandler',
    }

    logger.error('Error caught by useErrorHandler', errorContext)
    
    // Report to external service
    fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorContext),
    }).catch(console.error)
  }, [])
}