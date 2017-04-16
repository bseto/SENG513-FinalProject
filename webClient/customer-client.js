var socket = io();
var myName = "";
var myID = "";
var myColor = '#000000';
var myNamespace = "";

$(function () {
   if ( Cookies.getJSON('profile') ) {
        myName = Cookies.getJSON('profile').username;
        myID = Cookies.getJSON('profile').userID;
        myColor = Cookies.getJSON('profile').color;
    }

    $( "#dialogPane" ).dialog({ autoOpen: false });

    logout = function() {
        console.log("Logging out...");
    };

    $( "#AccountSettingsBtn" ).button({
        label: "Account Settings"
    }).on("click", function() {
        $("#dialogPane").append(accountSettingsHTML);

        retrieveAccountSettings();

        $("#dialogPane").dialog({
            title: "Account Settings",
            autoOpen: false,
            height: 450,
            width: 360,
            modal: true,
            buttons: {
                "Confirm Changes": modifyAccountSettings(),
                Cancel: function() {
                    $( this ).dialog( "close" );
                    $("#dialogPane").empty();
                }
            },
            close: function() {
                $("#dialogPane").empty();
            }
        });

        $( "#dialogPane" ).dialog( "open" );
    });
    $( "#CreateTicketBtn" ).button({
        label: "Create Ticket"
    }).on("click", function() {
        $("#dialogPane").append(createTicketHTML);

        $("#dialogPane").dialog({
            title: "Create New Ticket",
            autoOpen: false,
            height: 450,
            width: 360,
            modal: true,
            buttons: {
                "Create a new ticket": onCreateTicketClicked,
                Cancel: function() {
                    $( this ).dialog( "close" );
                    $("#dialogPane").empty();
                }
            },
            close: function() {
                $("#dialogPane").empty();
            }
        });

        $( "#dialogPane" ).dialog( "open" );
    });   
    $( "#LogoutBtn" ).button({
        label: "Logout"
    }).on("click", logout);

    arrangeButtons = function() {
        let radius = 200;
        let fields = $('.field'), container = $('#buttonPanel'),
            width = container.width(), height = container.height(),
            angle = -0.5*Math.PI, step = (2*Math.PI) / fields.length;
        fields.each(function() {
            let x = Math.round(width/2 + radius * Math.cos(angle) - $(this).width()/2);
            let y = Math.round(height/2 + radius * Math.sin(angle) - $(this).height()/2);
            $(this).css({
                left: x + 'px',
                top: y + 'px'
            });
            angle += step;
        });
    }();

    onCreateTicketClicked = function() {
        $("#ticketName").removeClass( "ui-state-error" );

        let title = $("#ticketName").val();
        let description = $("#description").val();

        if ( title.length < 5 ) {
            $("#ticketName").addClass( "ui-state-error" );
            $(".validateTips").text("Your title must be at least 5 characters long").addClass( "ui-state-highlight" );
            setTimeout(function() {
                $(".validateTips").removeClass( "ui-state-highlight", 1500 );
            }, 250 );
            return false;
        }

        $("#confirmDialog").append('<p>Are you sure you want to submit this ticket?</p>');
        $("#confirmDialog").dialog({
            resizeable: false,
            height: "auto",
            width: 400,
            modal: true,
            buttons: {
                "Submit": function() {
                    $("#confirmDialog").empty();
                    $( this ).dialog("close");
                    createTicket( title, description );
                },
                Cancel: function() {
                    $("#confirmDialog").empty();
                    $( this ).dialog("close");
                }
            }
        });

    }

    createTicket = function( title, description ) {
        console.log("Creating new ticket...");

        socket.emit('submitTicket', {
            title: title,
            description: description
        });

        $("#dialogPane").dialog("close");
        $("#dialogPane").append(chatHTML);

        $("#textField").keyup(function (e) {
            if (e.keyCode == 13) {	
                sendMessage();
            }
        });

        $( "#dialogPane" ).dialog({
            title: "Resolving Ticket",
            autoOpen: false,
            height: 650,
            width: 530,
            modal: true,
            buttons: {
                Close: function() {
                    $( this ).dialog( "close" );
                    $("#dialogPane").empty();
                }
            },
            close: function() {
                $("#dialogPane").empty();
            }
        });

        $( "#dialogPane" ).dialog( "open" );
    };

//{Username, Password, Type, Color}
    retrieveAccountSettings = function () {
        console.log("Getting account settings...");
        socket.emit('retrieveAccountInfo', {
            userID: myID
        })
    }

    modifyAccountSettings = function() {
        console.log("Setting account settings...");
    }

    socket.on('connect', function (data) {
        socket.emit('connectRequest', Cookies.getJSON('profile'));
    });
    
    socket.on('message', function (data) {
        console.log(data);
        $('#messageList').append($('<li>').html(buildMessageString(data)));

        if ( $('#messageList').scrollTop() >= ( $('#messageList')[0].scrollHeight - $('#messageList').height() - 100 ) ) {
            $('#messageList').scrollTop($('#messageList')[0].scrollHeight);
        }
    });

    socket.on('serverMessage', function (data) {
        handleServerMessage(data);
    });

    buildMessageString = function (data) {
        let string = '';
        if (data.userId === socket.id || data.username == myName)
            string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: " + data.message + '</b>';
        else
            string = '<b>[' + data.timestamp + '] <font color="' + data.color + '">' + data.username + "</font>: </b>" + data.message;

        return string;
    };

    sendMessage = function () {
        socket.emit('message', {
            username: myName,
            userId: socket.id,
            color: myColor,
            namespace: myNamespace,
            message: $('#textField').val()
        });
        $('#textField').val('');
    };

    clearChatHistory = function() {
        $('#messageList').empty();
    };

    clearUserList = function() {
        $('#userList').empty();
    };

    handleServerMessage = function (data) {
        /*if (data.color) {
            myColor = data.color;
        }
        if (data.username) {
            myName = data.username;
        }
        if (data.namespace) {
            myNamespace = data.namespace;
        }
        if (data.userList) {
            clearUserList();
            for ( let user of data.userList ) {
                $('#userList').append($('<li>').html('<b><font color="' + user.color + '">' + user.username + '</font></b>'));
            }
        }
        if (data.chatHistory) {
            clearChatHistory();
            for ( let entry of data.chatHistory ) {
                if ( entry.serverMessage ) {
                    entry.username = 'Server';
                    entry.color = "red";
                    $('#messageList').append($('<li>').css('color', "red").html(buildMessageString(entry)));
                } else {
                    $('#messageList').append($('<li>').html(buildMessageString(entry)));
                }
            }
            $('#messageList').scrollTop($('#messageList')[0].scrollHeight);
        }
        if (data.message) {
            data.username = 'Server';
            data.color = "red";
            $('#messageList').append($('<li>').css('color', "red").html(buildMessageString(data)));
                if ( $('#messageList').scrollTop() >= ( $('#messageList')[0].scrollHeight - $('#messageList').height() - 100 ) ) {
                    $('#messageList').scrollTop($('#messageList')[0].scrollHeight);
                }
		    }
		    Cookies.set('profile', {
                username: myName,
                color: myColor,
                namespace: myNamespace
            });*/
	  };

      var accountSettingsHTML = '<div id="dialogContent"></div>'

      var createTicketHTML = '<div id="dialogContent"><div id="confirmDialog" title="Confirm"></div><p class="validateTips">You must at least provide a title.</p><form><fieldset><label for="ticketName">Title: </label><input type="text" name="ticketName" id="ticketName" placeholder="A descriptive title..." class="text ui-widget-content ui-corner-all" size="25" maxlength="40"><br><label for="description">Description: </label><br><textarea name="description" id="description" placeholder="Please be concise and clear" cols="35" rows="10" maxlength="600" class="ui-widget-content ui-corner-all"/></fieldset></form></div>';

      var chatHTML = '<div id="dialogContent" style="height: 100%"><div id="chat-content"><div id="messageArea"><ul id="messageList"></ul></div><div id="chat-controls"><textarea id="textField" placeholder="Enter text..."/></div></div></div>';

});
