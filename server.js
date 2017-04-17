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
        let room = data.room;
        updateHistory( room, data );
        data.timestamp = getTimestamp();
        console.log("Broadcasting message: in " + room + ": " + data.message.slice(0, -1));
        io.in( room ).emit('message', data);
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
            room: userinfo.room,
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

        let newTicket = new ticket( new Date(), user.userId, ticketCounter, data.title, data.description );

        ticketQueue.set(newTicket.ticketNo, newTicket);

        io.sockets.emit('queueUpdate', {
            mode: 'add',
            ticket: {
                ticketNo: newTicket.ticketNo,
                title: newTicket.title,
                created: newTicket.created
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

        let user = map_socketIdToUsers.get(socket.id);
        if ( !user ) {
            console.log("Unknown user attempted to retrieve ticket...?");
            return;
        }

        socket.emit('ticketRetrieved', ticket);
        ticketQueue.delete(data.ticketNo);

        io.sockets.emit('queueUpdate', {
            mode: 'remove',
            ticketNo: data.ticketNo
        });

        joinRoom( socket, ticket.room, user.username );
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

        joinRoom( socket, room, data.username );
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
};

ticket = function( created, room, ticketNo, title, description ) {
    this.created = created;
    this.room = room;
    this.ticketNo = ticketNo;
    this.title = title;
    this.description = description;
};

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

joinRoom = function( socket, room, username ) {
    socket.join( room );

    let time = getTimestamp();

    socket.to(room).emit('serverMessage', {
        room: room,
        timestamp: time,
        message: '<i>' + username + '</i> has joined the room.'
    });
    
    updateHistory( room, {
        timestamp: time,
        message: '<i>' + username + '</i> has joined the room.',
        serverMessage: true
    });

    socket.emit('serverMessage', {
        timestamp: time,
        message: 'Welcome, ' + username + ".",
        username: username,
        room: room,
        newRoom: room,
        chatHistory: chatHistory.get(room),
        queue: getTicketQueue()
    });
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
