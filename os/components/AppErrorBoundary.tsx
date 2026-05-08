import React from 'react';

interface Props {
  appId: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[OS] App "${this.props.appId}" crashed:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-white pt-10 px-6">
        <div className="text-5xl mb-4 text-gray-500">!</div>
        <div className="text-lg font-medium text-gray-800 mb-1">应用出现问题</div>
        <div className="text-sm text-gray-400 mb-1">{this.props.appId}</div>
        <div className="text-xs text-gray-300 mb-6 max-w-[280px] text-center break-all line-clamp-3">
          {this.state.error?.message}
        </div>
        <button
          onClick={this.handleRetry}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-full text-sm font-medium"
        >
          重新加载
        </button>
      </div>
    );
  }
}
