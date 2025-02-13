import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// import App from "./App";
import Piano from './Piano';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Piano />
  </React.StrictMode>
);