const Mongo = require('mongoose');
const Schema = Mongo.Schema;
const ObjectId = Schema.ObjectId;

const Discord = require('discord.js');
const Snowflake = Discord.Snowflake;

var Watcher = new Schema({
    twitter_id: String,
    channel_id: String,
    guild_id: String
});

Mongo.model('watcher', Watcher);