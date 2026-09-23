
import './instrumentation.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
createApp().listen(port, '0.0.0.0', () => {
  console.log(`AADB Product Analytics listening on ${port}`);
});