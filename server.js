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
  return (ma && ma[1]) ? (ma[1].replace(/,/g, '') | 0) : null;
}

function translateCommand(cmd, args){
  if(!cmd.match(`^<@!?${client.user.id}>$`)){
    return cmd;
  }
  if(args.length === 0){
    return '*bal';
  }else{
    if(args[0].match(/<@!?([0-9]*?)>/)){
      return '*transfer';
    }else if(args[0].startsWith('+')){
      return '*add';
    }else{
      return '*pay';
    }
  }
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
vtable['*help'] = async (uid) => {
  return 'ヘルプです。\n'
       + '*bal\n'
       + '  残高がみれます。\n'
       + '*add 金額\n'
       + '  口座に追加します。\n'
       + '*pay 金額\n'
       + '  残高から支払います。';
};
vtable['*transfer'] = async (uid, args) => {
  const wallet = await loadJson(uid);
  const parsed = parsePayment(args[1]);
  if(!parsed){
    return '金額が入力されていませんが…';
  }
  if(wallet.balance < parsed){
    return `お金が足りませんよ…のこり${wallet.balance.toLocaleString()}円しかありません…`;
  }
  const target = args[0].match(/<@!?([0-9]*?)>/);
  if(!target || !target[1]){
    return '送金先が見つかりません…';
  }
  const targetUid = target[1];
  if(uid === targetUid){
    return '送金先が同じですよ…';
  }
  const targetWallet = await loadJson(targetUid);
  wallet.balance -= parsed;
  wallet.transactions.push({action: 'transfer', amount: parsed, created_at: Date.now()});
  targetWallet.balance += parsed;
  targetWallet.transactions.push({action: 'receive', amount: parsed, created_at: Date.now()});
  await saveJson(uid, wallet);
  await saveJson(targetUid, targetWallet);
  return `${args[0]}へ${parsed.toLocaleString()}円送金しました。のこり${wallet.balance.toLocaleString()}円です。`;
};

client.on('ready', () => {
  console.log(`bot started. ${client.user.id}`);
});
 
client.on('message', async (message) => {
  const {cmd, args} = breakCommand(message.content);
  const uid = message.author.id;
  const translated = translateCommand(cmd, args);
  if(uid === client.user.id){
    console.log('status: filtered');
    return;
  }
  console.log(`message received: ${message.content}`);
  console.log(`cmd: ${cmd}, args: ${args.join(' ')}, uid: ${uid}, translated: ${translated}`);
  // execute command
  if(vtable[translated]){
    const resp = await vtable[translated](uid, args);
    console.log(`resp: ${resp}`);
    if(resp){
      message.reply(resp);
      console.log('status: sent');
    }
  }
});

client.on('error', () => {
  console.log('error');
});
 
client.login(process.env.CLIENT_TOKEN);
