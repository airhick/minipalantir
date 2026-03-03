window.addEventListener('error', e => console.error('Uncaught error:', e.error)); window.addEventListener('unhandledrejection', e => console.error('Unhandled rejection:', e.reason));
