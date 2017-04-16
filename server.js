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
                socket.emit('login-result', { stats: false, Type: null });
                console.log("Auth failed: " + JSON.stringify(doc));
            }
            else {
                socket.emit('login-result', { status: true, Type: doc.Type });
                console.log("Auth success: " + JSON.stringify(doc));
            }
        });
    });
    socket.on('register', function(data) {
        console.log('Registering new user: ' + JSON.stringify(data));
        dbmgr.insertNewUser(data.username, data.password, "user","#FFFFFF", function(doc) {
            socket.emit('registration-result', doc);
        });
    });
    socket.on('connectRequest', function ( cookie ) {
        let newUser = false;
        let name = '';
        let id = '';
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
        map_socketIdToUsers.set( socket.id, userInfo );

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
        dbmgr.insertNewUser

        socket.emit('serverMessage', {
            timestamp: time,
            message: welcomeString,
            username: name,
            namespace: namespace,
            userList: map_namespaceToUserList.get(namespace),
            chatHistory: chatHistory.get(namespace),
            queue: getTicketQueue()
        });
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
        let userInfo = map_socketIdToUsers.get(socket.id);
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

    socket.on('submitTicket', function(data) {
        handleSubmitTicket( socket, data );
    });

    socket.on('retrieveTicket', function(data) {
        handleRetrieveTicket( socket, data );
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
    case '/ticket':
        handleTicketCommand(socket, tokens);
        break;
    default:
        reportServerError(socket, "Bad command: " + message, "What? I didn't understand that command. <br>Currently supported commands: <br>'/nick' <br>'/nickcolor' <br>'/join' <br>'/ticket'");
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
    let userInfo = map_socketIdToUsers.get(socket.id);
    if ( !userInfo ) {
        reportServerError( socket, "Bad nickname change request - couldn't retrieve user " + userInfo.username, "Couldn't retrieve your user info!" );
        return;
    }

    let oldName = userInfo.username;

    // Check for unqiue name in current namespace
    let newName = tokens[1].match(/\w+/)[0];
    for (let user of map_namespaceToUserList.get(userInfo.namespace)) {
        if ( user.username.toUpperCase() === newName.toUpperCase() ) {
            reportServerError( socket, "Bad nickname change request - duplicate name" + newName, "Your nickname must be unique!");
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
        reportServerError(socket, "Bad chatroom change request - no room", "You didn't supply a Chatroom Name!");
        return;
    } 

    // Check for valid characters
    if (/[\W]/.test(tokens[1].slice(0, -1)) || tokens[1].trim().length === 0) {
        reportServerError(socket, "Bad chatroom change request - bad characters: " + tokens[1], "Your chatroom must contain only alphanumeric characters");
        return;
    } 
    
    // Get userInfo from socket-user map
    let userInfo = map_socketIdToUsers.get(socket.id);
    let oldNamespace = userInfo.namespace;
    let newNamespace = tokens[1].match(/\w+/)[0];

    // Check for valid room
    if ( oldNamespace.toUpperCase() === newNamespace.toUpperCase() ) {
        reportServerError(socket, "Bad chatroom change request - duplicate room: " + newNamespace, "You are already in that room!");
        return;
    }

    // Get userInfo from userlists map
    let userInfo2 = findUserInUserList( userInfo.namespace, userInfo.userId );
    if ( !userInfo || !userInfo2 ) {
        if ( !userInfo )
            reportServerError(socket, "Bad namespace change request - couldn't retrieve user " + userInfo.username + " from socket-user map", "Couldn't retrieve your user info!");
        if ( !userInfo2 )
            reportServerError(socket, "Bad namespace change request - couldn't retrieve user " + userInfo.username + " from userlists map", "Couldn't retrieve your user info!");
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
    let userInfo = map_socketIdToUsers.get(socket.id);

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

handleTicketCommand = function ( socket, tokens ) {
    if ( tokens.length < 2) {
        reportServerError(socket, "Bad ticket command - malformed", "You need to supply more arguments for this command! (/ticket add <title> <desc>, /ticket del <num>, or /ticket all)");
        return;
    }

    let mode = tokens[1].toLowerCase();
    let queue = {};
    let string = "";
    switch ( mode ) {
    case "add":
        let desc = tokens.length >= 4 ? tokens.slice(3) : []
        handleSubmitTicket( socket, {
            title: tokens[2],
            description: desc
        });
        queue = getTicketQueue();
        for ( let ticket of queue ) {
            string += "[" + ticket.ticketNo + "/" + ticket.title + "/" + ticket.created + "] "
        }
        reportServerError(socket, "Ticket queue retrieval: " + string, string);
        break;
    case "del":
        let idx = parseInt(tokens[2]);
        handleRetrieveTicket( socket, {
            ticketNo: idx
        });
        queue = getTicketQueue();
        for ( let ticket of queue ) {
            string += "[" + ticket.ticketNo + "/" + ticket.title + "/" + ticket.created + "] "
        }
        reportServerError(socket, "Ticket queue retrieval: " + string, string);
        break;
    case "all":
        queue = getTicketQueue();
        for ( let ticket of queue ) {
            string += "[" + ticket.ticketNo + "/" + ticket.title + "/" + ticket.created + "] "
        }
        reportServerError(socket, "Ticket queue retrieval: " + string, string);
        break;
    default:
        reportServerError(socket, "Bad ticket command - bad mode: " + mode, "Valid modes for ticket command are 'add', 'del', and 'all' only!");
    }
}

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

handleSubmitTicket = function( socket, data ) {
    console.log("Ticket received from: " + socket.id);
    console.log(JSON.stringify(data));

    ticketCounter++;

    let ticket = {
        created: new Date(),
        userId: socket.id,
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
};

handleRetrieveTicket = function( socket, data ) {
    let ticket = ticketQueue.get(data.ticketNo);
    if ( !ticket ) {
        reportServerError( socket, "Invalid ticket retrieval: " + data.ticketNo, "Invalid ticket number - could not retrieve ticket");
        return;
    }

    socket.emit('ticketRetrieved', {ticket});

    ticketQueue.delete(data.ticketNo);

    io.sockets.emit('queueUpdate', {
        mode: 'remove',
        ticketNo: data.ticketNo
    });
};

console.log("Listening on port " + port);
