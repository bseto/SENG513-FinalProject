var express = require("express");
var app = express();
var port = process.env.PORT || 3000;
var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var io = require('socket.io').listen(app.listen(port));

app.set('views', __dirname + '/pug');
app.set('view engine', "pug");
app.engine('pug', require('pug').__express);
app.use(express.static(__dirname + '/webClient'));

var map_socketToUsers = new Map();
var map_namespaceToUserList = new Map();
var chatHistory = new Map();

app.get("/", function (req, res) {
    res.render("page");
});

io.sockets.on('connect', function (socket) {
    socket.on('connectRequest', function ( cookie ) {
        let newUser = false;
        let name = '';
        let color = '#000000';
        let namespace = 'default';

        if ( !cookie ) {
            newUser = true;
            name = generateUsername();
            socket.join("default")
        } else {
            name = cookie.username;
            color = cookie.color;
            namespace = cookie.namespace;
            socket.join(namespace);
        }

        let userInfo = {
            username: name,
            userId: socket.id,
            color: color,
            namespace: namespace
        };

        addToUserList( namespace, userInfo );
        map_socketToUsers.set( socket, userInfo );

        let time = getTimestamp();

        socket.to(namespace).emit('serverMessage', {
            timestamp: time,
            message: '<i>' + name + '</i> has joined the room.',
            userList: map_namespaceToUserList.get(namespace)
        });

        updateHistory( namespace, {
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
            namespace: namespace,
            userList: map_namespaceToUserList.get(namespace),
            chatHistory: chatHistory.get(namespace)
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
            let namespace = data.namespace;
            updateHistory( namespace, data );
            data.timestamp = getTimestamp();
            console.log("Broadcasting message: in " + namespace + ":" + data.message.slice(0, -1));
            io.in( namespace ).emit('message', data);
        }
    });

    socket.on('disconnect', function () {
        let userInfo = map_socketToUsers.get(socket);
        if ( userInfo === undefined ) {
            console.log("Attempted to disconnect a user that was not logged...?");
            return;
        }

        removeFromUserList( userInfo.namespace, userInfo );

        let time = getTimestamp();

        console.log("User disconnected: " + userInfo.username + " from " + userInfo.namespace);

        socket.to( userInfo.namespace ).emit('serverMessage', {
            timestamp: time,
            message: '<i>' + userInfo.username + '</i> has left the room.',
            userList: map_namespaceToUserList.get( userInfo.namespace )
        });

        updateHistory( userInfo.namespace, {
            timestamp: time,
            message: '<i>' + userInfo.username + '</i> has left the room.',
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

    return text;
};

addToUserList = function( namespace, info ) {
    let list = map_namespaceToUserList.get( namespace );

    if ( list )
    {
        list.push(info);
        list.sort(function(a, b){
            return a.username < b.username ? -1 : 1;
        });
    }
    else
    {
        map_namespaceToUserList.set(info.namespace, [info]);
    }
};

removeFromUserList = function( namespace, info ) {
    let list = map_namespaceToUserList.get( namespace );

    if ( list )
    {
        let pos = list.indexOf(info);
        list.splice(pos, 1);

        list.sort(function(a, b){
            return a.username < b.username ? -1 : 1;
        });
    }
};

updateUserList = function( namespace, info ) {
    let userInfo = findUserInUserList( info );
    if ( userInfo === undefined )
        return;

    userInfo.username = info.username;
    userInfo.userId = info.socket.id,
    userInfo.color = info.color,
    userInfo.namespace = info.namespace
};

findUserInUserList = function( namespace, userId ) {
    let list = map_namespaceToUserList.get( namespace );
    if ( !list )
        return undefined;
    
    return list.find( function(client){
            return client.userId == userId;
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
    case '/join':
        handleChangeNamespace(socket, tokens);
        break;
    default:
        console.log("badCommand: " + message);
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "What? I didn't understand that command. <br>Currently supported commands: <br>'/nick' <br>'/nickcolor' <br>'/join'"
        });
    }
};

handleChangeNickname = function (socket, tokens) {
    // Check for new usernname
    if (tokens.length < 2) {
        console.log("No new nickname supplied");
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "You didn't supply a new username!"
        });
        return;
    }

    // Check for valid characters
    if (/[\W]/.test(tokens[1].slice(0, -1)) || tokens[1].trim().length === 0) {
        console.log("Bad nickname change request - bad characters: " + tokens[1]);
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "Your nickname must contain only alphanumeric characters"
        });
        return;
    } 
    
    // Get userInfo from socket-users map
    let userInfo = map_socketToUsers.get(socket);
    if ( !userInfo ) {
        console.log( "Bad nickname change request - couldn't retrieve user " + userInfo.username );

        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "Couldn't retrieve your user info!"
        });
        return;
    }

    let oldName = userInfo.username;

    // Check for unqiue name in current namespace
    let newName = tokens[1].match(/\w+/)[0];
    for (let user of map_namespaceToUserList.get(userInfo.namespace)) {
        if ( user.username.toUpperCase() === newName.toUpperCase() ) {
            console.log("Bad nickname change request - duplicate name " + newName);
            socket.emit('serverMessage', {
                timestamp: getTimestamp(),
                message: "Your nickname must be unique!"
            });
            return;
        }
    }

    // Update userInfo
    userInfo.username = newName;

    socket.emit('serverMessage', {
        timestamp: getTimestamp(),
        username: userInfo.username,
        message: "Successfully changed nickname to " + userInfo.username,
        userList: map_namespaceToUserList.get(userInfo.namespace)
    });

    socket.to(userInfo.namespace).emit('serverMessage', {
        timestamp: getTimestamp(),
        message: '<i>' + oldName + '</i> is now known as <i>' + userInfo.username + '</i>',
        userList: map_namespaceToUserList.get(userInfo.namespace)
    });

    console.log("Setting nickname for " + oldName + " to " + userInfo.username);
};

handleChangeNamespace = function (socket, tokens) {
    // Check for new room name
    if (tokens.length < 2) {
        console.log("No chatroom supplied");
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "You didn't supply a Chatroom Name!"
        });
        return;
    } 

    // Check for valid characters
    if (/[\W]/.test(tokens[1].slice(0, -1)) || tokens[1].trim().length === 0) {
        console.log("Bad chatroom change request - bad characters: " + tokens[1]);
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "Your chatroom must contain only alphanumeric characters"
        });
        return;
    } 
    
    // Get userInfo from socket-user map
    let userInfo = map_socketToUsers.get(socket);
    let oldNamespace = userInfo.namespace;
    let newNamespace = tokens[1].match(/\w+/)[0];

    // Check for valid room
    if ( oldNamespace.toUpperCase() === newNamespace.toUpperCase() ) {
        console.log( "Bad chatroom change request - duplicate room: " + newNamespace );
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "You are already in that room!"
        });
        return;
    }

    // Get userInfo from userlists map
    let userInfo2 = findUserInUserList( userInfo.namespace, userInfo.userId );
    if ( !userInfo || !userInfo2 ) {
        if ( !userInfo )
            console.log( "Bad namespace change request - couldn't retrieve user " + userInfo.username + " from socket-user map" );
        if ( !userInfo2 )
            console.log( "Bad namespace change request - couldn't retrieve user " + userInfo.username + " from userlists map" );

        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "Couldn't retrieve your user info!"
        })
        return;
    }

    // Update userInfo
    userInfo.namespace = newNamespace;

    // Leave old namespace
    socket.leave(oldNamespace);
    removeFromUserList( oldNamespace, userInfo2 );
    socket.to(oldNamespace).emit('serverMessage', {
        timestamp: getTimestamp(),
        message: '<i>' + userInfo.username + '</i> has left the room.',
        userList: map_namespaceToUserList.get(oldNamespace)
    });

    updateHistory( oldNamespace, {
        timestamp: getTimestamp(),
        message: '<i>' + userInfo.username + '</i> has left the room.',
        serverMessage: true
    });

    // Join new namespace
    socket.join(userInfo.namespace);
    addToUserList( newNamespace, userInfo );

    let history = chatHistory.get(newNamespace);
    if ( !history )
        history = [];
    socket.emit('serverMessage', {
        timestamp: getTimestamp(),
        message: "Successfully changed chat room to " + newNamespace,
        namespace: newNamespace,
        userList: map_namespaceToUserList.get(newNamespace),
        chatHistory: history
    });

    socket.to( newNamespace ).emit('serverMessage', {
        timestamp: getTimestamp(),
        message: '<i>' + userInfo.username + '</i> has joined the room.',
        userList: map_namespaceToUserList.get( newNamespace )
    });

    updateHistory( newNamespace, {
        timestamp: getTimestamp(),
        message: '<i>' + userInfo.username + '</i> has joined the room.',
        serverMessage: true
    });

    console.log( "Switching rooms: " + userInfo.username + " from " + oldNamespace + " to " + newNamespace );
};

handleChangeNickColor = function (socket, tokens) {
    // Check for new color
    if (tokens.length < 2) {
        console.log("No new colour supplied");
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "You didn't supply a new nickcolor!"
        });
        return;
    }

    // Check for valid characters
    let newColor = tokens[1].match(/(^#[0-9a-fA-F]{6})/g);
    if (!newColor) {
        console.log("Bad nickcolor change request: " + tokens[1]);
        socket.emit('serverMessage', {
            timestamp: getTimestamp(),
            message: "That's not a color! Use the form '#FFFFFF' to pick a color!"
        });
        return;
    }

    // Get userInfo from socket-user map
    let userInfo = map_socketToUsers.get(socket);

    // Update userInfo
    userInfo.color = newColor[0];

    socket.emit('serverMessage', {
        timestamp: getTimestamp(),
        color: userInfo.color,
        message: "Successfully changed color to <font color=\"" + newColor + "\">" + newColor + "</font>"
    });

    // Update userlists for all relevant rooms
    let rooms = Object.keys(socket.rooms).map(key => key); // This is currently using room name; to use namespaces, use 'key => socket.rooms[key]'
    for ( room of rooms ) {
        io.in(room).emit('serverMessage', { // This is currently using room name; to use namespaces, use 'io.of'
            userList: map_namespaceToUserList.get(room)
        });
    }

    console.log("Setting color for " + userInfo.username + " to " + newColor);
};

updateHistory = function( namespace, data ) {
    let history = chatHistory.get(namespace);

    if ( history )
    {
        if ( history.length >= 500 )
            history.shift();
        history.push( data );
    } 
    else 
    {
        chatHistory.set(namespace, [data]);
    }
};

console.log("Listening on port " + port);
