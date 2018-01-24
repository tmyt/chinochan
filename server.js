'use strict';

const fs = require('fs')
    , path = require('path');

const Discord = require('discord.js')
    , client = new Discord.Client();

const DataPath = path.join(process.env.DATA_PATH || __dirname, 'wallet.json');

function breakCommand(str){
  const commands = str.split(/\s+/);
  return {
    cmd: commands[0],
    args: commands.slice(1),
  };
}

function loadJson(){
  return new Promise(resolve => {
    fs.readFile(DataPath, 'utf8', (err, data) => {
      resolve(err ? {} : JSON.parse(data));
    });
  });
}

function saveJson(data){
  return new Promise(resolve => {
    fs.writeFile(DataPath, JSON.stringify(data), (err, data) => {
      resolve(null);
    });
  });
}

function parsePayment(arg){
  const re = /^(?:\\|¥)?([0-9,]+)(?:円|(?:えん)?)$/;
  const ma = (arg || '').match(re);
  return (ma && ma[1]) ? (ma[1].replace(',', '') | 0) : null;
}

const vtable = {};
vtable['*bal'] = async (uid, args) => {
  const wallet = await loadJson();
  return `のこり、${(wallet[uid] || 0).toLocaleString()}円です`;
};
vtable['*add'] = async (uid, args) => {
  const wallet = await loadJson();
  let balance = wallet[uid] || 0;
  const parsed = parsePayment(args[0]);
  if(!parsed){
    return '金額が入力されていませんが…';
  }
  wallet[uid] = (balance += parsed);
  await saveJson(wallet);
  return `${parsed.toLocaleString()}円受け取りました。のこり${balance.toLocaleString()}円です。`;

};
vtable['*pay'] = async (uid, args) => {
  const wallet = await loadJson();
  const parsed = parsePayment(args[0]);
  let balance = wallet[uid] || 0;
  if(!parsed){
    return '金額が入力されていませんが…';
  }
  if(balance < parsed){
    return `お金が足りませんよ…のこり${balance.toLocaleString()}円しかありません…`;
  }
  wallet[uid] = balance -= parsed;
  await saveJson(wallet);
  return `${parsed.toLocaleString()}円ですね。のこり${balance.toLocaleString()}円です。`;
};

client.on('ready', () => {
  console.log('I am ready!');
});
 
client.on('message', async (message) => {
  const {cmd, args} = breakCommand(message.content);
  const uid = message.author.id;
  parsePayment(args[0]);
  if(vtable[cmd]){
    const resp = await vtable[cmd](uid, args);
    if(resp){
      message.reply(resp);
    }
  }
});

client.on('error', () => {
  console.log('error');
});
 
client.login(process.env.CLIENT_TOKEN);
