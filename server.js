'use strict';

const fs = require('fs')
    , path = require('path');

const Discord = require('discord.js')
    , client = new Discord.Client();

const DataPath = path.join(process.env.DATA_PATH || __dirname);

function breakCommand(str){
  const commands = str.split(/\s+/);
  return {
    cmd: commands[0],
    args: commands.slice(1),
  };
}

function loadJson(uid){
  return new Promise(resolve => {
    fs.readFile(path.join(DataPath, `${uid}.json`), 'utf8', (err, data) => {
      resolve(err ? {balance: 0, transactions: []} : JSON.parse(data));
    });
  });
}

function saveJson(uid, data){
  return new Promise(resolve => {
    fs.writeFile(path.join(DataPath, `${uid}.json`), JSON.stringify(data), (err, data) => {
      resolve(null);
    });
  });
}

function parsePayment(arg){
  const re = /^\+?(?:\\|¥)?([0-9,]+)(?:円|(?:えん)?)$/;
  const ma = (arg || '').match(re);
  return (ma && ma[1]) ? (ma[1].replace(',', '') | 0) : null;
}

const vtable = {};
vtable['*bal'] = async (uid, args) => {
  const wallet = await loadJson(uid);
  return `のこり、${(wallet.balance || 0).toLocaleString()}円です`;
};
vtable['*add'] = async (uid, args) => {
  const wallet = await loadJson(uid);
  const parsed = parsePayment(args[0]);
  if(!parsed){
    return '金額が入力されていませんが…';
  }
  wallet.balance += parsed;
  wallet.transactions.push({action: 'add', amount: parsed, created_at: Date.now()});
  await saveJson(uid, wallet);
  return `${parsed.toLocaleString()}円受け取りました。のこり${wallet.balance.toLocaleString()}円です。`;

};
vtable['*pay'] = async (uid, args) => {
  const wallet = await loadJson(uid);
  const parsed = parsePayment(args[0]);
  if(!parsed){
    return '金額が入力されていませんが…';
  }
  if(wallet.balance < parsed){
    return `お金が足りませんよ…のこり${wallet.balance.toLocaleString()}円しかありません…`;
  }
  wallet.balance -= parsed;
  wallet.transactions.push({action: 'pay', amount: parsed, created_at: Date.now()});
  await saveJson(uid, wallet);
  return `${parsed.toLocaleString()}円ですね。のこり${wallet.balance.toLocaleString()}円です。`;
};
vtable['*total'] = async(uid) => {
  const wallet = await loadJson(uid);
  let amount = wallet.transactions.reduce((acc, cur) => {
    if(cur.action !== 'pay') return acc;
    return acc + cur.amount;
  }, 0);
  return `これまで${amount}円つかったみたいです。ありがとうございます。`;
};

client.on('ready', () => {
  console.log(`bot started. ${client.user.id}`);
});
 
client.on('message', async (message) => {
  let {cmd, args} = breakCommand(message.content);
  const uid = message.author.id;
  parsePayment(args[0]);
  // parse @ message
  if(cmd == `<@${client.user.id}>`){
    if(args.length === 0){
      cmd = '*bal';
    }else{
      if(args[0].startsWith('+')){
        cmd = '*add';
      }else{
        cmd = '*pay';
      }
    }
  }
  // execute command
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
