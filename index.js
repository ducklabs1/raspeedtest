const express = require('express');
const app = express();
const speedtest = require('speedtest-net');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':memory:');
var schedule = require('node-schedule');
var fs = require('fs');
var savefileIterator = 0;
var serveIndex = require('serve-index');
db.serialize(function() {
	db.run("CREATE TABLE tests (time DATETIME PRIMARY_KEY, ping FLOAT, download FLOAT, upload FLOAT, ip VARCHAR,host VARCHAR, location VARCHAR)");
});
app.get('/test',function(req,res){
	speedtest().on('data',data=> {
		var dt = new Date();
		console.log("Speedtest At",dt.toUTCString());
		res.json(data);
		var server = data.server;
		db.serialize(function(){
			var stmt = db.prepare("INSERT INTO \"tests\"(time,ping,download,upload,ip,host,location) VALUES(CURRENT_TIMESTAMP,\""+server.ping+"\",\""+data.speeds.download+"\",\""+data.speeds.upload+"\",\""+data.client.ip+"\",\""+server.host+"\",\""+server.location+"\")");
			stmt.run();
			stmt.finalize();
		});
	});
});
app.get('/json',function(req,res){
	db.serialize(function(){
			var result = new Array();
			db.each("SELECT * FROM tests",function(err,row){
				result.push(row);
			},function(err,num){
				res.setHeader("ContentType","application/json");
				res.json(result);
			});
		});
		db.serialize(function(){
		var result = new Array();
		var d = new Date().toJSON().slice(0,10);
		var filename = d+".json";
	});
});
app.get('/',function(req,res){
	res.sendFile("HOME_DIRECTORY/index.html");
});
app.use("/logs", express.static('logs'));
app.use('/logs', serveIndex(__dirname + '/logs'));

app.get('/save', function(req,res){
	db.serialize(function(){
		var result = new Array();
		var d = new Date().toJSON().slice(0,10);
		var filename = "save"+savefileIterator+"_"+d+".json";
		savefileIterator++;
		db.each("SELECT * FROM tests",function(err,row){
				result.push(row);
			},function(err,num){
				var stream = fs.createWriteStream("HOME_DIRECTORY/logs/"+filename);
				stream.once('open',function(){
					stream.write(JSON.stringify(result));
					stream.end();
				});
			});
		res.send("Success!");
	});
});

function testSpeed() {
  speedtest().on('data',data=> {
		var server = data.server;
		db.serialize(function(){
			var dt = new Date();
			console.log("Speedtest At",dt.toUTCString());
			var stmt = db.prepare("INSERT INTO \"tests\"(time,ping,download,upload,ip,host,location) VALUES(CURRENT_TIMESTAMP,\""+server.ping+"\",\""+data.speeds.download+"\",\""+data.speeds.upload+"\",\""+data.client.ip+"\",\""+server.host+"\",\""+server.location+"\")");
			stmt.run();
			stmt.finalize();
		});
	});
};

var sched = schedule.scheduleJob('*/10 * * * *', function(){
  testSpeed();
});
var save = schedule.scheduleJob('59 23 * * *', function(){
	savefileIterator = 0;
	db.serialize(function(){
		var result = new Array();
		var d = new Date().toJSON().slice(0,10);
		var filename = d+".json";
		db.each("SELECT * FROM tests",function(err,row){
				result.push(row);
			},function(err,num){
				var stream = fs.createWriteStream("HOME_DIRECTORY/logs/"+filename);
				stream.once('open',function(){
					stream.write(JSON.stringify(result));
					stream.end();
				});
			});
		var stmt = db.prepare("DELETE FROM \"tests\" WHERE 1");
		stmt.run();
		stmt.finalize();
	});
});
app.listen(8443, () => console.log('Speedtest Automizer Running on port 8443'));