import { kv } from '@vercel/kv'

export default async function handler(req, res) {
    // Allow debugging from browser
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')

    try {
        const envStatus = {
            KV_REST_API_URL: process.env.KV_REST_API_URL ? 'Set' : 'Missing',
            KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'Set' : 'Missing'
        }

        // List all keys available in process.env (masking values)
        const availableEnvKeys = Object.keys(process.env).sort();

        // Check specific Vercel vars
        const vercelVars = {
            VERCEL: process.env.VERCEL,
            VERCEL_ENV: process.env.VERCEL_ENV,
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_PROJECT_NAME: process.env.VERCEL_PROJECT_NAME,
            VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
            VERCEL_URL: process.env.VERCEL_URL
        };

        // Attempt simple KV operation
        let kvOperation = 'Pending'
        let kvResult = null

        try {
            // Write
            await kv.set('debug:ping', 'pong_' + Date.now())
            // Read
            kvResult = await kv.get('debug:ping')
            kvOperation = kvResult && kvResult.startsWith('pong_') ? 'Success' : 'Failed'
        } catch (e) {
            kvOperation = `Error: ${e.message}`
        }

        res.status(200).json({
            status: kvOperation === 'Success' ? 'Online' : 'Error',
            environment: envStatus,
            availableEnvKeys,
            vercelContext: vercelVars,
            connectionTest: kvOperation,
            lastResult: kvResult,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        res.status(500).json({
            error: 'Debug script failed',
            details: error.message
        })
    }
}
