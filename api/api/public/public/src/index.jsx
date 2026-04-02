import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Progress from './Progress.jsx';

const isProgress = window.location.pathname === '/progress';

function ProgressLoader() {
  const [mod, setMod] = React.useState(null);
  React.useEffect(() => {
    import('./Progress.jsx').then(m => setMod(() => m.default));
  }, []);
  if (!mod) return <div style={{fontFamily:'Georgia,serif',textAlign:'center',padding:'3rem',color:'#aaa'}}>Loading…</div>;
  const C = mod;
  return <C />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  isProgress ? <ProgressLoader /> : <App />
);
