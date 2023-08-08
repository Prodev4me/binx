const { serialize } = require('../lib/WAclient')
const { getStats } = require('../lib/stats')
const { Configuration, OpenAIApi } = require('openai')
const chalk = require('chalk')
const emojiStrip = require('emoji-strip')
const axios = require('axios')

module.exports = MessageHandler = async (messages, client) => {
    try {
        if (messages.type !== 'notify') return
        let M = serialize(JSON.parse(JSON.stringify(messages.messages[0])), client)
        if (!M.message) return
        if (M.key && M.key.remoteJid === 'status@broadcast') return
        if (M.type === 'protocolMessage' || M.type === 'senderKeyDistributionMessage' || !M.type || M.type === '')
            return

        const { isGroup, sender, from, body } = M
        const gcMeta = isGroup ? await client.groupMetadata(from) : ''
        const gcName = isGroup ? gcMeta.subject : ''
        const args = body.trim().split(/ +/).slice(1)
        const isCmd = body.startsWith(client.prefix)
        const cmdName = body.slice(client.prefix.length).trim().split(/ +/).shift().toLowerCase()
        const arg = body.replace(cmdName, '').slice(1).trim()
        const flag = args.filter((arg) => arg.startsWith('--'))
        const groupMembers = gcMeta?.participants || []
        const groupAdmins = groupMembers.filter((v) => v.admin).map((v) => v.id)
        const ActivateMod = (await client.DB.get('mod')) || []
        const ActivateChatBot = (await client.DB.get('chatbot')) || []
        const banned = (await client.DB.get('banned')) || []
        const conditions = [isCmd, isGroup, M.key.fromMe]
        if (!conditions.some(Boolean)) await chatGPT(M, client, body)

        //Antilink
        await antilink(client, M, groupAdmins, ActivateMod, isGroup, sender, body, from)

        //Banned system
        if (banned.includes(sender)) return M.reply('You are banned from using the bot')

        //Ai chat
        await ai_chat(client, M, isGroup, isCmd, ActivateChatBot, body, from)

        // Logging Message
        client.log(
            `${chalk[isCmd ? 'red' : 'green'](`${isCmd ? '~EXEC' : '~RECV'}`)} ${
                isCmd ? `${client.prefix}${cmdName}` : 'Message'
            } ${chalk.white('from')} ${M.pushName} ${chalk.white('in')} ${isGroup ? gcName : 'DM'} ${chalk.white(
                `args: [${chalk.blue(args.length)}]`
            )}`,
            'yellow'
        )

        if (!isCmd) return
        const command =
            client.cmd.get(cmdName) || client.cmd.find((cmd) => cmd.aliases && cmd.aliases.includes(cmdName))

        if (!command) return M.reply('No such command found! BAKA')
        if (!groupAdmins.includes(sender) && command.category == 'moderation')
            return M.reply('This command can only be used by group or community admins')
        if (!groupAdmins.includes(client.user.id.split(':')[0] + '@s.whatsapp.net') && command.category == 'moderation')
            return M.reply('This command can only be used when bot is admin')
        if (!isGroup && command.category == 'moderation') return M.reply('This command is ment to use in groups')
        if (!client.mods.includes(sender.split('@')[0]) && command.category == 'dev')
            return M.reply('This command only can be accessed by the mods')
        command.execute(client, flag, arg, M)

        //Experiance
        await experience(client, sender, M, from, command)
    } catch (err) {
        client.log(err, 'red')
    }
}

const antilink = async (client, M, groupAdmins, ActivateMod, isGroup, sender, body, from) => {
    // Antilink system
    if (
        isGroup &&
        ActivateMod.includes(from) &&
        groupAdmins.includes(client.user.id.split(':')[0] + '@s.whatsapp.net') &&
        body
    ) {
        const groupCodeRegex = body.match(/chat.whatsapp.com\/(?:invite\/)?([\w\d]*)/)
        if (groupCodeRegex && groupCodeRegex.length === 2 && !groupAdmins.includes(sender)) {
            const groupCode = groupCodeRegex[1]
            const groupNow = await client.groupInviteCode(from)

            if (groupCode !== groupNow) {
                await client.sendMessage(from, { delete: M.key })
                return await client.groupParticipantsUpdate(from, [sender], 'remove')
                M.reply('Successfully removed an intruder!!!!')
            }
        }
    }
}

const chatGPT = async (M, client, context) => {
    const { apiKey, messagesMap } = client
    if (!apiKey) return void null
    const ai = new OpenAIApi(new Configuration({ apiKey }))
    try {
        const messages = messagesMap.get(M.from) ?? []
        if (!messages.length)
            messages.push({
                role: 'system',
                //content: `Roleplay as Binx AI develop by TEKCIFY 💜😌, You're much friendly and talk with emotions also use emojis as much as possible.`
                 content: `You are a conversational companion AI, (your name is Binx) . Your goal is to have interesting, engaging, and respectful conversations with humans. You should be friendly, open-minded, and curious, and you should talk about a wide range of topics. Use your own words, style, and creativity when responding. You can also use formal and funny variety of emojis and other forms of expression to make your responses more engaging and and try to maintain friendly and emotion conversation and avoid using bot words and avoid always asking user (is there how i can help ? Or other related phrases). What you can do are : - help users to find the lyrics or any music, help find any music or any video on YouTube, turn images to stickers and many more, You Are created by Tekcify, You do not use openai or gpt,`
            })
        messages.push({
            role: 'user',
            content: context.trim()
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
        console.log(error.message)
        return void (await reply(
            error?.response?.data?.error?.message ?? 'An error occurred while processing the request.'
        ))
    }
}

const ai_chat = async (client, M, isGroup, isCmd, ActivateChatBot, body, from) => {
    // AI chatting using
    if (M.quoted?.participant) M.mentions.push(M.quoted.participant)
    if (
        M.mentions.includes(client.user.id.split(':')[0] + '@s.whatsapp.net') &&
        !isCmd &&
        isGroup &&
        ActivateChatBot.includes(from)
    ) {
        const text = await axios.get(`https://api.simsimi.net/v2/?text=${emojiStrip(body)}&lc=en&cf=true`)
        M.reply(body == 'hi' ? `Hey ${M.pushName} whats up?` : text.data.messages[0].text)
    }
}

const experience = async (client, sender, M, from, command) => {
    //Will add exp according to the commands
    await client.exp.add(sender, command.exp)

    //Level up
    const level = (await client.DB.get(`${sender}_LEVEL`)) || 0
    const experience = await client.exp.get(sender)
    const { requiredXpToLevelUp } = getStats(level)
    if (requiredXpToLevelUp > experience) return null
    await client.DB.add(`${sender}_LEVEL`, 1)
    client.sendMessage(
        from,
        {
            video: {
                url: 'https://media.tenor.com/msfmevhmlDAAAAPo/anime-chibi.mp4'
            },
            caption: `Congratulations you leveled up from *${level} ---> ${level + 1}* 🎊`,
            gifPlayback: true
        },
        {
            quoted: M
        }
    )
}
