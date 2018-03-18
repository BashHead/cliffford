// Packages required
const Discord = require('discord.js');
const mysql = require('mysql');

const token = '';
const channels = {serverfarm: '', book: '', table: ''};

const client = new Discord.Client({messageCacheMaxSize: 500});

client.on('ready', () => {
  console.log('ready!');
});

client.login(token);

class tempMessage{
  constructor(msg, channel){
    client.channels.get(channels[channel]).send(msg)
    .then(msg=>{
      msg.delete(3000)
    }).catch();
  }
}


class DB{
  // Constructor
  constructor(){
    this.con = mysql.createConnection({
      host: "",
      user: "",
      password: "",
      database: ""
    });
    this.con.connect(function(err) {
      if(err) throw err;
    });
    this.getVar(function(result){
      return;
    });
  }

  getLastCheckedID(callback){
    this.con.query("SELECT * FROM `Cliffford`", function(err, result, fields){
      if (err) throw err;
      return callback(JSON.parse(JSON.stringify(result))[0].lastCheckedID);
    });
  }

  updateLastCheckedID(newOne){
    this.con.query("UPDATE `Cliffford` SET `lastCheckedID` = '" + newOne + "'", function(err, result, fields){
      if (err) throw err;
      return;
    });
  }

  // Functions
  getVar(callback){
    this.con.query("SELECT lead_id,field_number,value FROM wp_rg_lead_detail ORDER BY id DESC", function(err, result, fields){
      if (err) throw err;
      return callback(JSON.parse(JSON.stringify(result)));
    });
  }

  newApplications(lastCheckedID, callback){
    this.getVar(function(dbResult){
      let res = [];
      if(dbResult.length == 0 || dbResult[0].lead_id <= lastCheckedID) return res;
      for(let i = 0; i*4 < dbResult.length; i++){
        if(dbResult[i*4].lead_id > lastCheckedID){
          res[i] = {};
          for(let j = i*4; j < i*4+4; j++){
            if(dbResult[j].field_number == 1)
              res[i].gta = dbResult[j].value;
            if(dbResult[j].field_number == 2)
              res[i].invited = dbResult[j].value;
            if(dbResult[j].field_number == 7)
              res[i].discord = dbResult[j].value;
          }
        }
      }
      db.updateLastCheckedID(dbResult[0].lead_id);
      callback(res);
    });
  }


  // Voting on #the-table commands
  update(smiley, name){
    this.con.query("UPDATE `Cliffford_table` SET `name` = '" + name + "' WHERE smiley='" + smiley + "'", function(err, result, fields){
      if (err){
        new tempMessage('Failed: database error.', 'table');
        throw err;
      }
      return;
    });
  }
  del(smiley){
    this.con.query("DELETE FROM `Cliffford_table` WHERE `smiley` = '" + smiley + "'", function(err, result, fields){
      if (err){
        new tempMessage('Failed: database error.', 'table');
        throw err;
      }
      return;
    });
  }
  add(Smiley, IsPos, Name){
    this.con.query("INSERT INTO `Cliffford_table` (smiley, isPositive, name) VALUES ('"+Smiley+"', '"+IsPos+"', '"+Name+"')", function(err, result, fields){
      if (err){
        new tempMessage('Failed: database error.', 'table');
        throw err;
      }
      return;
    });
  }

  getPosNeg(callback){
    this.con.query("SELECT smiley,isPositive,name FROM `Cliffford_table`", function(err, result, fields){
      if (err){
        new tempMessage('Failed: database error.', 'table');
        throw err;
        return;
      }
      let resRaw = JSON.parse(JSON.stringify(result));
      let res = {};
      res.smileys = [];
      res.isPos = [];
      res.names = [];
      for(let i=0; i<resRaw.length; i++){
        res.smileys[i] = resRaw[i].smiley;
        res.names[i] = resRaw[i].name;
        res.isPos[i] = resRaw[i].isPositive;
      }
      return callback(res);
    });
  }
}
var db = new DB();


client.on('message', message => {
  if(message.content === '!checkprospects'){
    console.log('did recieve it');
    new tempMessage('Update: pending...', 'book');
    check();
    new tempMessage('Succes: done.', 'book');
    message.delete(2000);
  }

  if(message.content.substr(0,10) == '!db update'){
    let t = message.content.split(" ");
    new tempMessage('Update: pending...', 'table');
    if(t.length != 4 || !(/^[a-zA-Z\s]*$/.test(message.content.substr(1)))){
      new tempMessage('Failed: invalid arguments. Type !db update {smiley code} {persons name}', 'table');
      return;
    }
    db.update(t[2], t[3]);
    new tempMessage('Succes: done.', 'table');
    message.delete(5000);
  }

  if(message.content.substr(0,10) == '!db delete'){
    new tempMessage('Update: pending...', 'table');
    if(message.content.length < 12 || !(/^[a-zA-Z\s]*$/.test(message.content.substr(1)))){
      new tempMessage('Failed: invalid arguments. Type !db delete {smiley code}', 'table');
      return;
    }
    db.del(message.content.substr(11));
    new tempMessage('Succes: done.', 'table');
    message.delete(5000);
  }

  if(message.content.substr(0,7) == '!db add'){
    let t = message.content.split(" ");
    new tempMessage('Update: pending...', 'table');
    if(t.length != 5 || !(/^[a-zA-Z\s]*$/.test(message.content.substr(1)))){
      new tempMessage('Failed: invalid arguments. Type !db add {smiley code} {is positive (true|false)} {persons name}', 'table');
      return;
    }
    db.add(t[2], t[3], t[4]);
    new tempMessage('Succes: done.', 'table');
    message.delete(5000);
  }
});


// If someone add a smiley to a vote in #the-table
client.on('messageReactionAdd', (reaction, user) => {
  if(reaction.message.channel.id != channels.table){
    return;
  }
  db.getPosNeg(function(result){
    let reac = reaction.message.reactions.keyArray();
    let posCount = 0;
    let passed = [];
    let negCount = 0;
    let failed = [];
    for(let i = 0; i < reac.length; i++){
      let s = reac[i].split(':')[0];
      let loc = result.smileys.indexOf(s);
      if(loc != -1){
        if(result.isPos[loc] == 'true'){
          posCount++;
          passed.push(result.names[loc]);
        }
        if(result.isPos[loc] == 'false'){
          negCount++;
          failed.push(result.names[loc]);
        }
      }
    }
    if(posCount >= 4){
      client.channels.get(channels.table).send('```Commissioners voted on:\n' + reaction.message.content.substr(3,reaction.message.content.length-6) + '\n\nThis voted passed by: ' + passed.join(', ') + '.\nVoted negative: ' + ((failed.length > 0)?failed.join(', '):'-')+'.```');
      reaction.message.delete(2000);
    }
    if(negCount >= 4 || posCount == 3 && negCount == 3){
      client.channels.get(channels.table).send('```Commissioners voted on:\n' + reaction.message.content.substr(3,reaction.message.content.length-6) + '\n\nThis voted failed by: ' + failed.join(', ') + '.\nVoted positive: ' + ((passed.length > 0)?passed.join(', '):'-')+'.```');
      reaction.message.delete(2000);
    }
  });
});

function check(){
  db.getLastCheckedID(function(lastCheckedID){
    db.newApplications(lastCheckedID, function(pp){
      for(let i = 0; i < pp.length; i++){
        client.channels.get(channels.book).send('```Cliffford detected a new prospect!\nGTA name: ' + pp[i].gta + '\nDiscord: ' + pp[i].discord + '\ninvited by: ' + pp[i].invited + '```');
      }
    });
  });
}
// Set interval to check for new applications
setInterval(check, 30*60*1000); // Time in ms (minutes*60*1000)
