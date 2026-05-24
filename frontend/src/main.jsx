import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('React error boundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff1f2', minHeight: '100vh' }}>
          <h2 style={{ color: '#be123c', marginBottom: 8 }}>⚠ App crashed — error details below</h2>
          <pre style={{ color: '#9f1239', background: '#ffe4e6', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13 }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ color: '#475569', background: '#f1f5f9', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 12, marginTop: 8 }}>
            {this.state.info?.componentStack}
          </pre>
          <button
            onClick={() => this.setState({ error: null, info: null })}
            style={{ marginTop: 16, padding: '8px 16px', background: '#be123c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
