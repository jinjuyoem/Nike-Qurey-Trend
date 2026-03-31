import { renderToStaticMarkup } from 'react-dom/server.browser';
import App from './src/App.jsx';
import React from 'react';

try {
  console.log('Rendering App...');
  renderToStaticMarkup(React.createElement(App));
  console.log('Success!');
} catch (e) {
  console.error('SERVER RENDER ERROR:', e);
}
