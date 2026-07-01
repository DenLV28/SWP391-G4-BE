/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Main entry point - Parking User/Driver Portal only
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
