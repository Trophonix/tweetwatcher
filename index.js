Array.prototype.removeIf = function(condition) {
    var i = this.length;
    while (i--) {
        if (condition(this[i], i)) {
            this.splice(i, 1);
        }
    }
};

const fs = require('fs');

const Twitter = require('twit');
const Discord = require('discord.js');

const config = require('./config.json');

const twitter = new Twitter(config.twitter);
const watching = [];

function sendTweet(event, embed) {
    watching.filter(watcher => watcher.userID === event.user.id).forEach(watcher => {
        discord.channels.filter(channel => channel.id === watcher.channelID).forEach(channel => {
            channel.send({embed: embed}).catch(console.error);
        });
    });
}

const discord = new Discord.Client();

function setupStream() {
    if (watching.length > 0) {
        let stream = twitter.stream('statuses/filter', {
            follow: watching.map(watcher => watcher.userID)
        });
        stream.on('error', console.error);
        stream.on('tweet', event => {
            let embed = {
                color: config.colors.main,
                author: {
                    name: event.user.name,
                    icon_url: event.user.profile_image_url
                },
                description: event.text,
                url: 'https://twitter.com/' + event.user.screen_name + '/status/' + event.id_str,
                fields: []
            };
            if (event.in_reply_to_status_id_str) {
                twitter.get('statuses/show', {id: event.in_reply_to_status_id_str}, (error, tweet, res) => {
                    if (!error && tweet) {
                        embed.fields.push({
                            name: '@' + tweet.user.screen_name,
                            value: tweet.text
                        });
                    }
                    sendTweet(event, embed);
                });
            } else {
                sendTweet(event, embed);
            }
        });
    }
}

const Mongo = require('mongoose');
require('./models');
const Watcher = Mongo.model('watcher');

discord.on('ready', () => {
    console.log('Happy birthday!');
});

discord.on('message', event => {
    let message = event.content;
    if (message.startsWith(config.prefix)) {
        message = message.replace(config.prefix, '');
        let args = message.split(' ');
        let command = args[0];
        args.splice(0, 1);
        switch (command.toLowerCase()) {
            case 'watch':
                if (args.length == 1) {
                    let name = args[0];
                    if (name.startsWith('@')) name = name.replace('@', '');
                    twitter.get('users/show', {screen_name: name}, (error, account, res) => {
                        if (!error && account) {
                            let data = {
                                twitter_id: account.id_str,
                                channel_id: event.channel.id,
                                guild_id: event.guild.id
                            };
                            Watcher.findOne(data, (err, watcher) => {
                                if (watcher) {
                                    event.reply('I\'m already watching ' + account.name + ' in ' + event.channel);
                                } else {
                                    let watcher = new Watcher(data);
                                    watcher.save((err) => {
                                        if (err) {
                                            event.reply('Something went wrong!');
                                            console.error(err);
                                        } else {
                                            setupStream();
                                            event.reply('I am now watching ' + account.name + ' in ' + event.channel);
                                        }
                                    });
                                }
                            });
                        } else {
                            event.reply('User not found: @' + name);
                        }
                    });
                } else {
                    event.reply('Error! Usage: `' + config.prefix + 'watch @<screenname>`')
                }
                break;
            case 'unwatch':
                if (args.length == 1) {
                    let name = args[0];
                    if (name.startsWith('@')) name = name.replace('@', '');
                    twitter.get('users/show', {screen_name: name}, (error, account, res) => {
                        if (!error && account) {
                            Watcher.remove({ twitter_id: account.id_str, channel_id: event.channel.id }, (err) => {
                                if (err) {
                                    event.reply('Something went wrong!');
                                    console.error(err);
                                    return;
                                }
                                setupStream();
                                event.reply('I am no longer watching ' + account.name + ' in ' + event.channel);
                            });
                        } else {
                            event.reply('User not found: @' + name);
                        }
                    });
                } else {
                    event.reply('Error! Usage: `' + config.prefix + 'watch @<screenname>`')
                }
                break;
            case 'list':
                mongo.find({ channel_id: event.channel.id }, (err, watchers) => {
                    if (err) {
                        event.reply('Something went wrong!');
                        console.error(err);
                        return;
                    }
                    let query = watchers.map(watcher => watcher.twitter_id);
                    if (query.length == 0) {
                        event.reply('No accounts are being watched in this channel! Use `' + config.prefix + 'help` for more information.');
                        return;
                    }
                    if (query.length > 100) {
                        query.length = 100;
                    }
                    twitter.post('users/lookup', { user_id: query }, (error, accounts, res) => {
                        if (error || !accounts) {
                            event.reply('Something went wrong!');
                            console.error(error);
                            return;
                        }
                        event.reply('Accounts being watched in ' + event.channel + ':\n' +
                            accounts.map(account => '`@' + account.screen_name + '`').join(', '));
                    });
                });
                break;
            case 'help':
                event.guild.fetchMember(event.author).then(
                    (member) => {
                        let name = member.nickname || event.author.username;
                        event.channel.send({embed: {
                            color: config.colors.main,
                            title: 'TweetWatcher Command Index',
                            description: 'TweetWatcher is a simple bot created by Lucas#5300 to watch tweets from users and display them in discord!',
                            footer: {
                                icon_url: event.author.avatarURL,
                                text: 'Requested by ' + name  
                            },
                            fields: [
                                {
                                    name: config.prefix + 'help',
                                    value: 'Display this help message'
                                },
                                {
                                    name: config.prefix + 'watch @<screenname> [channel]',
                                    value: 'Enable watcher for a twitter account in current [or another] channel'
                                },
                                {
                                    name: config.prefix + 'unwatch @<screenname>',
                                    value: 'Disable watcher for a twitter account in current [or another] channel'
                                },
                                {
                                    name: config.prefix + 'list',
                                    value: 'List all watchers for current [or another] channel'
                                }
                            ]
                        }});
                    },
                    console.error
                ).catch(console.error);
                break;
        }
    }
});

discord.login(config.token);