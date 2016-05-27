var firebase = require('firebase');
var areWordsShiritoriCompliant = require('./shiritori-compliance.js');

firebase.initializeApp({
  serviceAccount: __dirname + '/shiritori-kun-332ae0b49b2d.json',
  databaseURL: 'https://shiritori-kun.firebaseio.com/'
});

var db = firebase.database();
var ref = db.ref('words');
var bot;

function MainCtl (appBot) {
  bot = appBot;
}

MainCtl.prototype.handleCommand = handleCommand;
MainCtl.prototype.handleJapaneseWord = handleJapaneseWord;
MainCtl.prototype.getTime = getTime;
MainCtl.prototype.firebase = firebase;

var commands = [
  {
    command: 'remove',
    description: 'Removes a japanese word.',
    parameters: ['word'],
    permissions: ['serverop', 'resident'],
    execute: function (message, params) {
      if (message.channel.server) {
        ref.child(message.channel.server.id + '/' + params[1]).remove(function (error) {
          if (error) {
            bot.sendMessage(message.channel, 'Word not in database: ' + params[1]);
          } else {
            console.log(getTime() + message.author.username + ' -> Japanese word removed from db: ' + params[1]);
            bot.sendMessage(message.channel, 'Japanese word removed from db: ' + params[1]);
          }
        });
      }
    }
  },
  {
    command: 'reset',
    description: 'Resets the db of words.',
    parameters: ['force'],
    permissions: ['serverop'],
    execute: function (message, params) {
      if (params[1] == 'force') {
        ref.child(message.channel.server.id).remove(function (error) {
          if (error) {
            bot.sendMessage(message.channel, 'Could not reset.');
          } else {
            console.log(getTime() + message.author.username + ' -> Database of words reseted.');
            bot.sendMessage(message.channel, 'Database of words reseted.');
          }
        });
      }
    }
  },
  {
    command: 'ping',
    description: 'Shows the channel where the bot will currently send stuff.',
    parameters: [],
    permissions: ['resident'],
    execute: function (message, params) {
      bot.sendMessage(message.channel, 'Pong.');
    }
  }
];

function hasPermission (server, user, command) {
  var permissions = command.permissions;

  if (permissions.length == 0) {
    return true;
  }

  if (server) {
    for (i in bot.servers) {
      var userRoles = bot.servers.get('id', server.id).rolesOfUser(user);

      for (var i = 0; i < userRoles.length; i++) {
        if (permissions.findIndex((el) => el === userRoles[i].name.toLowerCase()) !== -1) {
          return true;
        }
      }
    }
  }

  return false;
}

function searchCommand (command) {
  for (var i = 0; i < commands.length; i++) {
    if (commands[i].command == command.toLowerCase()) {
      return commands[i];
    }
  }

  return false;
}

function handleCommand (message, command) {
  console.log(getTime() + message.author.username + ' -> ' + command);
  var params = command.split(' ');
  var com = searchCommand(params[0]);

  if (com) {
    if (!hasPermission(message.channel.server, message.author, com)) {
      bot.reply(message, "Sorry, you don't have the permission to use that command.");
    } else if (params.length - 1 < com.parameters.length) {
      bot.reply(message, 'Insufficient parameters. This command accepts ' + com.parameters.length + ' parameters: ' + com.parameters.join());
    } else {
      com.execute(message, params);
    }
  } else {
    var availableCommands = '';
    for (i in commands) {
      availableCommands += '.' + commands[i].command + ' ';
      for (j in commands[i].parameters) {
        availableCommands += commands[i].parameters[j] + ' ';
      }
      availableCommands += ' => ' + commands[i].description + ' Available to: ' + commands[i].permissions.join() + '\n';
    }

    bot.reply(message, 'Unknown command: "' + params[0] + '"');
    bot.sendMessage(message.channel, 'List of available commands:\n' + availableCommands);
  }
}

function getTime () {
  function f (x) {
    return x < 10 ? '0' + x : x;
  }
  var date = new Date();
  return '[' + f(date.getHours()) + ':' + f(date.getMinutes()) + ':' + f(date.getSeconds()) + '] ';
}

function handleJapaneseWord (message) {
  // detect any japanese word at the beginning of a sentence
  var detectedWord = message.content.match(/^([\u3005\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+)[\u3000-\u3004\u3006-\u303f ]*([\u3040-\u309f\u30a0-\u30ff]+)*[\u3000-\u3004\u3006-\u303f ]*(.*)/);
  if (detectedWord) {
    console.log(getTime() + message.author.username + ' -> Japanese word detected in server: ' + message.channel.server.id + ' #' + message.channel.name);

    ref.child(message.channel.server.id + '/' + detectedWord[1]).once('value', function (snap) {
      if (snap.exists()) {
        var lastWordFound = snap.val();
        lastWordFound.word = snap.key;
        console.log(getTime() + message.author.username + ' -> Word found on database: ' + lastWordFound.word);

        ref.child(message.channel.server.id).orderByChild('order').limitToLast(1).once('value', function (snap) {
          if (snap.exists()) {
            var key = Object.keys(snap.val())[0];
            var row = snap.val()[key];
            row.word = key;
            bot.sendMessage(message.channel, 'Word ' + lastWordFound.word + ' already used [ Reading: ' + lastWordFound.reading +
              ' Meaning: ' + lastWordFound.meaning + ' ].\nLast word: ' + row.word + ' [ Reading: ' + row.reading + ' Meaning: ' + row.meaning + ' ].');
          } else {
            bot.sendMessage(message.channel, 'Word ' + lastWordFound.word + ' already used [ Reading: ' + lastWordFound.reading +
              ' Meaning: ' + lastWordFound.meaning + ' ].');
          }
        });
      } else {
        var word = detectedWord[1];
        var reading = detectedWord[2] || detectedWord[1];
        var meaning = detectedWord[3];

        ref.child(message.channel.server.id).orderByChild('order').limitToLast(1).once('value', function (snap) {
          var order = 1;
          if (snap.exists()) {
            var key = Object.keys(snap.val())[0];
            order = snap.val()[key].order + 1;
            var previousWord = snap.val()[key];
          }
          if (!snap.exists() || areWordsShiritoriCompliant(previousWord.reading, reading)) {
            ref.transaction(function (words) {
              if (!words) {
                var words = {};
              }
              if (!words[message.channel.server.id]) {
                words[message.channel.server.id] = {};
              }
              if (!words[message.channel.server.id][word]) {
                words[message.channel.server.id][word] = {
                  order: order,
                  spelling: word,
                  reading: reading,
                  meaning: meaning,
                  server_id: message.channel.server.id
                };
              }
              return words;
            }, function (error, committed, snapshot) {
              if (!error) {
                console.log(getTime() + message.author.username + ' -> Japanese word added to db: ' + word + ', ' + reading + ', ' + meaning);
              }
            });
          } else {
            bot.sendMessage(message.channel, 'Word ' + word + ' not allowed, \nPrevious word: ' + previousWord.spelling + ' [ Reading: ' + previousWord.reading + ' Meaning: ' + previousWord.meaning + ' ].');
          }
        });
      }
    });
  }
}

module.exports = MainCtl;