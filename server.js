var express = require("express");
var app = express();
var port = process.env.PORT || 3000;
var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
var io = require('socket.io').listen(app.listen(port));
var dbmgr = require('./db');

app.set('views', __dirname + '/pug');
app.set('view engine', "pug");
app.engine('pug', require('pug').__express);
app.use(express.static(__dirname + '/webClient'));

var map_socketIdToUsers = new Map();
var map_namespaceToUserList = new Map();
var chatHistory = new Map();
var ticketQueue = new Map();

var ticketCounter = 0;

app.get("/", function (req, res) {
    res.render("landing");
});

app.get("/chat", function (req, res) {
    res.render("customer-page");
});

app.get("/staff", function (req, res) {
    res.render("staff-page");
})

io.sockets.on('connect', function (socket) {
    socket.on('login', function(data) {
        console.log('Attempted login: ' + JSON.stringify(data));
        dbmgr.authenticateUser(data.username, data.password, function(doc) {
            if(!doc) {
                socket.emit('login-result', undefined);
                console.log("Auth failed: " + JSON.stringify(doc));
            }
            else {
                socket.emit('login-result', doc);
                console.log("Auth success: " + JSON.stringify(doc));
            }
        });
    });
    socket.on('register', function(data) {
        console.log('Registering new user: ' + JSON.stringify(data));
        dbmgr.insertNewUser(data.username, data.password, data.type,"#000000", function(doc) {
            socket.emit('registration-result', doc);
        });
    });
    socket.on('userConnected', function (data) {
        console.log('User connected: ' + JSON.stringify(data));
        let userinfo = null;
        if ( data )
            userinfo = new userInfo( data.userid, data.username, socket.id, data.color, data.type );

        map_socketIdToUsers.set(socket.id, userinfo);
    });
    socket.on('retrieveTicketQueue', function(data) {
        console.log('Ticket queue request: ' + JSON.stringify(data));
        if ( data.type == "staff" )
            socket.emit('queueRetrieval', getTicketQueue());
    });
});

io.on('connection', function (socket) {
    socket.on('message', function (data) {
        console.log("Message received: '" + data.message.slice(0, -1) + "' from: " + data.username+ "(" + data.color + ")");
        if (data.message.startsWith('/')) {
            handleServerCommand(socket, data.message.slice(0, -1));
        } else {
            let room = data.room;
            updateHistory( room, data );
            data.timestamp = getTimestamp();
            console.log("Broadcasting message: in " + room + ": " + data.message.slice(0, -1));
            io.in( room ).emit('message', data);
        }
    });

    socket.on('disconnect', function () {
        let userinfo = map_socketIdToUsers.get(socket.id);
        if ( userinfo === undefined ) {
            console.log("Attempted to disconnect a user that was not logged...?");
            return;
        }

        map_socketIdToUsers.delete( socket.id );
        if ( userinfo === null )
            return;

        let time = getTimestamp();

        console.log("User disconnected: " + userinfo.username);

        socket.to( userinfo.room ).emit('serverMessage', {
            timestamp: time,
            message: '<i>' + userinfo.username + '</i> has left the room.'
        });

        updateHistory( userinfo.room, {
            timestamp: time,
            message: '<i>' + userinfo.username + '</i> has left the room.',
            serverMessage: true
        });
    });

    socket.on('submitTicket', function(data) {
        let user = map_socketIdToUsers.get(socket.id);
        if ( !user ) {
            console.log("Ticket received from unknown user: " + socket.id);
        }
        console.log("Ticket received from: " + user.username);
        console.log(JSON.stringify(data.title));

        ticketCounter++;

        let ticket = {
            created: new Date(),
            room: user.userId,
            ticketNo: ticketCounter,
            title: data.title,
            description: data.description
        };

        ticketQueue.set(ticket.ticketNo, ticket);

        io.sockets.emit('queueUpdate', {
            mode: 'add',
            ticket: {
                ticketNo: ticket.ticketNo,
                title: ticket.title,
                created: ticket.created
            }
        });
    });

    socket.on('retrieveTicket', function(data) {
        console.log("Ticket selected by: " + socket.id);
        console.log(JSON.stringify(data));

        let ticket = ticketQueue.get(data.ticketNo);
        if ( !ticket ) {
            reportServerError( socket, "Invalid ticket retrieval: " + data.ticketNo, "Invalid ticket number - could not retrieve ticket");
            return;
        }

        socket.join(ticket.room);

        socket.emit('ticketRetrieved', ticket);

        ticketQueue.delete(data.ticketNo);

        io.sockets.emit('queueUpdate', {
            mode: 'remove',
            ticketNo: data.ticketNo
        });
    });

    socket.on('updateAccountSettings', function(data) {
        console.log("Updating account settings: " + JSON.stringify(data));

        dbmgr.editUser(data.userid, data.username, data.type, data.pwd, data.color, function(result) {
            socket.emit('update-result', result);

            if ( !result )
                return;
            
            // Update user information in memory
            userinfo = map_socketIdToUsers.get(socket.id);
            if ( !userinfo ) {
                console.log( "Bad account update request - couldn't find user in socket-user map.");
                return;
            }

            userinfo.username = data.username;
            userinfo.color = data.color;

            socket.emit('serverMessage', {
                username: userinfo.username,
                color: userinfo.color
            });
        });

    });

    socket.on('createChatroom', function(data) {
        console.log("Create chatroom: " + JSON.stringify(data));

        let userinfo = map_socketIdToUsers.get(socket.id);
        if ( !userinfo ) {
            reportServerError("Error creating chatroom - couldn't retrieve user information.");
            return;
        }

        let room = data.userid;

        socket.join( room );

        let time = getTimestamp();

        socket.to(room).emit('serverMessage', {
            timestamp: time,
            message: '<i>' + data.username + '</i> has joined the room.'
        });
        
        updateHistory( room, {
            timestamp: time,
            message: '<i>' + data.username + '</i> has joined the room.',
            serverMessage: true
        });

        socket.emit('serverMessage', {
            timestamp: time,
            message: 'Welcome, ' + data.username + ".",
            username: data.username,
            room: room,
            chatHistory: chatHistory.get(room),
            queue: getTicketQueue()
        });
    });

    socket.on('leaveChatroom', function(data) {
        let userinfo = map_socketIdToUsers.get(socket.id);
        if ( userInfo === undefined ) {
            console.log("Unknown socket disconnected from chatroom: " + socket.id);
            return;
        }

        let time = getTimestamp();

        console.log("User disconnected: " + userinfo.username + " from " + userinfo.room);

        socket.to( userinfo.room ).emit('serverMessage', {
            timestamp: time,
            message: '<i>' + userinfo.username + '</i> has left the room.'
        });

        updateHistory( userinfo.room, {
            timestamp: time,
            message: '<i>' + userinfo.username + '</i> has left the room.',
            serverMessage: true
        });
    });

    socket.on('inviteUser', function(data) {
        console.log("Inviting other user: " + JSON.stringify(data));

        let sender = map_socketIdToUsers.get(socket.id)

        if ( sender.username == data ) {    // What a troll
            socket.emit('inviteUser-response', false);
            return;
        }

        for ( let [usersocket, userinfo] of map_socketIdToUsers ) {
            if ( !userinfo || userinfo.type != "staff" )
                continue;

            if ( userinfo.username == data ) {
                socket.to(usersocket).emit('chatroomInvitation', sender.username);
                socket.emit('inviteUser-response', true);
                return;
            }
        }

        socket.emit('inviteUser-response', false);
    });

    socket.on('joinChatroom', function(data) {
        console.log("Join chatroom: " + JSON.stringify(data));

        let recipient = map_socketIdToUsers.get(socket.id);

        if ( !recipient ) {
            console.log("Unknown user tried to join chatroom...?");
            return;
        }

        let sender = '';
        for ( let user of map_socketIdToUsers.values()) {
            if ( user.username == data.sender ){
                sender = user;
            }
        }

        if ( !sender ) {
            console.log("Couldn't find sender for chatroom invite.");
            return;
        }

        if ( data.response ) {
            //This needs to actually connect the chatroom...
            /*socket.to(sender.socketId).emit('joinChatroom-response', {
                response: true
            });*/
        } else {
            socket.to(sender.socketId).emit('joinChatroom-response', {
                response: false,
                sender: recipient.username
            });
        }

    });
});

userInfo = function( userid, username, socketId, color, type ) {
    this.userId = userid;
    this.username = username;
    this.socketId = socketId;
    this.color = color;
    this.type = type;
}

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

reportServerError = function( socket, consoleMsg, clientMsg ) {
    console.log(consoleMsg);
    socket.emit('serverMessage', {
        timestamp: getTimestamp(),
        message: clientMsg
    });
};

generateUsername = function () {
    let text = "";

    for (let i = 0; i < 7; i++)
        text += charSet.charAt(Math.floor(Math.random() * charSet.length));

    return text;
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
        reportServerError(socket, "Bad command: " + message, "What? I didn't understand that command. <br>Currently supported commands: <br>'/nick' <br>'/nickcolor' <br>'/join'");
    }
};

handleChangeNickname = function (socket, tokens) {
    // Check for new usernname
    if (tokens.length < 2) {
        reportServerError( socket, "Bad nickname change request - no name", "You didn't supply a new username!" );
        return;
    }

    // Check for valid characters
    if (/[\W]/.test(tokens[1].slice(0, -1)) || tokens[1].trim().length === 0) {
        reportServerError( socket, "Bad nickname change request - bad characters: " + tokens[1], "Your nickname must contain only alphanumeric characters" );
        return;
    } 
    
    // Get userInfo from socket-users map
    let userinfo = map_socketIdToUsers.get(socket.id);
    if ( !userinfo ) {
        reportServerError( socket, "Bad nickname change request - couldn't retrieve user " + userInfo.username, "Couldn't retrieve your user info!" );
        return;
    }

    let oldName = userinfo.username;

    // Check for unqiue name in current namespace
    let newName = tokens[1].match(/\w+/)[0];
    for (let user of map_namespaceToUserList.get(userinfo.namespace)) {
        if ( user.username.toUpperCase() === newName.toUpperCase() ) {
            reportServerError( socket, "Bad nickname change request - duplicate name" + newName, "Your nickname must be unique!");
            return;
        }
    }

    // Update userInfo
    userinfo.username = newName;

    socket.emit('serverMessage', {
        timestamp: getTimestamp(),
        username: userinfo.username,
        message: "Successfully changed nickname to " + userinfo.username,
        userList: map_namespaceToUserList.get(userinfo.namespace)
    });

    socket.to(userinfo.namespace).emit('serverMessage', {
        timestamp: getTimestamp(),
        message: '<i>' + oldName + '</i> is now known as <i>' + userinfo.username + '</i>',
        userList: map_namespaceToUserList.get(userinfo.namespace)
    });

    console.log("Setting nickname for " + oldName + " to " + userinfo.username);
};

/*
handleChangeNamespace = function (socket, tokens) {
    // Check for new room name
    if (tokens.length < 2) {
        reportServerError(socket, "Bad chatroom change request - no room", "You didn't supply a Chatroom Name!");
        return;
    } 

    // Check for valid characters
    if (/[\W]/.test(tokens[1].slice(0, -1)) || tokens[1].trim().length === 0) {
        reportServerError(socket, "Bad chatroom change request - bad characters: " + tokens[1], "Your chatroom must contain only alphanumeric characters");
        return;
    } 
    
    // Get userInfo from socket-user map
    let userinfo = map_socketIdToUsers.get(socket.id);
    let oldNamespace = userinfo.namespace;
    let newNamespace = tokens[1].match(/\w+/)[0];

    // Check for valid room
    if ( oldNamespace.toUpperCase() === newNamespace.toUpperCase() ) {
        reportServerError(socket, "Bad chatroom change request - duplicate room: " + newNamespace, "You are already in that room!");
        return;
    }

    // Get userInfo from userlists map
    let userinfo2 = findUserInUserList( userinfo.namespace, userinfo.socketId );
    if ( !userinfo || !userinfo2 ) {
        if ( !userinfo )
            reportServerError(socket, "Bad namespace change request - couldn't retrieve user " + userinfo.username + " from socket-user map", "Couldn't retrieve your user info!");
        if ( !userinfo2 )
            reportServerError(socket, "Bad namespace change request - couldn't retrieve user " + userinfo.username + " from userlists map", "Couldn't retrieve your user info!");
        return;
    }

    // Update userInfo
    userinfo.namespace = newNamespace;

    // Leave old namespace
    socket.leave(oldNamespace);
    removeFromUserList( oldNamespace, userinfo2 );
    socket.to(oldNamespace).emit('serverMessage', {
        timestamp: getTimestamp(),
        message: '<i>' + userinfo.username + '</i> has left the room.',
        userList: map_namespaceToUserList.get(oldNamespace)
    });

    updateHistory( oldNamespace, {
        timestamp: getTimestamp(),
        message: '<i>' + userinfo.username + '</i> has left the room.',
        serverMessage: true
    });

    // Join new namespace
    socket.join(userinfo.namespace);
    addToUserList( newNamespace, userinfo );

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
        message: '<i>' + userinfo.username + '</i> has joined the room.',
        userList: map_namespaceToUserList.get( newNamespace )
    });

    updateHistory( newNamespace, {
        timestamp: getTimestamp(),
        message: '<i>' + userinfo.username + '</i> has joined the room.',
        serverMessage: true
    });

    console.log( "Switching rooms: " + userinfo.username + " from " + oldNamespace + " to " + newNamespace );
};
*/

handleChangeNickColor = function (socket, tokens) {
    // Check for new color
    if (tokens.length < 2) {
        reportServerError(socket, "Bad nickcolor change request - no color", "You didn't supply a new nickcolor!");
        return;
    }

    // Check for valid characters
    let newColor = tokens[1].match(/(^#[0-9a-fA-F]{6})/g);
    if (!newColor) {
        reportServerError(socket, "Bad nickcolor change request - bad characters: " + tokens[1], "That's not a color! Use the form '#FFFFFF' to pick a color!");
        return;
    }

    // Get userInfo from socket-user map
    let userinfo = map_socketIdToUsers.get(socket.id);

    // Update userInfo
    userinfo.color = newColor[0];

    socket.emit('serverMessage', {
        timestamp: getTimestamp(),
        color: userinfo.color,
        message: "Successfully changed color to <font color=\"" + newColor + "\">" + newColor + "</font>"
    });

    // Update userlists for all relevant rooms
    let rooms = Object.keys(socket.rooms).map(key => key); // This is currently using room name; to use namespaces, use 'key => socket.rooms[key]'
    for ( room of rooms ) {
        io.in(room).emit('serverMessage', { // This is currently using room name; to use namespaces, use 'io.of'
            userList: map_namespaceToUserList.get(room)
        });
    }

    console.log("Setting color for " + userinfo.username + " to " + newColor);
};

updateHistory = function( room, data ) {
    let history = chatHistory.get(room);

    if ( history )
    {
        if ( history.length >= 500 )
            history.shift();
        history.push( data );
    } 
    else 
    {
        chatHistory.set(room, [data]);
    }
};

getTicketQueue = function() {
    let queue = [];
    for( let [ticketNo, ticket] of ticketQueue ) {
        queue.push({
            ticketNo: ticketNo,
            title: ticket.title,
            created: ticket.created
        });
    }
    return queue;
};

console.log("Listening on port " + port);
