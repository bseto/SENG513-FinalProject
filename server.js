var express = require("express");
var app = express();
var port = process.env.PORT || 3000;
var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var io = require('socket.io').listen(app.listen(port));

app.set('views', __dirname + '/pug');
app.set('view engine', "pug");
app.engine('pug', require('pug').__express);
app.use(express.static(__dirname + '/webClient'));

var clients = new Map();
var currentUsers = [];
var chatHistory = [];

app.get("/", function (req, res) {
	res.render("page");
});

io.sockets.on('connect', function (socket) {
	socket.on('connectRequest', function ( cookie ) {
		let newUser = false;
		let name = '';
		let color = '#000000';
		
		if ( !cookie ) {
			newUser = true;
			name = generateUsername();
		} else {
			name = cookie.username;
			color = cookie.color;
		}
		
		clients.set(socket, {
			username: name,
			color: color
		});
		
		let time = getTimestamp();
		
		generateUserList();

		socket.broadcast.emit('serverMessage', {
			timestamp: time,
			message: '<i>' + name + '</i> has joined the room.',
			userList: currentUsers
		});
		
		updateHistory({
			timestamp: time,
			message: '<i>' + name + '</i> has joined the room.',
			serverMessage: true
		});
		
		let welcomeString = '';
		if ( newUser ) {
			welcomeString = 'Welcome to the chat! You have been auto-assigned the username: ' + name + ".";
		}
		else {
			welcomeString = 'Welcome back, ' + name + ".";
		}
		
		socket.emit('serverMessage', {
			timestamp: time,
			message: welcomeString,
			username: name,
			userList: currentUsers,
			chatHistory: chatHistory
		});

		console.log("User connected:" + name);
	});
});

io.sockets.on('connection', function (socket) {
	socket.on('message', function (data) {
		console.log("Message received: '" + data.message.slice(0, -1) + "' from: " + data.username+ "(" + data.color + ")");
		if (data.message.startsWith('/')) {
			handleServerCommand(socket, data.message.slice(0, -1));
		} else {
			updateHistory(data);
			data.timestamp = getTimestamp();
			console.log("Broadcasting message: " + data.message.slice(0, -1));
			io.sockets.emit('message', data);
		}
	});

	socket.on('disconnect', function () {
		let deadUser = clients.get(socket).username;

		if (!clients.has(socket)) {
			console.log("Attempted to disconnect a user that was not logged...?");
			return;
		}

		clients.delete (socket);
		
		let time = getTimestamp();
		
		console.log("User disconnected:" + deadUser);

		generateUserList();

		io.sockets.emit('serverMessage', {
			timestamp: time,
			message: '<i>' + deadUser + '</i> has left the room.',
			userList: currentUsers
		});
		
		updateHistory({
			timestamp: time,
			message: '<i>' + deadUser + '</i> has left the room.',
			serverMessage: true
		});
	});
});

getTimestamp = function () {
	let date = new Date();
	let hh = date.getHours();
	if (hh < 10)
		hh = '0' + hh;

	let mm = date.getMinutes();
	if (mm < 10)
		mm = '0' + mm;

	let ss = date.getSeconds();
	if (ss < 10)
		ss = '0' + ss;

	return hh + ":" + mm + ":" + ss;
};

generateUsername = function () {
	let text = "";

	for (let i = 0; i < 7; i++)
		text += charSet.charAt(Math.floor(Math.random() * charSet.length));
	
	for (let user of currentUsers) {
		if ( user.username === text )
			generateUsername();
	}

	return text;
};

generateUserList = function () {
	currentUsers = [];

	for (let[socket, info]of clients)
		currentUsers.push( info );

	currentUsers.sort(function(a, b){
		return a.username < b.username ? -1 : 1;
	});
};

handleServerCommand = function (socket, message) {
	console.log("Handling server command: " + message);
	let tokens = message.split(' ');
	switch (tokens[0].toLowerCase()) {
	case '/nick':
		handleChangeNickname(socket, tokens);
		break;
	case '/nickcolor':
		handleChangeNickColor(socket, tokens);
		break;
	default:
		console.log("badCommand: " + message);
		socket.emit('serverMessage', {
			timestamp: getTimestamp(),
			message: "What? I didn't understand that command. <br>Currently supported commands: <br>'/nick' <br>'/nickcolor'"
		});
	}
};

handleChangeNickname = function (socket, tokens) {
	if (tokens.length < 2) {
		console.log("No new nickname supplied");
		socket.emit('serverMessage', {
			timestamp: getTimestamp(),
			message: "You didn't supply a new username!"
		});
	} else {
		let userInfo = clients.get(socket);
		let oldName = userInfo.username;
		if (/[\W]/.test(tokens[1].slice(0, -1)) || tokens[1].trim().length === 0) {
			console.log("Bad nickname change request - bad characters: " + tokens[1]);
			socket.emit('serverMessage', {
				timestamp: getTimestamp(),
				message: "Your nickname must contain only alphanumeric characters"
			});
		} else {
			let newName = tokens[1].match(/\w+/)[0];
			for (let user of currentUsers) {
				console.log(user.username);
				if ( user.username === newName ) {
					console.log("Bad nickname change request - duplicate name " + newName);
					socket.emit('serverMessage', {
						timestamp: getTimestamp(),
						message: "Your nickname must be unique!"
					});
					return;
				}
			}
			
			userInfo.username = newName;
			generateUserList();
			
			socket.emit('serverMessage', {
				timestamp: getTimestamp(),
				username: userInfo.username,
				message: "Successfully changed nickname to " + userInfo.username,
				userList: currentUsers
			});

			socket.broadcast.emit('serverMessage', {
				timestamp: getTimestamp(),
				message: '<i>' + oldName + '</i> is now known as <i>' + userInfo.username + '</i>',
				userList: currentUsers
			});
			console.log("Setting nickname for " + oldName + " to " + userInfo.username);
		}
	}
};

handleChangeNickColor = function (socket, tokens) {
	if (tokens.length < 2) {
		console.log("No new colour supplied");
		socket.emit('serverMessage', {
			timestamp: getTimestamp(),
			message: "You didn't supply a new nickcolor!"
		});
	} else {
		let userInfo = clients.get(socket);
		let newColor = tokens[1].match(/(^#[0-9a-fA-F]{6})/g);
		if (!newColor) {
			console.log("Bad nickcolor change request: " + tokens[1]);
			socket.emit('serverMessage', {
				timestamp: getTimestamp(),
				message: "That's not a color! Use the form '#FFFFFF' to pick a color!"
			});
		} else {
			userInfo.color = newColor[0];
			socket.emit('serverMessage', {
				timestamp: getTimestamp(),
				color: userInfo.color,
				message: "Successfully changed color to <font color=\"" + newColor + "\">" + newColor + "</font>"
			});

			generateUserList();
			
			io.sockets.emit('serverMessage', {
				userList: currentUsers
			});
			
			console.log("Setting color for " + userInfo.username + " to " + newColor);
		}
	}
};

updateHistory = function( data ) {
	if ( chatHistory.length >= 500 ) {
		chatHistory.shift();
	}
	chatHistory.push(data);
};

console.log("Listening on port " + port);
