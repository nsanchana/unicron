export default async function handler(req, res) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const nodeEnv = process.env.NODE_ENV

  res.status(200).json({
    hasAnthropicKey: !!anthropicKey,
    keyLength: anthropicKey ? anthropicKey.length : 0,
    keyPrefix: anthropicKey ? anthropicKey.substring(0, 10) + '...' : 'not set',
    nodeEnv: nodeEnv,
    allEnvKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('TOKEN'))
  })
}
