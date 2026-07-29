'use client';
import { Component, ReactNode } from 'react';
import OdooConnectionError from '@/components/errors/OdooConnectionError';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class OdooErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('OdooErrorBoundary caught an error:', error, errorInfo);
    // Invia a Sentry o logging service
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isOdooError = this.state.error?.message?.includes('ODOO') ||
                          this.state.error?.message?.includes('odoo') ||
                          this.state.error?.message?.includes('Connection');

      if (isOdooError) {
        return <OdooConnectionError onRetry={this.handleRetry} />;
      }

      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-red-800">Errore imprevisto</h2>
            <p className="text-red-600 mt-2">{this.state.error?.message}</p>
            <button
              onClick={this.handleRetry}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Riprova
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
