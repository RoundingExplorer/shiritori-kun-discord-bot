require('dotenv').config({path: __dirname + '/.env'});

var Discord = require('discord.js');
var MainCtl = require('./main-ctl.js');

var bot = new Discord.Client();
var mainCtl = new MainCtl(bot);

function stopBot () {
  bot.destroy((err) => {
    process.exit()
  });
}

bot.on('ready', () => {
  console.log('Ready!');
  console.log('Servers joined: ' + bot.servers.map(function (server) {
      return server.name + ',' + server.id + ';';
    }));
});

bot.on('message', (message) => {
  if (message.channel.name == 'shiritori') {
    if (message.content[0] == '.') {
      mainCtl.handleCommand(message, message.content.substring(1));
    }

    mainCtl.handleJapaneseWord(message);
  }
});

bot.on('disconnected', () => {
  console.log(mainCtl.getTime() + ' bot disconnected. Reconnecting.');
  bot.loginWithToken(process.env.BOT_TOKEN);
});

bot.loginWithToken(process.env.BOT_TOKEN);

process.on('SIGINT', stopBot);
process.on('SIGTERM', stopBot);
