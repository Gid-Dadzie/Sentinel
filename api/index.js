// Vercel serves every /api/* request through this function (see vercel.json). The API is
// bundled by `npm run build -w @sentinel/server` into server/dist/vercel.js.
export { default } from '../server/dist/vercel.js';
