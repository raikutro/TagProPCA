require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const bodyparser = require('body-parser');

const app = express();
const httpServer = http.Server(app);

const PORT = 8080;

const modelList = fs.readdirSync(__dirname + '/data/models');

app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());

app.get('/', function(req, res){
	res.sendFile(__dirname + '/public/index.html');
});

app.get('/model_list', function(req, res){
	res.json({
		models: modelList
	});
});

app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/models', express.static(path.join(__dirname, 'data/models')));

httpServer.listen(PORT, function(){
	console.log('listening on *:' + PORT);
});