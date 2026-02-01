import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'
dotenv.config()

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        console.error('No GEMINI_API_KEY found in environment')
        return
    }

    console.log('Testing connection with model: gemini-2.5-flash')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    try {
        const result = await model.generateContent('Hello, are you there?')
        const response = await result.response
        console.log('Success! Response:', response.text())
    } catch (error) {
        console.error('Error connecting to Gemini:', error.message)

        console.log('\n--- Retrying with gemini-1.5-flash for comparison ---')
        try {
            const modelBackup = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
            const resultBackup = await modelBackup.generateContent('Hello, are you there?')
            console.log('Success with 1.5-flash:', resultBackup.response.text())
        } catch (e2) {
            console.error('Error with gemini-1.5-flash:', e2.message)
        }
    }
}

testGemini()
