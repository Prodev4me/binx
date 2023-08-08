const { delay } = require('@whiskeysockets/baileys')

module.exports = {
    name: 'broadcast',
    aliases: ['bc'],
    category: 'dev',
    exp: 0,
    description: 'Will make a broadcast for groups where the bot is in. Can be used to make announcements',
    async execute(client, flag, arg, M) {
        if (!arg) return M.reply('No query provided!')
        let type = 'text'
        let buffer
        let group = true
        let results = await client.getAllGroups()
        if (flag.includes('--users')) {
            arg = arg.replace('--users', '')
            group = false
            results = await client.getAllUsers()
        }
        if (M.messageTypes(M.type)) {
            type = M.type.replace('Message', '')
            buffer = await M.download()
        } else if (M.quoted && M.messageTypes(M.quoted.mtype)) {
            type = M.quoted.mtype.replace('Message', '')
            buffer = await M.quoted.download()
        }
        const text = `*「 ${client.name.toUpperCase()} BROADCAST 」*\n\n${arg}\n\n*Regards: TEKCIFY TECH* 💜`
        for (const result of results) {
            await delay(5000)
            await client.sendMessage(result, {
                [type]: type === 'text' ? text : buffer,
                caption: type === 'text' ? undefined : text,
                gifPlayback: type === 'video' ? true : undefined,
                mentions: group ? (await client.groupMetadata(result)).participants.map((x) => x.id) : []
            })
        }
        M.reply(`🟩 Successfully Broadcast in ${results.length} ${group ? 'groups' : 'DMs'}`)
    }
}
