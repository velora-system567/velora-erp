/**
 * Vercel serverless entry point.
 * Exports the Express app as a serverless function for Vercel.
 */
import { app } from "../backend/src/app.js";

export default app;
