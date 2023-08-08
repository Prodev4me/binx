const { Configuration, OpenAIApi } = require('openai')

module.exports = {
    name: 'chatgpt',
    aliases: ['gpt', 'binxgpt'],
    category: 'utils',
    exp: 5,
    description: 'Talk to chatGPT on WhatsApp',
    async execute(client, flag, arg, M) {
        const { apiKey, messagesMap } = client
        if (!arg) return M.reply('Provide your prompt to make request!')
        if (!apiKey) return M.reply('API key is missing. Please make sure to provide a valid API key.')
        try {
            const ai = new OpenAIApi(new Configuration({ apiKey }))
            const messages = messagesMap.get(M.from) ?? []
            if (!messages.length)
                messages.push({
                    role: 'system',
                    content: `Roleplay as Binx AI develop by TEKCIFY 💜😌, You're much friendly and talk with emotions also use emojis as much as possible.
            `
                })
            messages.push({
                role: 'user',
                content: `${M.sender}: ${arg.trim()}`
            })
            const response = await ai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages
            })
            const res = response.data.choices[0]?.message
            if (!res) return void M.reply('An error occured')
            messages.push(res)
            messagesMap.set(M.from, messages)
            await M.reply(res.content)
        } catch (error) {
            client.log(error.message, 'red')
            return void (await M.reply(
                error?.response?.data?.error?.message ?? 'An error occurred while processing the request.'
            ))
        }
    }
}
